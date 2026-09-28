# Cabinet Pro

Plateforme SaaS de gestion de cabinets médicaux multi-spécialités, construite sur le socle de Barber Shop.
Cette première version couvre le **lot 1 (socle)** et le **lot 2 (module dentiste)** du cahier des charges v1.0 du 27/09/2026.

- **Frontend** : React 18, Vite, Tailwind, TanStack Query, i18next (français, arabe RTL, anglais)
- **Backend** : Node.js, Express, Prisma, MySQL, JWT
- **Multi-cabinets** : chaque donnée est rattachée à un cabinet ; toutes les routes métier passent par `/api/cabinets/:cabinetId/…`

## Démarrer en local

Prérequis : Node 20, MySQL 8.

```bash
# Backend
cd backend
cp ../.env.example .env        # puis renseigner DATABASE_URL, SHADOW_DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate deploy      # crée les tables
npm run prisma:seed            # plans, spécialités, actes par défaut, Super Admin, cabinet de démonstration
npm run dev                    # http://localhost:4100

# Frontend (autre terminal)
cd frontend
npm install
npm run dev                    # http://localhost:5174 (proxy /api -> 4100)
```

Ou avec Docker : `JWT_SECRET=… MYSQL_ROOT_PASSWORD=… SEED_DATABASE=true docker compose up --build` (frontend sur le port 3100).

Tests backend : `cd backend && npm test`.

### Comptes créés par le seed

| Compte | Mot de passe | Rôle |
| --- | --- | --- |
| superadmin@cabinetpro.ma | Admin123! | Super Admin (modifiable par `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`) |
| demo.dentiste@cabinetpro.ma | Demo1234! | Médecin titulaire, dentiste |
| demo.generaliste@cabinetpro.ma | Demo1234! | Médecin collaborateur, médecine générale |
| demo.assistant@cabinetpro.ma | Demo1234! | Assistante |

Le cabinet de démonstration contient des patients fictifs, dont Karim El Amrani (schéma dentaire de l’exemple du cahier des charges, plan de traitement avec devis accepté, échéancier et premier paiement), une enfant de 4 ans (denture temporaire) et un enfant de 8 ans (denture mixte). Relancer le seed recrée ce cabinet ; `SEED_DEMO=false` le désactive.

## Rôles et droits

Les droits effectifs d’un utilisateur = droits de son rôle ∩ fonctions incluses dans le plan du cabinet (`backend/src/types/permissions.ts`).

| Rôle | Accès |
| --- | --- |
| Super Admin | Cabinets, plans, spécialités, factures SaaS, messages, audit. Ouvre le **cabinet de démonstration** librement ; un cabinet réel **uniquement** si le titulaire a autorisé un accès support (limité dans le temps, lecture seule, journalisé). |
| Médecin titulaire | Tout son cabinet : équipe, tarifs, paramètres, abonnement, journal d’accès. |
| Médecin collaborateur | Son agenda ; ses patients (ou tout le cabinet si le titulaire l’autorise) ; ses encaissements et statistiques. |
| Assistant(e) | Accueil, agenda, salle d’attente, fiche administrative, encaissement, impression. **Aucun** accès au contenu médical : toute tentative est refusée et journalisée. |

## Ce qui est livré

**Socle commun**
- Dossier patient : fiche administrative, couverture AMO/CNOPS/mutuelle, antécédents, allergies en bandeau sur toutes les pages, détection des doublons, consentements horodatés, chronologie unique, pièces jointes (radios, analyses, PDF) stockées hors du dossier public et servies par une route authentifiée.
- Agenda jour / semaine / mois par praticien (grille sur tablette et ordinateur, liste sur téléphone), statuts, contrôle des chevauchements, salle d’attente en temps réel avec temps d’attente et patients sans rendez-vous.
- Consultation avec constantes ; une consultation terminée est verrouillée, chaque correction crée une version datée et signée.
- Ordonnances (recherche de médicaments, ordonnances types, renouvellement en un clic), certificats, arrêts de travail, lettres d’orientation, demandes d’examens ; impression A4 à l’en-tête du cabinet (PDF via le navigateur).
- Catalogue d’actes et tarifs, factures numérotées, paiements partiels (espèces, carte, virement, chèque), caisse du jour, devis et échéanciers.
- Rappels WhatsApp / SMS la veille et une heure avant (délais réglables), uniquement aux patients consentants, sans information médicale, dans la limite du quota mensuel du plan.
- Tableau de bord : rendez-vous du jour, encaissements, impayés, taux d’absence, actes fréquents, nouveaux patients, plans de traitement en cours ; statistiques sur 6 mois pour les plans Pro et Clinique.
- Journal de toutes les ouvertures de dossiers, verrouillage de session après 15 minutes d’inactivité.

