-- CreateTable
CREATE TABLE `TrialRequest` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `cabinetName` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `specialty` VARCHAR(191) NULL,
    `doctors` INTEGER NULL,
    `message` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'NEW',
    `notes` TEXT NULL,
    `cabinetId` VARCHAR(191) NULL,
    `handledById` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrialRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `TrialRequest_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

