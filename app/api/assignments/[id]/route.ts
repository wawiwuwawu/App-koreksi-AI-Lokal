import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: assignmentId } = await params;

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
        duplicateOf: {
          select: {
            id: true,
            studentName: true,
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

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (assignment.task.class.course.lecturerId !== session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    return NextResponse.json({ assignment });
  } catch (error: any) {
    console.error("[Assignment GET] Failed to fetch assignment:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: assignmentId } = await params;

    // Check ownership
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

    if (assignment.task.class.course.lecturerId !== session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    // Safely delete within transaction to prevent foreign key errors
    await prisma.$transaction([
      prisma.assignment.updateMany({
        where: { duplicateOfId: assignmentId },
        data: {
          duplicateOfId: null,
          isDuplicate: false,
          duplicateReason: null,
          duplicateSimilarity: null,
        },
      }),
      prisma.assignment.delete({
        where: { id: assignmentId },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error: any) {
    console.error("[Assignment DELETE] Failed to delete assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: assignmentId } = await params;
    const body = await req.json();
    const { score, feedback, resetDuplicate } = body;

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

    if (assignment.task.class.course.lecturerId !== session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const updateData: any = {};
    if (score !== undefined) {
      const parsedScore = score === "" || score === null ? null : parseInt(score, 10);
      if (parsedScore !== null && (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100)) {
        return NextResponse.json({ error: "Nilai harus di antara 0 - 100" }, { status: 400 });
      }
      updateData.score = parsedScore;
    }
    if (feedback !== undefined) {
      updateData.feedback = feedback;
    }

    if (resetDuplicate === true) {
      updateData.isDuplicate = false;
      updateData.duplicateOfId = null;
      updateData.duplicateReason = null;
      updateData.duplicateSimilarity = null;
      updateData.plagiarismNote = "Status duplikat dibatalkan secara manual oleh Dosen.";
    }

    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        duplicateOf: {
          select: { id: true, studentName: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Koreksi manual berhasil disimpan",
      assignment: updated,
    });
  } catch (error: any) {
    console.error("[Assignment PATCH] Failed to update assignment:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui nilai", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
