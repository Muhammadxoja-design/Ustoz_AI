import { Router } from 'express';
import { prisma } from '../lib/prisma';
import multer from 'multer';

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } 
});

function requireAdminAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

router.use(requireAdminAuth);

router.get('/leaderboard', async (_req, res) => {
  try {
    const results = await prisma.result.findMany({
      include: {
        user: {
          include: { auditLogs: true }
        }
      }
    });

    const leaderboard = results.map(result => {
      const violations = result.user.auditLogs?.filter((log: any) => log.type === 'TAB_SWITCH').length || 0;
      const basePoints = result.score * 10;
      const speedBonus = Math.max(0, 300 - Math.round(result.timeSpentMs / 1000)); 
      const penalty = violations * 50; 
      const finalScore = basePoints + speedBonus - penalty;

      return {
        id: result.id,
        user: result.user.fullName,
        region: result.user.region,
        score: result.score,
        timeTaken: Math.round(result.timeSpentMs / 1000),
        violations,
        finalScore,
        status: result.user.status || 'ACTIVE',
        telegramId: result.user.telegramId.toString()
      };
    });

    leaderboard.sort((a, b) => b.finalScore - a.finalScore);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to build complex leaderboard' });
  }
});

router.get('/audit-logs', async (_req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    
    res.json(logs.map(log => ({
      id: log.id,
      user: log.user.fullName,
      action: log.type,
      createdAt: log.createdAt
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch telemetry logs' });
  }
});

router.post('/user/:id/status', async (req, res) => {
  try {
    const { status } = req.body; 
    if (!['ACTIVE', 'FROZEN', 'BANNED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status type' });
    }
    await prisma.user.update({
      where: { telegramId: BigInt(req.params.id) },
      data: { status }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute administrative action' });
  }
});

router.get('/export', async (_req, res) => {
  try {
    const results = await prisma.result.findMany({
      include: { user: true },
      orderBy: { score: 'desc' }
    });

    const header = ['ID', 'Telegram ID', 'Full Name', 'Phone', 'Age', 'Gender', 'Region', 'District', 'Raw Score %', 'Time Taken (ms)', 'Account Status', 'Date Tested'];
    const escapeCsv = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

    const rows = results.map(r => [
      r.id, r.user.telegramId.toString(), r.user.fullName, r.user.phone, r.user.age, r.user.gender, r.user.region, r.user.district, r.score, r.timeSpentMs, r.user.status || 'ACTIVE', r.completedAt.toISOString()
    ].map(escapeCsv).join(','));

    const csvContent = [header.join(','), ...rows].join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('Ustoz_AI_Database_Export.csv');
    res.send(csvContent);

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate CSV export' });
  }
});

router.post('/questions/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file attached to the request.' });
    }

    const { testId } = req.body;
    if (!testId) {
      return res.status(400).json({ error: 'Target Test ID must be provided to import questions.' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== '');
    
    if (rows.length === 0) return res.status(400).json({ error: 'CSV file is empty.' });

    const hasHeader = rows[0].toLowerCase().includes('text') || rows[0].toLowerCase().includes('question');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    let importedCount = 0;

    // Execute bulk insertion securely via Prisma Transaction.
    await prisma.$transaction(async (tx) => {
      for (const row of dataRows) {
        // Advanced CSV Regex
        const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches || matches.length < 6) continue;

        const clean = (str: string) => str.replace(/^"|"$/g, '').trim();
        
        const content = clean(matches[0]);
        // Construct the Json array exactly matching our React UI expectations
        const options = [
          { id: 'A', text: clean(matches[1]) },
          { id: 'B', text: clean(matches[2]) },
          { id: 'C', text: clean(matches[3]) },
          { id: 'D', text: clean(matches[4]) }
        ];
        const correctOption = clean(matches[5]); // 'A', 'B', 'C', or 'D'

        await tx.question.create({
          data: {
            testId: testId,
            content,
            options,
            correctOption,
            points: 1
          }
        });
        importedCount++;
      }
    });

    res.json({ success: true, count: importedCount });

  } catch (error) {
    console.error("Bulk Import error:", error);
    res.status(500).json({ error: 'Failed to parse and import CSV batch securely.' });
  }
});

export default router;
