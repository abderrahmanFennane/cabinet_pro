import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { copyDefaultActs } from '../services/cabinet-setup';

// Specialty catalogue and default act catalogues (F-SA-02).
const router = Router();

/** Public: specialties offered at sign-up. */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.specialty.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }));
  } catch (err) { next(err); }
});

router.use(authenticate, requireRoles('SUPER_ADMIN'));

router.patch('/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ isActive: z.boolean().optional(), name: z.string().trim().min(1).optional() }).parse(req.body);
    sendSuccess(res, await prisma.specialty.update({ where: { code: req.params.code }, data }), 'Spécialité mise à jour');
  } catch (err) { next(err); }
});

const defaultActSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1),
  price: z.number().min(0),
  category: z.string().default('AUTRE'),
  scope: z.enum(['NONE', 'TOOTH', 'TEETH', 'QUADRANT', 'MOUTH']).default('NONE'),
  usesFaces: z.boolean().default(false),
  resultingState: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

router.get('/:code/default-acts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await prisma.defaultAct.findMany({ where: { specialty: req.params.code }, orderBy: [{ category: 'asc' }, { code: 'asc' }] }));
  } catch (err) { next(err); }
});

router.post('/:code/default-acts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = defaultActSchema.parse(req.body);
    sendSuccess(res, await prisma.defaultAct.create({ data: { ...data, specialty: req.params.code } }), 'Acte ajouté', undefined, 201);
  } catch (err) { next(err); }
});

router.patch('/:code/default-acts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = defaultActSchema.partial().parse(req.body);
    const act = await prisma.defaultAct.findFirst({ where: { id: req.params.id, specialty: req.params.code } });
    if (!act) throw new AppError('Acte introuvable', 404);
    sendSuccess(res, await prisma.defaultAct.update({ where: { id: act.id }, data }), 'Acte mis à jour');
  } catch (err) { next(err); }
});

router.delete('/:code/default-acts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.defaultAct.deleteMany({ where: { id: req.params.id, specialty: req.params.code } });
    sendSuccess(res, null, 'Acte supprimé');
  } catch (err) { next(err); }
});

/** Adds the missing default acts of this specialty to a cabinet's catalogue. */
router.post('/:code/default-acts/copy-to/:cabinetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const added = await prisma.$transaction(tx => copyDefaultActs(tx, req.params.cabinetId, req.params.code));
    sendSuccess(res, { added }, `${added} acte(s) ajouté(s)`);
  } catch (err) { next(err); }
});

export default router;
