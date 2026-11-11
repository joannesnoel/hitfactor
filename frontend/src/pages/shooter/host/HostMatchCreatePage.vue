<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn flat dense round icon="arrow_back" aria-label="Back" @click="goBack" />
      <div class="text-h6 text-weight-bold q-ml-sm">Host a match</div>
    </div>

    <q-card flat bordered style="max-width: 560px">
      <q-card-section>
        <div class="text-caption text-grey-7 q-mb-md">
          Create your own private match. It stays off the public list — invite
          shooters with a QR code, then run and score it yourself.
        </div>

        <q-form @submit.prevent="submit" class="q-gutter-y-md">
          <q-input
            v-model="form.name"
            label="Match name"
            outlined
            autofocus
            :rules="[(v: string) => !!v || 'Name is required']"
          />

          <q-input
            v-model="form.location"
            label="Location"
            outlined
            :rules="[(v: string) => !!v || 'Location is required']"
          />

          <q-input
            v-model="form.start_date"
            label="Date"
            type="date"
            outlined
            stack-label
            :rules="[(v: string) => !!v || 'Date is required']"
          />

          <q-select
            v-model="form.organization"
            :options="orgOptions"
            emit-value
            map-options
            label="Organization"
            outlined
          />

          <q-input
            v-model.number="form.max_shooters"
            label="Max shooters (optional)"
            type="number"
            outlined
            min="1"
            max="500"
          />

          <q-btn
            type="submit"
            color="primary"
            label="Create match"
            class="full-width"
            size="lg"
            unelevated
            :loading="loading"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGoBack } from 'src/composables/useGoBack';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import {
  ORGANIZATIONS,
  DEFAULT_ORGANIZATION,
  type CreateMatchInput,
} from '@hitfactor/shared';

const $q = useQuasar();
const router = useRouter();
const goBack = useGoBack('/shooter/dashboard');
const loading = ref(false);

const orgOptions = ORGANIZATIONS.map((o) => ({ label: o, value: o }));

const form = reactive({
  name: '',
  location: '',
  start_date: new Date().toISOString().split('T')[0],
  organization: DEFAULT_ORGANIZATION as string,
  max_shooters: undefined as number | undefined,
});

async function submit() {
  loading.value = true;
  try {
    const payload: CreateMatchInput = {
      name: form.name,
      start_date: form.start_date,
      location: form.location,
      level: 'I',
      organization: form.organization as CreateMatchInput['organization'],
      is_private: true,
    };
    if (form.max_shooters) payload.max_shooters = form.max_shooters;
    const { data } = await api.post<{ id: string }>('/api/matches', payload);
    $q.notify({ type: 'positive', message: 'Match created — invite your shooters!' });
    await router.replace(`/shooter/host/matches/${data.id}`);
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Could not create the match';
    $q.notify({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}
</script>
