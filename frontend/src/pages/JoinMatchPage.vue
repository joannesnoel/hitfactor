<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="q-pa-lg" style="width: 460px; max-width: 92vw">
      <q-card-section class="text-center q-pb-none">
        <img src="/logo.png" alt="HitFactor" style="height: 64px" class="q-mb-xs" />
        <div class="text-h5 text-weight-bold text-primary">HitFactor</div>
        <div class="text-subtitle2 text-grey">You've been invited to a match</div>
      </q-card-section>

      <!-- Loading -->
      <q-card-section v-if="loading" class="flex flex-center q-py-xl">
        <q-spinner color="primary" size="2.5em" />
      </q-card-section>

      <!-- Invalid / expired token -->
      <q-card-section v-else-if="!preview" class="text-center">
        <q-icon name="link_off" size="42px" color="grey-6" class="q-mb-sm" />
        <div class="text-subtitle1 q-mb-xs">Invite not found</div>
        <div class="text-caption text-grey-7 q-mb-md">
          {{ loadError || 'This invite link is invalid or has expired.' }}
        </div>
        <q-btn flat color="primary" label="Go to HitFactor" to="/" />
      </q-card-section>

      <template v-else>
        <!-- Match summary -->
        <q-card-section>
          <q-card flat bordered class="bg-grey-1">
            <q-card-section class="q-py-sm">
              <div class="text-h6 text-weight-bold">{{ preview.name }}</div>
              <div class="text-caption text-grey-8">{{ summaryLine }}</div>
              <div v-if="preview.host_name" class="text-caption text-grey-7 q-mt-xs">
                Hosted by {{ preview.host_name }} ·
                {{ preview.participant_count }}
                {{ preview.participant_count === 1 ? 'shooter' : 'shooters' }} in
              </div>
            </q-card-section>
          </q-card>
        </q-card-section>

        <!-- Guest: must sign in first -->
        <q-card-section v-if="!isAuthenticated" class="q-pt-none">
          <div class="text-caption text-grey-7 q-mb-md">
            Sign in or create an account to join this match. Your entry links to
            your shooter record.
          </div>
          <q-btn
            color="primary"
            label="Create account & join"
            class="full-width"
            size="lg"
            unelevated
            :to="{ path: '/auth/register', query: { redirect: joinPath } }"
          />
          <q-btn
            flat
            no-caps
            color="primary"
            label="I already have an account — sign in"
            class="full-width q-mt-sm"
            :to="{ path: '/auth/login', query: { redirect: joinPath } }"
          />
        </q-card-section>

        <!-- Already registered -->
        <q-card-section v-else-if="alreadyJoined" class="q-pt-none text-center">
          <q-icon name="check_circle" size="40px" color="positive" class="q-mb-sm" />
          <div class="text-subtitle1 q-mb-md">You're in this match</div>
          <q-btn
            color="primary"
            label="Go to match"
            class="full-width"
            unelevated
            :to="`/shooter/matches/${preview.id}`"
          />
        </q-card-section>

        <!-- Registration closed -->
        <q-card-section
          v-else-if="!preview.registration_open"
          class="q-pt-none text-center"
        >
          <q-icon name="lock" size="36px" color="grey-6" class="q-mb-sm" />
          <div class="text-subtitle1">Registration is closed</div>
          <div class="text-caption text-grey-7">
            Ask the host to re-open registration.
          </div>
        </q-card-section>

        <!-- Signed in: confirm + pick division -->
        <q-card-section v-else class="q-pt-none">
          <div class="text-caption text-grey-7 q-mb-sm">
            Joining as <b>{{ userName }}</b>. Pick your division:
          </div>
          <q-select
            v-model="division"
            :options="divisionOptions"
            emit-value
            map-options
            outlined
            label="Division"
            class="q-mb-md"
          />
          <q-btn
            color="primary"
            label="Join match"
            class="full-width"
            size="lg"
            unelevated
            :loading="joining"
            :disable="!division"
            @click="join"
          />
        </q-card-section>
      </template>

      <q-banner v-if="error" class="text-white bg-red q-mt-sm" rounded>
        {{ error }}
      </q-banner>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import { useAuthStore } from 'src/stores/auth.store';

const props = defineProps<{ token: string }>();

interface JoinPreview {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  location: string;
  organization: string;
  status: string;
  registration_open: boolean;
  host_name: string | null;
  participant_count: number;
  divisions: { key: string; label: string }[];
}

const $q = useQuasar();
const router = useRouter();
const auth = useAuthStore();

const loading = ref(true);
const loadError = ref('');
const preview = ref<JoinPreview | null>(null);
const division = ref<string | null>(null);
const joining = ref(false);
const error = ref('');
const alreadyJoined = ref(false);

const isAuthenticated = computed(() => auth.isAuthenticated);
const userName = computed(() => auth.user?.display_name ?? 'you');
const joinPath = computed(() => `/join/${props.token}`);

const divisionOptions = computed(
  () => preview.value?.divisions.map((d) => ({ label: d.label, value: d.key })) ?? [],
);

const summaryLine = computed(() => {
  if (!preview.value) return '';
  const parts = [formatDate(preview.value.start_date)];
  if (preview.value.location) parts.push(preview.value.location);
  parts.push(preview.value.organization);
  return parts.join(' · ');
});

function formatDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

onMounted(async () => {
  // Persist the invite so it survives the sign-up detour (and is resumed by the
  // nav guard even if the ?redirect= is lost). Clear it once we're here signed in.
  try {
    if (auth.isAuthenticated) localStorage.removeItem('hf.pendingJoin');
    else localStorage.setItem('hf.pendingJoin', joinPath.value);
  } catch {
    /* storage unavailable — the ?redirect= path still works */
  }

  try {
    const { data } = await api.get<JoinPreview>(`/api/matches/join/${props.token}`);
    preview.value = data;
    if (data.divisions.length) division.value = data.divisions[0].value;
  } catch (err: unknown) {
    loadError.value =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      '';
  } finally {
    loading.value = false;
  }
});

async function join() {
  if (!preview.value || !division.value) return;
  joining.value = true;
  error.value = '';
  try {
    const { data } = await api.post<{ match_id: string }>(
      `/api/matches/join/${props.token}`,
      { division: division.value },
    );
    $q.notify({ type: 'positive', message: `You're registered for ${preview.value.name}!` });
    await router.push(`/shooter/matches/${data.match_id}`);
  } catch (err: unknown) {
    error.value =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Could not join this match';
    $q.notify({ type: 'negative', message: error.value });
  } finally {
    joining.value = false;
  }
}
</script>
