import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { authenticate, requirePermissions, requireRoles } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { ALL_PERMISSION_KEYS, PermissionKey } from '../types/permissions';
import { parsePermissionList } from '../utils/tenant-access';

const router = Router();
const planSchema = z.object({
  code: z.string().min(2).regex(/^[A-Z0-9_]+$/),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  monthlyPrice: z.number().min(0),
  durationMonths: z.number().int().positive().default(1),
  maxPractitioners: z.number().int().positive(),
  maxAssistants: z.number().int().positive(),
  monthlyMessages: z.number().int().min(0),
  storageGb: z.number().int().min(0),
  permissions: z.array(z.string()).optional().nullable(),
  isActive: z.boolean().default(true),
});

router.use(authenticate, requireRoles('SUPER_ADMIN'), requirePermissions('MANAGE_CABINETS'));

const parsePermissions = parsePermissionList;

const normalizePermissions = (value: any): PermissionKey[] | null => {
  if (!value) return null;
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map(p => String(p).toUpperCase())
    .filter((p): p is PermissionKey => ALL_PERMISSION_KEYS.includes(p as PermissionKey));
  return normalized;
};

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await (prisma as any).plan.findMany({ where: { deletedAt: null }, orderBy: { monthlyPrice: 'asc' } });
    sendSuccess(res, plans.map((p: any) => ({
      ...p,
      permissions: parsePermissions(p.permissions),
    })));
  } catch (err) { next(err); }
});
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = planSchema.parse(req.body);
    const permissions = normalizePermissions(parsed.permissions);
    const created = await (prisma as any).plan.create({
      data: { ...parsed, permissions: permissions ? JSON.stringify(permissions) : null },
    });
    sendSuccess(res, { ...created, permissions: parsePermissions(created.permissions) }, 'Plan créé', undefined, 201);
  } catch (err) { next(err); }
});
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = planSchema.partial().parse(req.body);
    const permissions = data.permissions === undefined ? undefined : normalizePermissions(data.permissions);
    const updated = await (prisma as any).plan.update({
      where: { id: req.params.id },
      data: { ...data, permissions: permissions === undefined ? undefined : permissions ? JSON.stringify(permissions) : null },
    });
    sendSuccess(res, { ...updated, permissions: parsePermissions(updated.permissions) }, 'Plan mis à jour');
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await (prisma as any).plan.findUnique({ where: { id: req.params.id }, select: { code: true } });
    if (!plan) return res.status(404).json({ error: 'Plan introuvable' });
    const cabinetsUsingPlan = await prisma.cabinet.count({ where: { plan: plan.code, deletedAt: null } });
    if (cabinetsUsingPlan > 0) return res.status(409).json({ error: 'Ce plan est utilisé par un ou plusieurs cabinets' });
    await (prisma as any).plan.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
    sendSuccess(res, null, 'Plan supprimé');
  } catch (err) { next(err); }
});

export default router;
