-- CreateTable
CREATE TABLE `ClinicalRecord` (
    `id` VARCHAR(191) NOT NULL,
    `cabinetId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `practitionerId` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `data` TEXT NOT NULL,
    `private` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ClinicalRecord_cabinetId_patientId_specialty_date_idx`(`cabinetId`, `patientId`, `specialty`, `date`),
    INDEX `ClinicalRecord_patientId_kind_idx`(`patientId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClinicalRecord` ADD CONSTRAINT `ClinicalRecord_cabinetId_fkey` FOREIGN KEY (`cabinetId`) REFERENCES `Cabinet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalRecord` ADD CONSTRAINT `ClinicalRecord_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalRecord` ADD CONSTRAINT `ClinicalRecord_practitionerId_fkey` FOREIGN KEY (`practitionerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
