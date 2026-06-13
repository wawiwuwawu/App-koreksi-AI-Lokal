import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionId, unauthorizedResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) return unauthorizedResponse();

    const config = await prisma.systemConfig.findUnique({
      where: { id: "default" },
    });

    if (!config) {
      return NextResponse.json({
        rubric: `Kriteria Penilaian Laporan:
1. Kesesuaian dengan topik (0-25)
2. Kedalaman analisis (0-25)
3. Struktur dan tata bahasa (0-25)
4. Orisinalitas dan referensi (0-25)
Total skor: 0-100`,
        windowSize: 3,
        aiBaseUrl: process.env.AI_BASE_URL || "http://localhost:1234/v1",
        aiModelName: process.env.AI_MODEL || "",
        aiTemperature: 0.2,
        shingleSize: 5,
        jaccardThreshold: 0.7,
        hammingThreshold: 5,
        imageMatchThresholds: { "1": 0.5, "2": 0.3, "3": 0.2 },
        queueConcurrency: 1,
        queueDelayMs: 100,
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
    const sessionId = getSessionId(req);
    if (!sessionId) return unauthorizedResponse();

    const body = await req.json();
    const { rubric, windowSize } = body;

    const parsedWindowSize = parseInt(windowSize, 10);
    if (isNaN(parsedWindowSize) || parsedWindowSize < 0) {
      return NextResponse.json(
        { error: "Window size must be a positive number" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (rubric !== undefined) updateData.rubric = rubric;
    if (windowSize !== undefined) updateData.windowSize = parsedWindowSize;

    if (body.aiBaseUrl !== undefined) updateData.aiBaseUrl = body.aiBaseUrl;
    if (body.aiModelName !== undefined) updateData.aiModelName = body.aiModelName;
    if (body.aiApiKey !== undefined) updateData.aiApiKey = body.aiApiKey;
    if (body.aiTemperature !== undefined) updateData.aiTemperature = parseFloat(body.aiTemperature);
    if (body.shingleSize !== undefined) updateData.shingleSize = parseInt(body.shingleSize, 10);
    if (body.jaccardThreshold !== undefined) updateData.jaccardThreshold = parseFloat(body.jaccardThreshold);
    if (body.hammingThreshold !== undefined) updateData.hammingThreshold = parseInt(body.hammingThreshold, 10);
    if (body.imageMatchThresholds !== undefined) updateData.imageMatchThresholds = body.imageMatchThresholds;
    if (body.queueConcurrency !== undefined) updateData.queueConcurrency = parseInt(body.queueConcurrency, 10);
    if (body.queueDelayMs !== undefined) updateData.queueDelayMs = parseInt(body.queueDelayMs, 10);

    const updatedConfig = await prisma.systemConfig.upsert({
      where: { id: "default" },
      update: updateData,
      create: {
        id: "default",
        rubric: rubric || "Kriteria Penilaian Laporan:\n1. Kesesuaian dengan topik (0-25)\n2. Kedalaman analisis (0-25)\n3. Struktur dan tata bahasa (0-25)\n4. Orisinalitas dan referensi (0-25)\nTotal skor: 0-100",
        windowSize: parsedWindowSize || 3,
        ...updateData,
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
