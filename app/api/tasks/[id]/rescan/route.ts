import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) return unauthorizedResponse();

    const { id: taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        class: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.class.course.lecturerId !== sessionId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const assignments = await prisma.assignment.findMany({
      where: { taskId, status: "done" },
      orderBy: { createdAt: "asc" },
    });

    const duplicateScore = task.duplicateScore ?? 50;
    let resetCount = 0;
    let newDuplicateCount = 0;

    const normalizeText = (txt: string) => {
      return txt
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    const parseImageHashes = (str: string | null): string[] => {
      if (!str) return [];
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          return parsed.filter((val) => typeof val === "string");
        }
        return [];
      } catch {
        return [];
      }
    };

    for (let i = 0; i < assignments.length; i++) {
      const current = assignments[i];
      const priorAssignments = assignments.slice(0, i);
      let duplicateCandidate: { id: string; studentName: string; reason: string; similarity: number } | null = null;

      if (current.textHash && current.extractedText) {
        const normalizedTokens = normalizeText(current.extractedText)
          .split(" ")
          .filter((token) => token.length > 2);

        const currentShingles = new Set<string>();
        for (let j = 0; j <= normalizedTokens.length - 5; j++) {
          currentShingles.add(normalizedTokens.slice(j, j + 5).join(" "));
        }

        const imageHashes = parseImageHashes(current.imageHashes);

        for (const prior of priorAssignments) {
          if (prior.textHash && prior.textHash === current.textHash) {
            duplicateCandidate = { id: prior.id, studentName: prior.studentName, reason: "text-identical", similarity: 1 };
            break;
          }

          const priorTokens = normalizeText(prior.extractedText)
            .split(" ")
            .filter((token) => token.length > 2);
          const priorShingles = new Set<string>();
          for (let j = 0; j <= priorTokens.length - 5; j++) {
            priorShingles.add(priorTokens.slice(j, j + 5).join(" "));
          }

          let intersectionSize = 0;
          for (const shingle of currentShingles) {
            if (priorShingles.has(shingle)) {
              intersectionSize++;
            }
          }
          const unionSize = currentShingles.size + priorShingles.size - intersectionSize;
          const similarity = unionSize > 0 ? intersectionSize / unionSize : 0;

          const priorImageHashes = parseImageHashes(prior.imageHashes);
          const matchingImagesCount = imageHashes.filter((hash: string) =>
            priorImageHashes.includes(hash)
          ).length;

          const isVisualDuplicate =
            matchingImagesCount >= 2 || (matchingImagesCount === 1 && similarity >= 0.4);

          if (isVisualDuplicate) {
            duplicateCandidate = { id: prior.id, studentName: prior.studentName, reason: "image-match", similarity: 1 };
            break;
          }

          if (similarity >= 0.7) {
            duplicateCandidate = { id: prior.id, studentName: prior.studentName, reason: "text-similarity", similarity };
            break;
          }
        }
      }

      if (duplicateCandidate) {
        newDuplicateCount++;
        const duplicateNote = `Duplikat terdeteksi (${duplicateCandidate.reason}) dengan ${duplicateCandidate.studentName}. Nilai disamakan menjadi ${duplicateScore}.`;

        await prisma.$transaction([
          prisma.assignment.update({
            where: { id: current.id },
            data: {
              isDuplicate: true,
              duplicateOfId: duplicateCandidate.id,
              duplicateReason: duplicateCandidate.reason,
              duplicateSimilarity: duplicateCandidate.similarity,
              score: duplicateScore,
              plagiarismNote: duplicateNote,
            },
          }),
          prisma.assignment.update({
            where: { id: duplicateCandidate.id },
            data: {
              score: duplicateScore,
              plagiarismNote: `Nilai disamakan karena duplikat dengan ${current.studentName}.`,
            },
          }),
        ]);
      } else {
        if (current.isDuplicate && current.duplicateReason !== "manual") {
          resetCount++;
          await prisma.assignment.update({
            where: { id: current.id },
            data: {
              isDuplicate: false,
              duplicateOfId: null,
              duplicateReason: null,
              duplicateSimilarity: null,
              plagiarismNote: "Status duplikat dibatalkan setelah pemindaian ulang kelas.",
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Pemindaian ulang duplikasi selesai",
      details: {
        totalScanned: assignments.length,
        resetDuplicates: resetCount,
        newDuplicatesFlagged: newDuplicateCount,
      },
    });
  } catch (error: any) {
    console.error("[Task Rescan POST] Error:", error);
    return NextResponse.json(
      { error: "Gagal memindai ulang", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
