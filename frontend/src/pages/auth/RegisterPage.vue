<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="q-pa-lg" style="width: 500px; max-width: 90vw">
      <q-card-section class="text-center q-pb-none">
        <img src="/logo.png" alt="HitFactor" style="height: 80px" class="q-mb-xs" />
        <div class="text-h4 text-weight-bold text-primary q-mb-sm">HitFactor</div>
        <div class="text-subtitle1 text-grey">{{ subtitle }}</div>
      </q-card-section>

      <!-- ── Step 1: name ── -->
      <q-card-section v-if="step === 'name'">
        <div class="text-caption text-grey-7 q-mb-sm">
          Enter your name and we'll check for existing match history to link to
          your account.
        </div>
        <q-input
          v-model="nameInput"
          outlined
          autofocus
          label="Your full name"
          :rules="[(v: string) => (v && v.trim().length >= 2) || 'Enter your name']"
          @keyup.enter="lookup"
        >
          <template #prepend><q-icon name="person" /></template>
        </q-input>
        <q-btn
          color="primary"
          label="Continue"
          class="full-width q-mt-sm"
          size="lg"
          unelevated
          :loading="looking"
          :disable="nameInput.trim().length < 2"
          @click="lookup"
        />
      </q-card-section>

      <!-- ── Step 2: resolve a match ── -->
      <q-card-section v-else-if="step === 'resolve'">
        <!-- Single match: yes/no -->
        <template v-if="matches.length === 1">
          <div class="text-caption text-grey-7 q-mb-sm">Is this you?</div>
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="q-py-sm">
              <div class="text-subtitle1 text-weight-bold">{{ matches[0].display_name }}</div>
              <div class="text-caption text-grey">{{ recordCaption(matches[0]) }}</div>
            </q-card-section>
          </q-card>
          <q-btn
            color="primary"
            label="Yes, that's me"
            class="full-width"
            size="lg"
            unelevated
            @click="chooseClaim(matches[0])"
          />
          <q-btn
            flat
            no-caps
            color="grey-8"
            label="No — I'm new here"
            class="full-width q-mt-sm"
            @click="chooseNew"
          />
        </template>

        <!-- Multiple matches: pick one -->
        <template v-else>
          <div class="text-caption text-grey-7 q-mb-sm">
            We found a few — which one is you?
          </div>
          <q-list bordered separator class="rounded-borders" style="max-height: 260px; overflow-y: auto">
            <q-item v-for="c in matches" :key="c.id" clickable @click="chooseClaim(c)">
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ c.display_name }}</q-item-label>
                <q-item-label caption>{{ recordCaption(c) }}</q-item-label>
              </q-item-section>
              <q-item-section side><q-icon name="chevron_right" /></q-item-section>
            </q-item>
          </q-list>
          <q-btn
            flat
            no-caps
            color="grey-8"
            label="None of these — I'm new here"
            class="full-width q-mt-sm"
            @click="chooseNew"
          />
        </template>

        <div class="text-center q-mt-sm">
          <q-btn flat dense no-caps size="sm" icon="arrow_back" label="Back" @click="backToName" />
        </div>
      </q-card-section>

      <!-- ── Step 3: credentials ── -->
      <q-card-section v-else>
        <q-banner
          v-if="claimTarget"
          dense
          class="bg-green-1 rounded-borders q-mb-md"
        >
          Linking <b>{{ claimTarget.display_name }}</b>'s history
          <template #action>
            <q-btn flat dense label="Change" @click="backToName" />
          </template>
        </q-banner>
        <q-banner v-else dense class="bg-blue-1 rounded-borders q-mb-md">
          Creating a new account
          <template #action>
            <q-btn flat dense label="Change" @click="backToName" />
          </template>
        </q-banner>

        <q-form @submit.prevent="handleSubmit" class="q-gutter-md">
          <q-input
            v-model="form.email"
            label="Email"
            type="email"
            outlined
            :rules="[
              (val: string) => !!val || 'Email is required',
              (val: string) => /.+@.+\..+/.test(val) || 'Must be a valid email',
            ]"
          >
            <template #prepend><q-icon name="email" /></template>
          </q-input>

          <q-input
            v-model="form.password"
            label="Password"
            :type="showPassword ? 'text' : 'password'"
            outlined
            :rules="[
              (val: string) => !!val || 'Password is required',
              (val: string) => val.length >= 8 || 'Must be at least 8 characters',
            ]"
          >
            <template #prepend><q-icon name="lock" /></template>
            <template #append>
              <q-icon
                :name="showPassword ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <!-- New account (no record claimed): confirm name + optional member # -->
          <q-input
            v-if="!claimTarget"
            v-model="form.display_name"
            label="Display Name"
            outlined
            :rules="[(val: string) => !!val || 'Display name is required']"
          >
            <template #prepend><q-icon name="person" /></template>
          </q-input>
          <q-input
            v-if="!claimTarget"
            v-model="form.member_number"
            label="Member Number (optional)"
            outlined
          >
            <template #prepend><q-icon name="badge" /></template>
          </q-input>

          <q-btn
            type="submit"
            color="primary"
            :label="claimTarget ? 'Claim account' : 'Create account'"
            class="full-width"
            size="lg"
            unelevated
            :loading="loading"
          />
        </q-form>
      </q-card-section>

      <q-card-section class="text-center q-pt-none">
        <router-link :to="loginTo" class="text-primary">
          Already have an account? Sign in
        </router-link>
      </q-card-section>

      <q-banner v-if="error" class="text-white bg-red q-mt-sm" rounded>
        {{ error }}
      </q-banner>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from 'src/composables/useAuth';
