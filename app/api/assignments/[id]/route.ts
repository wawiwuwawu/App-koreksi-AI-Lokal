import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
