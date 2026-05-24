-- AlterTable
ALTER TABLE `assignment` ADD COLUMN `duplicateOfId` VARCHAR(191) NULL,
    ADD COLUMN `duplicateReason` TEXT NULL,
    ADD COLUMN `duplicateSimilarity` DOUBLE NULL,
    ADD COLUMN `imageHashes` TEXT NULL,
    ADD COLUMN `isDuplicate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `textHash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `task` ADD COLUMN `duplicateScore` INTEGER NOT NULL DEFAULT 50;

-- AddForeignKey
ALTER TABLE `assignment` ADD CONSTRAINT `Assignment_duplicateOfId_fkey` FOREIGN KEY (`duplicateOfId`) REFERENCES `assignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
