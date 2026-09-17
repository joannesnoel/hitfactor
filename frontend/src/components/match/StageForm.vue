<template>
  <q-card :class="['q-pa-md', { 'fullscreen-form': fullscreen }]">
    <!-- Fullscreen header -->
    <q-toolbar v-if="fullscreen" class="bg-primary text-white">
      <q-btn flat round dense icon="close" @click="$emit('cancel')" />
      <q-toolbar-title>{{ isEditing ? 'Edit Stage' : 'Add Stage' }}</q-toolbar-title>
      <q-btn flat label="Save" @click="handleSubmit" />
    </q-toolbar>

    <q-card-section :class="{ 'scroll-area': fullscreen }">
      <div v-if="!fullscreen" class="text-h6 q-mb-md">{{ isEditing ? 'Edit Stage' : 'Add Stage' }}</div>
      <q-form @submit.prevent="handleSubmit" class="q-gutter-y-md">
        <div class="row q-col-gutter-md">
          <div class="col-4 col-xs-12">
            <q-input
              v-model.number="form.stage_number"
              label="Stage Number"
              type="number"
              :rules="[
                (val: number) => (val >= 1 && val <= 30) || 'Must be 1-30',
              ]"
              outlined
              dense
            />
          </div>
          <div class="col-8 col-xs-12">
            <q-input
              v-model="form.name"
              label="Stage Name"
              :rules="[
                (val: string) => (val && val.length > 0) || 'Required',
              ]"
              outlined
              dense
            />
          </div>
        </div>

        <q-input
          v-model="form.description"
          label="Description"
          type="textarea"
          outlined
          dense
          autogrow
        />

        <q-select
          v-model="form.scoring_type"
          :options="scoringTypeOptions"
          label="Scoring Type"
          emit-value
          map-options
          outlined
          dense
        />

        <!-- Target Configuration -->
        <div class="text-subtitle2">Targets</div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input
              v-model.number="form.number_of_targets"
              label="Paper Targets"
              type="number"
              :rules="[(val: number) => (val >= 0 && val <= 32) || 'Must be 0-32']"
              outlined
              dense
              @update:model-value="onPaperCountChange"
            />
          </div>
          <div class="col-6">
            <q-input
              v-model.number="form.number_of_steel"
              label="Steel Targets"
              type="number"
              :rules="[(val: number) => (val >= 0 && val <= 32) || 'Must be 0-32']"
              outlined
              dense
            />
          </div>
        </div>

        <!-- No-Shoots -->
        <div class="row items-center q-col-gutter-md">
          <div class="col-auto">
            <q-toggle
              v-model="hasNoShoots"
              label="No-Shoots"
            />
          </div>
          <div v-if="hasNoShoots" class="col-auto">
            <q-input
              v-model.number="form.number_of_no_shoots"
              label="Count"
              type="number"
              :rules="[(val: number) => (val >= 1 && val <= 16) || 'Must be 1-16']"
              outlined
              dense
              style="width: 100px"
            />
          </div>
        </div>

        <!-- Per-target rounds configuration -->
        <div v-if="form.number_of_targets > 0" class="q-mt-sm">
          <div class="row items-center justify-between q-mb-sm">
            <div class="text-subtitle2">Rounds per Target</div>
            <q-btn
              flat
              dense
              size="sm"
              label="Set all to"
              class="q-mr-xs"
            >
              <q-menu>
                <q-list dense>
                  <q-item v-for="n in [1, 2, 3, 4]" :key="n" clickable v-close-popup @click="setAllRounds(n)">
                    <q-item-section>{{ n }} round{{ n > 1 ? 's' : '' }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
          <div class="target-grid">
            <div
              v-for="(_, i) in form.paper_target_rounds"
              :key="i"
              class="target-tile"
              :class="{ 'target-tile--modified': form.paper_target_rounds[i] !== 2 }"
              @click="incrementRounds(i)"
              v-touch-hold.mouse="() => resetRounds(i)"
            >
              <div class="target-tile__label">T{{ i + 1 }}</div>
              <div class="target-tile__rounds">{{ form.paper_target_rounds[i] }}</div>
              <div class="target-tile__unit">rnd{{ form.paper_target_rounds[i] > 1 ? 's' : '' }}</div>
            </div>
          </div>
          <div class="text-caption text-grey q-mt-xs">Tap to add round. Hold to reset to 2.</div>
        </div>

        <!-- Computed Summary -->
        <q-banner class="bg-blue-1" rounded>
          <div class="row q-gutter-md text-body2">
            <div><strong>Min Rounds:</strong> {{ computedMinRounds }}</div>
            <div><strong>Max Points:</strong> {{ computedMaxPoints }}</div>
          </div>
        </q-banner>

        <q-input
          v-if="form.scoring_type === 'fixed_time'"
          v-model.number="form.fixed_time"
          label="Fixed Time (seconds)"
          type="number"
          step="0.01"
          outlined
          dense
        />

        <div class="row items-center q-col-gutter-md">
          <div class="col-auto">
            <q-toggle
              v-model="form.is_classifier"
              label="Is Classifier"
            />
          </div>
          <div v-if="form.is_classifier" class="col">
            <q-input
              v-model="form.classifier_number"
              label="Classifier Number"
              outlined
              dense
            />
          </div>
        </div>

        <!-- Stage Officials (public/admin matches only — a private, shooter-
             hosted match has no stage-level officials). -->
        <template v-if="!hideOfficers">
        <q-separator />
        <div class="text-subtitle2">Stage Officials</div>

        <!-- SCMO -->
        <div>
          <div class="text-caption text-grey-8 q-mb-xs">SCMO — Stage Chief Match Officer</div>
          <div v-if="scmoOfficer" class="q-mb-xs">
            <q-chip
              removable
              @remove="removeOfficerByRole('SCMO')"
              color="deep-purple-1"
              text-color="dark"
            >
              <q-avatar color="deep-purple" text-color="white" size="24px" class="q-mr-xs">
                {{ scmoOfficer.display_name.charAt(0).toUpperCase() }}
              </q-avatar>
              {{ scmoOfficer.display_name }}
            </q-chip>
          </div>
          <q-select
            v-if="!scmoOfficer"
            v-model="scmoSearch"
            :options="scmoSearchOptions"
            label="Search SCMO..."
            use-input
            input-debounce="200"
            emit-value
            map-options
            outlined
            dense
            @filter="(val, update) => searchUsersForRole(val, update, 'SCMO')"
            @update:model-value="(val) => onOfficerSelected(val, 'SCMO')"
          >
            <template #option="{ itemProps, opt }">
              <q-item v-bind="itemProps">
                <q-item-section avatar>
                  <q-avatar color="grey-4" text-color="grey-8" size="28px">
                    {{ opt.label.charAt(0).toUpperCase() }}
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                  <q-item-label caption>{{ opt.caption }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">No users found</q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>

        <!-- MO -->
        <div>
          <div class="text-caption text-grey-8 q-mb-xs">MO — Match Officers</div>
          <div v-if="moOfficers.length > 0" class="q-gutter-xs q-mb-xs">
            <q-chip
              v-for="(officer, idx) in moOfficers"
              :key="idx"
              removable
              @remove="removeOfficer(officer)"
              color="blue-grey-1"
              text-color="dark"
            >
              <q-avatar color="blue-grey" text-color="white" size="24px" class="q-mr-xs">
                {{ officer.display_name.charAt(0).toUpperCase() }}
              </q-avatar>
              {{ officer.display_name }}
            </q-chip>
          </div>
          <q-select
            v-model="moSearch"
            :options="moSearchOptions"
            label="Add Match Officer..."
            use-input
            input-debounce="200"
            emit-value
            map-options
            outlined
            dense
            @filter="(val, update) => searchUsersForRole(val, update, 'MO')"
            @update:model-value="(val) => onOfficerSelected(val, 'MO')"
          >
            <template #option="{ itemProps, opt }">
              <q-item v-bind="itemProps">
                <q-item-section avatar>
                  <q-avatar color="grey-4" text-color="grey-8" size="28px">
                    {{ opt.label.charAt(0).toUpperCase() }}
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                  <q-item-label caption>{{ opt.caption }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">No users found</q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>
        </template>

        <div v-if="!fullscreen" class="row justify-end q-gutter-sm">
          <q-btn flat label="Cancel" @click="$emit('cancel')" />
          <q-btn
            type="submit"
            color="primary"
            :label="isEditing ? 'Update Stage' : 'Add Stage'"
            unelevated
          />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watchEffect, nextTick } from 'vue';
import type { Stage, StageLevelOfficialRole } from '@hitfactor/shared';
import type { CreateStageInput, ScoringType } from '@hitfactor/shared';
import { computeStageRounds } from '@hitfactor/shared';
import { api } from 'src/boot/axios';

export interface StageOfficerAssignment {
  user_id: string;
  display_name: string;
  email: string;
  role: StageLevelOfficialRole;
}

export interface StageFormData {
  stage: CreateStageInput;
  officers: StageOfficerAssignment[];
}

const props = defineProps<{
  stage?: Stage;
  fullscreen?: boolean;
  existingOfficers?: StageOfficerAssignment[];
  // Private (shooter-hosted) matches have no stage-level officials.
  hideOfficers?: boolean;
}>();

const emit = defineEmits<{
  submit: [data: StageFormData];
  cancel: [];
}>();

const isEditing = !!props.stage;

const scoringTypeOptions = [
  { label: 'Comstock', value: 'comstock' },
  { label: 'Virginia Count', value: 'virginia_count' },
  { label: 'Fixed Time', value: 'fixed_time' },
];

const hasNoShoots = ref(false);
const scmoSearch = ref<string | null>(null);
const moSearch = ref<string | null>(null);
const scmoSearchOptions = ref<{ label: string; value: string; caption: string }[]>([]);
const moSearchOptions = ref<{ label: string; value: string; caption: string }[]>([]);
const assignedOfficers = ref<StageOfficerAssignment[]>([]);

const scmoOfficer = computed(() =>
  assignedOfficers.value.find((o) => o.role === 'SCMO') ?? null,
);
const moOfficers = computed(() =>
  assignedOfficers.value.filter((o) => o.role === 'MO'),
);

const form = reactive<{
  stage_number: number;
  name: string;
  description: string;
  scoring_type: ScoringType;
  number_of_targets: number;
  number_of_steel: number;
  number_of_no_shoots: number;
  paper_target_rounds: number[];
  fixed_time: number | undefined;
  is_classifier: boolean;
  classifier_number: string;
}>({
  stage_number: 1,
  name: '',
  description: '',
  scoring_type: 'comstock',
  number_of_targets: 5,
  number_of_steel: 0,
  number_of_no_shoots: 0,
  paper_target_rounds: [2, 2, 2, 2, 2],
  fixed_time: undefined,
  is_classifier: false,
  classifier_number: '',
});

const computedValues = computed(() =>
  computeStageRounds({
    number_of_targets: form.number_of_targets,
    number_of_steel: form.number_of_steel,
    paper_target_rounds: form.paper_target_rounds,
  }),
);

const computedMinRounds = computed(() => computedValues.value.min_rounds);
const computedMaxPoints = computed(() => computedValues.value.max_points);

watchEffect(() => {
  if (props.stage) {
    form.stage_number = props.stage.stage_number;
    form.name = props.stage.name;
    form.description = props.stage.description ?? '';
    form.scoring_type = props.stage.scoring_type as ScoringType;
    form.number_of_targets = props.stage.number_of_targets;
    form.number_of_steel = props.stage.number_of_steel;
    form.number_of_no_shoots = props.stage.number_of_no_shoots;
    form.paper_target_rounds = parsePaperRounds(
      props.stage.paper_target_rounds,
      props.stage.number_of_targets,
    );
    form.fixed_time = props.stage.fixed_time ?? undefined;
    form.is_classifier = props.stage.is_classifier;
    form.classifier_number = props.stage.classifier_number ?? '';
    hasNoShoots.value = props.stage.number_of_no_shoots > 0;
  }
  if (props.existingOfficers) {
    assignedOfficers.value = [...props.existingOfficers];
  }
});

// PowerSync stores jsonb columns as JSON strings in local SQLite, so an existing
// stage's paper_target_rounds can arrive as "[2, 2, 2]" rather than a parsed
// array. Iterating a string would render its characters ('[', ',', ...), so parse
// defensively and fall back to a sensible default per target.
function parsePaperRounds(raw: unknown, targetCount: number): number[] {
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = null;
    }
  }
  if (Array.isArray(arr) && arr.length) return arr.map((n) => Number(n));
  return Array(targetCount).fill(2);
}

