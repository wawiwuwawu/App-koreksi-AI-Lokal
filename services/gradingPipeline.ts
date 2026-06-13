import { prisma } from "@/lib/db";
import { downloadFileFromGoogleDrive } from "./pdfService";
import { processDocument } from "./documentService";
import { getSlidingWindowContext } from "./memoryService";
import { evaluateAssignment } from "./aiService";
import { createHash } from "crypto";
import { computeHammingDistance } from "./hashUtils";

/**
 * Orchestrates the full AI grading workflow:
 * 1. Mark status as "processing"
 * 2. Fetch Task and Rubric details
 * 3. Download Document (PDF/DOCX) from Google Drive
 * 4. Extract text and render pages/extract images to base64 in one pass
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
    const docBuffer = await downloadFileFromGoogleDrive(driveFileUrl);

    // 4. Process document text and images in one pass
    console.log(`[GradingPipeline] Extracting text and parsing images...`);
    const { extractedText, base64Images, imageHashes, fileExtension } = await processDocument(docBuffer);
    const textHash = hashNormalizedText(extractedText);
    const imageHashesSerialized = JSON.stringify(imageHashes);

    // Determine the dynamic file extension name
    let updatedFileName = assignment.fileName;
    if (fileExtension === "docx" && assignment.fileName.endsWith(".pdf")) {
      updatedFileName = assignment.fileName.replace(/\.pdf$/, ".docx");
    } else if (fileExtension === "pdf" && assignment.fileName.endsWith(".docx")) {
      updatedFileName = assignment.fileName.replace(/\.docx$/, ".pdf");
    }

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
            fileName: updatedFileName,
            extractedText,
            textHash,
            imageHashes: imageHashesSerialized,
            isDuplicate: true,
            duplicateOfId: duplicateCandidate.id,
            duplicateReason: duplicateCandidate.reason,
            duplicateSimilarity: duplicateCandidate.similarity,
            detectionSource: "deterministic",
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

    // Try to find if the AI's plagiarism note mentions any other student's name
    let aiDuplicateOfId: string | null = null;
    if (result.plagiarismNote) {
      const otherStudents = await prisma.assignment.findMany({
        where: { taskId, id: { not: assignmentId } },
        select: { id: true, studentName: true },
      });
      const matchedStudent = otherStudents.find((other) =>
        result.plagiarismNote.toLowerCase().includes(other.studentName.toLowerCase())
      );
      if (matchedStudent) {
        aiDuplicateOfId = matchedStudent.id;
      }
    }

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        fileName: updatedFileName,
        extractedText,
        textHash,
        imageHashes: imageHashesSerialized,
        score: result.score,
        feedback: result.feedback,
        plagiarismNote: result.plagiarismNote,
        detectionSource: result.plagiarismNote ? "ai" : null,
        duplicateOfId: aiDuplicateOfId,
        status: "done",
      },
    });

    // 8. Run Reverse Check to detect duplicates among other assignments
    await runReverseCheck(assignmentId, taskId, duplicateScore);
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

export async function findDuplicateCandidate(params: {
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
    if (candidate.textHash && textHash && candidate.textHash === textHash) {
      best = {
        id: candidate.id,
        studentName: candidate.studentName,
        reason: "text-identical",
        similarity: 1,
      };
      return best;
    }

    const candidateTokens = normalizeText(candidate.extractedText)
      .split(" ")
      .filter((token) => token.length > 2);
    const candidateShingles = buildShingles(candidateTokens, 5);
    const similarity = jaccardSimilarity(currentShingles, candidateShingles);

    // Check image matches using Hamming Distance (threshold <= 5, stricter to reduce template false positives)
    const candidateImageHashes = parseImageHashes(candidate.imageHashes);
    let matchingImagesCount = 0;
    for (const currentHash of imageHashes) {
      const hasMatch = candidateImageHashes.some(
        (candHash) => computeHammingDistance(currentHash, candHash) <= 5
      );
      if (hasMatch) {
        matchingImagesCount++;
      }
    }

    // A visual match requires cross-validation with text similarity to prevent
    // false positives from template-based documents (same header/footer/layout).
    // Thresholds:
    // - 3+ image matches: likely a real visual clone, but still require minimal text overlap (>= 0.2 Jaccard)
    // - 2 image matches: requires moderate text similarity (>= 0.3 Jaccard)
    // - 1 image match: requires strong text similarity (>= 0.5 Jaccard)
    const isVisualDuplicate =
      (matchingImagesCount >= 3 && similarity >= 0.2) ||
      (matchingImagesCount === 2 && similarity >= 0.3) ||
      (matchingImagesCount === 1 && similarity >= 0.5);

    if (isVisualDuplicate) {
      return {
        id: candidate.id,
        studentName: candidate.studentName,
        reason: "image-match",
        similarity: Math.max(similarity, matchingImagesCount / Math.max(imageHashes.length, 1)),
      };
    }

    // Lowered Jaccard threshold from 0.8 to 0.7 for text similarity
    if (similarity >= 0.7) {
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

async function runReverseCheck(assignmentId: string, taskId: string, duplicateScore: number) {
  console.log(`[GradingPipeline] Running Reverse Check for assignment: ${assignmentId}...`);
  const current = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!current || !current.extractedText) return;

  const others = await prisma.assignment.findMany({
    where: {
      taskId,
      id: { not: assignmentId },
      status: "done",
    },
  });

  const currentTokens = normalizeText(current.extractedText)
    .split(" ")
    .filter((token) => token.length > 2);
  const currentShingles = buildShingles(currentTokens, 5);
  const currentImageHashes = parseImageHashes(current.imageHashes);

  for (const other of others) {
    if (other.isDuplicate) continue;

    let isDuplicate = false;
    let reason = "";
    let similarity = 0;

    if (current.textHash && other.textHash && current.textHash === other.textHash) {
      isDuplicate = true;
      reason = "text-identical";
      similarity = 1;
    } else {
      const otherTokens = normalizeText(other.extractedText)
        .split(" ")
        .filter((token) => token.length > 2);
      const otherShingles = buildShingles(otherTokens, 5);
      const jaccard = jaccardSimilarity(currentShingles, otherShingles);

      const otherImageHashes = parseImageHashes(other.imageHashes);
      let matchingImagesCount = 0;
      for (const currentHash of currentImageHashes) {
        const hasMatch = otherImageHashes.some(
          (othHash) => computeHammingDistance(currentHash, othHash) <= 5
        );
        if (hasMatch) {
          matchingImagesCount++;
        }
      }

      // Same cross-validation thresholds as forward check
      const isVisualDuplicate =
        (matchingImagesCount >= 3 && jaccard >= 0.2) ||
        (matchingImagesCount === 2 && jaccard >= 0.3) ||
        (matchingImagesCount === 1 && jaccard >= 0.5);

      if (isVisualDuplicate) {
        isDuplicate = true;
        reason = "image-match";
        similarity = Math.max(jaccard, matchingImagesCount / Math.max(currentImageHashes.length, 1));
      } else if (jaccard >= 0.7) {
        isDuplicate = true;
        reason = "text-similarity";
        similarity = jaccard;
      }
    }

    if (isDuplicate) {
      console.log(`[GradingPipeline] Reverse Check found duplicate: ${other.studentName} is duplicate of ${current.studentName} (${reason})`);
      const duplicateNote = `Duplikat terdeteksi (${reason}) dengan ${current.studentName} (Reverse Check). Nilai disamakan menjadi ${duplicateScore}.`;
      await prisma.$transaction([
        prisma.assignment.update({
          where: { id: other.id },
          data: {
            isDuplicate: true,
            duplicateOfId: current.id,
            duplicateReason: reason,
            duplicateSimilarity: similarity,
            detectionSource: "deterministic-reverse",
            score: duplicateScore,
            plagiarismNote: duplicateNote,
          },
        }),
        prisma.assignment.update({
          where: { id: current.id },
          data: {
            score: duplicateScore,
            plagiarismNote: `Nilai disamakan karena duplikat dengan ${other.studentName}.`,
          },
        }),
      ]);
    }
  }
}
