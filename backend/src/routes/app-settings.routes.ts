import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { sendError, sendSuccess } from '../utils/response';

const router = Router();

const appSettingsPayload = z.object({
  businessName: z.string().optional().nullable(),
  businessLogo: z.string().optional().nullable(),
  supportPhone: z.string().optional().nullable(),
  supportEmail: z.string().email().optional().nullable().or(z.literal('')),
  supportWhatsapp: z.string().optional().nullable(),
});

const serialize = (settings: any) => ({
  businessName: settings?.businessName || null,
  businessLogo: settings?.businessLogo || null,
  supportPhone: settings?.supportPhone || null,
  supportEmail: settings?.supportEmail || null,
  supportWhatsapp: settings?.supportWhatsapp || null,
});

/** Public: branding and platform contact, shown on login and on the "trial ended" page. */
router.get('/public', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, serialize(await prisma.appSettings.findUnique({ where: { id: 'global' } })));
  } catch (err) { next(err); }
});

router.use(authenticate, requireRoles('SUPER_ADMIN'));

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'global' } });
    return sendSuccess(res, serialize(settings));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
      return sendSuccess(res, { businessName: null, businessLogo: null });
    }
    next(err);
  }
});

router.patch('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = appSettingsPayload.parse(req.body);
    const settings = await prisma.appSettings.upsert({
      where: { id: 'global' },
      update: data,
      create: {
        id: 'global',
        businessName: data.businessName ?? null,
        businessLogo: data.businessLogo ?? null,
        supportPhone: data.supportPhone ?? null,
        supportEmail: data.supportEmail || null,
        supportWhatsapp: data.supportWhatsapp ?? null,
      },
    });
    return sendSuccess(res, serialize(settings));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
      return sendError(res, 'Table AppSettings manquante. Appliquez la mise à jour Prisma sur la base (db push ou migration).', 500);
    }
    next(err);
  }
});

export default router;
