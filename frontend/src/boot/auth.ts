import { boot } from 'quasar/wrappers';
import { useAuthStore } from 'src/stores/auth.store';

const AUTH_PAGES = ['/auth/login', '/auth/register'];

export default boot(({ router }) => {
  const authStore = useAuthStore();

  // Load persisted auth state on app start
  authStore.loadFromStorage();

  // Navigation guard. Public routes (meta.public) render for everyone;
  // auth pages bounce signed-in users to their dashboard; everything else
  // requires a session.
  router.beforeEach((to, _from, next) => {
    // Resume a pending private-match invite once the guest is signed in — a
    // safety net for the QR/join flow if the ?redirect= is ever dropped along
    // the sign-up path. JoinMatchPage stores it (unauthenticated) and clears it
    // on arrival (authenticated), so this fires at most once.
    if (authStore.isAuthenticated && !to.path.startsWith('/join/')) {
      let pending: string | null = null;
      try {
        pending = localStorage.getItem('hf.pendingJoin');
      } catch {
        pending = null;
      }
      if (pending && pending.startsWith('/join/')) {
        return next(pending);
      }
    }

    const isPublic = to.matched.some((r) => r.meta?.public);
    const isAuthPage = AUTH_PAGES.includes(to.path);

    if (isPublic) {
      next();
    } else if (isAuthPage) {
      next(authStore.isAuthenticated ? '/dashboard' : undefined);
    } else if (!authStore.isAuthenticated) {
      next('/auth/login');
    } else {
      next();
    }
  });
});