import { useAuthStore } from 'src/stores/auth.store';
import { api } from 'src/boot/axios';
import { useQuasar } from 'quasar';
import type { RegisterInput } from '@hitfactor/shared';

interface Claimable {
  id: string;
  display_name: string;
  member_number: string | null;
  match_count: number;
  last_match: string | null;
}

const $q = useQuasar();
const router = useRouter();
const route = useRoute();
const { register } = useAuth();
const authStore = useAuthStore();

// A pending destination (e.g. a /join/<token> invite opened before signing up).
const redirect = computed(() =>
  typeof route.query.redirect === 'string' &&
  route.query.redirect.startsWith('/') &&
  !route.query.redirect.startsWith('//')
    ? route.query.redirect
    : null,
);
const loginTo = computed(() =>
  redirect.value
    ? { path: '/auth/login', query: { redirect: redirect.value } }
    : { path: '/auth/login' },
);

const showPassword = ref(false);
const loading = ref(false);
const error = ref('');

// Guided flow: name → resolve (is-this-you / pick) → credentials.
type Step = 'name' | 'resolve' | 'credentials';
const step = ref<Step>('name');
const nameInput = ref('');
const looking = ref(false);
const matches = ref<Claimable[]>([]);
const claimTarget = ref<Claimable | null>(null);

const form = reactive({
  email: '',
  password: '',
  display_name: '',
  member_number: '',
});

const subtitle = computed(() => {
  if (step.value === 'name') return "Let's find your shooter record";
  if (step.value === 'resolve') {
    return matches.value.length === 1 ? 'Is this you?' : 'Which one is you?';
  }
  return claimTarget.value ? 'Claim your record' : 'Create your account';
});

function recordCaption(c: Claimable): string {
  const parts = [`${c.match_count} match${c.match_count === 1 ? '' : 'es'}`];
  if (c.last_match) parts.push(`last: ${c.last_match}`);
  if (c.member_number) parts.push(`#${c.member_number}`);
  return parts.join(' · ');
}

// Look the typed name up against unclaimed records with match history.
async function lookup() {
  const name = nameInput.value.trim();
  if (name.length < 2) return;
  looking.value = true;
  error.value = '';
  try {
    const { data } = await api.get<Claimable[]>('/api/users/claimable', {
      params: { q: name },
    });
    matches.value = data;
    if (data.length === 0) {
      chooseNew(); // no record — straight to a new account with this name
    } else {
      step.value = 'resolve';
    }
  } catch {
    chooseNew(); // lookup failed — let them register anyway
  } finally {
    looking.value = false;
  }
}

function chooseClaim(c: Claimable) {
  claimTarget.value = c;
  step.value = 'credentials';
}

function chooseNew() {
  claimTarget.value = null;
  form.display_name = nameInput.value.trim();
  step.value = 'credentials';
}

function backToName() {
  claimTarget.value = null;
  matches.value = [];
  step.value = 'name';
}

async function handleSubmit() {
  loading.value = true;
  error.value = '';
  try {
    if (claimTarget.value) {
      await authStore.claim({
        user_id: claimTarget.value.id,
        email: form.email,
        password: form.password,
      });
      $q.notify({ type: 'positive', message: 'Record claimed — welcome!' });
      await router.push(redirect.value ?? '/shooter/performance');
      return;
    }
    const input: RegisterInput = {
      email: form.email,
      password: form.password,
      display_name: form.display_name,
    };
    if (form.member_number) input.member_number = form.member_number;
    await register(input, redirect.value);
    $q.notify({ type: 'positive', message: 'Account created!' });
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      (err instanceof Error ? err.message : 'Registration failed');
    error.value = message;
    $q.notify({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}
</script>
