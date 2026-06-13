import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueService } from "@/services/queueService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSizeRaw = parseInt(url.searchParams.get("pageSize") || "25", 10);
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
    const skip = (page - 1) * pageSize;
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

    const [assignments, totalAssignments, statusGroups] = await prisma.$transaction([
      prisma.assignment.findMany({
        where: { taskId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
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
      }),
      prisma.assignment.count({ where: { taskId } }),
      prisma.assignment.groupBy({
        by: ["status"],
        where: { taskId },
        orderBy: { status: "asc" },
        _count: { _all: true },
      }),
    ]);

    const statusCounts = {
      total: totalAssignments,
      pending: 0,
      processing: 0,
      done: 0,
      failed: 0,
    };
    for (const group of statusGroups) {
      if (group.status in statusCounts) {
        statusCounts[group.status as keyof typeof statusCounts] = (group._count as any)?._all ?? 0;
      }
    }

    const queueLength = queueService.getQueueLength();

    return NextResponse.json({
      task,
      assignments,
      queueLength,
      webhookConfigured: !!process.env.WEBHOOK_SECRET,
      statusCounts,
      pagination: {
        page,
        pageSize,
        total: totalAssignments,
        totalPages: Math.max(1, Math.ceil(totalAssignments / pageSize)),
      },
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
    const { rubric, windowSize, duplicateScore } = body;

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

    const parsedDuplicateScore =
      duplicateScore === undefined || duplicateScore === null
        ? task.duplicateScore
        : parseInt(duplicateScore, 10);
    if (isNaN(parsedDuplicateScore) || parsedDuplicateScore < 0) {
      return NextResponse.json(
        { error: "Nilai duplikat harus berupa angka positif" },
        { status: 400 }
      );
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        rubric,
        windowSize: parsedWindowSize,
        duplicateScore: parsedDuplicateScore,
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
