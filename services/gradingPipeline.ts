import { prisma } from "@/lib/db";
import {
  downloadFileFromGoogleDrive,
  processPDF,
} from "./pdfService";
import { getSlidingWindowContext } from "./memoryService";
import { evaluateAssignment } from "./aiService";

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

    // 3. Download Google Drive File
    console.log(
      `[GradingPipeline] Downloading file for ${studentName} from: ${driveFileUrl}`
    );
    const pdfBuffer = await downloadFileFromGoogleDrive(driveFileUrl);

    // 4. Process PDF text and screenshots in one pass
    console.log(`[GradingPipeline] Extracting text and rendering screenshots...`);
    const { extractedText, base64Images } = await processPDF(pdfBuffer);

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
