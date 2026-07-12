import { describe, it, expect } from 'vitest';
import {
  validateBannerUpload,
  BANNER_MAX_BYTES,
} from './banner-validation.js';

describe('validateBannerUpload', () => {
  it('accepts png/jpeg/webp under the size cap', () => {
    for (const t of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(validateBannerUpload(t, 1024)).toEqual({ ok: true });
    }
  });

  it('rejects a disallowed type with 415', () => {
    const r = validateBannerUpload('image/gif', 1024);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(415);
  });

  it('rejects a missing type with 415', () => {
    expect(validateBannerUpload(undefined, 1024).status).toBe(415);
  });

  it('rejects an empty file with 400', () => {
    expect(validateBannerUpload('image/png', 0).status).toBe(400);
  });

  it('rejects an oversized file with 413', () => {
    const r = validateBannerUpload('image/png', BANNER_MAX_BYTES + 1);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(413);
  });

  it('accepts exactly at the cap', () => {
    expect(validateBannerUpload('image/jpeg', BANNER_MAX_BYTES).ok).toBe(true);
  });
});
