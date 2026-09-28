-- AlterTable
ALTER TABLE `Patient` ADD COLUMN `insuredName` VARCHAR(191) NULL,
    ADD COLUMN `complementaryInsurance` VARCHAR(191) NULL,
    ADD COLUMN `complementaryNumber` VARCHAR(191) NULL;

-- "AMO" alone did not say which body pays: most AMO patients are CNSS members (private sector).
UPDATE `Patient` SET `coverage` = 'CNSS' WHERE `coverage` = 'AMO';
