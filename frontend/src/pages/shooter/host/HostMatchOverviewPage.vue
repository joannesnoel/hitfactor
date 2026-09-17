<template>
  <q-page padding>
    <div v-if="loading && !match" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="2.5em" />
    </div>

    <template v-else-if="match">
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

      <div class="q-mt-lg">
        <q-btn flat dense no-caps color="negative" icon="delete" label="Delete match" @click="confirmDelete" />
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, copyToClipboard } from 'quasar';
import { api } from 'src/boot/axios';
import QrCode from 'src/components/common/QrCode.vue';

interface MatchRow {
  id: string;
  name: string;
  join_token: string | null;
  registration_open: number | boolean;
}
interface StageRow {
  id: string;
  name: string;
  stage_number: number;
}

const ctx = inject<{
  match: Ref<MatchRow | null>;
  stages: Ref<StageRow[]>;
  registrations: Ref<unknown[]>;
  loading: Ref<boolean>;
  matchId: string;
}>('matchContext')!;

const { match, stages, registrations, loading, matchId } = ctx;

const $q = useQuasar();
const router = useRouter();
const base = `/shooter/host/matches/${matchId}`;
const saving = ref(false);

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
      await router.replace('/shooter/host');
    } catch {
      $q.notify({ type: 'negative', message: 'Could not delete the match' });
    }
  });
}
</script>
