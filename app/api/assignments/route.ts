import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Dynamic fetch to avoid build caching issues
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const assignments = await prisma.assignment.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(assignments);
  } catch (error: any) {
    console.error("[Assignments GET] Failed to retrieve entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
