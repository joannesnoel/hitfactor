import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';
import type { RegisterInput } from '@hitfactor/shared';

export function useAuth() {
  const authStore = useAuthStore();
  const router = useRouter();

  const user = computed(() => authStore.user);
  const isAuthenticated = computed(() => authStore.isAuthenticated);
  const isAdmin = computed(() => authStore.isAdmin);
  const isOfficer = computed(() => authStore.isOfficer);
  const userId = computed(() => authStore.user?.id ?? null);

  async function login(email: string, password: string) {
    await authStore.login(email, password);
    // Navigate based on role
    if (authStore.isAdmin) {
      router.push('/admin/dashboard');
    } else if (authStore.isOfficer) {
      router.push('/officer/dashboard');
    } else {
      router.push('/shooter/dashboard');
    }
  }

  async function register(input: RegisterInput) {
    await authStore.register(input);
    router.push('/shooter/dashboard');
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
