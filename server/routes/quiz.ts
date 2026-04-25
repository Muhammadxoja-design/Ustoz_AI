import { Router } from 'express';
import { prisma } from '../lib/prisma';
import Redis from 'ioredis';
import crypto from 'crypto';

const router = Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
redis.on('error', (err) => {
  console.error('[ioredis] Redis Error:', err.message);
});
const BOT_TOKEN = process.env.BOT_TOKEN || '';

// =============================================================================
// PUBLIC ENDPOINT — No auth required
// Returns the next/current active test info for WaitingRoom and Dashboard
// =============================================================================
router.get('/active-test', async (_req, res) => {
  try {
    const now = new Date();
    
    // First check for a currently active test
    let test = await prisma.test.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { startDate: 'asc' },
      select: { 
        id: true, title: true, subject: true, description: true,
        startDate: true, endDate: true, timeLimitMs: true,
        _count: { select: { questions: true } }
      }
    });

    if (test) {
      return res.json({ status: 'active', test });
    }

    // Otherwise, find the next upcoming test
    test = await prisma.test.findFirst({
      where: { startDate: { gt: now } },
      orderBy: { startDate: 'asc' },
      select: { 
        id: true, title: true, subject: true, description: true,
        startDate: true, endDate: true, timeLimitMs: true,
        _count: { select: { questions: true } }
      }
    });

    if (test) {
      return res.json({ status: 'upcoming', test });
    }

    // No tests found
    res.json({ status: 'none', test: null });
  } catch (error) {
    console.error("Active test fetch error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =============================================================================
// AUTH ENDPOINT — Check if user is registered and return profile
// =============================================================================
router.get('/me', async (req, res) => {
  try {
    const authUser = getTelegramUserFromToken(req);
    if (!authUser) return res.status(401).json({ message: 'Unauthorized' });

    const user = await prisma.user.findUnique({ 
      where: { telegramId: authUser.telegramId },
      include: {
        _count: { select: { results: true } }
      }
    });
    
    if (!user) {
      return res.json({ registered: false });
    }

    res.json({ registered: true, user });
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =============================================================================
// PRODUCTION-GRADE Telegram initData Verification (HMAC-SHA256)
// Prevents any non-Telegram client (Postman, curl, scripts) from accessing APIs.
// =============================================================================
function getTelegramUserFromToken(req: any): { telegramId: bigint; username?: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const initData = authHeader.replace('Bearer ', '');
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (expectedHash !== hash) return null;

    const userJson = params.get('user');
    if (!userJson) return null;

    const user = JSON.parse(userJson);
    return { telegramId: BigInt(user.id), username: user.username };
  } catch {
    return null;
  }
}

router.get('/questions', async (req, res) => {
  try {
    const authUser = getTelegramUserFromToken(req);
    if (!authUser) return res.status(401).json({ message: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { telegramId: authUser.telegramId } });
    if (!user) return res.status(404).json({ message: 'User not registered. Please register via the bot first.' });

    if (user.status === 'BANNED') {
      return res.status(403).json({ message: 'Your account has been banned. Contact support.' });
    }
    if (user.status === 'FROZEN') {
      return res.status(403).json({ message: 'Your account is temporarily frozen. Contact an administrator.' });
    }

    const activeTest = await prisma.test.findFirst({
      where: { startDate: { lte: new Date() }, endDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' }
    });

    if (!activeTest) return res.status(404).json({ message: 'No active test available at this time.' });

    const existingResult = await prisma.result.findUnique({
      where: { userId_testId: { userId: user.id, testId: activeTest.id } }
    });

    if (existingResult) {
      return res.status(403).json({ message: 'You have already completed this stage. Check the leaderboard for your score.' });
    }

    const questions = await prisma.question.findMany({
      where: { testId: activeTest.id },
      select: { id: true, type: true, content: true, mediaUrl: true, options: true }
    });

    const timeLimitSecs = Math.floor(activeTest.timeLimitMs / 1000);
    await redis.setex(`quiz_start:${user.id}:${activeTest.id}`, timeLimitSecs + 120, Date.now().toString());

    res.json({ testId: activeTest.id, timeLimit: timeLimitSecs, questions });
  } catch (error) {
    console.error("Quiz fetch error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const authUser = getTelegramUserFromToken(req);
    if (!authUser) return res.status(401).json({ message: 'Unauthorized' });

    const { testId, answers } = req.body;
    if (!testId || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'Invalid submission payload.' });
    }

    const user = await prisma.user.findUnique({ where: { telegramId: authUser.telegramId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const startTimeStr = await redis.get(`quiz_start:${user.id}:${testId}`);
    if (!startTimeStr) {
      return res.status(400).json({ message: 'Quiz session expired or already submitted.' });
    }

    const timeTakenMs = Date.now() - parseInt(startTimeStr, 10);
    const minimumPossibleTimeMs = answers.length * 1500;

    if (timeTakenMs < minimumPossibleTimeMs) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          type: 'FAST_ANSWER',
          description: `Speed anomaly: ${timeTakenMs}ms for ${answers.length} questions.`,
          metadata: { answers }
        }
      });
      return res.status(403).json({ message: 'Security alert: anomalous submission speed detected.' });
    }

    // Atomic delete — if it fails, do not grade
    await redis.del(`quiz_start:${user.id}:${testId}`);

    const questionIds = answers.map((a: any) => a.questionId);
    const dbQuestions = await prisma.question.findMany({
      where: { id: { in: questionIds }, testId: testId },
      select: { id: true, correctOption: true, points: true, type: true }
    });

    let score = 0;
    const answerRecords: any[] = [];

    for (const answer of answers) {
      const q = dbQuestions.find(dbq => dbq.id === answer.questionId);
      if (q) {
        let isCorrect: boolean | null = false;
        let pointsAwarded = 0;
        
        // Auto-grade logic based on type
        if (q.type === 'RADIO' || q.type === 'TRUE_FALSE') {
          isCorrect = q.correctOption === answer.selectedOption;
        } else if (q.type === 'TEXT' || q.type === 'RANGE') {
          // Normalize text to ignore case and spaces
          isCorrect = q.correctOption.trim().toLowerCase() === String(answer.selectedOption).trim().toLowerCase();
        } else if (q.type === 'VOICE' || q.type === 'DRAWING') {
          // Can't auto grade, or default to correct for participation?
          // Let's set points to 0 for now and isCorrect to null (manual grading pending)
          isCorrect = null;
        }

        if (isCorrect === true) {
          pointsAwarded = q.points;
          score += q.points;
        }

        answerRecords.push({
          questionId: q.id,
          value: String(answer.selectedOption),
          isCorrect,
          pointsAwarded
        });
      }
    }

    // Count any accrued tab-switch penalties for this session
    const penaltyLogs = await prisma.auditLog.count({
      where: { userId: user.id, type: 'TAB_SWITCH', createdAt: { gte: new Date(Date.now() - timeTakenMs - 5000) } }
    });
    const penaltyPts = penaltyLogs * 5; // 5 points deducted per violation

    await prisma.$transaction(async (tx) => {
      const result = await tx.result.create({
        data: { userId: user.id, testId, score, timeSpentMs: timeTakenMs, penaltyPts }
      });
      if (answerRecords.length > 0) {
        await tx.answer.createMany({
          data: answerRecords.map(a => ({ ...a, resultId: result.id }))
        });
      }
    });

    res.json({ success: true, score, penaltyPts });
  } catch (error) {
    console.error("Quiz submit error:", error);
    res.status(500).json({ message: 'Server error during submission grading' });
  }
});

// ===================================================
// POST /penalty — Receives Anti-Cheat violations
// ===================================================
router.post('/penalty', async (req, res) => {
  try {
    const authUser = getTelegramUserFromToken(req);
    if (!authUser) return res.status(401).json({ message: 'Unauthorized' });

    const { testId, reason, timestamp } = req.body;
    if (!testId || !reason) return res.status(400).json({ message: 'Invalid penalty payload.' });

    const user = await prisma.user.findUnique({ where: { telegramId: authUser.telegramId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        type: 'TAB_SWITCH',
        description: `Anti-cheat: ${reason} during test ${testId}.`,
        metadata: { testId, reason, clientTimestamp: timestamp }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Penalty logging error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// =============================================================
// GET /leaderboard/overall — Aggregate Cross-Stage Leaderboard
// (Determines the 7-stage Telegram Premium prize winners)
// =============================================================
router.get('/leaderboard/overall', async (req, res) => {
  try {
    const authUser = getTelegramUserFromToken(req);
    if (!authUser) return res.status(401).json({ message: 'Unauthorized' });

    // Aggregate all results per user across every stage, applying penalty deductions
    const aggregated = await prisma.result.groupBy({
      by: ['userId'],
      _sum: { score: true, penaltyPts: true },
      _min: { timeSpentMs: true }, // Best (lowest) total time is the tiebreaker
      orderBy: { _sum: { score: 'desc' } }
    });

    const enriched = await Promise.all(
      aggregated.map(async (row) => {
        const user = await prisma.user.findUnique({
          where: { id: row.userId },
          select: { fullName: true, region: true, status: true }
        });
        const netScore = (row._sum.score || 0) - (row._sum.penaltyPts || 0);
        return {
          userId: row.userId,
          fullName: user?.fullName,
          region: user?.region,
          status: user?.status,
          totalScore: netScore,
          fastestTimeMs: row._min.timeSpentMs
        };
      })
    );

    // Sort descending by score, break ties by ascending time
    enriched.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return (a.fastestTimeMs || 0) - (b.fastestTimeMs || 0);
    });

    // Top 3 are the Telegram Premium prize winners
    const winners = enriched.slice(0, 3).map((u, idx) => ({ ...u, prizeRank: idx + 1 }));
    res.json({ leaderboard: enriched, winners });
  } catch (error) {
    console.error("Overall leaderboard error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
