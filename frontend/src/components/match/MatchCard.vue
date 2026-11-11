<template>
  <q-card class="match-card cursor-pointer" @click="$emit('click')">
    <q-img v-if="bannerSrc" :src="bannerSrc" :ratio="16 / 9" />
    <q-card-section>
      <div class="row items-center no-wrap q-mb-sm">
        <div
          class="col text-h6 text-weight-bold ellipsis"
          style="min-width: 0"
        >
          {{ match.name }}
        </div>
        <q-icon
          v-if="match.is_private"
          name="lock"
          color="deep-purple"
          size="18px"
          class="q-ml-xs"
        >
          <q-tooltip>Private — only registered shooters can see it</q-tooltip>
        </q-icon>
        <q-badge
          :color="matchStatusColor(match.status)"
          :label="matchStatusLabel(match.status)"
          class="match-status-badge q-ml-sm"
        />
      </div>
      <!-- What you are in this match: host / scorer / shooter -->
      <div v-if="roles.length || participated" class="row q-gutter-xs q-mb-sm">
        <q-chip
          v-if="roles.includes('host')"
          dense
          size="sm"
          color="teal"
          text-color="white"
          icon="manage_accounts"
          label="Host"
        />
        <q-chip
          v-if="roles.includes('scorer')"
          dense
          size="sm"
          color="indigo"
          text-color="white"
          icon="sports_score"
          label="Scorer"
        />
        <q-chip
          v-if="roles.includes('shooter') || participated"
          dense
          size="sm"
          color="positive"
          text-color="white"
          icon="check_circle"
          :label="isPast ? 'You shot' : 'You\'re in'"
        />
      </div>
      <div class="row items-center q-gutter-sm text-grey-7">
        <q-icon name="event" size="16px" />
        <span>{{ formatDateRange(match.start_date, match.end_date) }}</span>
      </div>
      <div class="row items-center q-gutter-sm text-grey-7 q-mt-xs">
        <q-icon name="location_on" size="16px" />
        <span>{{ match.location }}</span>
      </div>
      <div class="row items-center q-gutter-sm q-mt-sm">
        <q-chip
          dense
          size="sm"
          :color="orgColor"
          text-color="white"
          :label="match.organization"
        />
        <q-chip dense size="sm" icon="star" :label="`Level ${match.level}`" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Match } from '@hitfactor/shared';
import { bannerUrl } from 'src/boot/axios';
import { matchStatusLabel, matchStatusColor } from 'src/composables/matchStatus';
import type { MatchRole } from 'src/composables/useMyMatchRoles';

const props = withDefaults(
  defineProps<{
    match: Match;
    participated?: boolean;
    // Host / scorer / shooter chips; leave empty for public listings.
    roles?: MatchRole[];
  }>(),
  { participated: false, roles: () => [] },
);

const isPast = computed(
  () =>
    props.match.status === 'final' ||
    props.match.start_date < new Date().toISOString().split('T')[0],
);

defineEmits<{
  click: [];
}>();

const bannerSrc = computed(() =>
  bannerUrl(props.match.id, props.match.banner_updated_at),
);

// Distinct colour per federation so PSMOC vs PPSA is scannable at a glance.
const orgColor = computed(() =>
  props.match.organization === 'PPSA' ? 'teal-7' : 'indigo-7',
);

function formatDateRange(start: string, end: string | null): string {
  const startDate = new Date(start).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  if (!end || end === start) return startDate;
  const endDate = new Date(end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${startDate} – ${endDate}`;
}
</script>

<style scoped>
.match-card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.match-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
