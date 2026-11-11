// When the app returns to the foreground (focus, tab visible, pageshow, network
// back) it re-establishes the sync stream, because iOS can silently kill a
// backgrounded stream. But connect() tears down the current stream, so doing it
// while a download is in progress restarts a large first sync over and over and
// can keep it from ever finishing. This decides when a reconnect is worth it.

/** Rapid foreground/blur flips within this window are ignored. */
export const RECONNECT_MIN_GAP_MS = 3_000;

/**
 * While connecting or actively downloading, leave the stream alone for this long.
 * Past it the stream is treated as stuck (e.g. dead after an iOS resume) and is
 * restarted, so a genuinely hung connection still recovers.
 */
export const BUSY_GRACE_MS = 60_000;

export function shouldReconnect(busy: boolean, msSinceLastAttempt: number): boolean {
  if (msSinceLastAttempt < RECONNECT_MIN_GAP_MS) return false;
  if (busy && msSinceLastAttempt < BUSY_GRACE_MS) return false;
  return true;
}
