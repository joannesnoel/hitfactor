import { boot } from 'quasar/wrappers';
import { useAuthStore } from 'src/stores/auth.store';

const PUBLIC_ROUTES = ['/auth/login', '/auth/register'];

export default boot(({ router }) => {
  const authStore = useAuthStore();

  // Load persisted auth state on app start
  authStore.loadFromStorage();

  // Navigation guard for protected routes
  router.beforeEach((to, _from, next) => {
    const isPublicRoute = PUBLIC_ROUTES.includes(to.path);

    if (!authStore.isAuthenticated && !isPublicRoute) {
      next('/auth/login');
    } else if (authStore.isAuthenticated && isPublicRoute) {
      next('/shooter/dashboard');
    } else {
      next();
    }
  });
});
