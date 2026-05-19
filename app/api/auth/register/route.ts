import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existing = await prisma.lecturer.findUnique({
      where: { email: trimmedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 }
      );
    }

    // Create the lecturer
    const lecturer = await prisma.lecturer.create({
      data: {
        name: name.trim(),
        email: trimmedEmail,
        password: hashPassword(password),
      },
    });

    // Set simple cookie to automatically log them in
    const response = NextResponse.json({
      success: true,
      lecturer: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
      },
    });

    response.cookies.set("lecturer_session", lecturer.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch (error: any) {
    console.error("[Register POST] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
