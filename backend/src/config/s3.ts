import { S3Client } from '@aws-sdk/client-s3';

// S3-compatible object storage (Garage) for match banners. Configured via env
// (a k8s Secret in each namespace). When unset — e.g. local dev — s3Enabled is
// false and the banner endpoints report "disabled" instead of crashing.

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? 'garage';
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

export const S3_BUCKET = process.env.S3_BUCKET ?? '';
export const s3Enabled = Boolean(
  endpoint && accessKeyId && secretAccessKey && S3_BUCKET
);

// Garage requires path-style addressing (no virtual-host buckets).
export const s3: S3Client | null = s3Enabled
  ? new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
      },
      forcePathStyle: true,
    })
  : null;

/** Deterministic object key for a match's banner. */
export function bannerKey(matchId: string): string {
  return `matches/${matchId}/banner`;
}
