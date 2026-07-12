import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  processBanner,
  BANNER_MAX_WIDTH,
  BANNER_MAX_HEIGHT,
} from './banner-image.js';

// A solid-color raw image encoded to PNG, at a given size.
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 30, b: 30 },
    },
  })
    .png()
    .toBuffer();
}

describe('processBanner', () => {
  it('downscales an oversized image to fit the bound and outputs WebP', async () => {
    const input = await makePng(3000, 1000); // wider than the cap
    const { data, contentType } = await processBanner(input);
    expect(contentType).toBe('image/webp');
    const meta = await sharp(data).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(BANNER_MAX_WIDTH);
    expect(meta.height).toBeLessThanOrEqual(BANNER_MAX_HEIGHT);
    // Aspect ratio preserved (3:1) → width hits the 1920 cap first.
    expect(meta.width).toBe(BANNER_MAX_WIDTH);
    expect(meta.height).toBe(Math.round(BANNER_MAX_WIDTH / 3));
  });

  it('does not upscale a small image, but still re-encodes to WebP', async () => {
    const input = await makePng(400, 200);
    const { data } = await processBanner(input);
    const meta = await sharp(data).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(200);
  });

  it('rejects a non-image buffer', async () => {
    await expect(
      processBanner(Buffer.from('this is not an image'))
    ).rejects.toBeTruthy();
  });
});
