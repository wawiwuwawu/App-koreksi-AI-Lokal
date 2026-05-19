-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "driveFileUrl" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "taskId" TEXT;
