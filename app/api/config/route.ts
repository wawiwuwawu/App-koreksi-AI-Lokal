import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "default" },
    });

    if (!config) {
      // Return default values if not yet configured
      return NextResponse.json({
        rubric: `Kriteria Penilaian Laporan:
1. Kesesuaian dengan topik (0-25)
2. Kedalaman analisis (0-25)
3. Struktur dan tata bahasa (0-25)
4. Orisinalitas dan referensi (0-25)
Total skor: 0-100`,
        windowSize: 3,
      });
    }

    return NextResponse.json(config);
  } catch (error: any) {
    console.error("[Config GET] Failed to fetch system config:", error);
    return NextResponse.json(
      { error: "Failed to fetch config", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rubric, windowSize } = body;

    const parsedWindowSize = parseInt(windowSize, 10);
    if (isNaN(parsedWindowSize) || parsedWindowSize < 0) {
      return NextResponse.json(
        { error: "Window size must be a positive number" },
        { status: 400 }
      );
    }

    const updatedConfig = await prisma.systemConfig.upsert({
      where: { id: "default" },
      update: {
        rubric,
        windowSize: parsedWindowSize,
      },
      create: {
        id: "default",
        rubric,
        windowSize: parsedWindowSize,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Configuration saved successfully",
      config: updatedConfig,
    });
  } catch (error: any) {
    console.error("[Config POST] Failed to update system config:", error);
    return NextResponse.json(
      { error: "Failed to update config", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
