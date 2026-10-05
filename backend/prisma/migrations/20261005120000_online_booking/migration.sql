-- AlterTable
ALTER TABLE `Cabinet` ADD COLUMN `bookingEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `bookingSlug` VARCHAR(191) NULL,
    ADD COLUMN `bookingHours` TEXT NULL,
    ADD COLUMN `bookingSlotMinutes` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `bookingAutoConfirm` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'CABINET';

-- CreateIndex
CREATE UNIQUE INDEX `Cabinet_bookingSlug_key` ON `Cabinet`(`bookingSlug`);
