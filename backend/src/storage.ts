import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const timestamp = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      cb(null, `${timestamp}-${safe}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export function getPublicPhotoPath(filename: string): string {
  return `/uploads/${filename}`;
}


