import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { sendSuccess } from '../utils/response';
import { createInboxMessage, providerStatus, sendMessage } from '../services/messaging';

const router = Router();

router.use(authenticate);

// ---- Inbox (any signed-in user; cabinet owners receive plan alerts and Super Admin messages) ----

router.get('/inbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where = { toUserId: req.user!.id, channel: 'IN_APP' };
    const [items, unread] = await Promise.all([
      prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.message.count({ where: { ...where, readAt: null } }),
    ]);
    sendSuccess(res, { items, unread });
  } catch (err) { next(err); }
});

router.post('/inbox/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.message.updateMany({ where: { toUserId: req.user!.id, channel: 'IN_APP', readAt: null }, data: { readAt: new Date() } });
    sendSuccess(res, { ok: true });
  } catch (err) { next(err); }
});

router.post('/inbox/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.message.updateMany({ where: { id: req.params.id, toUserId: req.user!.id }, data: { readAt: new Date() } });
    sendSuccess(res, { ok: true });
  } catch (err) { next(err); }
});

// ---- Cabinet reminder log (cabinet owner or Super Admin) ----

router.get('/cabinet/:cabinetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cabinetId } = req.params;
    if (req.user!.role !== 'SUPER_ADMIN' && !(req.user!.role === 'OWNER' && req.user!.cabinetId === cabinetId)) {
      throw new AppError('Accès non autorisé', 403);
    }
    const items = await prisma.message.findMany({
      where: { cabinetId, kind: 'APPOINTMENT_REMINDER' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

// ---- Super Admin ----

router.get('/providers', requireRoles('SUPER_ADMIN'), (_req: Request, res: Response) => {
  sendSuccess(res, providerStatus());
});

router.get('/', requireRoles('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.object({
      kind: z.string().optional(),
      status: z.string().optional(),
      channel: z.string().optional(),
      cabinetId: z.string().optional(),
    }).parse(req.query);
    const where: any = {};
    if (q.kind) where.kind = q.kind;
    if (q.status) where.status = q.status;
    if (q.channel) where.channel = q.channel;
    else where.channel = { in: ['SMS', 'WHATSAPP'] };
    if (q.cabinetId) where.cabinetId = q.cabinetId;

    const [items, grouped] = await Promise.all([
      prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }),
      prisma.message.groupBy({ by: ['status'], where: { channel: { in: ['SMS', 'WHATSAPP'] } }, _count: { _all: true } }),
    ]);
    const cabinetIds = [...new Set(items.map(item => item.cabinetId).filter(Boolean) as string[])];
    const cabinets = await prisma.cabinet.findMany({ where: { id: { in: cabinetIds } }, select: { id: true, name: true } });
    const cabinetName = new Map(cabinets.map(cabinet => [cabinet.id, cabinet.name]));
    sendSuccess(res, {
      items: items.map(item => ({ ...item, cabinetName: item.cabinetId ? cabinetName.get(item.cabinetId) || null : null })),
      counts: Object.fromEntries(grouped.map(group => [group.status, group._count._all])),
    });
  } catch (err) { next(err); }
});

const sendSchema = z.object({
  cabinetIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
  subject: z.string().max(120).optional().nullable(),
  body: z.string().min(1, 'Message requis').max(1000),
  channels: z.array(z.enum(['IN_APP', 'SMS', 'WHATSAPP'])).min(1, 'Choisissez au moins un canal'),
});

/** Super Admin -> cabinet owners. Every copy carries the sender's name and phone. */
router.post('/', requireRoles('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = sendSchema.parse(req.body);
    if (!data.all && !data.cabinetIds?.length) throw new AppError('Choisissez au moins un cabinet', 400);

    const sender = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, firstName: true, lastName: true, phone: true } });
    const settings = await prisma.appSettings.findUnique({ where: { id: 'global' } });
    const fromName = `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || settings?.businessName || 'Cabinet Pro';
    const fromPhone = sender?.phone || settings?.supportPhone || null;

    const cabinets = await prisma.cabinet.findMany({
      where: { deletedAt: null, ...(data.all ? {} : { id: { in: data.cabinetIds } }) },
      include: { users: { where: { role: 'OWNER', deletedAt: null } } },
    });

    const signature = `\n\n— ${fromName}${fromPhone ? ` · ${fromPhone}` : ''}`;
    const text = `${data.subject ? `${data.subject}\n` : ''}${data.body}${signature}`;
    const summary = { cabinets: cabinets.length, inbox: 0, sms: 0, whatsapp: 0, failed: 0, noPhone: 0 };

    for (const cabinet of cabinets) {
      for (const owner of cabinet.users) {
        if (data.channels.includes('IN_APP')) {
          await createInboxMessage({ kind: 'OWNER_MESSAGE', toUserId: owner.id, cabinetId: cabinet.id, subject: data.subject, body: data.body, fromUserId: sender?.id, fromName, fromPhone });
          summary.inbox += 1;
        }
        const phone = owner.phone || cabinet.phone;
        for (const channel of data.channels.filter(c => c !== 'IN_APP') as ('SMS' | 'WHATSAPP')[]) {
          if (!phone) { summary.noPhone += 1; continue; }
          const result = await sendMessage({
            kind: 'OWNER_MESSAGE', channel, toPhone: phone, body: text,
            templateParams: [fromName, data.body, fromPhone || '-'],
            cabinetId: cabinet.id, toUserId: owner.id, fromUserId: sender?.id, fromName, fromPhone, subject: data.subject,
          });
          if (result?.status === 'FAILED') summary.failed += 1;
          else if (channel === 'SMS') summary.sms += 1;
          else summary.whatsapp += 1;
        }
      }
    }
    sendSuccess(res, summary, 'Message envoyé');
  } catch (err) { next(err); }
});

router.post('/test', requireRoles('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, channel } = z.object({ phone: z.string().min(6), channel: z.enum(['SMS', 'WHATSAPP']) }).parse(req.body);
    const result = await sendMessage({ kind: 'TEST', channel, toPhone: phone, body: 'Test Cabinet Pro : la configuration des messages fonctionne ✅', fromUserId: req.user!.id });
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

export default router;
