/**
 * Long-running auto-recompute worker (single replica). Runs the dirty sweep on
 * an interval instead of a pod-per-minute CronJob — no pod churn. Ticks never
 * overlap (a slow tick is skipped, not stacked), and it shuts down cleanly on
 * SIGTERM so rollouts don't leave work half-done.
 */
import { recomputeDirtyMatches } from './recompute-sweep.js';

const INTERVAL_MS = Number(process.env.RECOMPUTE_INTERVAL_MS ?? 60_000);

let running = false;
let stopped = false;

async function tick(): Promise<void> {
  if (running || stopped) return; // skip if the previous tick is still in flight
  running = true;
  try {
    const { recomputed, total, ms } = await recomputeDirtyMatches();
    if (total > 0) {
      console.log(
        `[recompute-worker] recomputed ${recomputed}/${total} matches (${ms}ms)`
      );
    }
  } catch (err) {
    console.error('[recompute-worker] tick error:', err);
  } finally {
    running = false;
  }
}

console.log(`[recompute-worker] started; interval ${INTERVAL_MS}ms`);
void tick(); // run once on boot
const timer = setInterval(() => void tick(), INTERVAL_MS);

function shutdown(signal: string): void {
  console.log(`[recompute-worker] ${signal} — shutting down`);
  stopped = true;
  clearInterval(timer);
  // Give an in-flight tick a moment to finish, then exit.
  setTimeout(() => process.exit(0), 750);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
