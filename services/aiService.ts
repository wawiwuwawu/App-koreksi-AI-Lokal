import OpenAI from "openai";
import { AIGradingResult } from "@/types";

const baseURL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
const modelName = process.env.LM_STUDIO_MODEL || "google/gemma-4-e2b";

// Initialize OpenAI client configured for LM Studio
const openai = new OpenAI({
  apiKey: "not-needed-for-local-lm-studio",
  baseURL,
});

/**
 * Clean and strip any markdown syntax wrappers (e.g. ```json ... ```)
 * from the local LLM response before parsing.
 */
export function sanitizeLLMJson(raw: string): string {
  let cleaned = raw.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    cleaned = jsonMatch[1];
  }
  return cleaned.trim();
}

interface EvaluateParams {
  studentName: string;
  extractedText: string;
  base64Images: string[];
  memoryContext: string;
  rubric: string;
}

/**
 * Core grading logic that passes the prompt, student work, visual pages, and sliding window context
 * to the local multimodal LLM.
 */
export async function evaluateAssignment({
  studentName,
  extractedText,
  base64Images,
  memoryContext,
  rubric,
}: EvaluateParams): Promise<AIGradingResult> {
  const systemPrompt = `Anda adalah Asisten Penilai AI Profesional untuk mengoreksi tugas/laporan mahasiswa.
Tugas Anda adalah menilai laporan mahasiswa berdasarkan Rubrik Penilaian yang diberikan.

Berikut adalah Rubrik Penilaian yang harus Anda gunakan:
"""
${rubric}
"""

Untuk mendeteksi plagiarisme atau kemiripan konten antar mahasiswa, gunakan "Sliding Window Memory Context" di bawah ini yang berisi potongan teks dan nilai dari mahasiswa sebelumnya. Bandingkan gaya penulisan, kemiripan kalimat, struktur, dan kesalahan penulisan yang sama untuk melihat apakah ada indikasi menyontek/plagiat. Jika ada, sebutkan mahasiswa mana yang dituduh dicontek di dalam field "plagiarismNote".

Sliding Window Memory Context (Tugas-tugas sebelumnya):
${memoryContext}

Format Output: Anda WAJIB menjawab HANYA dalam format JSON dengan struktur persis seperti berikut (jangan ada teks pembuka/penutup):
{
  "score": <angka_integer_0_hingga_100>,
  "feedback": "<detail_evaluasi_panjang_dan_konstruktif_dalam_bahasa_indonesia>",
  "plagiarismNote": "<catatan_indikasi_plagiarisme_atau_kemiripan_dengan_mahasiswa_tertentu_jika_ada_jika_tidak_ada_kosongkan>"
}`;

  const userContent: Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }> = [
    {
      type: "text",
      text: `Berikut adalah tugas dari mahasiswa bernama "${studentName}":\n\nTeks yang diekstrak dari PDF:\n"""\n${extractedText}\n"""\n\nSilakan evaluasi teks dan gambar terlampir jika ada.`,
    },
  ];

  // Append base64 pages for vision-based evaluation if any
  base64Images.forEach((imgUrl) => {
    userContent.push({
      type: "image_url",
      image_url: {
        url: imgUrl,
      },
    });
  });

  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent as any },
      ],
      temperature: 0.2, // Consistent, deterministic output
    });

    const rawReply = response.choices[0]?.message?.content || "";
    const sanitizedReply = sanitizeLLMJson(rawReply);

    try {
      const parsed: AIGradingResult = JSON.parse(sanitizedReply);

      return {
        score: typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : 0,
        feedback: parsed.feedback || "Tidak ada feedback khusus.",
        plagiarismNote: parsed.plagiarismNote || "",
      };
    } catch (parseError) {
      console.error("Failed to parse local LLM JSON. Raw reply was:\n", rawReply);
      throw new Error("Gagal mengurai respon AI menjadi format JSON. Silakan coba lagi.");
    }
  } catch (error) {
    console.error("Error communicating with Local LM Studio:", error);
    throw error;
  }
}
