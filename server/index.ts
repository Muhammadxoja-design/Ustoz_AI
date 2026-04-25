import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  // Start the Telegram Bot
  import('../src/bot').catch(err => {
    console.error('Failed to start Telegram Bot:', err);
  });
});
