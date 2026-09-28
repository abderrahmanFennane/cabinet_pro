// Short navigation and "what this role can do" texts for the simplified layout.
export const frSimple = {
  nav: {
    today: 'Aujourd’hui', myDay: 'Ma journée', payments: 'Paiements', myPayments: 'Mes paiements', myCabinet: 'Mon cabinet',
    subscription: 'Abonnement', more: 'Plus', logout: 'Déconnexion',
  },
  can: {
    title: 'Vous pouvez',
    SUPER_ADMIN: ['Créer, suspendre et prolonger les cabinets', 'Créer les comptes : titulaires, médecins, assistants', 'Régler les plans, prix et limites', 'Ouvrir le cabinet de démonstration'],
    SUPER_ADMIN_NOT: ['Ouvrir un vrai dossier patient sans l’accord du cabinet'],
    OWNER: ['Tout ce que fait un médecin', 'Voir l’agenda et l’argent de tout le cabinet', 'Gérer l’équipe, les tarifs et l’abonnement'],
    OWNER_NOT: [],
    PRACTITIONER: ['Voir votre journée et votre prochain patient', 'Schéma dentaire, consultations, ordonnances', 'Plans de traitement et devis'],
    PRACTITIONER_NOT: ['Équipe, tarifs et abonnement'],
    ASSISTANT: ['Prendre les rendez-vous et accueillir', 'Modifier les coordonnées des patients', 'Encaisser et imprimer les documents'],
    ASSISTANT_NOT: ['Schéma dentaire, notes médicales, plans de traitement'],
  },
  today: {
    hello: 'Bonjour {{name}}', inRoom: '{{count}} en salle d’attente', toCome: '{{count}} encore à venir', onList: '{{count}} patient(s) sur votre liste',
    newAppointment: 'Nouveau rendez-vous', walkIn: 'Patient sans rendez-vous', schedule: 'Planning du jour', mySchedule: 'Mon planning', waitingRoom: 'Salle d’attente',
    allDoctors: 'Tous', nobodyWaiting: 'Personne n’attend.', noAppointments: 'Aucun rendez-vous aujourd’hui.', fullAgenda: 'Agenda complet', stats: 'Statistiques',
    withYou: 'Avec vous maintenant', waitingFor: 'Attend depuis {{time}}', nextAt: 'Prochain à {{time}}', allDone: 'Journée terminée', noMore: 'Plus de patients aujourd’hui',
    openFile: 'Ouvrir le dossier', start: 'Faire entrer', finish: 'Terminer la consultation', lookFile: 'Voir le dossier',
    checkIn: 'Arrivé', sendIn: 'Faire entrer', noShow: 'Absent', seen: 'Patients vus', collected: 'Encaissé aujourd’hui', unpaid: 'Impayés', waited: 'attend {{time}}',
    years: '{{count}} ans', allergy: 'Allergie : {{list}}',
  },
  login: { eyebrow: 'Gestion de cabinet médical', chart: 'Schéma dentaire interactif', reminders: 'Rappels WhatsApp la veille', languages: 'Français, arabe, anglais', forgot: 'Mot de passe oublié ?', forgotTitle: 'Mot de passe oublié', forgotHint: 'Saisissez votre email. Nous envoyons un code à 6 chiffres par SMS au numéro enregistré sur votre compte.', sendCode: 'Recevoir un code', codeTitle: 'Saisissez le code reçu', code: 'Code reçu par SMS', newPassword: 'Nouveau mot de passe', changePassword: 'Changer le mot de passe', newCode: 'Renvoyer un code', back: 'Retour à la connexion', noPhone: 'Pas de téléphone sur votre compte ? Demandez au médecin titulaire de changer votre mot de passe depuis Équipe.', changed: 'Mot de passe modifié. Connectez-vous avec le nouveau.' },
  adminPage: { assistants_one: '{{count}} assistant(e)', assistants_other: '{{count}} assistant(e)s', assistants: '{{count}} assistant(e)s', practitioners_one: '{{count}} praticien', practitioners_other: '{{count}} praticiens', assistantsUnlimited: 'Assistants illimités' },
  sub: { title: 'Abonnement', subtitle: 'Votre plan, ce qu’il comprend, et comment en changer.', current: 'Votre plan', until: 'Jusqu’au {{date}}', noEnd: 'Sans date de fin', perMonth: '{{price}} MAD / mois', free: 'Gratuit', practitioners: 'Praticiens', assistants: 'Assistants', unlimited: 'illimité', change: 'Changer de plan', choose: 'Choisir ce plan', yours: 'Votre plan', reminders: '{{count}} rappels WhatsApp / SMS par mois', storage: '{{count}} Go pour les radios et documents', treat: 'Plans de traitement, devis, échéanciers', stats: 'Statistiques avancées', multi: 'Plusieurs spécialités', contactTitle: 'Passer au plan {{plan}}', contactText: 'Le paiement en ligne arrive bientôt. Contactez-nous et nous activons votre nouveau plan le jour même.', contactMessage: 'Bonjour, je souhaite passer au plan {{plan}} pour le cabinet {{cabinet}}.', status: { ACTIVE: 'Actif', TRIALING: 'Essai gratuit', PAST_DUE: 'Paiement en retard', SUSPENDED: 'Suspendu', CANCELLED: 'Résilié' } },
}

