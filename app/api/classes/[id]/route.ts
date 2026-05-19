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

    // Verify class belongs to lecturer's course
    const clazz = await prisma.class.findFirst({
      where: {
        id,
        course: {
          lecturerId: session,
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
      { status: 550 }
    );
  }
}
