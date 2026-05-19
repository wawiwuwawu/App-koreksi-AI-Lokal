import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const lecturer = await prisma.lecturer.findUnique({
      where: { id: session },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!lecturer) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    return NextResponse.json({ lecturer });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
