<template>
  <q-page padding>
    <div v-if="loading && !match" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="2.5em" />
    </div>

    <template v-else-if="match">
      <!-- Finished: results are final until the host reopens the match -->
      <q-banner
        v-if="isFinished"
        rounded
        class="bg-purple-1 text-purple-10 q-mb-md"
        style="max-width: 620px"
      >
        <template #avatar><q-icon name="flag" color="purple" /></template>
        This match is finished. Reopen it to take sign-ups or change scores.
        <template #action>
          <q-btn flat no-caps color="purple" label="Reopen match" :loading="saving" @click="reopenMatch" />
        </template>
      </q-banner>

      <!-- Invite -->
      <q-card flat bordered class="q-mb-md" style="max-width: 620px">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-xs">Invite shooters</div>
          <div class="text-caption text-grey-7 q-mb-md">
            Have them scan this with their phone camera, or share the link. New
            shooters can create an account as they join.
          </div>

          <div v-if="inviteUrl" class="column items-center q-mb-md">
            <div class="bg-white q-pa-sm rounded-borders" style="border: 1px solid #e0e0e0">
              <QrCode :value="inviteUrl" :size="220" />
            </div>
          </div>
          <q-banner v-else dense class="bg-orange-1 rounded-borders q-mb-md">
            Preparing the invite link… if this persists, reload the page.
          </q-banner>

          <q-input
            v-if="inviteUrl"
            :model-value="inviteUrl"
            readonly
            outlined
            dense
          >
            <template #append>
              <q-btn flat dense icon="content_copy" @click="copyLink" />
            </template>
          </q-input>

          <div class="row items-center q-mt-md">
            <q-toggle
              :model-value="!!match.registration_open"
              label="Registration open"
              @update:model-value="setRegistrationOpen"
              :disable="saving"
            />
            <q-space />
            <div class="text-caption text-grey-7">
              {{ registrations.length }} joined
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- The host shot too: jump to their own analysis -->
      <q-card
        v-if="iShot"
        flat
        bordered
        class="q-mb-md cursor-pointer"
        style="max-width: 620px"
        @click="$router.push({ path: `/shooter/matches/${matchId}`, query: { tab: 'analysis' } })"
      >
        <q-card-section class="row items-center no-wrap">
          <q-icon name="insights" color="primary" size="28px" class="q-mr-md" />
          <div class="col">
            <div class="text-subtitle1 text-weight-bold">My analysis</div>
            <div class="text-caption text-grey-7">
              See how you did in this match, stage by stage, against the field.
            </div>
          </div>
          <q-icon name="chevron_right" color="grey-5" />
        </q-card-section>
      </q-card>

      <!-- Scorers: shooters the host lets enter scores -->
      <q-card flat bordered class="q-mb-md" style="max-width: 620px">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-xs">Scorers</div>
          <div class="text-caption text-grey-7 q-mb-sm">
            Let a shooter who has joined enter scores for any stage. They can't
            re-open locked scores or change the match.
          </div>

          <q-list v-if="scorers.length" dense separator class="q-mb-sm">
            <q-item v-for="sc in scorers" :key="sc.user_id">
              <q-item-section>{{ sc.display_name }}</q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  dense
                  no-caps
                  color="negative"
                  label="Remove"
                  :disable="scorerSaving"
                  @click="removeScorer(sc.user_id)"
                />
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else-if="!scorersLoading" class="text-caption text-grey-7 q-mb-sm">
            No scorers yet — you score everything yourself.
          </div>

          <div class="row items-center q-gutter-sm no-wrap">
            <q-select
              v-model="newScorerId"
              :options="scorerOptions"
              emit-value
              map-options
              dense
              outlined
              label="Add a shooter"
              class="col"
              :disable="scorerSaving || scorerOptions.length === 0"
              :hint="scorerOptions.length === 0 ? 'Shooters appear here once they join' : undefined"
            />
            <q-btn
              color="primary"
              unelevated
              no-caps
              label="Add"
              :loading="scorerSaving"
              :disable="!newScorerId || scorerSaving"
              @click="addScorer"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Score a stage (primary action while running the match) -->
      <div class="text-subtitle1 text-weight-medium q-mb-sm">
        <q-icon name="sports_score" color="teal" class="q-mr-xs" />Score
      </div>
      <q-card flat bordered class="q-mb-md" style="max-width: 620px">
        <q-list separator>
          <q-item
            v-for="s in orderedStages"
            :key="s.id"
            clickable
            @click="$router.push(`${base}/score/${s.id}`)"
          >
            <q-item-section avatar>
              <q-avatar color="grey-3" text-color="dark" size="32px">{{ s.stage_number }}</q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ s.name }}</q-item-label>
              <q-item-label caption>Tap to score shooters</q-item-label>
            </q-item-section>
            <q-item-section side><q-icon name="chevron_right" color="teal" /></q-item-section>
          </q-item>
          <q-item v-if="stages.length === 0">
            <q-item-section class="text-grey-7 text-caption">
              Add stages first —
              <a class="text-primary cursor-pointer" @click="$router.push(`${base}/stages`)">go to Stages</a>.
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <!-- Manage -->
      <div class="text-subtitle2 text-grey-8 q-mb-sm">Set up</div>
      <div class="row q-col-gutter-md q-mb-md" style="max-width: 620px">
        <div class="col-6 col-sm-3">
          <q-card flat bordered clickable class="cursor-pointer text-center q-pa-md" @click="$router.push(`${base}/stages`)">
            <q-icon name="flag" size="28px" color="primary" />
            <div class="text-caption q-mt-xs">Stages</div>
            <div class="text-weight-bold">{{ stages.length }}</div>
          </q-card>
        </div>
        <div class="col-6 col-sm-3">
          <q-card flat bordered clickable class="cursor-pointer text-center q-pa-md" @click="$router.push(`${base}/registrations`)">
            <q-icon name="people" size="28px" color="primary" />
            <div class="text-caption q-mt-xs">Shooters</div>
            <div class="text-weight-bold">{{ registrations.length }}</div>
          </q-card>
        </div>
        <div class="col-6 col-sm-3">
          <q-card flat bordered clickable class="cursor-pointer text-center q-pa-md" @click="$router.push(`${base}/results`)">
            <q-icon name="leaderboard" size="28px" color="primary" />
            <div class="text-caption q-mt-xs">Results</div>
          </q-card>
        </div>
      </div>

      <div class="q-mt-lg row items-center q-gutter-sm">
        <q-btn
          v-if="!isFinished"
          outline
          no-caps
          color="purple"
          icon="flag"
          label="Finish match"
          :loading="saving"
          @click="confirmFinish"
        />
        <q-btn flat dense no-caps color="negative" icon="delete" label="Delete match" @click="confirmDelete" />
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, copyToClipboard } from 'quasar';
import { api } from 'src/boot/axios';
import QrCode from 'src/components/common/QrCode.vue';
import { useAuthStore } from 'src/stores/auth.store';

