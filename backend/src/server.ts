import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { RequestUser } from './middleware/auth.middleware.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { matchesRoutes } from './modules/matches/matches.routes.js';
import { stagesRoutes } from './modules/stages/stages.routes.js';
import { scoresRoutes } from './modules/scores/scores.routes.js';
import { squadsRoutes } from './modules/squads/squads.routes.js';
import { resultsRoutes } from './modules/results/results.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { rangesRoutes } from './modules/ranges/ranges.routes.js';
import { powersyncRoutes } from './modules/powersync/powersync.routes.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:9000')
  .split(',')
  .map((o) => o.trim());

function loadHttpsOptions() {
  const keyPath = resolve(import.meta.dirname, '../../certs/localhost-key.pem');
  const certPath = resolve(import.meta.dirname, '../../certs/localhost-cert.pem');
  if (existsSync(keyPath) && existsSync(certPath)) {
    return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
  }
  return undefined;
}

async function buildApp() {
  const https = loadHttpsOptions();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    ...(https ? { https } : {}),
  });

  // Register CORS
  await app.register(cors, {
    origin: CORS_ORIGINS,
    credentials: true,
  });

  // Decorate request with user property
  app.decorateRequest('user', null as unknown as RequestUser);

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register route modules
  await app.register(authRoutes);
  await app.register(matchesRoutes);
  await app.register(stagesRoutes);
  await app.register(scoresRoutes);
  await app.register(squadsRoutes);
  await app.register(resultsRoutes);
  await app.register(usersRoutes);
  await app.register(rangesRoutes);
  await app.register(powersyncRoutes);

  return app;
}

async function start() {
  const app = await buildApp();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };
