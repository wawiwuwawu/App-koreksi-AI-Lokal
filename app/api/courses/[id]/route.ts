import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Verify course belongs to lecturer
    const course = await prisma.course.findFirst({
      where: { id, lecturerId: session },
    });

    if (!course) {
      return NextResponse.json({ error: "Mata kuliah tidak ditemukan atau tidak sah" }, { status: 404 });
    }

    await prisma.course.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Mata kuliah berhasil dihapus" });
  } catch (error: any) {
    console.error("[Course DELETE] Error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus mata kuliah", details: error?.message || String(error) },
      { status: 550 }
    );
  }
}
