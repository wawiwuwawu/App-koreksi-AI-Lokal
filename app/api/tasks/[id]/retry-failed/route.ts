import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueService } from "@/services/queueService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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

    if (task.class.course.lecturerId !== session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const failedAssignments = await prisma.assignment.findMany({
      where: { taskId, status: "failed" },
      select: { id: true },
    });

    if (failedAssignments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada tugas gagal untuk diulang",
        retried: 0,
      });
    }

    await prisma.assignment.updateMany({
      where: { id: { in: failedAssignments.map((a) => a.id) } },
      data: {
        status: "pending",
        score: null,
        feedback: null,
        plagiarismNote: null,
        errorMessage: null,
      },
    });

    for (const assignment of failedAssignments) {
      queueService.enqueue(assignment.id);
    }

    return NextResponse.json({
      success: true,
      message: "Semua tugas gagal telah diantrekan ulang",
      retried: failedAssignments.length,
    });
  } catch (error: any) {
    console.error("[Task Retry Failed POST] Error:", error);
    return NextResponse.json(
      { error: "Gagal mengulang tugas gagal", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
