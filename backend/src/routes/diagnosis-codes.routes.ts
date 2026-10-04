import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../config/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { parseDiagnosisFile } from '../services/diagnosis-codes';

// ICD-10 list shared by every cabinet, completed by the Super Admin (the cabinets search it through /cabinets/:id/diagnosis-codes).
const router = Router();
router.use(authenticate, requireRoles('SUPER_ADMIN'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, { count: await prisma.diagnosisCode.count() });
  } catch (err) { next(err); }
});

/** Adds the codes of the file and updates the labels of existing ones (nothing is removed). */
router.post('/import', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('Choisissez un fichier Excel ou CSV', 400);
    let codes;
    try { codes = await parseDiagnosisFile(req.file.buffer, req.file.originalname); } catch (err: any) {
      throw new AppError(/zip|central directory/i.test(err.message) ? 'Fichier illisible : enregistrez-le au format Excel (.xlsx) ou CSV.' : err.message, 400);
    }
    if (!codes.length) throw new AppError('Aucun code CIM-10 valide dans le fichier', 400);
    const existing = new Set((await prisma.diagnosisCode.findMany({ select: { code: true } })).map(c => c.code));
    const fresh = codes.filter(c => !existing.has(c.code));
    for (let i = 0; i < fresh.length; i += 1000) await prisma.diagnosisCode.createMany({ data: fresh.slice(i, i + 1000), skipDuplicates: true });
    const updates = codes.filter(c => existing.has(c.code));
    for (let i = 0; i < updates.length; i += 200) {
      await prisma.$transaction(updates.slice(i, i + 200).map(c => prisma.diagnosisCode.update({ where: { code: c.code }, data: { label: c.label, ...(c.chapter ? { chapter: c.chapter } : {}) } })));
    }
    sendSuccess(res, { added: fresh.length, updated: updates.length }, `${fresh.length} code(s) ajouté(s), ${updates.length} mis à jour`);
  } catch (err) { next(err); }
});

export default router;
