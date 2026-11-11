<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="text-h5 text-weight-bold">My Hosted Matches</div>
      <q-space />
      <q-btn
        color="primary"
        icon="add"
        label="Host a match"
        to="/shooter/host/create"
        no-caps
        unelevated
      />
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="2.5em" />
    </div>

    <q-card
      v-else-if="matches.length === 0"
      flat
      bordered
      class="q-pa-lg text-center text-grey-7"
      style="max-width: 560px"
    >
      <q-icon name="emoji_events" size="42px" color="grey-5" class="q-mb-sm" />
      <div class="text-subtitle1 q-mb-xs">You're not hosting any matches yet</div>
      <div class="text-caption q-mb-md">
        Create a private match, invite friends with a QR code, and score it
        yourself.
      </div>
      <q-btn color="primary" label="Host a match" to="/shooter/host/create" no-caps unelevated />
    </q-card>

    <div v-else class="row q-col-gutter-md">
      <div v-for="m in matches" :key="m.id" class="col-12 col-sm-6 col-md-4">
        <q-card
          flat
          bordered
          class="cursor-pointer full-height"
          @click="$router.push(`/shooter/host/matches/${m.id}`)"
        >
          <q-card-section>
            <div class="row items-center no-wrap">
              <div class="text-subtitle1 text-weight-bold ellipsis">{{ m.name }}</div>
              <q-space />
              <q-badge :color="matchStatusColor(m.status)" :label="matchStatusLabel(m.status)" />
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">{{ summary(m) }}</div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="between">
            <q-btn flat dense no-caps color="primary" icon="qr_code_2" label="Invite" @click.stop="$router.push(`/shooter/host/matches/${m.id}`)" />
            <q-icon name="chevron_right" color="grey-6" />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { matchStatusLabel, matchStatusColor } from 'src/composables/matchStatus';
import { ref, onMounted } from 'vue';
import { whenPowerSyncReady } from 'src/boot/powersync';
import { useAuthStore } from 'src/stores/auth.store';

interface HostMatch {
  id: string;
  name: string;
  status: string;
  start_date: string;
  location: string;
  organization: string;
}

const auth = useAuthStore();
const matches = ref<HostMatch[]>([]);
const loading = ref(true);

onMounted(async () => {
  const db = await whenPowerSyncReady();
  if (!db || !auth.user) {
    loading.value = false;
    return;
  }
  // Private matches this shooter hosts sync via the host_match_data bucket, so a
  // reactive watch keeps the list current as they create or edit matches.
  db.watch(
    'SELECT id, name, status, start_date, location, organization FROM matches WHERE created_by = ? ORDER BY start_date DESC',
    [auth.user.id],
    {
      onResult: (result) => {
        matches.value = (result.rows?._array as HostMatch[]) ?? [];
        loading.value = false;
      },
    },
  );
});

function summary(m: HostMatch): string {
  const d = new Date(`${m.start_date}T00:00:00`);
  const date = Number.isNaN(d.getTime())
    ? m.start_date
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return [date, m.location, m.organization].filter(Boolean).join(' · ');
}
</script>
