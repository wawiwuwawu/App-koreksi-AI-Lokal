import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const lecturer = await prisma.lecturer.findUnique({
      where: { id: sessionId },
      select: { id: true, name: true, email: true },
    });

    if (!lecturer) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({ lecturer });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