function onPaperCountChange(val: number | null) {
  const count = val ?? 0;
  const current = form.paper_target_rounds;
  if (count > current.length) {
    form.paper_target_rounds = [
      ...current,
      ...Array(count - current.length).fill(2),
    ];
  } else if (count < current.length) {
    form.paper_target_rounds = current.slice(0, count);
  }
}

function setAllRounds(n: number) {
  form.paper_target_rounds = form.paper_target_rounds.map(() => n);
}

function incrementRounds(index: number) {
  form.paper_target_rounds[index]++;
}

function resetRounds(index: number) {
  form.paper_target_rounds[index] = 2;
}

async function searchUsersForRole(
  val: string,
  update: (fn: () => void) => void,
  role: StageLevelOfficialRole,
) {
  const optionsRef = role === 'SCMO' ? scmoSearchOptions : moSearchOptions;
  if (!val || val.length < 2) {
    update(() => { optionsRef.value = []; });
    return;
  }
  try {
    const response = await api.get<{ id: string; display_name: string; email: string }[]>(
      '/api/users/search',
      { params: { q: val } },
    );
    update(() => {
      optionsRef.value = response.data
        .filter((u) => !assignedOfficers.value.some((o) => o.user_id === u.id && o.role === role))
        .map((u) => ({
          label: u.display_name,
          value: u.id,
          caption: u.email,
        }));
    });
  } catch {
    update(() => { optionsRef.value = []; });
  }
}

