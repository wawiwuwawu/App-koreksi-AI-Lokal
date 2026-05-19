import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { name, courseId } = await req.json();

    if (!name || !courseId) {
      return NextResponse.json({ error: "Nama kelas dan mata kuliah wajib diisi" }, { status: 400 });
    }

    // Verify course belongs to lecturer
    const course = await prisma.course.findFirst({
      where: { id: courseId, lecturerId: session },
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
