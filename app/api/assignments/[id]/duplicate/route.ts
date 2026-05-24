import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: assignmentId } = await params;
    const { sourceId } = await req.json();

    if (!sourceId || typeof sourceId !== "string") {
      return NextResponse.json({ error: "sourceId wajib diisi" }, { status: 400 });
    }

    if (sourceId === assignmentId) {
      return NextResponse.json({ error: "sourceId tidak boleh sama dengan assignmentId" }, { status: 400 });
    }

    const [target, source] = await prisma.$transaction([
      prisma.assignment.findUnique({
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
      }),
      prisma.assignment.findUnique({
        where: { id: sourceId },
        include: {
          task: true,
        },
      }),
    ]);

    if (!target || !source) {
      return NextResponse.json({ error: "Assignment tidak ditemukan" }, { status: 404 });
    }

    if (target.task.class.course.lecturerId !== session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    if (target.taskId !== source.taskId) {
      return NextResponse.json(
        { error: "Assignment sumber harus berasal dari tugas yang sama" },
        { status: 400 }
      );
    }

    const duplicateScore = target.task.duplicateScore ?? 50;
    const duplicateNote = `Ditandai duplikat secara manual dengan ${source.studentName}. Nilai disamakan menjadi ${duplicateScore}.`;

    const [updatedTarget] = await prisma.$transaction([
      prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          isDuplicate: true,
          duplicateOfId: sourceId,
          duplicateReason: "manual",
          duplicateSimilarity: 1,
          score: duplicateScore,
          status: "done",
          plagiarismNote: duplicateNote,
        },
        include: {
          duplicateOf: {
            select: { id: true, studentName: true },
          },
        },
      }),
      prisma.assignment.update({
        where: { id: sourceId },
        data: {
          score: duplicateScore,
          status: "done",
          plagiarismNote: `Nilai disamakan karena duplikat dengan ${target.studentName}.`,
        },
      }),
    ]);

    return NextResponse.json({ success: true, assignment: updatedTarget });
  } catch (error: any) {
    console.error("[Assignment Duplicate POST] Error:", error);
    return NextResponse.json(
      { error: "Gagal menandai duplikat", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
