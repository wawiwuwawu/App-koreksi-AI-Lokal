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

    const { id: assignmentId } = await params;
    const body = await req.json();
    const { action, sourceId } = body;

    if (!action || (action !== "confirm" && action !== "dismiss")) {
      return NextResponse.json({ error: "Action must be 'confirm' or 'dismiss'" }, { status: 400 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        task: {
          include: {
            class: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (assignment.task.class.course.lecturerId !== sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updateData: any = {};

    if (action === "confirm") {
      const duplicateScore = assignment.task.duplicateScore ?? 50;
      updateData.isDuplicate = true;
      updateData.score = duplicateScore;
      updateData.detectionSource = "ai-confirmed";

      const finalSourceId = sourceId || assignment.duplicateOfId;
      if (finalSourceId) {
        updateData.duplicateOfId = finalSourceId;

        const sourceAssignment = await prisma.assignment.findUnique({
          where: { id: finalSourceId },
          include: {
            task: {
              include: {
                class: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        });

        if (sourceAssignment && sourceAssignment.task.class.course.lecturerId === sessionId) {
          await prisma.assignment.update({
            where: { id: finalSourceId },
            data: {
              score: duplicateScore,
              plagiarismNote: `Nilai disamakan karena duplikat dengan ${assignment.studentName} (AI Dikonfirmasi).`,
            },
          });
        }
      }
    } else {
      updateData.detectionSource = null;
      updateData.plagiarismNote = null;
      updateData.isDuplicate = false;
      updateData.duplicateOfId = null;
      updateData.duplicateReason = null;
      updateData.duplicateSimilarity = null;
    }

    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        duplicateOf: {
          select: {
            id: true,
            studentName: true,
            extractedText: true,
          },
        },
        duplicates: {
          select: {
            id: true,
            studentName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: action === "confirm" ? "Indikasi AI berhasil dikonfirmasi" : "Indikasi AI berhasil diabaikan",
      assignment: updated,
    });
  } catch (error: any) {
    console.error("[Confirm Plagiarism POST] Failed:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui status plagiarisme", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
