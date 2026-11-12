import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';
import { OFFICIAL_MATCHES_ENABLED } from 'src/config/features';

export type RoleArea = 'admin' | 'officer' | 'shooter';

export interface RoleTarget {
  key: RoleArea;
  label: string;
  icon: string;
  to: string;
}

/**
 * Role-based navigation helper. Exposes which role "area" the user is currently
 * in (from the route) and the dashboards for the OTHER roles they can access —
 * used to render a consistent role switcher in every layout's account menu.
 */
export function useRoleSwitch() {
  const route = useRoute();
  const auth = useAuthStore();

  const currentArea = computed<RoleArea | null>(() => {
    if (route.path.startsWith('/admin')) return 'admin';
    if (route.path.startsWith('/officer')) return 'officer';
    if (/^\/(dashboard|performance|profile|matches|host)(\/|$)/.test(route.path)) return 'shooter';
    return null;
  });

  // Every dashboard the user can reach, in a stable order. Everyone is a shooter.
  const allTargets = computed<RoleTarget[]>(() => {
    const t: RoleTarget[] = [];
    if (OFFICIAL_MATCHES_ENABLED && auth.isAdmin)
      t.push({ key: 'admin', label: 'Admin Dashboard', icon: 'shield', to: '/admin/dashboard' });
    if (OFFICIAL_MATCHES_ENABLED && auth.isOfficer)
      t.push({ key: 'officer', label: 'Officer Dashboard', icon: 'sports_score', to: '/officer/dashboard' });
    t.push({ key: 'shooter', label: 'Shooter Dashboard', icon: 'emoji_events', to: '/dashboard' });
    return t;
  });

  // The switcher lists the roles you're NOT currently viewing.
  const switchTargets = computed(() =>
    allTargets.value.filter((x) => x.key !== currentArea.value),
  );

  return { currentArea, allTargets, switchTargets };
}
