import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../server/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure local storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max for videos/audio
});

// GET /uploads/:filename - served statically in index.ts, but we keep this router for POST

router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Return the URL to access the file
    // Assumes backend is served at root, or proxy is set up
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

export default router;
