import { describe, it, expect } from 'vitest';
import { shouldReconnect, RECONNECT_MIN_GAP_MS, BUSY_GRACE_MS } from './reconnectPolicy';

describe('shouldReconnect', () => {
  it('ignores rapid foreground/blur flips', () => {
    expect(shouldReconnect(false, RECONNECT_MIN_GAP_MS - 1)).toBe(false);
  });

  it('reconnects an idle connection once the debounce has passed (iOS stale stream)', () => {
    expect(shouldReconnect(false, RECONNECT_MIN_GAP_MS)).toBe(true);
    expect(shouldReconnect(false, 10 * 60_000)).toBe(true);
  });

  it('leaves a download in progress alone, so a big first sync can finish', () => {
    expect(shouldReconnect(true, RECONNECT_MIN_GAP_MS)).toBe(false);
    expect(shouldReconnect(true, BUSY_GRACE_MS - 1)).toBe(false);
  });

  it('restarts a connection that has been busy for too long (stuck)', () => {
    expect(shouldReconnect(true, BUSY_GRACE_MS)).toBe(true);
  });
});
