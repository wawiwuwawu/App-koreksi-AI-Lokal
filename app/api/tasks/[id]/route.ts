import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueService } from "@/services/queueService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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

    // Security: Ensure task belongs to the logged-in lecturer
    if (task.class.course.lecturerId !== session) {
      return NextResponse.json({ error: "Unauthorized access to this task" }, { status: 403 });
    }

    const assignments = await prisma.assignment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });

    const queueLength = queueService.getQueueLength();

    return NextResponse.json({
      task,
      assignments,
      queueLength,
      webhookSecret: process.env.WEBHOOK_SECRET || "",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { rubric, windowSize } = body;

    const parsedWindowSize = parseInt(windowSize, 10);
    if (isNaN(parsedWindowSize) || parsedWindowSize < 0) {
      return NextResponse.json(
        { error: "Window size must be a positive number" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: "Unauthorized access to this task" }, { status: 403 });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        rubric,
        windowSize: parsedWindowSize,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Rubrik dan ukuran memori berhasil disimpan",
      task: updatedTask,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
