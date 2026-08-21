<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="q-pa-lg" style="width: 500px; max-width: 90vw">
      <q-card-section class="text-center q-pb-none">
        <img src="/logo.png" alt="HitFactor" style="height: 80px" class="q-mb-xs" />
        <div class="text-h4 text-weight-bold text-primary q-mb-sm">HitFactor</div>
        <div class="text-subtitle1 text-grey">
          {{ claimTarget ? 'Claim your shooter record' : startNew ? 'Create a new account' : 'Find your record to get started' }}
        </div>
      </q-card-section>

      <!-- Step 1: search for your imported record (shown until you pick one
           or choose to register as a brand-new shooter) -->
      <q-card-section v-if="!claimTarget && !startNew">
        <div class="text-caption text-grey-7 q-mb-sm">
          Already shot a match here? Search your name to link your history —
          most shooters already have a record.
        </div>
        <q-input
          v-model="claimQuery"
          dense
          outlined
          autofocus
          debounce="300"
          placeholder="Search your name"
          @update:model-value="searchClaimable"
        >
          <template #prepend><q-icon name="search" /></template>
          <template #append>
            <q-spinner v-if="searching" size="18px" color="grey" />
          </template>
        </q-input>
        <q-list
          v-if="claimResults.length"
          bordered
          separator
          class="rounded-borders q-mt-xs"
          style="max-height: 240px; overflow-y: auto"
        >
          <q-item
            v-for="c in claimResults"
            :key="c.id"
            clickable
            @click="selectClaim(c)"
          >
            <q-item-section>
              <q-item-label>{{ c.display_name }}</q-item-label>
              <q-item-label caption>
                {{ c.match_count }} match{{ c.match_count > 1 ? 'es' : '' }}<span
                  v-if="c.member_number"
                > · #{{ c.member_number }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side><q-icon name="chevron_right" /></q-item-section>
          </q-item>
        </q-list>
        <div
          v-else-if="claimQuery.trim().length >= 2 && !searching"
          class="text-caption text-grey q-mt-sm"
        >
          No matching record found.
        </div>

        <q-separator class="q-my-md" />
        <div class="text-center">
          <div class="text-caption text-grey-7 q-mb-xs">
            New shooter, or can't find your name?
          </div>
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Register as a new shooter"
            @click="startNew = true"
          />
        </div>
      </q-card-section>

      <!-- Selected record -->
      <q-card-section v-if="claimTarget" class="q-pb-none">
        <q-banner dense class="bg-green-1 rounded-borders">
          Linking <b>{{ claimTarget.display_name }}</b>'s history
          <template #action>
            <q-btn flat dense label="Change" @click="claimTarget = null" />
          </template>
        </q-banner>
      </q-card-section>

      <!-- New-account mode -->
      <q-card-section v-if="startNew" class="q-pb-none">
        <q-banner dense class="bg-blue-1 rounded-borders">
          Creating a new account
          <template #action>
            <q-btn flat dense label="Search instead" @click="startNew = false" />
          </template>
        </q-banner>
      </q-card-section>

      <!-- Step 2: credentials — only after a record is chosen or new-shooter -->
      <q-card-section v-if="claimTarget || startNew">
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

          <q-input
            v-if="startNew"
            v-model="form.display_name"
            label="Display Name"
            outlined
            :rules="[(val: string) => !!val || 'Display name is required']"
          >
            <template #prepend><q-icon name="person" /></template>
          </q-input>

          <q-input
            v-if="startNew"
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
        <router-link to="/auth/login" class="text-primary">
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
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
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
}

const $q = useQuasar();
const router = useRouter();
const { register } = useAuth();
const authStore = useAuthStore();

const showPassword = ref(false);
const loading = ref(false);
const error = ref('');

const claimQuery = ref('');
const claimResults = ref<Claimable[]>([]);
const claimTarget = ref<Claimable | null>(null);
// Search-first flow: the credentials form stays hidden until the user either
// selects their imported record (claimTarget) or explicitly opts to register
// as a brand-new shooter (startNew).
const startNew = ref(false);
const searching = ref(false);

const form = reactive({
  email: '',
  password: '',
  display_name: '',
  member_number: '',
});

async function searchClaimable(q: string) {
  if (!q || q.trim().length < 2) {
    claimResults.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  try {
    const { data } = await api.get<Claimable[]>('/api/users/claimable', {
      params: { q },
    });
    claimResults.value = data;
  } catch {
    claimResults.value = [];
  } finally {
    searching.value = false;
  }
}

function selectClaim(c: Claimable) {
  claimTarget.value = c;
  claimResults.value = [];
  claimQuery.value = '';
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
      await router.push('/shooter/performance');
      return;
    }
    const input: RegisterInput = {
      email: form.email,
      password: form.password,
      display_name: form.display_name,
    };
    if (form.member_number) input.member_number = form.member_number;
    await register(input);
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