type Dict = typeof frSimple

export const enSimple: Dict = {
  nav: {
    today: 'Today', myDay: 'My day', payments: 'Payments', myPayments: 'My payments', myCabinet: 'My practice',
    subscription: 'Subscription', more: 'More', logout: 'Sign out',
  },
  can: {
    title: 'You can',
    SUPER_ADMIN: ['Create, pause and extend practices', 'Create accounts: owners, doctors, assistants', 'Set plans, prices and limits', 'Open the demo practice'],
    SUPER_ADMIN_NOT: ['Open a real patient file without the practice’s consent'],
    OWNER: ['Everything a doctor can do', 'See the whole practice’s schedule and money', 'Manage team, prices and subscription'],
    OWNER_NOT: [],
    PRACTITIONER: ['See your day and your next patient', 'Tooth chart, consultations, prescriptions', 'Treatment plans and quotes'],
    PRACTITIONER_NOT: ['Team, prices and subscription'],
    ASSISTANT: ['Book and check in patients', 'Edit patient contact details', 'Take payments and print documents'],
    ASSISTANT_NOT: ['Tooth chart, medical notes, treatment plans'],
  },
  today: {
    hello: 'Hello {{name}}', inRoom: '{{count}} in the waiting room', toCome: '{{count}} still to come', onList: '{{count}} patient(s) on your list',
    newAppointment: 'New appointment', walkIn: 'Walk-in patient', schedule: 'Today’s schedule', mySchedule: 'My schedule', waitingRoom: 'Waiting room',
    allDoctors: 'All', nobodyWaiting: 'Nobody is waiting.', noAppointments: 'No appointments today.', fullAgenda: 'Full schedule', stats: 'Statistics',
    withYou: 'With you now', waitingFor: 'Waiting for {{time}}', nextAt: 'Next at {{time}}', allDone: 'All done', noMore: 'No more patients today',
    openFile: 'Open file', start: 'Start visit', finish: 'Finish visit', lookFile: 'Look at the file',
    checkIn: 'Check in', sendIn: 'Send in', noShow: 'No-show', seen: 'Patients seen', collected: 'Collected today', unpaid: 'Unpaid', waited: 'waiting {{time}}',
    years: '{{count}} years', allergy: 'Allergy: {{list}}',
  },
  login: { eyebrow: 'Medical practice management', chart: 'Interactive tooth chart', reminders: 'WhatsApp reminders the day before', languages: 'French, Arabic, English', forgot: 'Forgot password?', forgotTitle: 'Forgot password', forgotHint: 'Enter your email. We send a 6-digit code by SMS to the phone number saved on your account.', sendCode: 'Get a code', codeTitle: 'Enter the code you received', code: 'Code received by SMS', newPassword: 'New password', changePassword: 'Change password', newCode: 'Send a new code', back: 'Back to sign in', noPhone: 'No phone on your account? Ask the practice owner to change your password from Team.', changed: 'Password changed. Sign in with the new one.' },
  adminPage: { assistants_one: '{{count}} assistant', assistants_other: '{{count}} assistants', assistants: '{{count}} assistants', practitioners_one: '{{count}} doctor', practitioners_other: '{{count}} doctors', assistantsUnlimited: 'Unlimited assistants' },
  sub: { title: 'Subscription', subtitle: 'Your plan, what it includes, and how to change it.', current: 'Your plan', until: 'Until {{date}}', noEnd: 'No end date', perMonth: '{{price}} MAD / month', free: 'Free', practitioners: 'Doctors', assistants: 'Assistants', unlimited: 'unlimited', change: 'Change plan', choose: 'Choose this plan', yours: 'Your plan', reminders: '{{count}} WhatsApp / SMS reminders a month', storage: '{{count}} GB for X-rays and documents', treat: 'Treatment plans, quotes, payment schedules', stats: 'Advanced statistics', multi: 'Several specialties', contactTitle: 'Switch to {{plan}}', contactText: 'Online payment is coming soon. Contact us and we switch your plan the same day.', contactMessage: 'Hello, I would like to switch practice {{cabinet}} to the {{plan}} plan.', status: { ACTIVE: 'Active', TRIALING: 'Free trial', PAST_DUE: 'Payment overdue', SUSPENDED: 'Suspended', CANCELLED: 'Cancelled' } },
}

