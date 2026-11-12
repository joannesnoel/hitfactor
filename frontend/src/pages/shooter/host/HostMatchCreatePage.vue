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

          <!-- The host usually shoots too: register them as part of creating. -->
          <q-checkbox v-model="form.participating" label="I am participating" />
          <div v-if="form.participating" class="q-gutter-y-md q-pl-md">
            <q-select
              v-model="form.division"
              :options="divisionOptions"
              emit-value
              map-options
              label="Your division"
              outlined
              :rules="[(v: string | null) => !!v || 'Pick your division']"
            />
            <div>
              <div class="text-caption text-grey-7 q-mb-xs">Power factor</div>
              <q-btn-toggle
                v-if="allowsMajor"
                v-model="form.power_factor"
                spread
                no-caps
                unelevated
                toggle-color="primary"
                color="grey-3"
                text-color="grey-9"
                :options="[
                  { label: 'Minor', value: 'Minor' },
                  { label: 'Major', value: 'Major' },
                ]"
              />
              <div v-else class="text-body2">
                Minor
                <span class="text-grey-6">
                  {{ form.division ? '(this division is Minor only)' : '(pick a division first)' }}
                </span>
              </div>
            </div>
          </div>

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
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGoBack } from 'src/composables/useGoBack';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import {
  ORGANIZATIONS,
  DEFAULT_ORGANIZATION,
  divisionAllowsMajor,
  getDivisionsForOrg,
  type CreateMatchInput,
  type Organization,
  type PowerFactor,
} from '@hitfactor/shared';

const $q = useQuasar();
const router = useRouter();
const goBack = useGoBack('/dashboard');
const loading = ref(false);

const orgOptions = ORGANIZATIONS.map((o) => ({ label: o, value: o }));

const form = reactive({
  name: '',
  location: '',
  start_date: new Date().toISOString().split('T')[0],
  organization: DEFAULT_ORGANIZATION as string,
  max_shooters: undefined as number | undefined,
  participating: true,
  division: null as string | null,
  power_factor: 'Minor' as PowerFactor,
});

// Divisions depend on the organization; a pick that no longer exists is cleared.
const divisionOptions = computed(() =>
  getDivisionsForOrg(form.organization as Organization).map((d) => ({
    label: d.label,
    value: d.key as string,
  })),
);
watch(
  () => form.organization,
  () => {
    if (!divisionOptions.value.some((d) => d.value === form.division)) form.division = null;
  },
);

// Only some divisions offer Major; the rest are fixed to Minor.
const allowsMajor = computed(() => (form.division ? divisionAllowsMajor(form.division) : false));
watch(allowsMajor, (ok) => {
  if (!ok) form.power_factor = 'Minor';
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
      hosted: true,
    };
    if (form.max_shooters) payload.max_shooters = form.max_shooters;
    if (form.participating && form.division) {
      payload.participate = { division: form.division, power_factor: form.power_factor };
    }
    const { data } = await api.post<{ id: string }>('/api/matches', payload);
    $q.notify({ type: 'positive', message: 'Match created — invite your shooters!' });
    await router.replace(`/host/matches/${data.id}`);
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
