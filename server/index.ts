import 'dotenv/config';
// Handle BigInt serialization globally for JSON.stringify
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { bot } from '../src/bot';
import { webhookCallback } from 'grammy';
import quizRoutes from './routes/quiz';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(cors());
app.use(express.json());

// API Routes — must match frontend /api/v1/* paths
app.use('/api/v1/quiz', quizRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadRoutes);

// Telegram Bot Webhook (Production Only)
if (process.env.NODE_ENV === 'production') {
  app.use('/api/v1/bot', webhookCallback(bot, 'express'));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve uploads
const uploadsPath = path.join(__dirname, '../server/uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve static files from the Vite build
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Self-pinging logic to keep the service awake on Render
const keepAlive = (url: string) => {
  if (!url) return;
  console.log(`[Keep-Alive] Starting self-ping for: ${url}`);
  setInterval(async () => {
    try {
      const res = await fetch(`${url}/health`);
      console.log(`[Keep-Alive] Pinged ${url}/health: ${res.status}`);
    } catch (err) {
      console.error(`[Keep-Alive] Ping failed:`, err);
    }
  }, 10 * 60 * 1000); // Every 10 minutes
};

app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // Set up Telegram Webhook in production
  if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    try {
      const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/api/v1/bot`;
      await bot.api.setWebhook(webhookUrl);
      console.log(`🤖 Telegram Webhook set to: ${webhookUrl}`);
    } catch (err) {
      console.error('Failed to set Telegram Webhook:', err);
    }
  }

  // Activate keep-alive if RENDER_EXTERNAL_URL is set
  if (process.env.RENDER_EXTERNAL_URL) {
    keepAlive(process.env.RENDER_EXTERNAL_URL);
  }
});
