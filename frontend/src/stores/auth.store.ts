import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from 'src/boot/axios';
import { connectPowerSync, disconnectPowerSync } from 'src/boot/powersync';
import type { User, AuthTokens } from '@hitfactor/shared';
import type { RegisterInput } from '@hitfactor/shared';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value);

  const userRoles = computed(() => user.value?.roles ?? []);
  const isAdmin = computed(() => userRoles.value.includes('admin'));
  const isOfficer = computed(() => userRoles.value.includes('officer'));

  function setTokens(tokens: AuthTokens) {
    accessToken.value = tokens.access_token;
    refreshToken.value = tokens.refresh_token;
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  }

  function clearAuth() {
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  async function login(email: string, password: string) {
    const response = await api.post<User & AuthTokens>(
      '/api/auth/login',
      { email, password },
    );
    user.value = response.data.user;
    setTokens(response.data);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    connectPowerSync().catch((err) =>
      console.warn('[PowerSync] Connect after login failed:', err),
    );
  }

  async function register(input: RegisterInput) {
    const response = await api.post<User & AuthTokens>(
      '/api/auth/register',
      input,
    );
    user.value = response.data.user;
    setTokens(response.data);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    connectPowerSync().catch((err) =>
      console.warn('[PowerSync] Connect after register failed:', err),
    );
  }

  async function claim(input: { user_id: string; email: string; password: string }) {
    const response = await api.post<User & AuthTokens>('/api/auth/claim', input);
    user.value = response.data.user;
    setTokens(response.data);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    connectPowerSync().catch((err) =>
      console.warn('[PowerSync] Connect after claim failed:', err),
    );
  }

  function logout() {
    clearAuth();
    // Fire-and-forget — don't block logout on PowerSync cleanup
    disconnectPowerSync().catch(() => {});
  }

  async function refreshTokens() {
    try {
      const response = await api.post<AuthTokens>('/api/auth/refresh', {
        refresh_token: refreshToken.value,
      });
      setTokens(response.data);
    } catch {
      clearAuth();
      throw new Error('Session expired');
    }
  }

  function loadFromStorage() {
    const storedToken = localStorage.getItem('access_token');
    const storedRefresh = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken) {
      accessToken.value = storedToken;
    }
    if (storedRefresh) {
      refreshToken.value = storedRefresh;
    }
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser);
      } catch {
        user.value = null;
      }
    }

    if (accessToken.value) {
      connectPowerSync().catch((err) =>
        console.warn('[PowerSync] Connect after restore failed:', err),
      );
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    userRoles,
    isAdmin,
    isOfficer,
    login,
    register,
    claim,
    logout,
    refreshTokens,
    loadFromStorage,
  };
});
