import type { FastifyRequest, FastifyReply } from 'fastify';

export function requireRole(role: string) {
  return async function roleMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user || !request.user.roles.includes(role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `Requires '${role}' role`,
      });
    }
  };
}
