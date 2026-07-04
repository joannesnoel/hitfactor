import type { FastifyRequest, FastifyReply } from 'fastify';
import { parsePsc } from './practiscore-psc.js';
import { importMatch } from './import.service.js';

/**
 * POST /api/admin/import?commit=true — upload a PractiScore .psc file.
 * Without commit=true it's a dry-run preview (parses + reports a summary,
 * rolls back). Admin only.
 */
export async function importMatchUpload(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user.roles.includes('admin')) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }

  const query = request.query as { commit?: string; in_progress?: string };
  const commit = query.commit === 'true';
  // In-progress matches are marked 'scoring' (shown as ongoing, not completed),
  // so the admin can keep uploading updated .psc exports through the day.
  const status = query.in_progress === 'true' ? 'scoring' : 'final';

  const upload = await request.file();
  if (!upload) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'No file uploaded',
    });
  }

  const buffer = await upload.toBuffer();

  let parsed;
  try {
    parsed = parsePsc(new Uint8Array(buffer));
  } catch (err) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message:
        err instanceof Error ? err.message : 'Failed to parse .psc file',
    });
  }

  const summary = await importMatch(parsed, request.user.id, {
    dryRun: !commit,
    status,
  });
  return reply.send(summary);
}
