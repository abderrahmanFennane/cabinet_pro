import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { requireMedicalAccess } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { sendSuccess } from '../../utils/response';
import { findPatientOr404, logPatientAccess } from '../../utils/patient-scope';
import { parseTeeth } from '../../utils/dental';

// Mounted at /api/cabinets/:cabinetId/patients/:patientId/attachments.
// Medical files live outside the public /uploads folder and are only streamed through this route.
const router = Router({ mergeParams: true });
router.use(requireMedicalAccess);

export const PRIVATE_ROOT = path.join(process.cwd(), 'private-uploads');
const MAX_BYTES = Number(process.env.ATTACHMENT_MAX_MB || 20) * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(PRIVATE_ROOT, req.params.cabinetId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname || '').toLowerCase()}`),
  }),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new AppError('Format non supporté : JPG, PNG, WEBP ou PDF', 400));
  },
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    sendSuccess(res, await prisma.attachment.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' } }));
  } catch (err) { next(err); }
});

router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  const file = req.file;
  try {
    const patient = await findPatientOr404(req);
    if (!file) throw new AppError('Fichier manquant', 400);
    const data = z.object({ type: z.enum(['XRAY', 'LAB', 'REPORT', 'PHOTO', 'OTHER']).default('OTHER'), title: z.string().max(190).optional(), teeth: z.string().optional() }).parse(req.body);
    let teeth: number[] = [];
    try { teeth = parseTeeth(data.teeth); } catch (err: any) { throw new AppError(err.message, 400); }
    const attachment = await prisma.attachment.create({
      data: {
        cabinetId: req.params.cabinetId, patientId: patient.id, type: data.type, title: data.title || null,
        fileName: file.originalname.slice(0, 190), storedName: file.filename, mimeType: file.mimetype, size: file.size,
        teeth: teeth.length ? teeth.join(',') : null, uploadedById: req.user!.id,
      },
    });
    sendSuccess(res, attachment, 'Fichier ajouté', undefined, 201);
  } catch (err) {
    if (file) fs.rm(file.path, () => undefined);
    next(err);
  }
});

router.get('/:id/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const attachment = await prisma.attachment.findFirst({ where: { id: req.params.id, patientId: patient.id } });
    if (!attachment) throw new AppError('Fichier introuvable', 404);
    await logPatientAccess(req, patient.id, 'VIEW_MEDICAL', `fichier ${attachment.fileName}`);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path.join(PRIVATE_ROOT, attachment.cabinetId, attachment.storedName));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await findPatientOr404(req);
    const attachment = await prisma.attachment.findFirst({ where: { id: req.params.id, patientId: patient.id } });
    if (!attachment) throw new AppError('Fichier introuvable', 404);
    await prisma.attachment.delete({ where: { id: attachment.id } });
    fs.rm(path.join(PRIVATE_ROOT, attachment.cabinetId, attachment.storedName), () => undefined);
    sendSuccess(res, null, 'Fichier supprimé');
  } catch (err) { next(err); }
});

export default router;
