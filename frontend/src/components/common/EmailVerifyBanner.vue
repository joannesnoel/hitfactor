<template>
  <q-banner
    v-if="show"
    dense
    class="bg-amber-2 text-amber-10"
    inline-actions
  >
    <template #avatar><q-icon name="mark_email_unread" color="amber-9" /></template>
    Please verify your email address to secure your account.
    <template #action>
      <q-btn
        flat
        dense
        no-caps
        :loading="busy"
        label="Resend email"
        @click="resend"
      />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import { useAuthStore } from 'src/stores/auth.store';

const $q = useQuasar();
const auth = useAuthStore();
const busy = ref(false);

// Only for signed-in users with an email on file that isn't verified.
const show = computed(
  () =>
    auth.isAuthenticated &&
    !!auth.user?.email &&
    auth.user?.email_verified === false,
);

async function resend() {
  busy.value = true;
  try {
    await api.post('/api/auth/resend-verification');
    $q.notify({ type: 'positive', message: 'Verification email sent', position: 'top' });
  } catch {
    $q.notify({ type: 'negative', message: 'Could not send email', position: 'top' });
  } finally {
    busy.value = false;
  }
}
</script>
