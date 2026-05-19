import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const lecturer = await prisma.lecturer.findUnique({
      where: { email },
    });

    if (!lecturer || lecturer.password !== hashPassword(password)) {
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

    response.cookies.set("lecturer_session", lecturer.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch (error: any) {
    console.error("[Login POST] Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
