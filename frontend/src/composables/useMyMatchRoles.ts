import { ref, onMounted, onUnmounted } from 'vue';
import { whenPowerSyncReady } from 'src/boot/powersync';
import { useAuthStore } from 'src/stores/auth.store';

export type MatchRole = 'host' | 'scorer' | 'shooter';

/**
 * Which matches the signed-in user is hosting, scoring, or shooting in — from
 * the local (synced) database, kept live with watches. There is one match
 * experience for everyone; these roles just decide what each person can do in it.
 */
export function useMyMatchRoles() {
  const auth = useAuthStore();
  const hostedIds = ref<Set<string>>(new Set());
  const scorerIds = ref<Set<string>>(new Set());
  const shooterIds = ref<Set<string>>(new Set());
  const abort = new AbortController();

  function idSet(result: { rows?: { _array?: unknown[] } }, key: string): Set<string> {
    const rows = (result.rows?._array as Record<string, string>[] | undefined) ?? [];
    return new Set(rows.map((r) => r[key]));
  }

  onMounted(async () => {
    const db = await whenPowerSyncReady();
    const uid = auth.user?.id;
    if (!db || !uid) return;
    const opts = { signal: abort.signal };
    db.watch(
      'SELECT id FROM matches WHERE created_by = ? AND is_private = 1',
      [uid],
      { onResult: (r) => (hostedIds.value = idSet(r, 'id')) },
      opts,
    );
    db.watch(
      'SELECT DISTINCT match_id FROM match_officers WHERE user_id = ?',
      [uid],
      { onResult: (r) => (scorerIds.value = idSet(r, 'match_id')) },
      opts,
    );
    db.watch(
      'SELECT DISTINCT match_id FROM registrations WHERE user_id = ?',
      [uid],
      { onResult: (r) => (shooterIds.value = idSet(r, 'match_id')) },
      opts,
    );
  });

  onUnmounted(() => abort.abort());

  function rolesFor(matchId: string): MatchRole[] {
    const out: MatchRole[] = [];
    if (hostedIds.value.has(matchId)) out.push('host');
    if (scorerIds.value.has(matchId)) out.push('scorer');
    if (shooterIds.value.has(matchId)) out.push('shooter');
    return out;
  }

  return { hostedIds, scorerIds, shooterIds, rolesFor };
}