interface MatchRow {
  id: string;
  name: string;
  join_token: string | null;
  registration_open: number | boolean;
  status: string;
}
interface RegistrationRow {
  id: string;
  user_id: string;
  shooter_name: string;
}
interface StageRow {
  id: string;
  name: string;
  stage_number: number;
}

const ctx = inject<{
  match: Ref<MatchRow | null>;
  stages: Ref<StageRow[]>;
  registrations: Ref<RegistrationRow[]>;
  loading: Ref<boolean>;
  matchId: string;
}>('matchContext')!;

const { match, stages, registrations, loading, matchId } = ctx;

const $q = useQuasar();
const router = useRouter();
const base = `/shooter/host/matches/${matchId}`;
const saving = ref(false);
const authStore = useAuthStore();

// Scorers live on the server (not synced to the host), so they use the REST API.
const scorers = ref<{ user_id: string; display_name: string }[]>([]);
const scorersLoading = ref(false);
const scorerSaving = ref(false);
const newScorerId = ref<string | null>(null);

// Joined shooters who aren't the host or already a scorer.
const scorerOptions = computed(() => {
  const taken = new Set(scorers.value.map((s) => s.user_id));
  const seen = new Set<string>();
  const out: { label: string; value: string }[] = [];
  for (const r of registrations.value) {
    if (!r.user_id || r.user_id === authStore.user?.id) continue;
    if (taken.has(r.user_id) || seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    out.push({ label: r.shooter_name, value: r.user_id });
  }
  return out;
});

function apiMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  );
}

