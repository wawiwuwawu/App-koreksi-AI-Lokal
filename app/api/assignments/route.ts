import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Dynamic fetch to avoid build caching issues
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSizeRaw = parseInt(url.searchParams.get("pageSize") || "25", 10);
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
    const skip = (page - 1) * pageSize;

    const [assignments, total] = await prisma.$transaction([
      prisma.assignment.findMany({
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: pageSize,
        include: {
          duplicateOf: {
            select: {
              id: true,
              studentName: true,
            },
          },
        },
      }),
      prisma.assignment.count(),
    ]);

    return NextResponse.json({
      assignments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error: any) {
    console.error("[Assignments GET] Failed to retrieve entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
