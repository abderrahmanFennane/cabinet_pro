-- AlterTable
ALTER TABLE `User` ADD COLUMN `totpSecret` TEXT NULL,
    ADD COLUMN `totpEnabledAt` DATETIME(3) NULL,
    ADD COLUMN `recoveryCodes` TEXT NULL,
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;