export const arSimple: Dict = {
  nav: {
    today: 'اليوم', myDay: 'يومي', payments: 'المدفوعات', myPayments: 'مدفوعاتي', myCabinet: 'عيادتي',
    subscription: 'الاشتراك', more: 'المزيد', logout: 'تسجيل الخروج',
  },
  can: {
    title: 'يمكنك',
    SUPER_ADMIN: ['إنشاء العيادات وإيقافها وتمديدها', 'إنشاء الحسابات: الأطباء المالكون والأطباء والمساعدون', 'ضبط الخطط والأسعار والحدود', 'فتح العيادة التجريبية'],
    SUPER_ADMIN_NOT: ['فتح ملف مريض حقيقي دون موافقة العيادة'],
    OWNER: ['كل ما يقوم به الطبيب', 'رؤية مواعيد وأموال العيادة كاملة', 'إدارة الفريق والأسعار والاشتراك'],
    OWNER_NOT: [],
    PRACTITIONER: ['رؤية يومك ومريضك التالي', 'مخطط الأسنان والاستشارات والوصفات', 'خطط العلاج وعروض الأسعار'],
    PRACTITIONER_NOT: ['الفريق والأسعار والاشتراك'],
    ASSISTANT: ['حجز المواعيد واستقبال المرضى', 'تعديل بيانات الاتصال بالمرضى', 'تحصيل المدفوعات وطباعة الوثائق'],
    ASSISTANT_NOT: ['مخطط الأسنان والملاحظات الطبية وخطط العلاج'],
  },
  today: {
    hello: 'مرحباً {{name}}', inRoom: '{{count}} في قاعة الانتظار', toCome: '{{count}} قادمون', onList: '{{count}} مريض في قائمتك',
    newAppointment: 'موعد جديد', walkIn: 'مريض بدون موعد', schedule: 'مواعيد اليوم', mySchedule: 'مواعيدي', waitingRoom: 'قاعة الانتظار',
    allDoctors: 'الكل', nobodyWaiting: 'لا أحد ينتظر.', noAppointments: 'لا مواعيد اليوم.', fullAgenda: 'الأجندة الكاملة', stats: 'الإحصائيات',
    withYou: 'معك الآن', waitingFor: 'ينتظر منذ {{time}}', nextAt: 'التالي على {{time}}', allDone: 'انتهى اليوم', noMore: 'لا مزيد من المرضى اليوم',
    openFile: 'فتح الملف', start: 'إدخال المريض', finish: 'إنهاء الاستشارة', lookFile: 'عرض الملف',
    checkIn: 'وصل', sendIn: 'إدخال', noShow: 'غائب', seen: 'مرضى تمت معاينتهم', collected: 'المحصّل اليوم', unpaid: 'غير مدفوع', waited: 'ينتظر {{time}}',
    years: '{{count}} سنة', allergy: 'حساسية: {{list}}',
  },
  login: { eyebrow: 'إدارة العيادات الطبية', chart: 'مخطط أسنان تفاعلي', reminders: 'تذكير عبر واتساب قبل يوم', languages: 'الفرنسية والعربية والإنجليزية', forgot: 'نسيت كلمة المرور؟', forgotTitle: 'نسيت كلمة المرور', forgotHint: 'أدخل بريدك الإلكتروني. نرسل رمزاً من 6 أرقام عبر رسالة قصيرة إلى الرقم المسجل في حسابك.', sendCode: 'استلام رمز', codeTitle: 'أدخل الرمز المستلم', code: 'الرمز المستلم عبر الرسائل', newPassword: 'كلمة مرور جديدة', changePassword: 'تغيير كلمة المرور', newCode: 'إرسال رمز جديد', back: 'العودة لتسجيل الدخول', noPhone: 'لا يوجد هاتف في حسابك؟ اطلب من الطبيب المالك تغيير كلمة المرور من صفحة الفريق.', changed: 'تم تغيير كلمة المرور. سجّل الدخول بالكلمة الجديدة.' },
  adminPage: { assistants_one: 'مساعد(ة) واحد(ة)', assistants_other: '{{count}} مساعدين', assistants: '{{count}} مساعدين', practitioners_one: 'طبيب واحد', practitioners_other: '{{count}} أطباء', assistantsUnlimited: 'مساعدون بلا حدود' },
  sub: { title: 'الاشتراك', subtitle: 'خطتك، وما تتضمنه، وكيفية تغييرها.', current: 'خطتك', until: 'حتى {{date}}', noEnd: 'بدون تاريخ انتهاء', perMonth: '{{price}} درهم / شهر', free: 'مجاني', practitioners: 'الأطباء', assistants: 'المساعدون', unlimited: 'بلا حدود', change: 'تغيير الخطة', choose: 'اختيار هذه الخطة', yours: 'خطتك', reminders: '{{count}} تذكير واتساب / رسالة شهرياً', storage: '{{count}} جيغا للأشعة والوثائق', treat: 'خطط العلاج وعروض الأسعار وجداول الدفع', stats: 'إحصائيات متقدمة', multi: 'عدة تخصصات', contactTitle: 'الانتقال إلى خطة {{plan}}', contactText: 'الدفع عبر الإنترنت قريباً. تواصل معنا وسنفعّل خطتك الجديدة في نفس اليوم.', contactMessage: 'مرحباً، أرغب في نقل عيادة {{cabinet}} إلى خطة {{plan}}.', status: { ACTIVE: 'نشط', TRIALING: 'تجربة مجانية', PAST_DUE: 'دفع متأخر', SUSPENDED: 'موقوف', CANCELLED: 'ملغى' } },
}
