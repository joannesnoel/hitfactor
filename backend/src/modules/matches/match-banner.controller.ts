import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { db } from '../../config/database.js';
import { matches, matchAdmins } from '../../db/schema.js';
import { s3, s3Enabled, S3_BUCKET, bannerKey } from '../../config/s3.js';
import { validateBannerUpload } from './banner-validation.js';
import type { RequestUser } from '../../middleware/auth.middleware.js';

async function canAdminMatch(
  matchId: string,
  user: RequestUser
): Promise<boolean> {
  if (user.roles.includes('admin')) return true;
  const [row] = await db
    .select({ id: matchAdmins.id })
    .from(matchAdmins)
    .where(
      and(eq(matchAdmins.match_id, matchId), eq(matchAdmins.user_id, user.id))
    )
    .limit(1);
  return !!row;
}

function ensureEnabled(reply: FastifyReply): boolean {
  if (!s3Enabled || !s3) {
    reply.status(503).send({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Object storage is not configured',
    });
    return false;
  }
  return true;
}

/**
 * POST /api/matches/:id/banner — admin uploads a match banner image. Stored in
 * Garage (S3) at matches/<id>/banner; bumps matches.banner_updated_at (which
 * signals a banner exists and cache-busts the public GET). Admin only.
 */
export async function uploadBanner(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!ensureEnabled(reply)) return;
  const { id } = request.params as { id: string };

  if (!(await canAdminMatch(id, request.user))) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to manage this match',
    });
  }

  const upload = await request.file();
  if (!upload) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'No file uploaded',
    });
  }
  const buffer = await upload.toBuffer();
  const check = validateBannerUpload(upload.mimetype, buffer.length);
  if (!check.ok) {
    return reply.status(check.status ?? 400).send({
      statusCode: check.status ?? 400,
      error: 'Bad Request',
      message: check.message ?? 'Invalid image',
    });
  }

  // Match must exist (and lets us return 404 rather than an orphan object).
  const [match] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);
  if (!match) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Match not found',
    });
  }

  await s3!.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: bannerKey(id),
      Body: buffer,
      ContentType: upload.mimetype,
      ContentLength: buffer.length,
    })
  );

  const now = new Date();
  await db
    .update(matches)
    .set({ banner_updated_at: now, updated_at: now })
    .where(eq(matches.id, id));

  return reply.send({ banner_updated_at: now.toISOString() });
}

/**
 * GET /api/matches/:id/banner — public. Streams the banner image from Garage.
 * Public so <img> tags (which can't send a JWT) and the public portal work.
 */
export async function getBanner(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!s3Enabled || !s3) return reply.status(404).send();
  const { id } = request.params as { id: string };

  try {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: bannerKey(id) })
    );
    const bytes = await obj.Body?.transformToByteArray();
    if (!bytes) return reply.status(404).send();
    return reply
      .header('Content-Type', obj.ContentType ?? 'application/octet-stream')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(Buffer.from(bytes));
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
      return reply.status(404).send();
    }
    throw err;
  }
}

/**
 * DELETE /api/matches/:id/banner — admin removes the banner. Clears
 * banner_updated_at so clients stop showing it. Admin only.
 */
export async function deleteBanner(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!ensureEnabled(reply)) return;
  const { id } = request.params as { id: string };

  if (!(await canAdminMatch(id, request.user))) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to manage this match',
    });
  }

  await s3!.send(
    new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: bannerKey(id) })
  );
  await db
    .update(matches)
    .set({ banner_updated_at: null, updated_at: new Date() })
    .where(eq(matches.id, id));

  return reply.status(204).send();
}
