import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseURL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2-second quick health check timeout

    const res = await fetch(`${baseURL}/models`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return NextResponse.json({ status: "connected", url: baseURL });
    }
    return NextResponse.json({
      status: "disconnected",
      error: `HTTP ${res.status}`,
      url: baseURL,
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "disconnected",
      error: err?.message || "Connection refused",
      url: baseURL,
    });
  }
}
