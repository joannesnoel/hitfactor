import { boot } from 'quasar/wrappers';

// Suppress the iOS Safari edge-swipe (back/forward history navigation), which
// officers kept triggering mid-scoring with a thumb near the screen edge.
//
// iOS treats an edge swipe as a system gesture, so there's no API to disable it
// outright — but blocking horizontal touch-moves that BEGIN within a few pixels
// of the left/right edge stops the browser from starting the navigation, while
// leaving normal taps and vertical scrolling untouched. (In the installed PWA /
// standalone mode this gesture doesn't exist, so this is a no-op there.)
const EDGE_PX = 30;

export default boot(() => {
  let startX = 0;
  let startY = 0;
  let fromEdge = false;

  window.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) {
        fromEdge = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      fromEdge = startX <= EDGE_PX || startX >= window.innerWidth - EDGE_PX;
    },
    { passive: true },
  );

  window.addEventListener(
    'touchmove',
    (e) => {
      if (!fromEdge || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      // Only cancel a predominantly-horizontal swipe from the edge — the one the
      // browser would read as back/forward. Vertical scrolls pass through.
      if (Math.abs(dx) > Math.abs(dy) && e.cancelable) {
        e.preventDefault();
      }
    },
    { passive: false },
  );
});
