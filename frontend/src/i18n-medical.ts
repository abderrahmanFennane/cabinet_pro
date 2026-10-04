// Navigation, roles and medical vocabulary in French, English and Arabic.
export const frMedical = {
  nav: {
    dashboard: 'Tableau de bord', agenda: 'Agenda', waitingRoom: 'Salle d’attente', patients: 'Patients', billing: 'Facturation',
    team: 'Équipe', settings: 'Paramètres', pricing: 'Abonnement', allCabinets: 'Cabinets', trialRequests: 'Demandes d’essai', plans: 'Plans', specialties: 'Spécialités',
    invoices: 'Factures SaaS', messages: 'Messages', audit: 'Journal d’audit', openMenu: 'Ouvrir le menu', closeMenu: 'Fermer le menu',
    demo: 'Cabinet de démonstration', support: 'Accès support', backToPlatform: 'Retour aux cabinets',
  },
  roles: { SUPER_ADMIN: 'Super Admin', OWNER: 'Médecin titulaire', PRACTITIONER: 'Médecin collaborateur', ASSISTANT: 'Assistant(e)' },
  specialty: {
    DENTISTRY: 'Médecine dentaire', GENERAL: 'Médecine générale', PEDIATRICS: 'Pédiatrie', GYNECOLOGY: 'Gynécologie-obstétrique',
    OPHTHALMOLOGY: 'Ophtalmologie', CARDIOLOGY: 'Cardiologie', DERMATOLOGY: 'Dermatologie', PHYSIOTHERAPY: 'Kinésithérapie', PSYCHIATRY: 'Psychiatrie / psychologie',
  },
  appointmentStatus: { PLANNED: 'Planifié', CONFIRMED: 'Confirmé', ARRIVED: 'Arrivé', IN_CONSULTATION: 'En consultation', DONE: 'Terminé', CANCELLED: 'Annulé', NO_SHOW: 'Absent' },
  toothState: {
    HEALTHY: 'Saine', CARIES: 'Carie', FILLED: 'Obturation', CROWN: 'Couronne', BRIDGE: 'Bridge', ENDO: 'Traitement canalaire',
    IMPLANT: 'Implant', MISSING: 'Absente / extraite', FRACTURED: 'Fracturée', MOBILE: 'Mobile', ERUPTING: 'En éruption',
  },
  face: { M: 'Mésiale', D: 'Distale', O: 'Occlusale', I: 'Incisive', V: 'Vestibulaire', L: 'Linguale', P: 'Palatine' },
  dentition: { PRIMARY: 'Temporaire', MIXED: 'Mixte', PERMANENT: 'Permanente' },
  coverage: { CNSS: 'CNSS (AMO)', CNOPS: 'AMO secteur public (ex-CNOPS)', AMO_TADAMON: 'AMO Tadamon', FAR: 'FAR', MUTUELLE: 'Mutuelle', PRIVATE: 'Assurance privée', NONE: 'Sans couverture', AMO: 'AMO' },
  paymentMethod: { CASH: 'Espèces', CARD: 'Carte', TRANSFER: 'Virement', CHECK: 'Chèque' },
  invoiceStatus: { OPEN: 'À payer', PARTIAL: 'Partiel', PAID: 'Payée', CANCELLED: 'Annulée' },
  quoteStatus: { DRAFT: 'Brouillon', SENT: 'Envoyé', ACCEPTED: 'Accepté', REJECTED: 'Refusé' },
  planStatus: { PROPOSED: 'Proposé', ACCEPTED: 'Accepté', IN_PROGRESS: 'En cours', DONE: 'Réalisé', CANCELLED: 'Annulé' },
  lock: { title: 'Session verrouillée', description: 'Session fermée après 15 minutes d’inactivité pour protéger les données des patients.' },
}

type Dict = typeof frMedical