function onOfficerSelected(userId: string | null, role: StageLevelOfficialRole) {
  if (!userId) return;
  const optionsRef = role === 'SCMO' ? scmoSearchOptions : moSearchOptions;
  const opt = optionsRef.value.find((o) => o.value === userId);
  if (!opt) return;

  // SCMO is one per stage — replace if exists
  if (role === 'SCMO') {
    const idx = assignedOfficers.value.findIndex((o) => o.role === 'SCMO');
    if (idx >= 0) assignedOfficers.value.splice(idx, 1);
  }

  assignedOfficers.value.push({
    user_id: userId,
    display_name: opt.label,
    email: opt.caption,
    role,
  });

  nextTick(() => {
    if (role === 'SCMO') {
      scmoSearch.value = null;
      scmoSearchOptions.value = [];
    } else {
      moSearch.value = null;
      moSearchOptions.value = [];
    }
  });
}

function removeOfficerByRole(role: StageLevelOfficialRole) {
  const idx = assignedOfficers.value.findIndex((o) => o.role === role);
  if (idx >= 0) assignedOfficers.value.splice(idx, 1);
}

function removeOfficer(officer: StageOfficerAssignment) {
  const idx = assignedOfficers.value.findIndex(
    (o) => o.user_id === officer.user_id && o.role === officer.role,
  );
  if (idx >= 0) assignedOfficers.value.splice(idx, 1);
}

