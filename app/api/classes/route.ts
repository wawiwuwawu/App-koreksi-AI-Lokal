import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) return unauthorizedResponse();

    const { name, courseId } = await req.json();

    if (!name || !courseId) {
      return NextResponse.json({ error: "Nama kelas dan mata kuliah wajib diisi" }, { status: 400 });
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, lecturerId: sessionId },
    });

    if (!course) {
      return NextResponse.json({ error: "Mata kuliah tidak ditemukan atau tidak sah" }, { status: 404 });
    }

    const clazz = await prisma.class.create({
      data: {
        name: name.trim(),
        courseId,
      },
    });

    return NextResponse.json({ success: true, class: clazz });
  } catch (error: any) {
    console.error("[Class POST] Error:", error);
    return NextResponse.json(
      { error: "Gagal membuat kelas", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