export const enMedical: Dict = {
  nav: {
    dashboard: 'Dashboard', agenda: 'Schedule', waitingRoom: 'Waiting room', patients: 'Patients', billing: 'Billing',
    team: 'Team', settings: 'Settings', pricing: 'Subscription', allCabinets: 'Practices', trialRequests: 'Trial requests', plans: 'Plans', specialties: 'Specialties',
    invoices: 'SaaS invoices', messages: 'Messages', audit: 'Audit log', openMenu: 'Open menu', closeMenu: 'Close menu',
    demo: 'Demo practice', support: 'Support access', backToPlatform: 'Back to practices',
  },
  roles: { SUPER_ADMIN: 'Super Admin', OWNER: 'Practice owner', PRACTITIONER: 'Associate doctor', ASSISTANT: 'Assistant' },
  specialty: {
    DENTISTRY: 'Dentistry', GENERAL: 'General medicine', PEDIATRICS: 'Pediatrics', GYNECOLOGY: 'Obstetrics & gynecology',
    OPHTHALMOLOGY: 'Ophthalmology', CARDIOLOGY: 'Cardiology', DERMATOLOGY: 'Dermatology', PHYSIOTHERAPY: 'Physiotherapy', PSYCHIATRY: 'Psychiatry / psychology',
  },
  appointmentStatus: { PLANNED: 'Scheduled', CONFIRMED: 'Confirmed', ARRIVED: 'Arrived', IN_CONSULTATION: 'In consultation', DONE: 'Done', CANCELLED: 'Cancelled', NO_SHOW: 'No-show' },
  toothState: {
    HEALTHY: 'Healthy', CARIES: 'Caries', FILLED: 'Filling', CROWN: 'Crown', BRIDGE: 'Bridge', ENDO: 'Root canal',
    IMPLANT: 'Implant', MISSING: 'Missing / extracted', FRACTURED: 'Fractured', MOBILE: 'Mobile', ERUPTING: 'Erupting',
  },
  face: { M: 'Mesial', D: 'Distal', O: 'Occlusal', I: 'Incisal', V: 'Buccal', L: 'Lingual', P: 'Palatal' },
  dentition: { PRIMARY: 'Primary', MIXED: 'Mixed', PERMANENT: 'Permanent' },
  coverage: { CNSS: 'CNSS (AMO)', CNOPS: 'Public-sector AMO (ex-CNOPS)', AMO_TADAMON: 'AMO Tadamon', FAR: 'Armed forces (FAR)', MUTUELLE: 'Mutual insurance', PRIVATE: 'Private insurance', NONE: 'No coverage', AMO: 'AMO' },
  paymentMethod: { CASH: 'Cash', CARD: 'Card', TRANSFER: 'Transfer', CHECK: 'Cheque' },
  invoiceStatus: { OPEN: 'Unpaid', PARTIAL: 'Partial', PAID: 'Paid', CANCELLED: 'Cancelled' },
  quoteStatus: { DRAFT: 'Draft', SENT: 'Sent', ACCEPTED: 'Accepted', REJECTED: 'Rejected' },
  planStatus: { PROPOSED: 'Proposed', ACCEPTED: 'Accepted', IN_PROGRESS: 'In progress', DONE: 'Done', CANCELLED: 'Cancelled' },
  lock: { title: 'Session locked', description: 'Signed out after 15 minutes of inactivity to protect patient data.' },
}

export const arMedical: Dict = {
  nav: {
    dashboard: 'لوحة القيادة', agenda: 'المواعيد', waitingRoom: 'قاعة الانتظار', patients: 'المرضى', billing: 'الفوترة',
    team: 'الفريق', settings: 'الإعدادات', pricing: 'الاشتراك', allCabinets: 'العيادات', trialRequests: 'طلبات التجربة', plans: 'الباقات', specialties: 'التخصصات',
    invoices: 'فواتير الاشتراكات', messages: 'الرسائل', audit: 'سجل التدقيق', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة',
    demo: 'عيادة تجريبية', support: 'دخول الدعم', backToPlatform: 'العودة إلى العيادات',
  },
  roles: { SUPER_ADMIN: 'المدير العام', OWNER: 'الطبيب صاحب العيادة', PRACTITIONER: 'طبيب متعاون', ASSISTANT: 'مساعد(ة)' },
  specialty: {
    DENTISTRY: 'طب الأسنان', GENERAL: 'الطب العام', PEDIATRICS: 'طب الأطفال', GYNECOLOGY: 'أمراض النساء والتوليد',
    OPHTHALMOLOGY: 'طب العيون', CARDIOLOGY: 'أمراض القلب', DERMATOLOGY: 'الأمراض الجلدية', PHYSIOTHERAPY: 'الترويض الطبي', PSYCHIATRY: 'الطب النفسي',
  },
  appointmentStatus: { PLANNED: 'مبرمج', CONFIRMED: 'مؤكد', ARRIVED: 'حاضر', IN_CONSULTATION: 'في الفحص', DONE: 'منتهٍ', CANCELLED: 'ملغى', NO_SHOW: 'غائب' },
  toothState: {
    HEALTHY: 'سليمة', CARIES: 'تسوس', FILLED: 'حشوة', CROWN: 'تاج', BRIDGE: 'جسر', ENDO: 'علاج العصب',
    IMPLANT: 'زرعة', MISSING: 'مفقودة / مقلوعة', FRACTURED: 'مكسورة', MOBILE: 'متحركة', ERUPTING: 'في طور البزوغ',
  },
  face: { M: 'إنسي', D: 'وحشي', O: 'إطباقي', I: 'قاطع', V: 'دهليزي', L: 'لساني', P: 'حنكي' },
  dentition: { PRIMARY: 'لبنية', MIXED: 'مختلطة', PERMANENT: 'دائمة' },
  coverage: { CNSS: 'الصندوق الوطني للضمان الاجتماعي (AMO)', CNOPS: 'التأمين الإجباري للقطاع العام (سابقاً CNOPS)', AMO_TADAMON: 'أمو تضامن', FAR: 'القوات المسلحة الملكية', MUTUELLE: 'تعاضدية', PRIVATE: 'تأمين خاص', NONE: 'بدون تغطية', AMO: 'AMO' },
  paymentMethod: { CASH: 'نقداً', CARD: 'بطاقة', TRANSFER: 'تحويل', CHECK: 'شيك' },
  invoiceStatus: { OPEN: 'غير مدفوعة', PARTIAL: 'جزئي', PAID: 'مدفوعة', CANCELLED: 'ملغاة' },
  quoteStatus: { DRAFT: 'مسودة', SENT: 'مرسل', ACCEPTED: 'مقبول', REJECTED: 'مرفوض' },
  planStatus: { PROPOSED: 'مقترح', ACCEPTED: 'مقبول', IN_PROGRESS: 'قيد الإنجاز', DONE: 'منجز', CANCELLED: 'ملغى' },
  lock: { title: 'تم قفل الجلسة', description: 'تم تسجيل الخروج بعد 15 دقيقة من عدم النشاط لحماية بيانات المرضى.' },
}
