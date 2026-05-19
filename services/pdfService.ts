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

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file from Google Drive (HTTP status ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Extract raw text from PDF buffer
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  let parser: PDFParse | null = null;
  try {
    const uint8 = new Uint8Array(buffer);
    parser = new PDFParse({ data: uint8 });
    const result = await parser.getText();
    return result.text || "";
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Gagal membaca teks dari PDF");
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

// Convert first 3 pages of PDF to Base64 image strings for multimodal evaluation
export async function convertPDFPagesToBase64(buffer: Buffer): Promise<string[]> {
  let parser: PDFParse | null = null;
  try {
    const uint8 = new Uint8Array(buffer);
    parser = new PDFParse({ data: uint8 });
    const screenshotResult = await parser.getScreenshot({
      first: 3,
      scale: 1.5,
      imageDataUrl: true,
      imageBuffer: false,
    });

    return (screenshotResult.pages || []).map((page) => page.dataUrl);
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    return []; // Return empty list, grading pipeline will fallback to text-only evaluation
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