async function loadScorers() {
  scorersLoading.value = true;
  try {
    const { data } = await api.get<{ user_id: string; display_name: string }[]>(
      `/api/matches/${matchId}/scorers`,
    );
    scorers.value = data;
  } catch {
    // offline / slow — leave the list as is
  } finally {
    scorersLoading.value = false;
  }
}

async function addScorer() {
  if (!newScorerId.value || scorerSaving.value) return;
  scorerSaving.value = true;
  try {
    await api.post(`/api/matches/${matchId}/scorers`, { user_id: newScorerId.value });
    newScorerId.value = null;
    await loadScorers();
    $q.notify({ type: 'positive', message: 'Scorer added', timeout: 1200 });
  } catch (err) {
    $q.notify({ type: 'negative', message: apiMessage(err, 'Could not add the scorer') });
  } finally {
    scorerSaving.value = false;
  }
}

async function removeScorer(userId: string) {
  if (scorerSaving.value) return;
  scorerSaving.value = true;
  try {
    await api.delete(`/api/matches/${matchId}/scorers/${userId}`);
    await loadScorers();
    $q.notify({ type: 'positive', message: 'Scorer removed', timeout: 1200 });
  } catch (err) {
    $q.notify({ type: 'negative', message: apiMessage(err, 'Could not remove the scorer') });
  } finally {
    scorerSaving.value = false;
  }
}

onMounted(() => void loadScorers());

// Whether the host is also a shooter in this match.
const iShot = computed(() =>
  registrations.value.some((r) => r.user_id === authStore.user?.id),
);

const isFinished = computed(() => match.value?.status === 'final');

const inviteUrl = computed(() =>
  match.value?.join_token
    ? `${window.location.origin}/join/${match.value.join_token}`
    : '',
);

const orderedStages = computed(() =>
  [...stages.value].sort((a, b) => a.stage_number - b.stage_number),
);

async function copyLink() {
  if (!inviteUrl.value) return;
  await copyToClipboard(inviteUrl.value);
  $q.notify({ type: 'positive', message: 'Invite link copied', timeout: 1200 });
}

async function setRegistrationOpen(open: boolean) {
  saving.value = true;
  try {
    await api.patch(`/api/matches/${matchId}`, { registration_open: open });
    $q.notify({
      type: 'positive',
      message: open ? 'Registration opened' : 'Registration closed',
      timeout: 1200,
    });
  } catch {
    $q.notify({ type: 'negative', message: 'Could not update registration' });
  } finally {
    saving.value = false;
  }
}

async function setStatus(body: { status: string; registration_open?: boolean }, done: string) {
  saving.value = true;
  try {
    await api.patch(`/api/matches/${matchId}`, body);
    $q.notify({ type: 'positive', message: done, timeout: 1500 });
  } catch {
    $q.notify({ type: 'negative', message: 'Could not update the match — check your connection' });
  } finally {
    saving.value = false;
  }
}

function confirmFinish() {
  $q.dialog({
    title: 'Finish match',
    message: 'Close sign-ups and mark this match finished? You can reopen it later to change scores.',
    cancel: true,
    ok: { label: 'Finish', color: 'purple', flat: true },
  }).onOk(() => void setStatus({ status: 'final', registration_open: false }, 'Match finished'));
}

function reopenMatch() {
  void setStatus({ status: 'active' }, 'Match reopened');
}

function confirmDelete() {
  $q.dialog({
    title: 'Delete match',
    message: `Delete "${match.value?.name}"? This removes all its stages, shooters and scores.`,
    cancel: true,
    ok: { label: 'Delete', color: 'negative', flat: true },
  }).onOk(async () => {
    try {
      await api.delete(`/api/matches/${matchId}`);
      $q.notify({ type: 'positive', message: 'Match deleted' });
      await router.replace('/shooter/dashboard');
    } catch {
      $q.notify({ type: 'negative', message: 'Could not delete the match' });
    }
  });
}
</script>
