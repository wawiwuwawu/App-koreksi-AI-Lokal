import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) return unauthorizedResponse();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSizeRaw = parseInt(url.searchParams.get("pageSize") || "25", 10);
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
    const skip = (page - 1) * pageSize;

    const [assignments, total] = await prisma.$transaction([
      prisma.assignment.findMany({
        where: {
          task: {
            class: {
              course: {
                lecturerId: sessionId,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          duplicateOf: {
            select: {
              id: true,
              studentName: true,
            },
          },
          duplicates: {
            select: {
              id: true,
              studentName: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.assignment.count({
        where: {
          task: {
            class: {
              course: {
                lecturerId: sessionId,
              },
            },
          },
        },
      }),
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
