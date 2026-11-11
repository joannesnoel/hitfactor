<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5 text-weight-bold">Matches</div>
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

    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <!-- Your matches: everything you host, score, or shoot in, in one place -->
      <section class="q-mb-lg">
        <div class="text-h6 text-weight-medium q-mb-sm">Your matches</div>

        <q-card
          v-if="yourMatches.length === 0"
          flat
          bordered
          class="q-pa-lg text-center text-grey-7"
        >
          <q-icon name="emoji_events" size="42px" color="grey-5" class="q-mb-sm" />
          <div class="text-subtitle1 q-mb-xs">You're not in any matches yet</div>
          <div class="text-caption q-mb-md">
            Scan a match's QR code or open its invite link to join, or host one
            of your own and invite your friends.
          </div>
          <q-btn color="primary" label="Host a match" to="/shooter/host/create" no-caps unelevated />
        </q-card>

        <div v-else class="row q-col-gutter-md">
          <div
            v-for="m in yourMatches"
            :key="m.id"
            class="col-12 col-sm-6 col-md-4"
          >
            <MatchCard :match="m" :roles="rolesFor(m.id)" @click="open(m)" />
          </div>
        </div>
      </section>

      <!-- Find a match: public matches you're not already in -->
      <section v-if="findMatches.length" class="q-mb-lg">
        <div class="text-h6 text-weight-medium q-mb-sm">Find a match</div>
        <div class="row q-col-gutter-md">
          <div
            v-for="m in findMatches"
            :key="m.id"
            class="col-12 col-sm-6 col-md-4"
          >
            <MatchCard :match="m" @click="open(m)" />
          </div>
        </div>
      </section>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { Match } from '@hitfactor/shared';
import { useMatch } from 'src/composables/useMatch';
import { useMyMatchRoles } from 'src/composables/useMyMatchRoles';
import MatchCard from 'src/components/match/MatchCard.vue';

const router = useRouter();

// useMatch() loads the match list via a reactive db.watch — so matches appear
// as they sync in after login, without needing to leave and return to the page.
const { matches: allMatches, loading } = useMatch();

// What the user is in each match (host / scorer / shooter), live from the local db.
const { rolesFor } = useMyMatchRoles();

const today = new Date().toISOString().split('T')[0];

// A match that is on now, or still to come, sorts ahead of finished ones.
function isCurrent(m: Match): boolean {
  return (
    m.start_date >= today || m.status === 'active' || m.status === 'scoring'
  );
}

// Private matches only ever show up here, and only if you're involved in them.
const yourMatches = computed(() => {
  const mine = allMatches.value.filter((m) => rolesFor(m.id).length > 0);
  const current = mine
    .filter(isCurrent)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = mine
    .filter((m) => !isCurrent(m))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  return [...current, ...past];
});

const findMatches = computed(() =>
  allMatches.value
    .filter(
      (m) =>
        !m.is_private &&
        rolesFor(m.id).length === 0 &&
        m.start_date >= today &&
        ['registration', 'active', 'scoring'].includes(m.status),
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 6),
);

// Hosts land on their match's control page; everyone else on the match view.
function open(m: Match) {
  if (rolesFor(m.id).includes('host')) {
    void router.push(`/shooter/host/matches/${m.id}`);
  } else {
    void router.push(`/shooter/matches/${m.id}`);
  }
}
</script>
