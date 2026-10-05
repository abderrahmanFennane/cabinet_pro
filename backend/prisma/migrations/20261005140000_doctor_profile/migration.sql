-- AlterTable
ALTER TABLE `User` ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `languages` VARCHAR(191) NULL,
    ADD COLUMN `consultationFee` INTEGER NULL;
