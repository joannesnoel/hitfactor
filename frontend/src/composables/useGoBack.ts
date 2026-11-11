import { useRouter } from 'vue-router';

// Pages a back button must never return to: login/register and the invite page
// redirect an already-signed-in user straight forward again, so stepping "back"
// onto them bounces the user into a loop.
const NO_RETURN = /^\/(auth|join)(\/|$)/;

/**
 * Decides whether the back button can safely use the browser history.
 * `previous` is vue-router's record of the entry before this one (null when the
 * page was opened directly, e.g. a QR scan, a bookmark, or after a reload that
 * dropped the app's history).
 */
export function pickBackTarget(
  previous: unknown,
  current: string,
): 'history' | 'fallback' {
  if (typeof previous !== 'string' || !previous) return 'fallback';
  if (previous === current || NO_RETURN.test(previous)) return 'fallback';
  return 'history';
}

/**
 * A predictable back button: go back in history when the previous page is a real
 * screen of the app, otherwise go to a sensible parent (replacing the entry, so
 * it can't build a back/forward loop).
 */
export function useGoBack(fallback: string): () => void {
  const router = useRouter();
  return () => {
    const previous = (window.history.state as { back?: unknown } | null)?.back;
    if (pickBackTarget(previous, router.currentRoute.value.path) === 'history') {
      router.back();
    } else {
      void router.replace(fallback);
    }
  };
}
