<template>
  <q-card class="match-card cursor-pointer" @click="$emit('click')">
    <q-img v-if="bannerSrc" :src="bannerSrc" :ratio="16 / 5" />
    <q-card-section>
      <div class="row items-center no-wrap q-mb-sm">
        <div
          class="col text-h6 text-weight-bold ellipsis"
          style="min-width: 0"
        >
          {{ match.name }}
        </div>
        <q-badge
          :color="statusColor(match.status)"
          :label="match.status"
          class="match-status-badge q-ml-sm"
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
      <div class="row items-center q-gutter-md q-mt-sm">
        <q-chip dense size="sm" icon="star" :label="`Level ${match.level}`" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Match } from '@hitfactor/shared';
import { bannerUrl } from 'src/boot/axios';

const props = defineProps<{
  match: Match;
}>();

defineEmits<{
  click: [];
}>();

const bannerSrc = computed(() =>
  bannerUrl(props.match.id, props.match.banner_updated_at),
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

function statusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'grey';
    case 'registration':
      return 'blue';
    case 'active':
      return 'green';
    case 'scoring':
      return 'orange';
    case 'final':
      return 'purple';
    case 'archived':
      return 'grey-7';
    default:
      return 'grey';
  }
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
