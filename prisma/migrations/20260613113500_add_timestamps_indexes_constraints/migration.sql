-- AlterTable: Add updatedAt columns with default value for existing rows
ALTER TABLE `course` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `class` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `task` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `assignment` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex: Add indexes for foreign keys and frequently queried columns
CREATE INDEX `course_lecturerId_idx` ON `course`(`lecturerId`);

CREATE INDEX `class_courseId_idx` ON `class`(`courseId`);

CREATE INDEX `task_classId_idx` ON `task`(`classId`);

CREATE INDEX `assignment_taskId_idx` ON `assignment`(`taskId`);

CREATE INDEX `assignment_status_idx` ON `assignment`(`status`);

CREATE INDEX `assignment_textHash_idx` ON `assignment`(`textHash`);

CREATE INDEX `assignment_duplicateOfId_idx` ON `assignment`(`duplicateOfId`);

CREATE INDEX `assignment_taskId_status_idx` ON `assignment`(`taskId`, `status`);

-- CreateIndex: Add unique constraints
CREATE UNIQUE INDEX `course_code_lecturerId_key` ON `course`(`code`, `lecturerId`);

CREATE UNIQUE INDEX `class_name_courseId_key` ON `class`(`name`, `courseId`);

CREATE UNIQUE INDEX `task_title_classId_key` ON `task`(`title`, `classId`);

CREATE UNIQUE INDEX `assignment_studentName_taskId_key` ON `assignment`(`studentName`, `taskId`);
