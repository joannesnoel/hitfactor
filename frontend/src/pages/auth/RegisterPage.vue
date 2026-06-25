<template>
  <div class="fullscreen bg-grey-2 flex flex-center">
    <q-card class="q-pa-lg" style="width: 500px; max-width: 90vw">
      <q-card-section class="text-center q-pb-none">
        <div class="text-h4 text-weight-bold text-primary q-mb-sm">HitFactor</div>
        <div class="text-subtitle1 text-grey">Create your account</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit.prevent="handleRegister" class="q-gutter-md">
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
            <template #prepend>
              <q-icon name="email" />
            </template>
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

          <q-input
            v-model="form.display_name"
            label="Display Name"
            outlined
            :rules="[(val: string) => !!val || 'Display name is required']"
          >
            <template #prepend>
              <q-icon name="person" />
            </template>
          </q-input>

          <q-input
            v-model="form.member_number"
            label="Member Number (optional)"
            outlined
          >
            <template #prepend>
              <q-icon name="badge" />
            </template>
          </q-input>

          <q-btn
            type="submit"
            color="primary"
            label="Register"
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
import { useAuth } from 'src/composables/useAuth';
import { useQuasar } from 'quasar';
import type { RegisterInput } from '@hitfactor/shared';

const $q = useQuasar();
const { register } = useAuth();

const showPassword = ref(false);
const loading = ref(false);
const error = ref('');

const form = reactive({
  email: '',
  password: '',
  display_name: '',
  member_number: '',
});

async function handleRegister() {
  loading.value = true;
  error.value = '';
  try {
    const input: RegisterInput = {
      email: form.email,
      password: form.password,
      display_name: form.display_name,
    };
    if (form.member_number) input.member_number = form.member_number;

    await register(input);
    $q.notify({ type: 'positive', message: 'Account created!' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    error.value = message;
    $q.notify({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}
</script>
