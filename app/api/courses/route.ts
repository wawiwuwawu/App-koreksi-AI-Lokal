import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const courses = await prisma.course.findMany({
      where: { lecturerId: session },
      include: {
        classes: {
          include: {
            tasks: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ courses });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { code, name } = await req.json();

    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama mata kuliah wajib diisi" }, { status: 400 });
    }

    const course = await prisma.course.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        lecturerId: session,
      },
    });

    return NextResponse.json({ success: true, course });
  } catch (error: any) {
    console.error("[Course POST] Error:", error);
    return NextResponse.json(
      { error: "Gagal membuat mata kuliah", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

