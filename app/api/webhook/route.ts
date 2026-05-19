import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ParsedSubmission } from "@/types";
import { processSubmission } from "@/services/gradingPipeline";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Extract raw arrays from e.namedValues Google Sheets format
  const timestampArray = body["Timestamp"];
  const studentNameArray = body["Nama Mahasiswa"];
  const driveLinkArray = body["Upload Laporan (PDF)"];
  const taskIdArray = body["id_tugas"];

  // Basic validation to check required structures exist
  if (
    !timestampArray ||
    !Array.isArray(timestampArray) ||
    timestampArray.length === 0 ||
    !studentNameArray ||
    !Array.isArray(studentNameArray) ||
    studentNameArray.length === 0 ||
    !driveLinkArray ||
    !Array.isArray(driveLinkArray) ||
    driveLinkArray.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid required arrays (Timestamp, Nama Mahasiswa, or Upload Laporan (PDF))",
      },
      { status: 400 }
    );
  }

  const studentName = studentNameArray[0]?.trim();
  const driveFileUrl = driveLinkArray[0]?.trim();
  const timestamp = timestampArray[0]?.trim();
  const taskId =
    taskIdArray && Array.isArray(taskIdArray) && taskIdArray[0]
      ? taskIdArray[0].trim()
      : "DEFAULT-TASK";

  if (!studentName || !driveFileUrl) {
    return NextResponse.json(
      { error: "Student name or Google Drive link is empty" },
      { status: 400 }
    );
  }

  const parsedSubmission: ParsedSubmission = {
    timestamp,
    studentName,
    driveFileUrl,
    taskId,
  };

  // Generate a display name for the file
  const safeName = studentName.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `${safeName}_${taskId}.pdf`;

  try {
    // 1. Create a database record in pending state
    const newAssignment = await prisma.assignment.create({
      data: {
        studentName,
        fileName,
        extractedText: "",
        taskId,
        driveFileUrl,
        status: "pending",
      },
    });

    // 2. Fire grading pipeline asynchronously in background to prevent webhook timeout
    processSubmission(newAssignment.id, parsedSubmission)
      .then(() => {
        console.log(`[Webhook] Background grading finished successfully for ${studentName}`);
      })
      .catch((err) => {
        console.error(`[Webhook] Background grading crashed for ${studentName}:`, err);
      });

    // 3. Immediately return status 200 with queue confirmation
    return NextResponse.json({
      success: true,
      message: "Submission received and queued for grading",
      assignmentId: newAssignment.id,
    });
  } catch (error: any) {
    console.error("[Webhook] Failed to initialize entry in DB:", error);
    return NextResponse.json(
      { error: "Database operation failed", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
