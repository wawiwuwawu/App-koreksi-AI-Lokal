import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) return unauthorizedResponse();

    const { id, title, rubric, windowSize, classId, duplicateScore } = await req.json();

    if (!title || !classId) {
      return NextResponse.json({ error: "Judul tugas dan kelas wajib diisi" }, { status: 400 });
    }

    const clazz = await prisma.class.findFirst({
      where: {
        id: classId,
        course: {
          lecturerId: sessionId,
        },
      },
    });

    if (!clazz) {
      return NextResponse.json({ error: "Kelas tidak ditemukan atau tidak sah" }, { status: 404 });
    }

    const taskId = id && id.trim() !== "" ? id.trim() : `TASK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (existingTask) {
      return NextResponse.json({ error: "ID Tugas sudah digunakan, pilih ID lain" }, { status: 400 });
    }

    const parsedWindowSize = parseInt(windowSize, 10);
    const finalWindowSize = isNaN(parsedWindowSize) ? 3 : parsedWindowSize;

    const parsedDuplicateScore = parseInt(duplicateScore, 10);
    const finalDuplicateScore = isNaN(parsedDuplicateScore) ? 50 : parsedDuplicateScore;
    if (finalDuplicateScore < 0) {
      return NextResponse.json(
        { error: "Nilai duplikat harus berupa angka positif" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        id: taskId,
        title: title.trim(),
        rubric: rubric ? rubric.trim() : "Kriteria Penilaian Laporan:\n1. Kesesuaian dengan topik (0-100)\nTotal skor: 0-100",
        windowSize: finalWindowSize,
        duplicateScore: finalDuplicateScore,
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
