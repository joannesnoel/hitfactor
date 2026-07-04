<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="q-pa-lg" style="width: 500px; max-width: 90vw">
      <q-card-section class="text-center q-pb-none">
        <div class="text-h4 text-weight-bold text-primary q-mb-sm">HitFactor</div>
        <div class="text-subtitle1 text-grey">
          {{ claimTarget ? 'Claim your shooter record' : 'Create your account' }}
        </div>
      </q-card-section>

      <!-- Claim: find your imported record -->
      <q-card-section class="q-pb-none">
        <div class="text-caption text-grey-7 q-mb-xs">
          Already shot a match? Find your name to link your history.
        </div>
        <q-input
          v-if="!claimTarget"
          v-model="claimQuery"
          dense
          outlined
          debounce="300"
          placeholder="Search your name"
          @update:model-value="searchClaimable"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <q-list
          v-if="!claimTarget && claimResults.length"
          bordered
          separator
          class="rounded-borders q-mt-xs"
          style="max-height: 200px; overflow-y: auto"
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
        <q-banner v-if="claimTarget" dense class="bg-green-1 rounded-borders q-mt-xs">
          Linking <b>{{ claimTarget.display_name }}</b>'s history
          <template #action>
            <q-btn flat dense label="Change" @click="claimTarget = null" />
          </template>
        </q-banner>
      </q-card-section>

      <q-card-section>
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
            :label="claimTarget ? 'Claim account' : 'Register'"
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

const form = reactive({
  email: '',
  password: '',
  display_name: '',
  member_number: '',
});

async function searchClaimable(q: string) {
  if (!q || q.trim().length < 2) {
    claimResults.value = [];
    return;
  }
  try {
    const { data } = await api.get<Claimable[]>('/api/users/claimable', {
      params: { q },
    });
    claimResults.value = data;
  } catch {
    claimResults.value = [];
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
