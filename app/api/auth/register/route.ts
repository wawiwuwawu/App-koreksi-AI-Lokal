import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const existing = await prisma.lecturer.findUnique({
      where: { email: trimmedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 }
      );
    }

    const lecturer = await prisma.lecturer.create({
      data: {
        name: name.trim(),
        email: trimmedEmail,
        password: await hashPassword(password),
      },
    });

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
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
