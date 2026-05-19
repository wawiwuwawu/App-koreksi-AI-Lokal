import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueService } from "@/services/queueService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Reset status to pending and clear error/grading outputs
    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: "pending",
        score: null,
        feedback: null,
        plagiarismNote: null,
        errorMessage: null,
      },
    });

    // Enqueue
    queueService.enqueue(assignmentId);

    return NextResponse.json({
      success: true,
      message: "Assignment re-queued for AI grading",
      assignment: updated,
    });
  } catch (error: any) {
    console.error("[Assignment Retry] Failed to retry grading:", error);
    return NextResponse.json(
      { error: "Failed to retry grading", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
