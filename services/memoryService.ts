import { prisma } from "@/lib/db";

/**
 * Fetches the last N assignments that have been successfully graded (status: "done")
 * and formats them into a comparison context string for plagiarism detection.
 */
export async function getSlidingWindowContext(limit: number, taskId: string): Promise<string> {
  if (limit <= 0) return "";

  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        taskId,
        status: "done",
        score: { not: null },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        studentName: true,
        extractedText: true,
        score: true,
      },
    });

    if (assignments.length === 0) {
      return "Belum ada tugas terdahulu yang dinilai sebagai pembanding.";
    }

    return assignments
      .map((ass, index) => {
        // Truncate comparison text to prevent overloading the local LLM's context window
        const truncatedText =
          ass.extractedText.length > 3000
            ? ass.extractedText.substring(0, 3000) + "... [teks dipotong]"
            : ass.extractedText;

        return `TUGAS PEMBANDING #${index + 1}:
Nama Mahasiswa: ${ass.studentName}
Nilai yang Diberikan: ${ass.score}
Potongan Isi Tugas:
"""
${truncatedText}
"""
-----------------------------------------`;
      })
      .join("\n\n");
  } catch (error) {
    console.error("Error generating sliding window context:", error);
    return "Gagal memuat memori tugas pembanding.";
  }
}
