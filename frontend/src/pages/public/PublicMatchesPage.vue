<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold q-mb-md">Matches</div>

    <q-tabs
      v-model="tab"
      dense
      align="left"
      class="text-grey q-mb-md"
      active-color="primary"
      indicator-color="primary"
      narrow-indicator
    >
      <q-tab name="upcoming" :label="`Upcoming & Live (${upcoming.length})`" />
      <q-tab name="completed" :label="`Completed (${completed.length})`" />
    </q-tabs>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <div class="row q-col-gutter-md">
        <div
          v-for="m in shown"
          :key="m.id"
          class="col-12 col-sm-6 col-md-4"
        >
          <MatchCard :match="m" @click="open(m.id)" />
        </div>
      </div>
      <div v-if="shown.length === 0" class="text-center text-grey q-pa-xl">
        No {{ tab }} matches
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from 'src/boot/axios';
import type { Match } from '@hitfactor/shared';
import MatchCard from 'src/components/match/MatchCard.vue';

const router = useRouter();
const loading = ref(true);
const matches = ref<Match[]>([]);
const tab = ref<'upcoming' | 'completed'>('upcoming');

const COMPLETED = ['final', 'archived'];
const upcoming = computed(() =>
  matches.value.filter((m) => !COMPLETED.includes(m.status))
);
const completed = computed(() =>
  matches.value.filter((m) => COMPLETED.includes(m.status))
);
const shown = computed(() =>
  tab.value === 'upcoming' ? upcoming.value : completed.value
);

function open(id: string): void {
  void router.push(`/public/matches/${id}`);
}

onMounted(async () => {
  try {
    const { data } = await api.get<Match[]>('/api/public/matches');
    matches.value = Array.isArray(data) ? data : [];
  } catch {
    matches.value = [];
  } finally {
    loading.value = false;
  }
});
</script>
