-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `seriesId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Cabinet` ADD COLUMN `setupGuideHiddenAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Consultation` ADD COLUMN `diagnosisCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `lastReminderAt` DATETIME(3) NULL,
    ADD COLUMN `reminderCount` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `CashClosing` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `totals` TEXT NOT NULL,
    `expectedCash` DECIMAL(12, 2) NOT NULL,
    `countedCash` DECIMAL(12, 2) NOT NULL,
    `difference` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `closedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CashClosing_cabinetId_day_key`(`cabinetId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsultationTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `examination` TEXT NULL,
    `diagnosis` TEXT NULL,
    `diagnosisCode` VARCHAR(191) NULL,
    `plan` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConsultationTemplate_cabinetId_idx`(`cabinetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentShare` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `refId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `openedAt` DATETIME(3) NULL,
    `openCount` INTEGER NOT NULL DEFAULT 0,
    `failedTries` INTEGER NOT NULL DEFAULT 0,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DocumentShare_token_key`(`token`),
    INDEX `DocumentShare_cabinetId_patientId_idx`(`cabinetId`, `patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiagnosisCode` (
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `chapter` VARCHAR(191) NULL,

    INDEX `DiagnosisCode_label_idx`(`label`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Appointment_seriesId_idx` ON `Appointment`(`seriesId`);

-- AddForeignKey
ALTER TABLE `CashClosing` ADD CONSTRAINT `CashClosing_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationTemplate` ADD CONSTRAINT `ConsultationTemplate_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentShare` ADD CONSTRAINT `DocumentShare_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

