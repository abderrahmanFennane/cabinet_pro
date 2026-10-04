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
import drugsRoutes from './routes/drugs.routes';
import { publicShare } from './routes/share.routes';
import diagnosisCodesRoutes from './routes/diagnosis-codes.routes';
import platformRoutes from './routes/platform.routes';
import trialRequestsRoutes, { publicTrialRequests } from './routes/trial-requests.routes';
import { sendSuccess } from './utils/response';
import { rateLimit } from './utils/rate-limit';

/** The HTTP application without the listening socket or the background jobs (tests start it on their own port). */
const app = express();

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(config.cors));
// Gzip JSON responses: patient lists and agendas shrink by ~80 % on the wire.
app.use(compression());
const structuredLogFormat = (tokens: any, req: express.Request, res: express.Response) => JSON.stringify({ time: new Date().toISOString(), method: tokens.method(req, res), path: tokens.url(req, res), status: Number(tokens.status(req, res)), responseMs: Number(tokens['response-time'](req, res)) });
app.use(morgan((process.env.NODE_ENV === 'production' ? structuredLogFormat : 'dev') as any));
// CMI payment notifications and returns are form posts
app.use('/api/billing/cmi', express.urlencoded({ extended: false, limit: '100kb' }));
// Public and sign-in endpoints only take small bodies: a robot cannot make them parse megabytes.
app.use(['/api/public', '/api/auth', '/api/share'], express.json({ limit: '20kb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
// Public files only (logos). Medical attachments are served by an authenticated route.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: '7d' }));

// Safety net for the whole API: far above what a person does (API_RATE_LIMIT requests per minute and per IP, 600 by default).
// Stricter limits apply on sign-in and public forms; a real flood must be stopped upstream (nginx, Cloudflare).
app.use('/api', rateLimit({
  windowMs: 60_000, max: Number(process.env.API_RATE_LIMIT) || 600, message: 'Trop de requêtes. Patientez une minute.',
  skip: (req) => process.env.NODE_ENV === 'test' || req.path === '/health',
}));

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
app.use('/api/drugs', drugsRoutes);
app.use('/api/diagnosis-codes', diagnosisCodesRoutes);
app.use('/api/platform', platformRoutes);
// Patient opening a document sent by link (no account)
app.use('/api/share', publicShare);
// Trial request form of the public home page (no account), and its list for the Super Admin
app.use('/api/public/trial-requests', publicTrialRequests);
app.use('/api/trial-requests', trialRequestsRoutes);
app.use('/api/users', usersRoutes);
// Cabinet records first (list, settings, subscription), then the cabinet's data under /:cabinetId/...
app.use('/api/cabinets', cabinetsRoutes);
app.use('/api/cabinets/:cabinetId', cabinetDataRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
