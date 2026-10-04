// Translations for trial sign-up, subscriptions, messaging, audit and invoices.
// Merged into the main resources in i18n.ts (top-level namespaces don't overlap).

export const frExtra = {
  trial: {
    cta: 'Essai gratuit de {{days}} jours', ctaHint: 'Sans carte bancaire. Créez votre cabinet en 1 minute.', phone: 'Téléphone (WhatsApp)', phoneHint: 'Pour recevoir les alertes de votre abonnement.', passwordHint: 'Minimum 8 caractères', created: 'Votre essai gratuit est activé !',
    banner: 'Essai gratuit : {{count}} jour(s) restant(s)', bannerToday: 'Votre essai gratuit se termine aujourd’hui', choosePlan: 'Choisir un plan',
  },
  blocked: {
    TRIAL_ENDED: 'Votre essai gratuit est terminé', PLAN_EXPIRED: 'Votre abonnement a expiré', SUSPENDED: 'Compte suspendu',
    TRIAL_ENDEDText: 'Merci d’avoir essayé Cabinet Pro ! Pour continuer à utiliser votre espace, choisissez un plan ou contactez-nous.',
    PLAN_EXPIREDText: 'Votre accès est suspendu depuis la fin de votre abonnement. Vos données sont conservées : renouvelez pour reprendre.',
    SUSPENDEDText: 'L’accès à votre cabinet a été suspendu. Contactez-nous pour le réactiver.',
    practitionerText: 'L’accès au cabinet est suspendu. Contactez le propriétaire du cabinet pour le réactiver.',
    endedOn: 'Terminé le {{date}}', payOnline: 'Payer en ligne', choose: 'Choisir ce plan', perPeriod: '/ {{months}} mois', contactUs: 'Nous contacter', contactHint: 'Paiement par virement, espèces ou carte : contactez-nous et nous réactivons votre cabinet.', call: 'Appeler', whatsapp: 'WhatsApp', email: 'Email', onlineUnavailable: 'Le paiement en ligne n’est pas encore disponible. Contactez-nous pour activer votre plan.', dataSafe: 'Vos données sont conservées.',
  },
  inbox: {
    title: 'Notifications', empty: 'Aucune notification', markAll: 'Tout marquer comme lu', from: 'De', unread: 'non lu',
  },
  messagesPage: {
    title: 'Messages', subtitle: 'Envoyez des messages aux propriétaires de cabinets et suivez les SMS / WhatsApp envoyés.', compose: 'Nouveau message', to: 'Destinataires', allCabinets: 'Tous les cabinets', selectCabinets: 'Cabinets sélectionnés', subject: 'Objet (optionnel)', body: 'Message', channels: 'Canaux', inApp: 'Dans l’application', sms: 'SMS', whatsapp: 'WhatsApp', send: 'Envoyer', sent: 'Message envoyé', signature: 'Signé : {{name}} · {{phone}}', log: 'Historique des envois', providers: 'Fournisseurs', providerLog: 'Mode test : les messages sont enregistrés mais pas envoyés', providerLive: 'Connecté ({{name}})', test: 'Envoyer un test', testPhone: 'Numéro de test', summary: '{{inbox}} notif. · {{sms}} SMS · {{whatsapp}} WhatsApp · {{failed}} échec(s)',
    kinds: { APPOINTMENT_REMINDER: 'Rappel RDV', PLAN_EXPIRY: 'Fin de plan', OWNER_MESSAGE: 'Message', WELCOME: 'Bienvenue', TEST: 'Test' },
    statuses: { SENT: 'Envoyé', LOGGED: 'Test (non envoyé)', FAILED: 'Échec', PENDING: 'En cours' },
    empty: 'Aucun message pour le moment',
  },
  audit: {
    title: 'Journal d’audit', subtitle: 'Toutes les actions effectuées sur la plateforme.', cabinet: 'Cabinet', allCabinets: 'Tous les cabinets', method: 'Action', allMethods: 'Toutes', search: 'Rechercher une action ou un chemin...', failedOnly: 'Erreurs uniquement', user: 'Utilisateur', when: 'Date', status: 'Statut', loadMore: 'Charger plus', empty: 'Aucune entrée', system: 'Système',
    methods: { POST: 'Création', PATCH: 'Modification', PUT: 'Modification', DELETE: 'Suppression', WEBHOOK: 'Webhook' },
  },
  invoices: {
    title: 'Factures', subtitle: 'Paiements des abonnements de tous les cabinets.', cabinet: 'Cabinet', plan: 'Plan', amount: 'Montant', status: 'Statut', date: 'Date', paidAt: 'Payée le', periodEnd: 'Période jusqu’au', open: 'Ouvrir', empty: 'Aucune facture', all: 'Toutes', paidTotal: 'Encaissé', pendingTotal: 'En attente', failedTotal: 'Échouées', history: 'Historique des factures',
    statuses: { PAID: 'Payée', PENDING: 'En attente', FAILED: 'Échouée' },
  },
  saas: {
    title: 'Chiffres SaaS', mrr: 'Revenu mensuel récurrent', collected: 'Encaissé ce mois', paying: 'Cabinets payants', trialing: 'En essai', expired: 'Expirés', suspended: 'Suspendus', newThisMonth: '{{count}} nouveau(x) ce mois', conversion: 'Conversion essai → payant', conversionDetail: '{{converted}} sur {{trials}} essais', revenue6m: 'Encaissements (6 mois)', byPlan: 'Revenu par plan', trialsEnding: 'Essais qui se terminent', renewals: 'Renouvellements à venir', recentlyExpired: 'Expirés récemment', none: 'Rien à signaler', manage: 'Gérer', message: 'Message', inDays: 'dans {{count}} j', today: 'aujourd’hui', ago: 'il y a {{count}} j', cabinets: '{{count}} cabinet(s)',
  },
  subscription: {
    manage: 'Gérer l’abonnement', plan: 'Plan', status: 'Statut', endsOn: 'Fin de période', quick: 'Raccourcis', plus3d: '+3 jours', plus1m: '+1 mois', plus1y: '+1 an', recordPayment: 'Enregistrer un paiement', amount: 'Montant (MAD)', method: 'Moyen de paiement', reference: 'Référence (optionnel)', save: 'Enregistrer', saved: 'Abonnement mis à jour', current: 'Actuellement',
    statuses: { TRIALING: 'Essai', ACTIVE: 'Actif', PAST_DUE: 'Expiré / impayé', SUSPENDED: 'Suspendu', CANCELLED: 'Annulé' },
    methods: { CASH: 'Espèces', TRANSFER: 'Virement', CARD: 'Carte', CMI: 'Carte bancaire (CMI)', OTHER: 'Autre' },
  },
  reminders: {
    tab: 'Rappels', title: 'Rappels automatiques', description: 'Vos clients reçoivent un rappel 1 heure avant leur rendez-vous.', enabled: 'Envoyer les rappels de rendez-vous', channel: 'Canal', both: 'WhatsApp + SMS', whatsappOnly: 'WhatsApp uniquement', smsOnly: 'SMS uniquement', saved: 'Préférences enregistrées', log: 'Derniers rappels envoyés', empty: 'Aucun rappel envoyé pour le moment', sentBadge: 'Rappel envoyé',
  },
  support: {
    title: 'Contact support', description: 'Affiché aux cabinets dont l’essai ou l’abonnement est terminé.', phone: 'Téléphone', whatsapp: 'WhatsApp', email: 'Email',
  },
}

