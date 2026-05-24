import { processPDF } from "./pdfService";
import mammoth from "mammoth";
import { createHash } from "crypto";

/**
 * Detect file type based on standard magic bytes signature:
 * - %PDF (hex: 25 50 44 46) -> PDF
 * - PK (hex: 50 4B 03 04) -> DOCX (ZIP archive format)
 */
export function detectFileType(buffer: Buffer): "pdf" | "docx" | "unknown" {
  if (buffer.length >= 4) {
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return "pdf";
    }
    if (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      return "docx";
    }
  }
  return "unknown";
}

/**
 * Extracts plain text and embedded images (up to 3) from a DOCX buffer using Mammoth.
 */
export async function processDOCX(
  buffer: Buffer
): Promise<{ extractedText: string; base64Images: string[]; imageHashes: string[] }> {
  try {
    // 1. Extract plain text content
    const textResult = await mammoth.extractRawText({ buffer });
    const extractedText = textResult.value || "";

    // 2. Extract embedded images by running conversion with a custom image handler
    const base64Images: string[] = [];
    const imageHashes: string[] = [];

    const options = {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          const imageBase64 = await image.readAsBase64String();
          const dataUrl = `data:${image.contentType};base64,${imageBase64}`;
          base64Images.push(dataUrl);

          const rawBuffer = Buffer.from(imageBase64, "base64");
          const hash = createHash("sha256").update(rawBuffer).digest("hex");
          imageHashes.push(hash);
        } catch (imgErr) {
          console.error("[documentService] Failed to read docx embedded image:", imgErr);
        }
        return { src: "" }; // We only collect, no need to produce massive HTML src
      }),
    };

    // Run convertToHtml to trigger the convertImage handler
    await mammoth.convertToHtml({ buffer }, options);

    return {
      extractedText,
      // Limit to first 3 images to prevent overloading the local multimodal LLM context
      base64Images: base64Images.slice(0, 3),
      imageHashes: imageHashes.slice(0, 3),
    };
  } catch (error: any) {
    console.error("[documentService] Error processing DOCX:", error);
    throw new Error("Gagal membaca atau memproses dokumen DOCX");
  }
}

/**
 * Unified entry point to process any supported document buffer (PDF or DOCX).
 * Automatically detects type and extracts text, base64 images, and visual hashes.
 */
export async function processDocument(
  buffer: Buffer
): Promise<{
  extractedText: string;
  base64Images: string[];
  imageHashes: string[];
  fileExtension: "pdf" | "docx";
}> {
  const fileType = detectFileType(buffer);

  if (fileType === "pdf") {
    const result = await processPDF(buffer);
    return { ...result, fileExtension: "pdf" };
  }

  if (fileType === "docx") {
    const result = await processDOCX(buffer);
    return { ...result, fileExtension: "docx" };
  }

  throw new Error("Format file tidak didukung. Harap unggah berkas PDF atau DOCX.");
}
