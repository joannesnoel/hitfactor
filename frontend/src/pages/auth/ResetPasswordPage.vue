<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="q-pa-lg" style="width: 400px; max-width: 90vw">
      <q-card-section class="text-center q-pb-none">
        <img src="/logo.png" alt="HitFactor" style="height: 64px" class="q-mb-xs" />
        <div class="text-h5 text-weight-bold text-primary">Set a new password</div>
      </q-card-section>

      <q-card-section v-if="!done">
        <q-banner v-if="!token" class="bg-red-1 text-red-9" rounded dense>
          This reset link is missing its token. Request a new one.
        </q-banner>
        <q-form v-else @submit.prevent="submit" class="q-gutter-md">
          <q-input
            v-model="password"
            label="New password"
            :type="show ? 'text' : 'password'"
            outlined
            :rules="[(v: string) => (v?.length ?? 0) >= 8 || 'At least 8 characters']"
          >
            <template #prepend><q-icon name="lock" /></template>
            <template #append>
              <q-icon :name="show ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="show = !show" />
            </template>
          </q-input>
          <q-input
            v-model="confirm"
            label="Confirm password"
            :type="show ? 'text' : 'password'"
            outlined
            :rules="[(v: string) => v === password || 'Passwords do not match']"
          >
            <template #prepend><q-icon name="lock" /></template>
          </q-input>
          <q-btn
            type="submit"
            color="primary"
            label="Update password"
            class="full-width"
            size="lg"
            unelevated
            :loading="loading"
          />
        </q-form>
        <q-banner v-if="error" class="text-white bg-red q-mt-md" rounded dense>{{ error }}</q-banner>
      </q-card-section>

      <q-card-section v-else class="text-center">
        <q-icon name="check_circle" color="positive" size="48px" class="q-mb-sm" />
        <div class="text-body1 q-mb-md">Your password has been updated.</div>
        <q-btn color="primary" label="Sign in" unelevated to="/auth/login" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from 'src/boot/axios';

const route = useRoute();
const token = ref((route.query.token as string) ?? '');
const password = ref('');
const confirm = ref('');
const show = ref(false);
const loading = ref(false);
const done = ref(false);
const error = ref('');

async function submit() {
  if (password.value !== confirm.value) return;
  loading.value = true;
  error.value = '';
  try {
    await api.post('/api/auth/reset-password', {
      token: token.value,
      password: password.value,
    });
    done.value = true;
  } catch (e) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err.response?.data?.message ?? 'Could not reset password';
  } finally {
    loading.value = false;
  }
}
</script>
