-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'ASSISTANT',
    `specialty` VARCHAR(191) NULL,
    `seesAllPatients` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `cabinetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_cabinetId_idx`(`cabinetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cabinet` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `logo` VARCHAR(191) NULL,
    `letterhead` TEXT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MAD',
    `specialty` VARCHAR(191) NOT NULL DEFAULT 'DENTISTRY',
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'TRIAL',
    `subscriptionStatus` VARCHAR(191) NOT NULL DEFAULT 'TRIALING',
    `trialEndsAt` DATETIME(3) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `maxPractitioners` INTEGER NOT NULL DEFAULT 1,
    `maxAssistants` INTEGER NOT NULL DEFAULT 1,
    `monthlyMessages` INTEGER NOT NULL DEFAULT 20,
    `remindersEnabled` BOOLEAN NOT NULL DEFAULT true,
    `reminderChannel` VARCHAR(191) NOT NULL DEFAULT 'BOTH',
    `reminderLeadMinutes` VARCHAR(191) NOT NULL DEFAULT '1440,60',
    `invoiceSeq` INTEGER NOT NULL DEFAULT 0,
    `quoteSeq` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Cabinet_name_idx`(`name`),
    INDEX `Cabinet_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `monthlyPrice` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `durationMonths` INTEGER NOT NULL DEFAULT 1,
    `maxPractitioners` INTEGER NOT NULL DEFAULT 1,
    `maxAssistants` INTEGER NOT NULL DEFAULT 1,
    `monthlyMessages` INTEGER NOT NULL DEFAULT 100,
    `storageGb` INTEGER NOT NULL DEFAULT 5,
    `permissions` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Plan_code_key`(`code`),
    INDEX `Plan_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DefaultAct` (
    `id` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `category` VARCHAR(191) NOT NULL DEFAULT 'AUTRE',
    `scope` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `usesFaces` BOOLEAN NOT NULL DEFAULT false,
    `resultingState` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DefaultAct_specialty_code_key`(`specialty`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Specialty` (
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionHistory` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SubscriptionHistory_cabinetId_createdAt_idx`(`cabinetId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `stripeSessionId` VARCHAR(191) NULL,
    `stripeInvoiceId` VARCHAR(191) NULL,
    `plan` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(65, 30) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MAD',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `invoiceUrl` VARCHAR(191) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `periodEnd` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paidAt` DATETIME(3) NULL,

    UNIQUE INDEX `BillingInvoice_stripeSessionId_key`(`stripeSessionId`),
    UNIQUE INDEX `BillingInvoice_stripeInvoiceId_key`(`stripeInvoiceId`),
    INDEX `BillingInvoice_cabinetId_createdAt_idx`(`cabinetId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `toPhone` VARCHAR(191) NULL,
    `toUserId` VARCHAR(191) NULL,
    `fromUserId` VARCHAR(191) NULL,
    `fromName` VARCHAR(191) NULL,
    `fromPhone` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `error` TEXT NULL,
    `providerId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `dedupeKey` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Message_dedupeKey_key`(`dedupeKey`),
    INDEX `Message_cabinetId_createdAt_idx`(`cabinetId`, `createdAt`),
    INDEX `Message_toUserId_readAt_idx`(`toUserId`, `readAt`),
    INDEX `Message_kind_createdAt_idx`(`kind`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `cabinetId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `status` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_cabinetId_createdAt_idx`(`cabinetId`, `createdAt`),
    INDEX `AuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatientAccessLog` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PatientAccessLog_cabinetId_createdAt_idx`(`cabinetId`, `createdAt`),
    INDEX `PatientAccessLog_patientId_createdAt_idx`(`patientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportAccessGrant` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `grantedById` VARCHAR(191) NOT NULL,
    `readOnly` BOOLEAN NOT NULL DEFAULT true,
    `reason` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupportAccessGrant_cabinetId_expiresAt_idx`(`cabinetId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSettings` (
    `id` VARCHAR(191) NOT NULL,
    `businessName` VARCHAR(191) NULL,
    `businessLogo` VARCHAR(191) NULL,
    `supportPhone` VARCHAR(191) NULL,
    `supportEmail` VARCHAR(191) NULL,
    `supportWhatsapp` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Patient` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `sex` VARCHAR(191) NULL,
    `birthDate` DATETIME(3) NULL,
    `cin` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `coverage` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `coverageNumber` VARCHAR(191) NULL,
    `bloodGroup` VARCHAR(191) NULL,
    `medicalHistory` TEXT NULL,
    `surgicalHistory` TEXT NULL,
    `familyHistory` TEXT NULL,
    `currentTreatments` TEXT NULL,
    `allergies` TEXT NULL,
    `dentition` VARCHAR(191) NULL,
    `primaryPractitionerId` VARCHAR(191) NULL,
    `consentDataAt` DATETIME(3) NULL,
    `consentRemindersAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Patient_cabinetId_lastName_idx`(`cabinetId`, `lastName`),
    INDEX `Patient_cabinetId_phone_idx`(`cabinetId`, `phone`),
    INDEX `Patient_cabinetId_cin_idx`(`cabinetId`, `cin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NULL,
    `practitionerId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL DEFAULT 30,
    `type` VARCHAR(191) NOT NULL DEFAULT 'CONSULTATION',
    `reason` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `walkIn` BOOLEAN NOT NULL DEFAULT false,
    `arrivedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancellationReason` VARCHAR(191) NULL,
    `remindersSent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Appointment_cabinetId_date_idx`(`cabinetId`, `date`),
    INDEX `Appointment_practitionerId_date_idx`(`practitionerId`, `date`),
    INDEX `Appointment_patientId_idx`(`patientId`),
    INDEX `Appointment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Consultation` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `practitionerId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `specialty` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` TEXT NULL,
    `examination` TEXT NULL,
    `vitals` TEXT NULL,
    `diagnosis` TEXT NULL,
    `plan` TEXT NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `lockedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Consultation_cabinetId_patientId_date_idx`(`cabinetId`, `patientId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsultationRevision` (
    `id` VARCHAR(191) NOT NULL,
    `consultationId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsultationRevision_consultationId_version_idx`(`consultationId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prescription` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `practitionerId` VARCHAR(191) NOT NULL,
    `consultationId` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `items` TEXT NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Prescription_cabinetId_patientId_date_idx`(`cabinetId`, `patientId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrescriptionTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `practitionerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `items` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PrescriptionTemplate_cabinetId_idx`(`cabinetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MedicalDocument` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `practitionerId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MedicalDocument_cabinetId_patientId_createdAt_idx`(`cabinetId`, `patientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `title` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `teeth` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Attachment_cabinetId_patientId_createdAt_idx`(`cabinetId`, `patientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Act` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `category` VARCHAR(191) NOT NULL DEFAULT 'AUTRE',
    `scope` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `usesFaces` BOOLEAN NOT NULL DEFAULT false,
    `resultingState` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Act_cabinetId_isActive_idx`(`cabinetId`, `isActive`),
    UNIQUE INDEX `Act_cabinetId_code_key`(`cabinetId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `practitionerId` VARCHAR(191) NULL,
    `number` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `total` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `paid` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Invoice_cabinetId_date_idx`(`cabinetId`, `date`),
    INDEX `Invoice_patientId_idx`(`patientId`),
    UNIQUE INDEX `Invoice_cabinetId_number_key`(`cabinetId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `actId` VARCHAR(191) NULL,
    `dentalActId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `teeth` VARCHAR(191) NULL,
    `faces` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(65, 30) NOT NULL,
    `total` DECIMAL(65, 30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InvoiceItem_dentalActId_key`(`dentalActId`),
    INDEX `InvoiceItem_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `quoteId` VARCHAR(191) NULL,
    `method` VARCHAR(191) NOT NULL DEFAULT 'CASH',
    `amount` DECIMAL(65, 30) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_cabinetId_paidAt_idx`(`cabinetId`, `paidAt`),
    INDEX `Payment_patientId_idx`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quote` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `treatmentPlanId` VARCHAR(191) NULL,
    `practitionerId` VARCHAR(191) NULL,
    `number` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `total` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `acceptedAt` DATETIME(3) NULL,
    `installments` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quote_treatmentPlanId_key`(`treatmentPlanId`),
    INDEX `Quote_patientId_idx`(`patientId`),
    UNIQUE INDEX `Quote_cabinetId_number_key`(`cabinetId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteItem` (
    `id` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NOT NULL,
    `actId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `teeth` VARCHAR(191) NULL,
    `faces` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(65, 30) NOT NULL,
    `total` DECIMAL(65, 30) NOT NULL,

    INDEX `QuoteItem_quoteId_idx`(`quoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ToothState` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `tooth` INTEGER NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'HEALTHY',
    `faces` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ToothState_cabinetId_idx`(`cabinetId`),
    UNIQUE INDEX `ToothState_patientId_tooth_key`(`patientId`, `tooth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DentalAct` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `practitionerId` VARCHAR(191) NOT NULL,
    `treatmentPlanId` VARCHAR(191) NULL,
    `actId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'TOOTH',
    `teeth` VARCHAR(191) NULL,
    `faces` VARCHAR(191) NULL,
    `price` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `resultingState` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `session` INTEGER NULL,
    `performedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DentalAct_cabinetId_patientId_status_idx`(`cabinetId`, `patientId`, `status`),
    INDEX `DentalAct_treatmentPlanId_idx`(`treatmentPlanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreatmentPlan` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `practitionerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PROPOSED',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreatmentPlan_cabinetId_patientId_idx`(`cabinetId`, `patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionHistory` ADD CONSTRAINT `SubscriptionHistory_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingInvoice` ADD CONSTRAINT `BillingInvoice_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientAccessLog` ADD CONSTRAINT `PatientAccessLog_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportAccessGrant` ADD CONSTRAINT `SupportAccessGrant_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Patient` ADD CONSTRAINT `Patient_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_practitionerId_fkey` FOREIGN KEY (`practitionerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_practitionerId_fkey` FOREIGN KEY (`practitionerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationRevision` ADD CONSTRAINT `ConsultationRevision_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescription` ADD CONSTRAINT `Prescription_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescription` ADD CONSTRAINT `Prescription_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescription` ADD CONSTRAINT `Prescription_practitionerId_fkey` FOREIGN KEY (`practitionerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrescriptionTemplate` ADD CONSTRAINT `PrescriptionTemplate_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicalDocument` ADD CONSTRAINT `MedicalDocument_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MedicalDocument` ADD CONSTRAINT `MedicalDocument_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Act` ADD CONSTRAINT `Act_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_treatmentPlanId_fkey` FOREIGN KEY (`treatmentPlanId`) REFERENCES `TreatmentPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteItem` ADD CONSTRAINT `QuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ToothState` ADD CONSTRAINT `ToothState_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ToothState` ADD CONSTRAINT `ToothState_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DentalAct` ADD CONSTRAINT `DentalAct_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DentalAct` ADD CONSTRAINT `DentalAct_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DentalAct` ADD CONSTRAINT `DentalAct_practitionerId_fkey` FOREIGN KEY (`practitionerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DentalAct` ADD CONSTRAINT `DentalAct_treatmentPlanId_fkey` FOREIGN KEY (`treatmentPlanId`) REFERENCES `TreatmentPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPlan` ADD CONSTRAINT `TreatmentPlan_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPlan` ADD CONSTRAINT `TreatmentPlan_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPlan` ADD CONSTRAINT `TreatmentPlan_practitionerId_fkey` FOREIGN KEY (`practitionerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

