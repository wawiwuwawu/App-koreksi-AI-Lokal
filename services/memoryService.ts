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

    // Total character budget for the memory context (approx 2000-2500 tokens)
    const TOTAL_CHAR_BUDGET = 8000;
    const limitPerAssignment = Math.max(1000, Math.floor(TOTAL_CHAR_BUDGET / assignments.length));

    return assignments
      .map((ass, index) => {
        // Clean up excessive whitespace to save tokens
        const cleanedText = ass.extractedText
          .replace(/[ \t]+/g, " ")
          .replace(/\n\s*\n+/g, "\n")
          .trim();

        // Truncate comparison text to prevent overloading the local LLM's context window
        const truncatedText =
          cleanedText.length > limitPerAssignment
            ? cleanedText.substring(0, limitPerAssignment) + "... [teks dipotong]"
            : cleanedText;

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
