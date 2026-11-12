import { describe, it, expect } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'src/stores/auth.store';
import routes from './routes';

const router = createRouter({ history: createMemoryHistory(), routes });
// resolve() only matches; push() would load the lazy .vue components.
const go = async (p: string) => {
  const r = router.resolve(p);
  const redirect = r.matched.at(-1)?.redirect;
  if (!redirect) return r;
  const target = typeof redirect === 'function' ? (redirect as unknown as (to: typeof r) => string)(r) : redirect;
  return router.resolve(target);
};

describe('shooter routes live at the root', () => {
  it('resolves the root-level pages', async () => {
    for (const p of ['/dashboard', '/performance', '/profile', '/host/create', '/matches/m1']) {
      expect((await go(p)).fullPath).toBe(p);
    }
    expect((await go('/host/matches/m1/score/s1')).params.stageId).toBe('s1');
  });

  it('redirects legacy /shooter/** links, keeping query', async () => {
    expect((await go('/shooter/dashboard')).fullPath).toBe('/dashboard');
    expect((await go('/shooter/matches/m1?tab=analysis')).fullPath).toBe('/matches/m1?tab=analysis');
    expect((await go('/shooter/host/matches/m1/stages')).fullPath).toBe('/host/matches/m1/stages');
  });

  it('sends the bare root to the dashboard when signed in, else the public list', async () => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    expect((await go('/')).fullPath).toBe('/public/matches');
    auth.$patch({ accessToken: 'x' } as never);
    expect((await go('/')).fullPath).toBe('/dashboard');
  });
});
