import app from './app';
import { config } from './config';
import { startReminderJobs } from './jobs/reminders';
import { startDemoRefreshJob } from './services/demo';
import { ensureCatalogue } from './services/cabinet-setup';
import { prisma } from './config/prisma';
import { providerStatus } from './services/messaging';
import { ensureDrugs } from './services/drugs';
import { ensureDiagnosisCodes } from './services/diagnosis-codes';

app.listen(config.port, () => {
  console.log(`🚀 Serveur démarré sur le port ${config.port}`);
  startReminderJobs();
  ensureCatalogue(prisma)
    .then(r => { if (r.specialties || r.acts) console.log(`📚 Catalogue complété : ${r.specialties} spécialité(s), ${r.acts} acte(s) par défaut`); })
    .catch(err => console.error('[catalogue]', err?.message || err));
  startDemoRefreshJob();
  ensureDrugs(prisma)
    .then(n => { if (n) console.log(`💊 Liste nationale des médicaments chargée : ${n}`); })
    .catch(err => console.error('[drugs]', err?.message || err));
  ensureDiagnosisCodes(prisma)
    .then(n => { if (n) console.log(`🩺 Codes CIM-10 ajoutés : ${n}`); })
    .catch(err => console.error('[cim10]', err?.message || err));
  const providers = providerStatus();
  if (process.env.NODE_ENV === 'production' && providers.sms.provider === 'log' && providers.whatsapp.provider === 'log') {
    console.warn('⚠️  Ni SMS (INFOBIP_*) ni WhatsApp (WHATSAPP_*) configurés : rappels et codes de réinitialisation sont seulement journalisés, pas envoyés.');
  }
});
