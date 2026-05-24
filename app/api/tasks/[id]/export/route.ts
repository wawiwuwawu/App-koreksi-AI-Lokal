import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        class: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const assignments = await prisma.assignment.findMany({
      where: { taskId },
      orderBy: { studentName: "asc" },
      include: {
        duplicateOf: {
          select: {
            studentName: true,
          },
        },
      },
    });

    // Helper to sanitize CSV fields (escape quotes, wrap in quotes)
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      let str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    // Header row
    const headers = [
      "Nama Mahasiswa",
      "Nilai",
      "Status",
      "Duplikat?",
      "Alasan Duplikat",
      "Kemiripan",
      "Duplikat Dari",
      "Feedback AI",
      "Catatan Plagiarisme",
      "Google Drive URL",
      "Tanggal Submit"
    ];

    const csvRows = [headers.join(",")];

    for (const ass of assignments) {
      const row = [
        escapeCSV(ass.studentName),
        escapeCSV(ass.score !== null ? ass.score : "-"),
        escapeCSV(ass.status),
        escapeCSV(ass.isDuplicate ? "Ya" : "Tidak"),
        escapeCSV(ass.duplicateReason || "-"),
        escapeCSV(ass.duplicateSimilarity !== null ? `${(ass.duplicateSimilarity * 100).toFixed(1)}%` : "-"), // fixed calculation representation
        escapeCSV(ass.duplicateOf?.studentName || "-"),
        escapeCSV(ass.feedback),
        escapeCSV(ass.plagiarismNote),
        escapeCSV(ass.driveFileUrl),
        escapeCSV(ass.createdAt.toISOString())
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = "\uFEFF" + csvRows.join("\n"); // Add BOM for UTF-8 compatibility in Excel

    const safeTitle = task.title.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Nilai_${safeTitle}_${task.class.name}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("[Export GET] Failed to export task grades:", error);
    return NextResponse.json(
      { error: "Failed to export data", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
