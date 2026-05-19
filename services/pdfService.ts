import { PDFParse } from "pdf-parse";

// Extract Google Drive file ID from standard view or open URL formats
export function extractDriveFileId(url: string): string {
  const reg = /[-\w]{25,}/;
  const match = url.match(reg);
  if (match) return match[0];
  throw new Error("Could not parse file ID from Google Drive URL: " + url);
}

// Downloads Google Drive file using public download link into buffer
export async function downloadFileFromGoogleDrive(driveUrl: string): Promise<Buffer> {
  const fileId = extractDriveFileId(driveUrl);
  const downloadUrl = `https://drive.google.com/uc?export=download&confirm=no_antivirus&id=${fileId}`;

  const response = await fetch(downloadUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file from Google Drive (HTTP status ${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error(
      "File Google Drive tidak dapat diunduh (terdeteksi halaman HTML/login, pastikan file disetel publik: 'Siapa saja yang memiliki link dapat melihat')"
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Process PDF text and screenshots in a single PDFParse lifecycle pass
export async function processPDF(
  buffer: Buffer
): Promise<{ extractedText: string; base64Images: string[] }> {
  let parser: PDFParse | null = null;
  try {
    const uint8 = new Uint8Array(buffer);
    parser = new PDFParse({ data: uint8 });

    // 1. Extract text content
    const textResult = await parser.getText();
    const extractedText = textResult.text || "";

    // 2. Extract visual page screenshots (first 3 pages)
    let base64Images: string[] = [];
    try {
      const screenshotResult = await parser.getScreenshot({
        first: 3,
        scale: 1.5,
        imageDataUrl: true,
        imageBuffer: false,
      });
      base64Images = (screenshotResult.pages || []).map((page) => page.dataUrl);
    } catch (screenshotError) {
      console.error("[pdfService] Failed to render screenshots from PDF:", screenshotError);
      // Fallback: we still have the extracted text, so keep going
    }

    return { extractedText, base64Images };
  } catch (error) {
    console.error("[pdfService] Error processing PDF:", error);
    throw new Error("Gagal membaca atau memproses dokumen PDF");
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (err) {
        // Ignored
      }
    }
  }
}
