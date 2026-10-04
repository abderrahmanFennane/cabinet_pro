-- CreateTable
CREATE TABLE `Drug` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `dci` VARCHAR(191) NULL,
    `dosage` VARCHAR(191) NULL,
    `form` VARCHAR(191) NULL,
    `presentation` VARCHAR(191) NULL,
    `ppv` DECIMAL(10, 2) NULL,
    `refundRate` INTEGER NULL,
    `generic` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Drug_code_key`(`code`),
    INDEX `Drug_name_idx`(`name`),
    INDEX `Drug_dci_idx`(`dci`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
