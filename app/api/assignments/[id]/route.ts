import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = req.cookies.get("lecturer_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: assignmentId } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        task: {
          include: {
            class: {
              include: {
                course: true,
              },
            },
          },
        },
        duplicateOf: {
          select: {
            id: true,
            studentName: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (assignment.task.class.course.lecturerId !== session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    return NextResponse.json({ assignment });
  } catch (error: any) {
    console.error("[Assignment GET] Failed to fetch assignment:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;

    await prisma.assignment.delete({
      where: { id: assignmentId },
    });

    return NextResponse.json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error: any) {
    console.error("[Assignment DELETE] Failed to delete assignment:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