export const enExtra: typeof frExtra = {
  trial: {
    cta: '{{days}}-day free trial', ctaHint: 'No credit card. Set up your cabinet in 1 minute.', phone: 'Phone (WhatsApp)', phoneHint: 'To receive alerts about your subscription.', passwordHint: 'At least 8 characters', created: 'Your free trial is active!',
    banner: 'Free trial: {{count}} day(s) left', bannerToday: 'Your free trial ends today', choosePlan: 'Choose a plan',
  },
  blocked: {
    TRIAL_ENDED: 'Your free trial has ended', PLAN_EXPIRED: 'Your subscription has expired', SUSPENDED: 'Account suspended',
    TRIAL_ENDEDText: 'Thanks for trying Cabinet Pro! To keep using your workspace, choose a plan or contact us.',
    PLAN_EXPIREDText: 'Access is paused since your subscription ended. Your data is kept: renew to continue.',
    SUSPENDEDText: 'Access to your cabinet has been suspended. Contact us to reactivate it.',
    practitionerText: 'Access to the cabinet is paused. Contact the cabinet owner to reactivate it.',
    endedOn: 'Ended on {{date}}', payOnline: 'Pay online', choose: 'Choose this plan', perPeriod: '/ {{months}} month(s)', contactUs: 'Contact us', contactHint: 'Bank transfer, cash or card: contact us and we will reactivate your cabinet.', call: 'Call', whatsapp: 'WhatsApp', email: 'Email', onlineUnavailable: 'Online payment is not available yet. Contact us to activate your plan.', dataSafe: 'Your data is kept.',
  },
  inbox: { title: 'Notifications', empty: 'No notifications', markAll: 'Mark all as read', from: 'From', unread: 'unread' },
  messagesPage: {
    title: 'Messages', subtitle: 'Message cabinet owners and track the SMS / WhatsApp messages sent.', compose: 'New message', to: 'Recipients', allCabinets: 'All cabinets', selectCabinets: 'Selected cabinets', subject: 'Subject (optional)', body: 'Message', channels: 'Channels', inApp: 'In the app', sms: 'SMS', whatsapp: 'WhatsApp', send: 'Send', sent: 'Message sent', signature: 'Signed: {{name}} · {{phone}}', log: 'Delivery history', providers: 'Providers', providerLog: 'Test mode: messages are recorded but not sent', providerLive: 'Connected ({{name}})', test: 'Send a test', testPhone: 'Test number', summary: '{{inbox}} notif. · {{sms}} SMS · {{whatsapp}} WhatsApp · {{failed}} failed',
    kinds: { APPOINTMENT_REMINDER: 'Appointment reminder', PLAN_EXPIRY: 'Plan ending', OWNER_MESSAGE: 'Message', WELCOME: 'Welcome', TEST: 'Test' },
    statuses: { SENT: 'Sent', LOGGED: 'Test (not sent)', FAILED: 'Failed', PENDING: 'Pending' },
    empty: 'No messages yet',
  },
  audit: {
    title: 'Audit log', subtitle: 'Every action performed on the platform.', cabinet: 'Cabinet', allCabinets: 'All cabinets', method: 'Action', allMethods: 'All', search: 'Search an action or path...', failedOnly: 'Errors only', user: 'User', when: 'Date', status: 'Status', loadMore: 'Load more', empty: 'No entries', system: 'System',
    methods: { POST: 'Create', PATCH: 'Update', PUT: 'Update', DELETE: 'Delete', WEBHOOK: 'Webhook' },
  },
  invoices: {
    title: 'Invoices', subtitle: 'Subscription payments from every cabinet.', cabinet: 'Cabinet', plan: 'Plan', amount: 'Amount', status: 'Status', date: 'Date', paidAt: 'Paid on', periodEnd: 'Period until', open: 'Open', empty: 'No invoices', all: 'All', paidTotal: 'Collected', pendingTotal: 'Pending', failedTotal: 'Failed', history: 'Invoice history',
    statuses: { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed' },
  },
  saas: {
    title: 'SaaS figures', mrr: 'Monthly recurring revenue', collected: 'Collected this month', paying: 'Paying cabinets', trialing: 'On trial', expired: 'Expired', suspended: 'Suspended', newThisMonth: '{{count}} new this month', conversion: 'Trial → paid conversion', conversionDetail: '{{converted}} of {{trials}} trials', revenue6m: 'Collections (6 months)', byPlan: 'Revenue by plan', trialsEnding: 'Trials ending', renewals: 'Upcoming renewals', recentlyExpired: 'Recently expired', none: 'Nothing to report', manage: 'Manage', message: 'Message', inDays: 'in {{count}} d', today: 'today', ago: '{{count}} d ago', cabinets: '{{count}} cabinet(s)',
  },
  subscription: {
    manage: 'Manage subscription', plan: 'Plan', status: 'Status', endsOn: 'Period end', quick: 'Shortcuts', plus3d: '+3 days', plus1m: '+1 month', plus1y: '+1 year', recordPayment: 'Record a payment', amount: 'Amount (MAD)', method: 'Payment method', reference: 'Reference (optional)', save: 'Save', saved: 'Subscription updated', current: 'Currently',
    statuses: { TRIALING: 'Trial', ACTIVE: 'Active', PAST_DUE: 'Expired / unpaid', SUSPENDED: 'Suspended', CANCELLED: 'Cancelled' },
    methods: { CASH: 'Cash', TRANSFER: 'Bank transfer', CARD: 'Card', CMI: 'Bank card (CMI)', OTHER: 'Other' },
  },
  reminders: {
    tab: 'Reminders', title: 'Automatic reminders', description: 'Your clients get a reminder 1 hour before their appointment.', enabled: 'Send appointment reminders', channel: 'Channel', both: 'WhatsApp + SMS', whatsappOnly: 'WhatsApp only', smsOnly: 'SMS only', saved: 'Preferences saved', log: 'Latest reminders sent', empty: 'No reminders sent yet', sentBadge: 'Reminder sent',
  },
  support: { title: 'Support contact', description: 'Shown to cabinets whose trial or subscription has ended.', phone: 'Phone', whatsapp: 'WhatsApp', email: 'Email' },
}

export const arExtra: typeof frExtra = {
  trial: {
    cta: 'تجربة مجانية لمدة {{days}} أيام', ctaHint: 'بدون بطاقة بنكية. أنشئ عيادتك في دقيقة واحدة.', phone: 'الهاتف (واتساب)', phoneHint: 'لتلقي تنبيهات اشتراكك.', passwordHint: '8 أحرف على الأقل', created: 'تم تفعيل تجربتك المجانية!',
    banner: 'التجربة المجانية: متبقي {{count}} يوم', bannerToday: 'تنتهي تجربتك المجانية اليوم', choosePlan: 'اختر خطة',
  },
  blocked: {
    TRIAL_ENDED: 'انتهت تجربتك المجانية', PLAN_EXPIRED: 'انتهى اشتراكك', SUSPENDED: 'الحساب موقوف',
    TRIAL_ENDEDText: 'شكراً لتجربة Cabinet Pro! لمواصلة استخدام مساحتك، اختر خطة أو تواصل معنا.',
    PLAN_EXPIREDText: 'تم إيقاف الوصول منذ انتهاء اشتراكك. بياناتك محفوظة: جدّد للمتابعة.',
    SUSPENDEDText: 'تم إيقاف الوصول إلى عيادتك. تواصل معنا لإعادة تفعيله.',
    practitionerText: 'تم إيقاف الوصول إلى العيادة. تواصل مع صاحب العيادة لإعادة تفعيله.',
    endedOn: 'انتهى في {{date}}', payOnline: 'الدفع عبر الإنترنت', choose: 'اختيار هذه الخطة', perPeriod: '/ {{months}} شهر', contactUs: 'تواصل معنا', contactHint: 'تحويل بنكي أو نقداً أو بالبطاقة: تواصل معنا وسنعيد تفعيل عيادتك.', call: 'اتصال', whatsapp: 'واتساب', email: 'البريد', onlineUnavailable: 'الدفع عبر الإنترنت غير متاح بعد. تواصل معنا لتفعيل خطتك.', dataSafe: 'بياناتك محفوظة.',
  },
  inbox: { title: 'الإشعارات', empty: 'لا توجد إشعارات', markAll: 'تعليم الكل كمقروء', from: 'من', unread: 'غير مقروء' },
  messagesPage: {
    title: 'الرسائل', subtitle: 'أرسل رسائل إلى أصحاب العيادات وتابع رسائل SMS وواتساب المرسلة.', compose: 'رسالة جديدة', to: 'المستلمون', allCabinets: 'كل العيادات', selectCabinets: 'عيادةات محددة', subject: 'الموضوع (اختياري)', body: 'الرسالة', channels: 'القنوات', inApp: 'داخل التطبيق', sms: 'SMS', whatsapp: 'واتساب', send: 'إرسال', sent: 'تم إرسال الرسالة', signature: 'التوقيع: {{name}} · {{phone}}', log: 'سجل الإرسال', providers: 'مزودو الخدمة', providerLog: 'وضع الاختبار: يتم حفظ الرسائل دون إرسالها', providerLive: 'متصل ({{name}})', test: 'إرسال تجربة', testPhone: 'رقم الاختبار', summary: '{{inbox}} إشعار · {{sms}} SMS · {{whatsapp}} واتساب · {{failed}} فشل',
    kinds: { APPOINTMENT_REMINDER: 'تذكير موعد', PLAN_EXPIRY: 'انتهاء الخطة', OWNER_MESSAGE: 'رسالة', WELCOME: 'ترحيب', TEST: 'اختبار' },
    statuses: { SENT: 'أُرسلت', LOGGED: 'اختبار (لم تُرسل)', FAILED: 'فشل', PENDING: 'قيد الإرسال' },
    empty: 'لا توجد رسائل بعد',
  },
  audit: {
    title: 'سجل التدقيق', subtitle: 'كل الإجراءات المنفذة على المنصة.', cabinet: 'العيادة', allCabinets: 'كل العيادات', method: 'الإجراء', allMethods: 'الكل', search: 'ابحث عن إجراء أو مسار...', failedOnly: 'الأخطاء فقط', user: 'المستخدم', when: 'التاريخ', status: 'الحالة', loadMore: 'تحميل المزيد', empty: 'لا توجد سجلات', system: 'النظام',
    methods: { POST: 'إنشاء', PATCH: 'تعديل', PUT: 'تعديل', DELETE: 'حذف', WEBHOOK: 'Webhook' },
  },
  invoices: {
    title: 'الفواتير', subtitle: 'مدفوعات اشتراكات كل العيادات.', cabinet: 'العيادة', plan: 'الخطة', amount: 'المبلغ', status: 'الحالة', date: 'التاريخ', paidAt: 'دُفعت في', periodEnd: 'الفترة حتى', open: 'فتح', empty: 'لا توجد فواتير', all: 'الكل', paidTotal: 'المحصّل', pendingTotal: 'قيد الانتظار', failedTotal: 'فاشلة', history: 'سجل الفواتير',
    statuses: { PAID: 'مدفوعة', PENDING: 'قيد الانتظار', FAILED: 'فاشلة' },
  },
  saas: {
    title: 'أرقام SaaS', mrr: 'الإيراد الشهري المتكرر', collected: 'المحصّل هذا الشهر', paying: 'عيادةات مشتركة', trialing: 'في فترة التجربة', expired: 'منتهية', suspended: 'موقوفة', newThisMonth: '{{count}} جديد هذا الشهر', conversion: 'التحويل من تجربة إلى اشتراك', conversionDetail: '{{converted}} من {{trials}} تجربة', revenue6m: 'التحصيل (6 أشهر)', byPlan: 'الإيراد حسب الخطة', trialsEnding: 'تجارب تنتهي قريباً', renewals: 'تجديدات قادمة', recentlyExpired: 'انتهت مؤخراً', none: 'لا شيء', manage: 'إدارة', message: 'رسالة', inDays: 'بعد {{count}} ي', today: 'اليوم', ago: 'منذ {{count}} ي', cabinets: '{{count}} عيادة',
  },
  subscription: {
    manage: 'إدارة الاشتراك', plan: 'الخطة', status: 'الحالة', endsOn: 'نهاية الفترة', quick: 'اختصارات', plus3d: '+3 أيام', plus1m: '+شهر', plus1y: '+سنة', recordPayment: 'تسجيل دفعة', amount: 'المبلغ (درهم)', method: 'طريقة الدفع', reference: 'المرجع (اختياري)', save: 'حفظ', saved: 'تم تحديث الاشتراك', current: 'حالياً',
    statuses: { TRIALING: 'تجربة', ACTIVE: 'نشط', PAST_DUE: 'منتهي / غير مدفوع', SUSPENDED: 'موقوف', CANCELLED: 'ملغى' },
    methods: { CASH: 'نقداً', TRANSFER: 'تحويل بنكي', CARD: 'بطاقة', CMI: 'بطاقة بنكية (CMI)', OTHER: 'أخرى' },
  },
  reminders: {
    tab: 'التذكيرات', title: 'التذكيرات التلقائية', description: 'يتلقى زبناؤك تذكيراً قبل موعدهم بساعة.', enabled: 'إرسال تذكيرات المواعيد', channel: 'القناة', both: 'واتساب + SMS', whatsappOnly: 'واتساب فقط', smsOnly: 'SMS فقط', saved: 'تم حفظ التفضيلات', log: 'آخر التذكيرات المرسلة', empty: 'لم يتم إرسال أي تذكير بعد', sentBadge: 'تم إرسال التذكير',
  },
  support: { title: 'جهة اتصال الدعم', description: 'تظهر للعيادةات التي انتهت تجربتها أو اشتراكها.', phone: 'الهاتف', whatsapp: 'واتساب', email: 'البريد' },
}