function handleSubmit() {
  const data: CreateStageInput = {
    stage_number: form.stage_number,
    name: form.name,
    scoring_type: form.scoring_type,
    number_of_targets: form.number_of_targets,
    number_of_steel: form.number_of_steel,
    number_of_no_shoots: hasNoShoots.value ? form.number_of_no_shoots : 0,
    paper_target_rounds: form.paper_target_rounds,
    is_classifier: form.is_classifier,
  };

  if (form.description) {
    data.description = form.description;
  }
  if (form.fixed_time !== undefined && form.scoring_type === 'fixed_time') {
    data.fixed_time = form.fixed_time;
  }
  if (form.is_classifier && form.classifier_number) {
    data.classifier_number = form.classifier_number;
  }

  emit('submit', { stage: data, officers: assignedOfficers.value });
}
</script>

<style scoped>
.fullscreen-form {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 0;
}

.fullscreen-form .scroll-area {
  flex: 1;
  overflow-y: auto;
}

.target-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
}

.target-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border: 2px solid #1976d2;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}

.target-tile:active {
  transform: scale(0.93);
  background-color: rgba(25, 118, 210, 0.12);
}

.target-tile--modified {
  border-color: #ff9800;
  background-color: rgba(255, 152, 0, 0.08);
}

.target-tile__label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  line-height: 1;
}

.target-tile__rounds {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: #1976d2;
}

.target-tile--modified .target-tile__rounds {
  color: #ff9800;
}

.target-tile__unit {
  font-size: 10px;
  color: #999;
  line-height: 1;
}
</style>
