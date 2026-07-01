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
    const isPublic = to.matched.some((r) => r.meta?.public);
    const isAuthPage = AUTH_PAGES.includes(to.path);

    if (isPublic) {
      next();
    } else if (isAuthPage) {
      next(authStore.isAuthenticated ? '/shooter/dashboard' : undefined);
    } else if (!authStore.isAuthenticated) {
      next('/auth/login');
    } else {
      next();
    }
  });
});
