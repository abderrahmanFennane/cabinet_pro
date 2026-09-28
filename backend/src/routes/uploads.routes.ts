import express, { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate, requirePermissions, requireRoles } from '../middleware/auth';
import { sendError, sendSuccess } from '../utils/response';

const router = express.Router();

type MulterRequest = Request & { file?: Express.Multer.File };

const storage = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const kind = String(req.params.kind || '').trim();
    if (!kind) return cb(new Error('kind requis'), '');

    const owner = kind === 'logos'
      ? (req.user?.cabinetId || 'unknown')
      : kind === 'business-logos'
        ? 'global'
        : (req.user?.role === 'SUPER_ADMIN' ? 'global' : (req.user?.cabinetId || 'unknown'));
    const dest = path.join(process.cwd(), 'uploads', kind, owner);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];

    if (allowedTypes.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Format image non supporté. Utilisez JPG, PNG ou SVG.'));
  },
});

router.post(
  '/:kind',
  authenticate,
  requireRoles('OWNER', 'SUPER_ADMIN'),
  (req, res, next) => {
    const kind = String(req.params.kind || '').trim();
    if (kind === 'logos') {
      if (req.user?.role !== 'OWNER') return res.status(403).json({ error: 'Permissions insuffisantes' });
      return requirePermissions('MANAGE_SETTINGS')(req, res, next);
    }
    if (kind === 'business-logos') {
      if (req.user?.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Permissions insuffisantes' });
      return next();
    }
    return res.status(400).json({ error: 'kind invalide' });
  },
  upload.single('file'),
  (req, res) => {
    const file = (req as MulterRequest).file;
    if (!file) return sendError(res, 'Fichier manquant', 400);

    const kind = String(req.params.kind || '').trim();
    const owner = kind === 'logos'
      ? (req.user?.cabinetId || 'unknown')
      : kind === 'business-logos'
        ? 'global'
        : (req.user?.role === 'SUPER_ADMIN' ? 'global' : (req.user?.cabinetId || 'unknown'));
    const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
    const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    const base = `${proto}://${host}`;
    const url = `${base}/uploads/${kind}/${owner}/${file.filename}`;
    return sendSuccess(res, { url });
  }
);

export default router;