**Module dentiste**
- Odontogramme FDI : denture temporaire, mixte ou permanente choisie selon l’âge, changement de vue manuel.
- 11 états de dent, chacun avec une couleur **et** un motif + une abréviation (lisible par les personnes daltoniennes) ; faces M, D, O/I, V, L/P.
- Fiche de dent : état, faces, notes, historique daté avec le praticien, radios rattachées, actes planifiés.
- Actes du catalogue sur une dent, plusieurs dents, un quadrant ou toute la bouche ; réaliser un acte met à jour l’état de la dent (ex. extraction → absente) et l’ajoute à la facture du jour.
- Plans de traitement par séances, devis généré depuis le plan, acceptation, échéancier, reste à payer mis à jour à chaque paiement. Les actes d’un plan dont le devis est accepté ne sont pas refacturés.
- Téléphone : un quadrant à la fois (4 onglets + glissement), dents d’au moins 44 px, fiche de dent en panneau montant ; ordinateur : fiche en panneau latéral.

**Super Admin** : cabinets (création avec titulaire, spécialité, plan, quotas, suspension), plans et fonctions incluses, spécialités et catalogues d’actes par défaut, chiffres SaaS (revenu récurrent, essais, conversions, répartition par spécialité), factures, messages aux titulaires, journal d’audit, essai gratuit et page de renouvellement.

## Critères de recette (section 13)

| Critère | Où c’est géré |
| --- | --- |
| Patient de 8 ans → denture mixte sans réglage | `utils/dental.ts` `dentitionForAge`, testé dans `test/dental.test.cjs` |
| Extraction sur la 46 → dent absente + historique + facture | `routes/cabinet/dental.routes.ts` `performAct` |
| Devis depuis un plan, reste à payer après chaque paiement | `POST …/plans/:id/quote`, `utils/billing.ts` `quoteBalance` |
| Téléphone 360 px : schéma par quadrant sans défilement horizontal | `components/dental/Odontogram.tsx` |
| Assistant : consultation et fiche de dent refusées et journalisées | `middleware/auth.ts` `requireMedicalAccess` |
| Plan Essentiel sans plans de traitement, visibles dès le plan Pro | clé `DENTAL_TREATMENT_PLAN` des plans (seed) |
| Super Admin : démo oui, dossier réel non sans autorisation | `middleware/auth.ts` `requireCabinetAccess` |
| Chaque ouverture de dossier dans le journal d’accès | `utils/patient-scope.ts` `logPatientAccess`, Paramètres → Confidentialité |
| Rappel WhatsApp sans information médicale | `jobs/reminders.ts` |

## Pas encore fait

- **Sécurité** : double authentification des médecins et du Super Admin, chiffrement au repos des champs médicaux et des pièces jointes.
- **Traductions** : la navigation, les rôles, les statuts et le vocabulaire dentaire existent en français, arabe et anglais ; le texte des nouveaux écrans est encore en français seulement.
- **Base médicaments** : une liste de départ (`backend/src/data/drugs.ts`) complétée par les médicaments déjà prescrits dans le cabinet ; la base nationale reste à brancher.
- Prévu en V2 / V3 par le cahier des charges : codage CIM-10, feuille de soins AMO/CNOPS, relances d’impayés, rendez-vous récurrents, historique visuel de l’odontogramme, charting parodontal, autres spécialités, portail patient, paiement CMI.
- Les points de la section 14 (nom, tarifs, nomenclature ANAM, hébergement, signature électronique…) sont à valider. Les prix des plans et des actes du seed sont indicatifs.

## Structure

```
backend/
  prisma/schema.prisma            modèles (socle + dentaire)
  prisma/seed.ts                  plans, spécialités, actes par défaut, démo
  src/middleware/auth.ts          authentification, droits, accès cabinet et médical
  src/routes/cabinet/             routes d’un cabinet : patients, médical, dentaire, agenda, facturation
  src/routes/*.routes.ts          plateforme : auth, cabinets, équipe, plans, spécialités, messages, audit
  src/jobs/reminders.ts           rappels de rendez-vous et d’expiration d’abonnement
frontend/src/
  components/dental/              odontogramme, fiche de dent, actes, plans de traitement
  components/patient/             onglets du dossier patient
  pages/                          écrans
```
