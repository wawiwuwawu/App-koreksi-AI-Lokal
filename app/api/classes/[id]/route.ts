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

    const clazz = await prisma.class.findFirst({
      where: {
        id,
        course: {
          lecturerId: sessionId,
        },
      },
    });

    if (!clazz) {
      return NextResponse.json({ error: "Kelas tidak ditemukan atau tidak sah" }, { status: 404 });
    }

    await prisma.class.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Kelas berhasil dihapus" });
  } catch (error: any) {
    console.error("[Class DELETE] Error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus kelas", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
