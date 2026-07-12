import sharp from 'sharp';

// Normalize an uploaded banner: auto-orient from EXIF, downscale to fit within
// a sane bound (never upscale), strip metadata, and re-encode to WebP. This
// bounds stored size + payload and gives every banner a consistent format
// regardless of what the admin uploaded.

export const BANNER_MAX_WIDTH = 1920;
export const BANNER_MAX_HEIGHT = 1080;
export const BANNER_OUTPUT_TYPE = 'image/webp';

export interface ProcessedBanner {
  data: Buffer;
  contentType: string;
}

/**
 * Resize/re-encode a banner image buffer. Throws if the buffer is not a
 * decodable image (caller maps that to a 400).
 */
export async function processBanner(input: Buffer): Promise<ProcessedBanner> {
  const data = await sharp(input)
    .rotate() // apply EXIF orientation, then drop metadata
    .resize(BANNER_MAX_WIDTH, BANNER_MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  return { data, contentType: BANNER_OUTPUT_TYPE };
}
