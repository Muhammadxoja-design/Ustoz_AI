import { Router } from 'express';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import Papa from 'papaparse';

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// =============================================================================
// Admin Auth Middleware — uses ADMIN_SECRET_TOKEN from .env
// Frontend must send: Authorization: Bearer <token>
// =============================================================================
const ADMIN_TOKEN = process.env.ADMIN_SECRET_TOKEN || 'ustoz-admin-2026';

function requireAdminAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  const token = authHeader.replace('Bearer ', '');
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ message: 'Forbidden: Invalid admin token' });
  }
  next();
}

router.use(requireAdminAuth);

// =============================================================================
// TEST MANAGEMENT — Full CRUD
// =============================================================================

// GET /tests — List all tests
router.get('/tests', async (_req, res) => {
  try {
    const tests = await prisma.test.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { questions: true, results: true } }
      }
    });
    res.json(tests);
  } catch (error) {
    console.error("List tests error:", error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

// POST /tests — Create new test
router.post('/tests', async (req, res) => {
  try {
    const { title, subject, description, startDate, endDate, timeLimitMs } = req.body;

    if (!title || !subject || !startDate || !endDate || !timeLimitMs) {
      return res.status(400).json({ error: 'Missing required fields: title, subject, startDate, endDate, timeLimitMs' });
    }

    const test = await prisma.test.create({
      data: {
        title,
        subject,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        timeLimitMs: parseInt(timeLimitMs, 10),
      }
    });

    res.json(test);
  } catch (error) {
    console.error("Create test error:", error);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

// PUT /tests/:id — Update test
router.put('/tests/:id', async (req, res) => {
  try {
    const { title, subject, description, startDate, endDate, timeLimitMs } = req.body;

    const test = await prisma.test.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(subject && { subject }),
        ...(description !== undefined && { description }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(timeLimitMs && { timeLimitMs: parseInt(timeLimitMs, 10) }),
      }
    });

    res.json(test);
  } catch (error) {
    console.error("Update test error:", error);
    res.status(500).json({ error: 'Failed to update test' });
  }
});

// DELETE /tests/:id — Delete test (cascades questions + results)
router.delete('/tests/:id', async (req, res) => {
  try {
    await prisma.test.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete test error:", error);
    res.status(500).json({ error: 'Failed to delete test' });
  }
});

// =============================================================================
// LEADERBOARD
// =============================================================================
router.get('/leaderboard', async (_req, res) => {
  try {
    const results = await prisma.result.findMany({
      include: {
        user: {
          include: { auditLogs: true }
        },
        test: { select: { title: true } }
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
        telegramId: result.user.telegramId.toString(),
        testTitle: result.test?.title || 'N/A'
      };
    });

    leaderboard.sort((a, b) => b.finalScore - a.finalScore);
    res.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: 'Failed to build complex leaderboard' });
  }
});

// =============================================================================
// AUDIT LOGS
// =============================================================================
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
      description: log.description,
      createdAt: log.createdAt
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch telemetry logs' });
  }
});

// =============================================================================
// USER STATUS MANAGEMENT
// =============================================================================
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

// =============================================================================
// CSV EXPORT
// =============================================================================
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

// =============================================================================
// QUESTION BULK IMPORT — now requires testId in the form body
// =============================================================================
router.post('/questions/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file attached to the request.' });
    }

    const { testId } = req.body;
    if (!testId) {
      return res.status(400).json({ error: 'Target Test ID must be provided to import questions.' });
    }

    // Verify the test exists
    const testExists = await prisma.test.findUnique({ where: { id: testId } });
    if (!testExists) {
      return res.status(404).json({ error: 'Test not found with the provided ID.' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const parsed = Papa.parse<string[]>(csvContent, { 
      header: false, 
      skipEmptyLines: true 
    });

    if (parsed.errors.length > 0) {
      console.warn("CSV parsing warnings:", parsed.errors);
    }

    const rows = parsed.data;
    if (rows.length === 0) return res.status(400).json({ error: 'CSV file is empty.' });

    // Check if first row is header
    const firstRowStr = rows[0].join(' ').toLowerCase();
    const hasHeader = firstRowStr.includes('text') || firstRowStr.includes('question') || firstRowStr.includes('option');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    let importedCount = 0;
    let errors: string[] = [];

    // Execute bulk insertion securely via Prisma Transaction.
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = hasHeader ? i + 2 : i + 1;

        if (row.length < 6) {
          errors.push(`Row ${rowNum}: Not enough columns (expected at least 6).`);
          continue;
        }

        const content = row[0].trim();
        const options = [
          { id: 'A', text: row[1].trim() },
          { id: 'B', text: row[2].trim() },
          { id: 'C', text: row[3].trim() },
          { id: 'D', text: row[4].trim() }
        ];
        const correctOption = row[5].trim().toUpperCase();

        if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
          errors.push(`Row ${rowNum}: Invalid correct option "${row[5]}". Must be A, B, C, or D.`);
          continue;
        }

        await tx.question.create({
          data: {
            testId: testId,
            type: 'RADIO', // Default for CSV
            content,
            options,
            correctOption,
            points: 1
          }
        });
        importedCount++;
      }
    });

    res.json({ success: true, count: importedCount, errors });

  } catch (error) {
    console.error("Bulk Import error:", error);
    res.status(500).json({ error: 'Failed to parse and import CSV batch securely.' });
  }
});

// =============================================================================
// QUESTION MANAGEMENT (CRUD)
// =============================================================================

// GET /tests/:testId/questions — List questions for a test
router.get('/tests/:testId/questions', async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      where: { testId: req.params.testId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /questions — Create single question
router.post('/questions', async (req, res) => {
  try {
    const { testId, type, content, mediaUrl, options, correctOption, points } = req.body;
    if (!testId || !content || !correctOption) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const question = await prisma.question.create({
      data: { testId, type: type || 'RADIO', content, mediaUrl, options: options || [], correctOption, points: points || 1 }
    });
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// PUT /questions/:id — Update single question
router.put('/questions/:id', async (req, res) => {
  try {
    const { type, content, mediaUrl, options, correctOption, points } = req.body;
    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        ...(type && { type }),
        ...(content && { content }),
        ...(mediaUrl !== undefined && { mediaUrl }),
        ...(options && { options }),
        ...(correctOption !== undefined && { correctOption }),
        ...(points !== undefined && { points })
      }
    });
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE /questions/:id — Delete single question
router.delete('/questions/:id', async (req, res) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// =============================================================================
// DASHBOARD STATS
// =============================================================================
router.get('/stats', async (_req, res) => {
  try {
    const [userCount, testCount, resultCount] = await Promise.all([
      prisma.user.count(),
      prisma.test.count(),
      prisma.result.count()
    ]);
    res.json({ users: userCount, tests: testCount, results: resultCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
