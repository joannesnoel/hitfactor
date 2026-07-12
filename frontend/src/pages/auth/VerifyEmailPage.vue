<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="q-pa-lg text-center" style="width: 400px; max-width: 90vw">
      <q-card-section>
        <img src="/logo.png" alt="HitFactor" style="height: 64px" class="q-mb-sm" />
        <template v-if="state === 'pending'">
          <q-spinner color="primary" size="42px" />
          <div class="text-body1 q-mt-md">Verifying your email…</div>
        </template>
        <template v-else-if="state === 'ok'">
          <q-icon name="verified" color="positive" size="48px" />
          <div class="text-h6 q-mt-sm">Email verified</div>
          <div class="text-body2 text-grey q-mb-md">Thanks — your address is confirmed.</div>
          <q-btn color="primary" unelevated :to="ctaTo" :label="ctaLabel" />
        </template>
        <template v-else>
          <q-icon name="error" color="negative" size="48px" />
          <div class="text-h6 q-mt-sm">Verification failed</div>
          <div class="text-body2 text-grey q-mb-md">{{ error }}</div>
          <q-btn color="primary" flat to="/auth/login" label="Back to sign in" />
        </template>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from 'src/boot/axios';
import { useAuthStore } from 'src/stores/auth.store';

const route = useRoute();
const auth = useAuthStore();
const state = ref<'pending' | 'ok' | 'error'>('pending');
const error = ref('');

const ctaTo = computed(() =>
  auth.isAuthenticated ? '/shooter/dashboard' : '/auth/login',
);
const ctaLabel = computed(() =>
  auth.isAuthenticated ? 'Go to dashboard' : 'Sign in',
);

onMounted(async () => {
  const token = (route.query.token as string) ?? '';
  if (!token) {
    state.value = 'error';
    error.value = 'This verification link is missing its token.';
    return;
  }
  try {
    await api.post('/api/auth/verify-email', { token });
    if (auth.user) auth.user.email_verified = true;
    state.value = 'ok';
  } catch (e) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err.response?.data?.message ?? 'This link is invalid or expired.';
    state.value = 'error';
  }
});
</script>
