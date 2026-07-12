import { boot } from 'quasar/wrappers';
import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach the current access token (re-read each call, so a
// retried request after a refresh picks up the new token automatically).
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

function forceLogout(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  if (window.location.pathname !== '/auth/login') {
    window.location.href = '/auth/login';
  }
}

// Single-flight refresh: a burst of concurrent 401s triggers only one refresh.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token');
  // Bare axios (no interceptors) so a failed refresh can't recurse.
  const { data } = await axios.post<{
    access_token: string;
    refresh_token: string;
  }>(`${baseURL}/api/auth/refresh`, { refresh_token: refreshToken });
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

// Response interceptor: on 401, silently refresh the access token and retry the
// request once. Only log out if the refresh itself fails (expired/invalid
// refresh token). Bad-credential 401s from /login surface to the caller.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    const isRefreshCall = url.includes('/api/auth/refresh');
    const isLoginCall = url.includes('/api/auth/login');

    if (status === 401 && original && !original._retry && !isRefreshCall && !isLoginCall) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        await refreshPromise;
        return api(original); // request interceptor re-attaches the fresh token
      } catch {
        forceLogout();
        return Promise.reject(error);
      }
    }

    // Retried request or refresh-token 401 → the session is genuinely over.
    if (status === 401 && !isLoginCall) {
      forceLogout();
    }
    return Promise.reject(error);
  },
);

export default boot(() => {
  // axios instance is configured above, nothing else needed at boot
});

export { api, baseURL };

/**
 * Absolute URL for a match's banner image, or null when the match has none.
 * `bannerUpdatedAt` (synced on the match) both signals a banner exists and
 * busts the browser cache when the banner is replaced. Used directly as an
 * <img> src, so it points at the public GET (no auth header needed).
 */
export function bannerUrl(
  matchId: string,
  bannerUpdatedAt: string | null | undefined,
): string | null {
  if (!bannerUpdatedAt) return null;
  return `${baseURL}/api/matches/${matchId}/banner?v=${encodeURIComponent(bannerUpdatedAt)}`;
}
