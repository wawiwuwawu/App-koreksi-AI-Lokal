import { prisma } from "@/lib/db";
import {
  downloadFileFromGoogleDrive,
  processPDF,
} from "./pdfService";
import { getSlidingWindowContext } from "./memoryService";
import { evaluateAssignment } from "./aiService";
import { createHash } from "crypto";

/**
 * Orchestrates the full AI grading workflow:
 * 1. Mark status as "processing"
 * 2. Fetch Task and Rubric details
 * 3. Download PDF from Google Drive
 * 4. Extract text and render pages to images in one pass
 * 5. Fetch previous grades for the same task (sliding window)
 * 6. Query local multimodal LLM
 * 7. Write results (score, feedback, plagiarism analysis) to database
 */
export async function processSubmission(assignmentId: string) {
  try {
    // 1. Mark the assignment status as processing
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: "processing" },
    });

    // 2. Fetch Assignment and Task Details
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        task: true,
      },
    });

    if (!assignment || !assignment.task) {
      throw new Error(`Assignment or Task not found for ID: ${assignmentId}`);
    }

    const { driveFileUrl, studentName, taskId } = assignment;
    if (!driveFileUrl) {
      throw new Error(`No Drive File URL provided for student: ${studentName}`);
    }

    const rubric = assignment.task.rubric;
    const windowSize = assignment.task.windowSize;
    const duplicateScore = assignment.task.duplicateScore ?? 50;

    // 3. Download Google Drive File
    console.log(
      `[GradingPipeline] Downloading file for ${studentName} from: ${driveFileUrl}`
    );
    const pdfBuffer = await downloadFileFromGoogleDrive(driveFileUrl);

    // 4. Process PDF text and screenshots in one pass
    console.log(`[GradingPipeline] Extracting text and rendering screenshots...`);
    const { extractedText, base64Images, imageHashes } = await processPDF(pdfBuffer);
    const textHash = hashNormalizedText(extractedText);
    const imageHashesSerialized = JSON.stringify(imageHashes);

    const duplicateCandidate = await findDuplicateCandidate({
      assignmentId,
      taskId,
      textHash,
      imageHashes,
      extractedText,
    });

    if (duplicateCandidate) {
      const duplicateNote = `Duplikat terdeteksi (${duplicateCandidate.reason}) dengan ${duplicateCandidate.studentName}. Nilai disamakan menjadi ${duplicateScore}.`;

      await prisma.$transaction([
        prisma.assignment.update({
          where: { id: assignmentId },
          data: {
            extractedText,
            textHash,
            imageHashes: imageHashesSerialized,
            isDuplicate: true,
            duplicateOfId: duplicateCandidate.id,
            duplicateReason: duplicateCandidate.reason,
            duplicateSimilarity: duplicateCandidate.similarity,
            score: duplicateScore,
            status: "done",
            plagiarismNote: duplicateNote,
          },
        }),
        prisma.assignment.update({
          where: { id: duplicateCandidate.id },
          data: {
            score: duplicateScore,
            status: "done",
            plagiarismNote: `Nilai disamakan karena duplikat dengan ${studentName}.`,
          },
        }),
      ]);

      return;
    }

    // 5. Retrieve Memory sliding window context
    console.log(
      `[GradingPipeline] Fetching sliding window context (size: ${windowSize}, taskId: ${taskId})...`
    );
    const memoryContext = await getSlidingWindowContext(windowSize, taskId);

    // 6. Request Grading and Plagiarism Check from AI
    console.log(`[GradingPipeline] Sending query to local LLM...`);
    const result = await evaluateAssignment({
      studentName,
      extractedText,
      base64Images,
      memoryContext,
      rubric,
    });

    // 7. Update DB with success outcomes
    console.log(
      `[GradingPipeline] Process complete. Student: ${studentName}, Score: ${result.score}`
    );
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        extractedText,
        textHash,
        imageHashes: imageHashesSerialized,
        score: result.score,
        feedback: result.feedback,
        plagiarismNote: result.plagiarismNote,
        status: "done",
      },
    });
  } catch (error: any) {
    console.error(
      `[GradingPipeline] Failure processing submission:`,
      error
    );

    // Log the error and mark status as failed
    try {
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          status: "failed",
          errorMessage: error?.message || String(error),
        },
      });
    } catch (dbError) {
      console.error("[GradingPipeline] Failed to log failure status to database:", dbError);
    }
  }
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashNormalizedText(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  return createHash("sha256").update(normalized).digest("hex");
}

function buildShingles(tokens: string[], size: number): Set<string> {
  if (tokens.length === 0) return new Set();
  if (tokens.length < size) return new Set([tokens.join(" ")]);
  const shingles = new Set<string>();
  for (let i = 0; i <= tokens.length - size; i += 1) {
    shingles.add(tokens.slice(i, i + size).join(" "));
  }
  return shingles;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function parseImageHashes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((val) => typeof val === "string");
    }
    return [];
  } catch {
    return [];
  }
}

async function findDuplicateCandidate(params: {
  assignmentId: string;
  taskId: string;
  textHash: string;
  imageHashes: string[];
  extractedText: string;
}) {
  const { assignmentId, taskId, textHash, imageHashes, extractedText } = params;
  const candidates = await prisma.assignment.findMany({
    where: {
      taskId,
      id: { not: assignmentId },
      extractedText: { not: "" },
    },
    select: {
      id: true,
      studentName: true,
      textHash: true,
      imageHashes: true,
      extractedText: true,
    },
  });

  const normalizedTokens = normalizeText(extractedText)
    .split(" ")
    .filter((token) => token.length > 2);
  const currentShingles = buildShingles(normalizedTokens, 5);

  let best: { id: string; studentName: string; reason: string; similarity: number } | null = null;

  for (const candidate of candidates) {
    const candidateImageHashes = parseImageHashes(candidate.imageHashes);
    const hasImageMatch =
      imageHashes.length > 0 &&
      candidateImageHashes.some((hash) => imageHashes.includes(hash));
    if (hasImageMatch) {
      return {
        id: candidate.id,
        studentName: candidate.studentName,
        reason: "image-match",
        similarity: 1,
      };
    }

    if (candidate.textHash && textHash && candidate.textHash === textHash) {
      best = {
        id: candidate.id,
        studentName: candidate.studentName,
        reason: "text-identical",
        similarity: 1,
      };
      continue;
    }

    const candidateTokens = normalizeText(candidate.extractedText)
      .split(" ")
      .filter((token) => token.length > 2);
    const candidateShingles = buildShingles(candidateTokens, 5);
    const similarity = jaccardSimilarity(currentShingles, candidateShingles);
    if (similarity >= 0.8) {
      if (!best || similarity > best.similarity) {
        best = {
          id: candidate.id,
          studentName: candidate.studentName,
          reason: "text-similarity",
          similarity,
        };
      }
    }
  }

  return best;
}
