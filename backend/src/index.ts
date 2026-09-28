import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';

import { config } from './config';
import { notFound, errorHandler } from './middleware/error';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import cabinetsRoutes from './routes/cabinets.routes';
import cabinetDataRoutes from './routes/cabinet';
import plansRoutes from './routes/plans.routes';
import billingRoutes from './routes/billing.routes';
import specialtiesRoutes from './routes/specialties.routes';
import uploadsRoutes from './routes/uploads.routes';
import appSettingsRoutes from './routes/app-settings.routes';
import messagesRoutes from './routes/messages.routes';
import auditRoutes from './routes/audit.routes';
import { startReminderJobs } from './jobs/reminders';
import { sendSuccess } from './utils/response';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(config.cors));
// Gzip JSON responses: patient lists and agendas shrink by ~80 % on the wire.
app.use(compression());
const structuredLogFormat = (tokens: any, req: express.Request, res: express.Response) => JSON.stringify({ time: new Date().toISOString(), method: tokens.method(req, res), path: tokens.url(req, res), status: Number(tokens.status(req, res)), responseMs: Number(tokens['response-time'](req, res)) });
app.use(morgan((process.env.NODE_ENV === 'production' ? structuredLogFormat : 'dev') as any));
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
// Public files only (logos). Medical attachments are served by an authenticated route.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: '7d' }));

app.get('/api/health', (_req, res) => {
  sendSuccess(res, { ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/specialties', specialtiesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/app-settings', appSettingsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/users', usersRoutes);
// Cabinet records first (list, settings, subscription), then the cabinet's data under /:cabinetId/...
app.use('/api/cabinets', cabinetsRoutes);
app.use('/api/cabinets/:cabinetId', cabinetDataRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🚀 Serveur démarré sur le port ${config.port}`);
  startReminderJobs();
});

export default app;
