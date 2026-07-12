// Banner upload constraints, factored out for unit testing.

export const BANNER_ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const BANNER_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface BannerValidation {
  ok: boolean;
  status?: number; // HTTP status when !ok
  message?: string;
}

/** Validate a banner upload's content type and size. */
export function validateBannerUpload(
  mimetype: string | undefined,
  size: number
): BannerValidation {
  if (!mimetype || !BANNER_ALLOWED_TYPES.includes(mimetype as never)) {
    return {
      ok: false,
      status: 415,
      message: `Unsupported image type${mimetype ? ` "${mimetype}"` : ''}. Allowed: PNG, JPEG, WebP.`,
    };
  }
  if (size <= 0) {
    return { ok: false, status: 400, message: 'Empty file' };
  }
  if (size > BANNER_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      message: `Image too large (${(size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`,
    };
  }
  return { ok: true };
}
