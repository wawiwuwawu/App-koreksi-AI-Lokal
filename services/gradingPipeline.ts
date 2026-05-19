import { prisma } from "@/lib/db";
import { ParsedSubmission } from "@/types";
import {
  downloadFileFromGoogleDrive,
  processPDF,
} from "./pdfService";
import { getSlidingWindowContext } from "./memoryService";
import { evaluateAssignment } from "./aiService";

/**
 * Orchestrates the full AI grading workflow:
 * 1. Mark status as "processing"
 * 2. Download from Google Drive (public links)
 * 3. Extract text & render visual pages to images in one pass
 * 4. Fetch previous grades (sliding window)
 * 5. Query multimodal LLM
 * 6. Write results (score, feedback, plagiarism analysis) to database
 */
export async function processSubmission(assignmentId: string, submission: ParsedSubmission) {
  try {
    // 1. Mark the assignment status as processing
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: "processing" },
    });

    // 2. Fetch System Rubric & Window Size
    const config = await prisma.systemConfig.findUnique({
      where: { id: "default" },
    });

    const rubric =
      config?.rubric ||
      `Kriteria Penilaian Laporan:
1. Kesesuaian dengan topik (0-25)
2. Kedalaman analisis (0-25)
3. Struktur dan tata bahasa (0-25)
4. Orisinalitas dan referensi (0-25)
Total skor: 0-100`;
    const windowSize = config?.windowSize ?? 3;

    // 3. Download Google Drive File
    console.log(
      `[GradingPipeline] Downloading file for ${submission.studentName} from: ${submission.driveFileUrl}`
    );
    const pdfBuffer = await downloadFileFromGoogleDrive(submission.driveFileUrl);

    // 4. Process PDF text and screenshots in one pass
    console.log(`[GradingPipeline] Extracting text and rendering screenshots...`);
    const { extractedText, base64Images } = await processPDF(pdfBuffer);

    // 6. Retrieve Memory sliding window context
    console.log(
      `[GradingPipeline] Fetching sliding window context (size: ${windowSize})...`
    );
    const memoryContext = await getSlidingWindowContext(windowSize);

    // 7. Request Grading and Plagiarism Check from AI
    console.log(`[GradingPipeline] Sending query to local LLM...`);
    const result = await evaluateAssignment({
      studentName: submission.studentName,
      extractedText,
      base64Images,
      memoryContext,
      rubric,
    });

    // 8. Update DB with success outcomes
    console.log(
      `[GradingPipeline] Process complete. Student: ${submission.studentName}, Score: ${result.score}`
    );
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        extractedText,
        score: result.score,
        feedback: result.feedback,
        plagiarismNote: result.plagiarismNote,
        status: "done",
      },
    });
  } catch (error: any) {
    console.error(
      `[GradingPipeline] Failure processing submission for ${submission.studentName}:`,
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
