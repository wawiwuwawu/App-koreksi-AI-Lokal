import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { WebhookPayload } from "@/types";
import { queueService } from "@/services/queueService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Authenticate webhook request via secret token if configured
  const secretHeader = req.headers.get("x-webhook-secret");
  const configuredSecret = process.env.WEBHOOK_SECRET;
  if (configuredSecret && secretHeader !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized webhook access" }, { status: 401 });
  }

  let body: WebhookPayload;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Helper to extract values dynamically supporting different column headers
  const getPayloadValue = (payload: any, exactKeys: string[], partialMatch: string) => {
    for (const key of exactKeys) {
      if (payload[key] && Array.isArray(payload[key]) && payload[key].length > 0) {
        return payload[key];
      }
    }
    const lowerPartial = partialMatch.toLowerCase();
    for (const key of Object.keys(payload)) {
      if (key.toLowerCase().includes(lowerPartial)) {
        if (payload[key] && Array.isArray(payload[key]) && payload[key].length > 0) {
          return payload[key];
        }
      }
    }
    return null;
  };

  // Extract values dynamically
  const timestampArray = getPayloadValue(body, ["Timestamp"], "timestamp");
  const studentNameArray = getPayloadValue(body, ["Nama Mahasiswa", "Nama"], "nama");
  const driveLinkArray = getPayloadValue(body, ["Upload Laporan (PDF)", "Upload Lab Activity"], "upload");
  const taskIdArray = getPayloadValue(body, ["id_tugas", "taskId"], "tugas");

  // Basic validation to check required structures exist
  if (!timestampArray || !studentNameArray || !driveLinkArray) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid required columns. Make sure your form has columns for Timestamp, Student Name (e.g. 'Nama' or 'Nama Mahasiswa'), and PDF Upload (e.g. 'Upload Lab Activity' or 'Upload Laporan (PDF)').",
      },
      { status: 400 }
    );
  }

  const studentName = studentNameArray[0]?.trim();
  const driveFileUrl = driveLinkArray[0]?.trim();
  const taskId =
    taskIdArray && Array.isArray(taskIdArray) && taskIdArray[0]
      ? taskIdArray[0].trim()
      : null;

  if (!studentName || !driveFileUrl) {
    return NextResponse.json(
      { error: "Student name or Google Drive link is empty" },
      { status: 400 }
    );
  }

  if (!taskId) {
    return NextResponse.json(
      { error: "ID Tugas (id_tugas) is missing in payload" },
      { status: 400 }
    );
  }

  try {
    // 2. Validate that Task exists in the system
    const taskExists = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!taskExists) {
      console.warn(`[Webhook] Rejected submission: Task ID ${taskId} does not exist.`);
      return NextResponse.json(
        { error: `Tugas dengan ID ${taskId} tidak terdaftar di sistem` },
        { status: 400 }
      );
    }

    // 3. Prevent duplicate entries for the same student + taskId
    const existingAssignment = await prisma.assignment.findFirst({
      where: {
        studentName,
        taskId,
        status: { not: "failed" },
      },
    });

    if (existingAssignment) {
      console.log(
        `[Webhook] Skipping duplicate submission for ${studentName} (${taskId}), existing ID: ${existingAssignment.id}`
      );
      return NextResponse.json({
        success: true,
        message: "Submission already received and processing/completed",
        assignmentId: existingAssignment.id,
      });
    }

    // Generate a display name for the file
    const safeName = studentName.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${safeName}_${taskId}.pdf`;

    // 4. Create a database record in pending state
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

    // 5. Enqueue the assignment for sequential AI grading
    queueService.enqueue(newAssignment.id);

    // 6. Immediately return status 200 with queue confirmation
    return NextResponse.json({
      success: true,
      message: "Submission received and queued for grading",
      assignmentId: newAssignment.id,
    });
  } catch (error: any) {
    console.error("[Webhook] Failed to process submission:", error);
    return NextResponse.json(
      { error: "Database operation failed", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
