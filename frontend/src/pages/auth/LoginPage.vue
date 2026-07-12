<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="login-card q-pa-lg" style="width: 400px; max-width: 90vw">
      <q-card-section class="text-center q-pb-none">
        <img src="/logo.png" alt="HitFactor" style="height: 88px" class="q-mb-xs" />
        <div class="text-h4 text-weight-bold text-primary q-mb-sm">HitFactor</div>
        <div class="text-subtitle1 text-grey">Home for Cebuano practical shooters</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit.prevent="handleLogin" class="q-gutter-md">
          <q-input
            v-model="email"
            label="Email"
            type="email"
            outlined
            :rules="[(val: string) => !!val || 'Email is required', (val: string) => /.+@.+\..+/.test(val) || 'Must be a valid email']"
          >
            <template #prepend>
              <q-icon name="email" />
            </template>
          </q-input>

          <q-input
            v-model="password"
            label="Password"
            :type="showPassword ? 'text' : 'password'"
            outlined
            :rules="[(val: string) => !!val || 'Password is required']"
          >
            <template #prepend>
              <q-icon name="lock" />
            </template>
            <template #append>
              <q-icon
                :name="showPassword ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <q-btn
            type="submit"
            color="primary"
            label="Sign In"
            class="full-width"
            size="lg"
            unelevated
            :loading="loading"
          />
        </q-form>
      </q-card-section>

      <q-card-section class="text-center q-pt-none">
        <router-link to="/auth/forgot-password" class="text-grey-7">
          Forgot password?
        </router-link>
        <div class="q-mt-sm">
          <router-link to="/auth/register" class="text-primary">
            Don't have an account? Register
          </router-link>
        </div>
        <div class="q-mt-sm">
          <router-link to="/public/matches" class="text-grey-7">
            Browse public results →
          </router-link>
        </div>
      </q-card-section>

      <q-banner v-if="error" class="text-white bg-red q-mt-sm" rounded>
        {{ error }}
      </q-banner>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from 'src/composables/useAuth';
import { useQuasar } from 'quasar';

const $q = useQuasar();
const { login } = useAuth();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  loading.value = true;
  error.value = '';
  try {
    await login(email.value, password.value);
    $q.notify({ type: 'positive', message: 'Welcome back!' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    error.value = message;
    $q.notify({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}
</script>
