// Pulls a match invite token out of whatever a shooter scans or pastes: the full
// invite link (".../join/<token>"), or just the token itself. Returns null for
// anything else, so only the token ever reaches the app's own /join route — a
// scanned QR can never send the app to an arbitrary URL.
const TOKEN = /^[A-Za-z0-9_-]{6,64}$/;

export function parseJoinToken(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    const m = url.pathname.match(/^\/join\/([^/]+)\/?$/);
    return m && TOKEN.test(m[1]) ? m[1] : null;
  } catch {
    // not a URL — maybe a bare code
  }
  return TOKEN.test(text) ? text : null;
}
