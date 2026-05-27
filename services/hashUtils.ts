import { loadImage, createCanvas } from "@napi-rs/canvas";

/**
 * Computes a 64-bit Difference Hash (dHash) represented as a 16-character hex string.
 * dHash tracks gradients by comparing adjacent pixels in a resized (9x8) grayscale version of the image.
 * 
 * @param imageBufferOrBase64 - Buffer of the image or base64 data string (with or without prefix data:image/...)
 */
export async function computeDHash(imageBufferOrBase64: Buffer | string): Promise<string> {
  try {
    let image;
    if (typeof imageBufferOrBase64 === "string") {
      const base64 = imageBufferOrBase64.includes(",") 
        ? imageBufferOrBase64.split(",")[1] 
        : imageBufferOrBase64;
      image = await loadImage(Buffer.from(base64, "base64"));
    } else {
      image = await loadImage(imageBufferOrBase64);
    }

    // dHash is computed on a 9x8 grid (9 width, 8 height)
    const width = 9;
    const height = 8;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Resize and draw the image
    ctx.drawImage(image, 0, 0, width, height);

    // Get pixel data
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Convert to grayscale values (using standard luminosity formula)
    const grayscale: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      grayscale.push(gray);
    }

    // Compare left and right adjacent pixels in each row
    // Each row has 9 pixels -> 8 comparisons -> 8 bits per row
    // 8 rows * 8 bits = 64 bits total
    let hashBits = "";
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width - 1; col++) {
        const leftPixel = grayscale[row * width + col];
        const rightPixel = grayscale[row * width + col + 1];
        hashBits += leftPixel > rightPixel ? "1" : "0";
      }
    }

    // Convert 64 bits to a 16-character hex string
    let hexHash = "";
    for (let i = 0; i < 64; i += 4) {
      const chunk = hashBits.substring(i, i + 4);
      hexHash += parseInt(chunk, 2).toString(16);
    }

    return hexHash;
  } catch (error) {
    console.error("[hashUtils] Failed to compute dHash, falling back to empty string:", error);
    return "";
  }
}

/**
 * Computes the Hamming Distance between two 16-character hex dHash strings.
 * This represents the number of differing bits between the two hashes.
 * Lower distance means higher visual similarity. A distance of 0 means identical visual structure.
 */
export function computeHammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) return 64; // Maximum distance if any is missing
  if (hash1.length !== hash2.length) {
    return Math.max(hash1.length, hash2.length) * 4;
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const val1 = parseInt(hash1[i], 16);
    const val2 = parseInt(hash2[i], 16);
    if (isNaN(val1) || isNaN(val2)) {
      distance += 4;
      continue;
    }
    let xor = val1 ^ val2;
    // Count number of set bits (1s) in XOR result
    while (xor > 0) {
      if (xor & 1) distance++;
      xor >>= 1;
    }
  }
  return distance;
}
