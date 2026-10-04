import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../config/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { parseDrugWorkbook, replaceDrugs } from '../services/drugs';

// National medicine list, managed by the Super Admin (the cabinets search it through /cabinets/:id/drugs).
const router = Router();
router.use(authenticate, requireRoles('SUPER_ADMIN'));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [count, generics, last] = await Promise.all([
      prisma.drug.count(),
      prisma.drug.count({ where: { generic: true } }),
      prisma.drug.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ]);
    sendSuccess(res, { count, generics, updatedAt: last?.updatedAt ?? null });
  } catch (err) { next(err); }
});

/** Replaces the list with a newer reference file (XLSX, same columns as the CNOPS / DMP file). */
router.post('/import', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('Choisissez un fichier Excel (.xlsx)', 400);
    let rows;
    try { rows = await parseDrugWorkbook(req.file.buffer); } catch (err: any) {
      throw new AppError(/zip|central directory/i.test(err.message) ? 'Ce fichier n’est pas un fichier Excel (.xlsx).' : `Fichier illisible : ${err.message}`, 400);
    }
    if (rows.length < 100) throw new AppError(`Seulement ${rows.length} médicament(s) trouvés : vérifiez le fichier.`, 400);
    const count = await replaceDrugs(prisma, rows);
    sendSuccess(res, { count }, `${count} médicaments importés`);
  } catch (err) { next(err); }
});

export default router;
