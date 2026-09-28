import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();

router.use(authenticate, requireRoles('SUPER_ADMIN'));

/** Platform-wide audit log with user and cabinet names, newest first, cursor-paginated. */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({
      cabinetId: z.string().optional(),
      userId: z.string().optional(),
      method: z.string().optional(),
      search: z.string().optional(),
      failed: z.enum(['true', 'false']).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      cursor: z.string().optional(),
      take: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(req.query);

    const where: any = {};
    if (q.cabinetId) where.cabinetId = q.cabinetId;
    if (q.userId) where.userId = q.userId;
    if (q.method) where.method = q.method;
    if (q.search) where.OR = [{ action: { contains: q.search } }, { path: { contains: q.search } }];
    if (q.failed === 'true') where.status = { gte: 400 };
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(`${q.from}T00:00:00`);
      if (q.to) where.createdAt.lte = new Date(`${q.to}T23:59:59.999`);
    }

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.take;
    const items = rows.slice(0, q.take);

    const userIds = [...new Set(items.map(item => item.userId).filter(Boolean) as string[])];
    const cabinetIds = [...new Set(items.map(item => item.cabinetId).filter(Boolean) as string[])];
    const [users, cabinets] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, email: true, role: true } }),
      prisma.cabinet.findMany({ where: { id: { in: cabinetIds } }, select: { id: true, name: true } }),
    ]);
    const userById = new Map(users.map(user => [user.id, user]));
    const cabinetById = new Map(cabinets.map(cabinet => [cabinet.id, cabinet.name]));

    sendSuccess(res, {
      items: items.map(item => ({
        ...item,
        user: item.userId ? userById.get(item.userId) || null : null,
        cabinetName: item.cabinetId ? cabinetById.get(item.cabinetId) || null : null,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (err) { next(err); }
});

export default router;
