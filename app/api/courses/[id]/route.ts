import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId, unauthorizedResponse } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) return unauthorizedResponse();

    const { id } = await params;

    const course = await prisma.course.findFirst({
      where: { id, lecturerId: sessionId },
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
      { status: 500 }
    );
  }
}
