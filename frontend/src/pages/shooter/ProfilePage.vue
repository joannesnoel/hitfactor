<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold q-mb-lg">Profile</div>

    <q-card style="max-width: 500px">
      <q-card-section>
        <q-form @submit.prevent="handleSave" class="q-gutter-md">
          <!-- Email (read-only) -->
          <q-input
            :model-value="authStore.user?.email"
            label="Email"
            outlined
            dense
            readonly
            disable
          >
            <template #prepend>
              <q-icon name="email" />
            </template>
          </q-input>

          <q-input
            v-model="form.display_name"
            label="Display Name"
            outlined
            dense
            :rules="[(val: string) => !!val || 'Display name is required']"
          >
            <template #prepend>
              <q-icon name="person" />
            </template>
          </q-input>

          <q-input
            v-model="form.member_number"
            label="Member Number"
            outlined
            dense
          >
            <template #prepend>
              <q-icon name="badge" />
            </template>
          </q-input>

          <q-select
            v-model="form.classification"
            :options="classificationOptions"
            label="Classification"
            emit-value
            map-options
            outlined
            dense
            clearable
          />

          <q-select
            v-model="form.default_division"
            :options="divisionOptions"
            label="Default Division"
            emit-value
            map-options
            outlined
            dense
            clearable
          />

          <q-btn
            type="submit"
            color="primary"
            label="Save Profile"
            class="full-width"
            unelevated
            :loading="saving"
          />
        </q-form>
      </q-card-section>
    </q-card>

    <!-- Account Info -->
    <q-card class="q-mt-md" style="max-width: 500px">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Account Info</div>
        <q-list dense>
          <q-item>
            <q-item-section>
              <q-item-label>Roles</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-badge
                  v-for="role in authStore.user?.roles ?? []"
                  :key="role"
                  :label="role"
                  :color="role === 'admin' ? 'red' : role === 'officer' ? 'blue' : 'green'"
                />
              </div>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Member Since</q-item-label>
            </q-item-section>
            <q-item-section side>
              {{ authStore.user?.created_at ? formatDate(authStore.user.created_at) : '-' }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- Logout Button -->
    <div class="q-mt-lg" style="max-width: 500px">
      <q-btn
        outline
        color="negative"
        label="Sign Out"
        icon="logout"
        class="full-width"
        @click="handleLogout"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import { useAuthStore } from 'src/stores/auth.store';
import { useAuth } from 'src/composables/useAuth';
import { CLASSIFICATIONS, getDivisionsForOrg, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import type { Classification, Division } from '@hitfactor/shared';

const $q = useQuasar();
const authStore = useAuthStore();
const { logout } = useAuth();

const saving = ref(false);

const form = reactive<{
  display_name: string;
  member_number: string;
  classification: Classification | undefined;
  default_division: Division | undefined;
}>({
  display_name: '',
  member_number: '',
  classification: undefined,
  default_division: undefined,
});

const classificationOptions = CLASSIFICATIONS.map((c) => ({ label: c, value: c }));
// Profile is not tied to a match, so labels use the default organization.
const divisionOptions = getDivisionsForOrg(DEFAULT_ORGANIZATION).map((d) => ({
  label: d.label,
  value: d.key,
}));

onMounted(() => {
  if (authStore.user) {
    form.display_name = authStore.user.display_name;
    form.member_number = authStore.user.member_number ?? '';
    form.classification = (authStore.user.classification as Classification) ?? undefined;
    form.default_division = (authStore.user.default_division as Division) ?? undefined;
  }
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

async function handleSave() {
  saving.value = true;
  try {
    const input: Record<string, string | undefined> = {};
    if (form.display_name) input.display_name = form.display_name;
    if (form.member_number) input.member_number = form.member_number;
    if (form.classification) input.classification = form.classification;
    if (form.default_division) input.default_division = form.default_division;

    await api.patch('/api/users/profile', input);
    // Update local store
    if (authStore.user) {
      authStore.user.display_name = form.display_name;
      authStore.user.member_number = form.member_number || null;
      authStore.user.classification = form.classification ?? null;
      authStore.user.default_division = form.default_division ?? null;
      localStorage.setItem('user', JSON.stringify(authStore.user));
    }
    $q.notify({ type: 'positive', message: 'Profile updated!' });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update profile' });
  } finally {
    saving.value = false;
  }
}

async function handleLogout() {
  await logout();
}
</script>
