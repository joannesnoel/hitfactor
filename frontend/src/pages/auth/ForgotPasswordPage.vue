<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="q-pa-lg" style="width: 400px; max-width: 90vw">
      <q-card-section class="text-center q-pb-none">
        <img src="/logo.png" alt="HitFactor" style="height: 64px" class="q-mb-xs" />
        <div class="text-h5 text-weight-bold text-primary">Forgot password</div>
      </q-card-section>

      <q-card-section v-if="!sent">
        <div class="text-body2 text-grey q-mb-md">
          Enter your account email and we'll send you a reset link.
        </div>
        <q-form @submit.prevent="submit" class="q-gutter-md">
          <q-input
            v-model="email"
            label="Email"
            type="email"
            outlined
            :rules="[(v: string) => !!v || 'Email is required', (v: string) => /.+@.+\..+/.test(v) || 'Must be a valid email']"
          >
            <template #prepend><q-icon name="email" /></template>
          </q-input>
          <q-btn
            type="submit"
            color="primary"
            label="Send reset link"
            class="full-width"
            size="lg"
            unelevated
            :loading="loading"
          />
        </q-form>
      </q-card-section>

      <q-card-section v-else class="text-center">
        <q-icon name="mark_email_read" color="positive" size="48px" class="q-mb-sm" />
        <div class="text-body1">
          If that email is registered, a reset link is on its way. Check your inbox.
        </div>
      </q-card-section>

      <q-card-section class="text-center q-pt-none">
        <router-link to="/auth/login" class="text-grey-7">← Back to sign in</router-link>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { api } from 'src/boot/axios';

const email = ref('');
const loading = ref(false);
const sent = ref(false);

async function submit() {
  loading.value = true;
  try {
    await api.post('/api/auth/forgot-password', { email: email.value });
    sent.value = true;
  } finally {
    loading.value = false;
  }
}
</script>
