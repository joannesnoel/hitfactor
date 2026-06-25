import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { registerSchema, loginSchema } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { users } from '../../db/schema.js';
import {
  signAccessToken,
  signRefreshToken,
  signPowerSyncToken,
  verifyJWT,
  getJWKS,
} from '../../config/jwt.js';

export async function register(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { email, password, display_name, member_number } = parsed.data;

  // Check if user already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return reply.status(409).send({
      statusCode: 409,
      error: 'Conflict',
      message: 'Email already registered',
    });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(users)
    .values({
      email,
      password_hash,
      display_name,
      member_number: member_number ?? null,
      roles: ['shooter'],
    })
    .returning();

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    roles: user.roles as string[],
  };

  const access_token = await signAccessToken(tokenPayload);
  const refresh_token = await signRefreshToken(tokenPayload);

  return reply.status(201).send({
    access_token,
    refresh_token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      roles: user.roles,
    },
  });
}

export async function login(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });
  }

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    roles: user.roles as string[],
  };

  const access_token = await signAccessToken(tokenPayload);
  const refresh_token = await signRefreshToken(tokenPayload);

  return reply.send({
    access_token,
    refresh_token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      roles: user.roles,
    },
  });
}

export async function refresh(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = request.body as { refresh_token?: string };

  if (!body?.refresh_token) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'refresh_token is required',
    });
  }

  try {
    const { payload } = await verifyJWT(body.refresh_token);

    if ((payload as Record<string, unknown>).type !== 'refresh') {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid token type',
      });
    }

    const userId = payload.sub as string;

    // Fetch fresh user data
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles as string[],
    };

    const access_token = await signAccessToken(tokenPayload);
    const refresh_token = await signRefreshToken(tokenPayload);

    return reply.send({ access_token, refresh_token });
  } catch {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid or expired refresh token',
    });
  }
}

export async function getPowerSyncToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = await signPowerSyncToken(request.user.id);
  const powersyncUrl = process.env.POWERSYNC_URL ?? 'http://localhost:8080';

  // The PowerSync web SDK connector expects { endpoint, token, expiresAt }.
  // Derive expiresAt from the token's own exp claim.
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString()
  ) as { exp?: number };
  const expiresAt = payload.exp
    ? new Date(payload.exp * 1000).toISOString()
    : new Date(Date.now() + 5 * 60 * 1000).toISOString();

  return reply.send({
    endpoint: powersyncUrl,
    token,
    expiresAt,
    powersync_url: powersyncUrl, // backward-compat
  });
}

export async function getJWKSEndpoint(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const jwks = await getJWKS();
  return reply.send(jwks);
}
