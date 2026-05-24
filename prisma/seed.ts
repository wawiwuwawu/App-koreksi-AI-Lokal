import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  // 1. Seed SystemConfig (fallback)
  await prisma.systemConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      rubric: `Kriteria Penilaian Laporan:
1. Kesesuaian dengan topik (0-25)
2. Kedalaman analisis (0-25)
3. Struktur dan tata bahasa (0-25)
4. Orisinalitas dan referensi (0-25)
Total skor: 0-100`,
      windowSize: 3,
    },
  });

  // 2. Seed Lecturer
  const lecturer = await prisma.lecturer.upsert({
    where: { email: "dosen@example.com" },
    update: {},
    create: {
      name: "Dr. Budi Santoso",
      email: "dosen@example.com",
      password: hashPassword("password123"),
    },
  });

  // 3. Seed Course
  const course = await prisma.course.create({
    data: {
      code: "IF101",
      name: "Dasar Pemrograman",
      lecturerId: lecturer.id,
    },
  });

  // 4. Seed Class
  const clazz = await prisma.class.create({
    data: {
      name: "IF-43-01",
      courseId: course.id,
    },
  });

  // 5. Seed Tasks
  await prisma.task.create({
    data: {
      id: "TASK-001",
      title: "Tugas 1: Algoritma & Flowchart",
      rubric: `Kriteria Penilaian Tugas 1:
1. Ketepatan logika flowchart (0-40)
2. Struktur pseudo-code (0-30)
3. Penjelasan analisis (0-30)
Total skor: 0-100`,
      windowSize: 3,
      classId: clazz.id,
    },
  });

  await prisma.task.create({
    data: {
      id: "TASK-002",
      title: "Tugas 2: Looping & Array",
      rubric: `Kriteria Penilaian Tugas 2:
1. Efisiensi loop (0-35)
2. Kompleksitas memori array (0-35)
3. Kerapihan penulisan kode (0-30)
Total skor: 0-100`,
      windowSize: 3,
      classId: clazz.id,
    },
  });

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
