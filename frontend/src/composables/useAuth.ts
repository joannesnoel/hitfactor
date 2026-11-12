import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';
import { OFFICIAL_MATCHES_ENABLED } from 'src/config/features';
import type { RegisterInput } from '@hitfactor/shared';

export function useAuth() {
  const authStore = useAuthStore();
  const router = useRouter();

  const user = computed(() => authStore.user);
  const isAuthenticated = computed(() => authStore.isAuthenticated);
  const isAdmin = computed(() => authStore.isAdmin);
  const isOfficer = computed(() => authStore.isOfficer);
  const userId = computed(() => authStore.user?.id ?? null);

  // Only allow same-origin internal paths as a post-auth redirect (e.g. a
  // pending /join/<token> invite) — never an absolute or protocol-relative URL.
  function safeRedirect(redirect?: string | null): string | null {
    if (!redirect) return null;
    return redirect.startsWith('/') && !redirect.startsWith('//')
      ? redirect
      : null;
  }

  async function login(email: string, password: string, redirect?: string | null) {
    await authStore.login(email, password);
    const dest = safeRedirect(redirect);
    if (dest) {
      router.push(dest);
    } else if (OFFICIAL_MATCHES_ENABLED && authStore.isAdmin) {
      router.push('/admin/dashboard');
    } else if (OFFICIAL_MATCHES_ENABLED && authStore.isOfficer) {
      router.push('/officer/dashboard');
    } else {
      router.push('/dashboard');
    }
  }

  async function register(input: RegisterInput, redirect?: string | null) {
    await authStore.register(input);
    router.push(safeRedirect(redirect) ?? '/dashboard');
  }

  async function logout() {
    await authStore.logout();
    router.push('/auth/login');
  }

  return {
    user,
    isAuthenticated,
    isAdmin,
    isOfficer,
    userId,
    login,
    register,
    logout,
  };
}
