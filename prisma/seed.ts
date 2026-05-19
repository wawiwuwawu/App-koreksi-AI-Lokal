import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
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
  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
