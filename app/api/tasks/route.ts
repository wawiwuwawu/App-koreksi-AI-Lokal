import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id, title, rubric, windowSize, classId } = await req.json();

    if (!title || !classId) {
      return NextResponse.json({ error: "Judul tugas dan kelas wajib diisi" }, { status: 400 });
    }

    // Verify class belongs to lecturer's course
    const clazz = await prisma.class.findFirst({
      where: {
        id: classId,
        course: {
          lecturerId: session,
        },
      },
    });

    if (!clazz) {
      return NextResponse.json({ error: "Kelas tidak ditemukan atau tidak sah" }, { status: 404 });
    }

    // Check if task ID is custom or auto-generate
    const taskId = id && id.trim() !== "" ? id.trim() : `TASK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Verify unique Task ID
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (existingTask) {
      return NextResponse.json({ error: "ID Tugas sudah digunakan, pilih ID lain" }, { status: 400 });
    }

    const parsedWindowSize = parseInt(windowSize, 10);
    const finalWindowSize = isNaN(parsedWindowSize) ? 3 : parsedWindowSize;

    const task = await prisma.task.create({
      data: {
        id: taskId,
        title: title.trim(),
        rubric: rubric ? rubric.trim() : "Kriteria Penilaian Laporan:\n1. Kesesuaian dengan topik (0-100)\nTotal skor: 0-100",
        windowSize: finalWindowSize,
        classId,
      },
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error("[Task POST] Error:", error);
    return NextResponse.json(
      { error: "Gagal membuat tugas", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
