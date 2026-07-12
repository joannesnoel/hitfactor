import type { FastifyRequest, FastifyReply } from 'fastify';
import { parsePsc } from './practiscore-psc.js';
import { importMatch } from './import.service.js';
import { fetchEssShooters, buildEssMatch } from './ipsc-ess.js';

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

/**
 * Parse an ESS portal/verify URL into a validated host + integer match id.
 * SSRF guard: host must end with `.ipscess.org`; match id must be an integer.
 */
function parseEssUrl(raw: string): { host: string; matchId: number } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('URL must be https');
  }
  const host = url.hostname.toLowerCase();
  if (!(host === 'ipscess.org' || host.endsWith('.ipscess.org'))) {
    throw new Error('Host must be an *.ipscess.org portal');
  }
  // match id from ?match=<n>, ?matchId=<n>, or /verify/<n>
  const q =
    url.searchParams.get('match') ?? url.searchParams.get('matchId') ?? '';
  const pathMatch = url.pathname.match(/\/verify\/(\d+)/);
  const idStr = q || (pathMatch ? pathMatch[1] : '');
  const matchId = Number(idStr);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new Error('Could not find an integer match id in the URL');
  }
  return { host, matchId };
}

/**
 * POST /api/admin/import/ess — import a match from an IPSC ESS results portal.
 * Body: { url }. Query commit=true persists (else dry-run preview);
 * in_progress=true marks the match 'scoring'. Admin only. The backend fetches
 * the public per-shooter verify pages server-to-server (browser CORS blocks it).
 */
export async function importMatchFromEss(
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
  const status = query.in_progress === 'true' ? 'scoring' : 'final';

  const body = (request.body ?? {}) as { url?: string };
  if (!body.url || typeof body.url !== 'string') {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Missing "url" in request body',
    });
  }

  let host: string;
  let matchId: number;
  try {
    ({ host, matchId } = parseEssUrl(body.url));
  } catch (err) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: err instanceof Error ? err.message : 'Invalid ESS URL',
    });
  }

  const { shooters, scanned } = await fetchEssShooters(host, matchId);
  if (shooters.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `No shooters found for match ${matchId} on ${host} (scanned ${scanned} ids)`,
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  const parsed = buildEssMatch(host, matchId, shooters, date);

  const summary = await importMatch(parsed, request.user.id, {
    dryRun: !commit,
    status,
  });
  summary.warnings.unshift(
    `Scraped ${shooters.length} shooter(s) from ${host} (scanned ${scanned} ids). No steel/DQ data in ESS verify pages; date defaulted to ${date}.`
  );
  return reply.send(summary);
}
