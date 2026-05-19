import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import { pdfToImg } from "pdftoimg-js";

// Extract Google Drive file ID from standard view or open URL formats
export function extractDriveFileId(url: string): string {
  // Matches IDs like: 1a2b3c4d5e...
  const reg = /[-\w]{25,}/;
  const match = url.match(reg);
  if (match) return match[0];
  throw new Error("Could not parse file ID from Google Drive URL: " + url);
}

// Downloads Google Drive file using public download link into buffer
export async function downloadFileFromGoogleDrive(driveUrl: string): Promise<Buffer> {
  const fileId = extractDriveFileId(driveUrl);
  // Construct direct download link (requires file to be shared as "Anyone with link can view")
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
  try {
    const data = await pdf(buffer);
    return data.text || "";
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Gagal membaca teks dari PDF");
  }
}

// Convert first 3 pages of PDF to Base64 image strings for multimodal evaluation
export async function convertPDFPagesToBase64(buffer: Buffer): Promise<string[]> {
  const tempDir = path.join(process.cwd(), "temp-files");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFilePath = path.join(
    tempDir,
    `temp-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`
  );
  fs.writeFileSync(tempFilePath, buffer);

  const base64Images: string[] = [];

  try {
    // Process first 3 pages (or less if document is shorter)
    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      try {
        const dataUrl = await pdfToImg(tempFilePath, {
          pages: pageNum,
          imgType: "png",
          scale: 1.5,
        });

        if (dataUrl) {
          // dataUrl is already formatted as "data:image/png;base64,iVBORw0KGgo..."
          base64Images.push(dataUrl);
        }
      } catch (err) {
        // Loop breaks or page doesn't exist (e.g. page 2 on a 1-page PDF)
        break;
      }
    }
    return base64Images;
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    return []; // Return empty if image conversion fails, fallback to text only
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error("Failed to delete temp file:", err);
      }
    }
  }
}
