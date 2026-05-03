import sharp from "sharp";

// Accepted input MIME types
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Rejected types with helpful messages
const REJECTED_TYPES: Record<string, string> = {
  "image/gif": "GIF files are not supported yet. Please upload a JPEG, PNG, WebP, or HEIC image.",
  "image/tiff": "TIFF files are not supported. Please upload a JPEG, PNG, WebP, or HEIC image.",
  "image/bmp": "BMP files are not supported. Please upload a JPEG, PNG, WebP, or HEIC image.",
  "image/svg+xml": "SVG files are not supported. Please upload a JPEG, PNG, WebP, or HEIC image.",
};

export interface ProcessedImage {
  display: Buffer;
  thumbnail: Buffer;
  original: Buffer;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Check if a MIME type is accepted by the image pipeline.
 * Returns null if accepted, or an error message string if rejected.
 */
export function validateImageMimeType(mimeType: string): string | null {
  if (ACCEPTED_MIME_TYPES.has(mimeType)) return null;
  return (
    REJECTED_TYPES[mimeType] ||
    `Unsupported image format "${mimeType}". Accepted: JPEG, PNG, WebP, HEIC, HEIF.`
  );
}

/**
 * Process an image buffer through the Sharp pipeline.
 *
 * - Display: 1600px longest edge, fit inside, withoutEnlargement, WebP q80, EXIF auto-rotate
 * - Thumbnail: 400px square, fit cover, WebP q70, EXIF auto-rotate
 * - Original: pass-through buffer (stored as-is for archival / future paid-tier access)
 */
export async function processImage(inputBuffer: Buffer): Promise<ProcessedImage> {
  // Read metadata first to get dimensions and validate format
  const metadata = await sharp(inputBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions. The file may be corrupted.");
  }

  // Display version: 1600px longest edge, WebP
  const display = await sharp(inputBuffer)
    .rotate() // auto-orient from EXIF
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Thumbnail: 400px square, cover crop, WebP
  const thumbnail = await sharp(inputBuffer)
    .rotate()
    .resize(400, 400, { fit: "cover" })
    .webp({ quality: 70 })
    .toBuffer();

  // Determine the original's actual dimensions after EXIF rotation
  const rotated = await sharp(inputBuffer).rotate().metadata();

  return {
    display,
    thumbnail,
    original: inputBuffer,
    width: rotated.width || metadata.width,
    height: rotated.height || metadata.height,
    mimeType: `image/${metadata.format || "jpeg"}`,
  };
}
