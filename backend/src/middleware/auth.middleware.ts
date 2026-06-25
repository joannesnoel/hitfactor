import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJWT } from '../config/jwt.js';

export interface RequestUser {
  id: string;
  email: string;
  roles: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user: RequestUser;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await verifyJWT(token);
    request.user = {
      id: payload.sub as string,
      email: (payload as Record<string, unknown>).email as string,
      roles: (payload as Record<string, unknown>).roles as string[] ?? [],
    };
  } catch {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}
