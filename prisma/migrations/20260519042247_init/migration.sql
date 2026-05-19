-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "score" INTEGER,
    "feedback" TEXT,
    "plagiarismNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "rubric" TEXT NOT NULL,
    "windowSize" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);
