import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const lecturer = await prisma.lecturer.findUnique({
      where: { email: email?.trim()?.toLowerCase() },
    });

    if (!lecturer || !(await verifyPassword(password, lecturer.password))) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      lecturer: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
      },
    });

    response.cookies.set(createSessionCookie(lecturer.id));

    return response;
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
