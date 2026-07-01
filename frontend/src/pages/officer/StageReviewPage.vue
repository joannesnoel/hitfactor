<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <q-btn flat round icon="arrow_back" @click="$router.back()" />
      <div class="q-ml-sm">
        <div class="text-h5 text-weight-bold" v-if="stage">
          Review: Stage {{ stage.stage_number }} - {{ stage.name }}
        </div>
        <div class="text-caption text-grey">
          {{ scores.length }} scores entered
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <!-- Scores Table -->
      <q-table
        :rows="scores"
        :columns="columns"
        row-key="id"
        flat
        bordered
        dense
        :pagination="{ rowsPerPage: 50 }"
      >
        <template #body-cell-verified="props">
          <q-td :props="props">
            <q-icon
              :name="props.row.verified ? 'check_circle' : 'radio_button_unchecked'"
              :color="props.row.verified ? 'green' : 'grey'"
            />
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge v-if="props.row.dqed" color="red" label="DQ" />
            <q-badge v-else-if="props.row.dnf" color="orange" label="DNF" />
            <q-badge v-else color="green" label="OK" />
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              flat
              dense
              icon="edit"
              color="primary"
              @click="editScore(props.row)"
            />
            <q-btn
              flat
              dense
              :icon="props.row.verified ? 'undo' : 'verified'"
              :color="props.row.verified ? 'grey' : 'green'"
              @click="toggleVerify(props.row)"
            />
          </q-td>
        </template>
      </q-table>

      <div v-if="scores.length === 0" class="text-center text-grey q-pa-xl">
        No scores entered for this stage yet
      </div>
    </template>

    <!-- Edit Score Dialog -->
    <q-dialog v-model="showEditDialog" full-width>
      <q-card v-if="editingScore" style="max-width: 600px">
        <q-card-section class="text-h6">
          Edit Score: {{ editingScore.shooter_name }}
        </q-card-section>
        <q-card-section>
          <div class="q-gutter-md">
            <div class="row q-gutter-sm">
              <q-input v-model.number="editForm.alpha_count" label="A" type="number" outlined dense class="col" />
              <q-input v-model.number="editForm.charlie_count" label="C" type="number" outlined dense class="col" />
              <q-input v-model.number="editForm.delta_count" label="D" type="number" outlined dense class="col" />
            </div>
            <div class="row q-gutter-sm">
              <q-input v-model.number="editForm.miss_count" label="M" type="number" outlined dense class="col" />
              <q-input v-model.number="editForm.no_shoot_count" label="NS" type="number" outlined dense class="col" />
              <q-input v-model.number="editForm.procedural_count" label="Proc" type="number" outlined dense class="col" />
            </div>
            <div class="row q-gutter-sm">
              <q-input v-model.number="editForm.steel_hits" label="Steel Hits" type="number" outlined dense class="col" />
              <q-input v-model.number="editForm.steel_misses" label="Steel Misses" type="number" outlined dense class="col" />
            </div>
            <q-input v-model.number="editForm.time" label="Time" type="number" step="0.01" outlined dense />
            <div class="row q-gutter-md">
              <q-toggle v-model="editForm.dqed" label="DQ" color="red" />
              <q-toggle v-model="editForm.dnf" label="DNF" color="orange" />
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" unelevated @click="saveEdit" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import type { PowerSyncDatabase } from '@powersync/web';
import { whenPowerSyncReady } from 'src/boot/powersync';
import type { Stage, Score, ScoringType, PowerFactor, Organization } from '@hitfactor/shared';
import { computeScore, getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import { useAuthStore } from 'src/stores/auth.store';
import type { QTableColumn } from 'quasar';

const route = useRoute();
const $q = useQuasar();
let db: PowerSyncDatabase | null = null;
const authStore = useAuthStore();

const matchId = route.params.matchId as string;
const stageId = route.params.stageId as string;

const loading = ref(true);
const stage = ref<Stage | null>(null);
const organization = ref<Organization>(DEFAULT_ORGANIZATION);
const scores = ref<Score[]>([]);
const showEditDialog = ref(false);
const editingScore = ref<Score | null>(null);

const editForm = reactive({
  alpha_count: 0,
  charlie_count: 0,
  delta_count: 0,
  miss_count: 0,
  no_shoot_count: 0,
  procedural_count: 0,
  steel_hits: 0,
  steel_misses: 0,
  time: 0,
  dqed: false,
  dnf: false,
});

const columns: QTableColumn[] = [
  { name: 'shooter_name', label: 'Name', field: 'shooter_name', align: 'left', sortable: true },
  { name: 'division', label: 'Div', field: 'division', align: 'center', sortable: true, format: (val: string) => getDivisionLabel(organization.value, val) },
  { name: 'alpha_count', label: 'A', field: 'alpha_count', align: 'center' },
  { name: 'charlie_count', label: 'C', field: 'charlie_count', align: 'center' },
  { name: 'delta_count', label: 'D', field: 'delta_count', align: 'center' },
  { name: 'miss_count', label: 'M', field: 'miss_count', align: 'center' },
  { name: 'no_shoot_count', label: 'NS', field: 'no_shoot_count', align: 'center' },
  { name: 'procedural_count', label: 'Proc', field: 'procedural_count', align: 'center' },
  { name: 'time', label: 'Time', field: 'time', align: 'center', format: (val: number) => val.toFixed(2) },
  { name: 'hit_factor', label: 'HF', field: 'hit_factor', align: 'center', sortable: true, format: (val: number) => val.toFixed(4) },
  { name: 'status', label: 'Status', field: 'dqed', align: 'center' },
  { name: 'verified', label: 'Verified', field: 'verified', align: 'center' },
  { name: 'actions', label: 'Actions', field: 'id', align: 'center' },
];

function editScore(score: Score) {
  editingScore.value = score;
  editForm.alpha_count = score.alpha_count;
  editForm.charlie_count = score.charlie_count;
  editForm.delta_count = score.delta_count;
  editForm.miss_count = score.miss_count;
  editForm.no_shoot_count = score.no_shoot_count;
  editForm.procedural_count = score.procedural_count;
  editForm.steel_hits = score.steel_hits;
  editForm.steel_misses = score.steel_misses;
  editForm.time = score.time;
  editForm.dqed = score.dqed;
  editForm.dnf = score.dnf;
  showEditDialog.value = true;
}

async function saveEdit() {
  if (!db || !editingScore.value || !stage.value || !authStore.user) return;

  try {
    const computed = computeScore(
      {
        ...editForm,
        power_factor: editingScore.value.power_factor as PowerFactor,
      },
      stage.value.scoring_type as ScoringType,
    );

    const now = new Date().toISOString();
    await db.execute(
      `UPDATE scores SET
        alpha_count = ?, charlie_count = ?, delta_count = ?, miss_count = ?,
        no_shoot_count = ?, procedural_count = ?, steel_hits = ?, steel_misses = ?,
        time = ?, raw_points = ?, penalty_points = ?, total_points = ?,
        hit_factor = ?, dqed = ?, dnf = ?, modified_at = ?, modified_by = ?
      WHERE id = ?`,
      [
        editForm.alpha_count, editForm.charlie_count, editForm.delta_count, editForm.miss_count,
        editForm.no_shoot_count, editForm.procedural_count, editForm.steel_hits, editForm.steel_misses,
        editForm.time, computed.raw_points, computed.penalty_points, computed.total_points,
        computed.hit_factor, editForm.dqed ? 1 : 0, editForm.dnf ? 1 : 0, now, authStore.user.id,
        editingScore.value.id,
      ],
    );

    await loadScores();
    $q.notify({ type: 'positive', message: 'Score updated' });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update score' });
  }
}

async function toggleVerify(score: Score) {
  if (!db || !authStore.user) return;

  try {
    const newVerified = !score.verified;
    await db.execute(
      'UPDATE scores SET verified = ?, verified_by = ? WHERE id = ?',
      [newVerified ? 1 : 0, newVerified ? authStore.user.id : null, score.id],
    );
    await loadScores();
    $q.notify({
      type: 'positive',
      message: newVerified ? 'Score verified' : 'Verification removed',
    });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update verification' });
  }
}

async function loadScores() {
  if (!db) return;
  scores.value = await db.getAll<Score>(
    'SELECT * FROM scores WHERE match_id = ? AND stage_id = ? ORDER BY shooter_name',
    [matchId, stageId],
  );
}

onMounted(async () => {
  db = await whenPowerSyncReady();
  if (!db) {
    loading.value = false;
    return;
  }

  try {
    const stageRow = await db.get<Stage>('SELECT * FROM stages WHERE id = ?', [stageId]);
    stage.value = {
      ...stageRow,
      stage_number: Number(stageRow.stage_number),
      is_classifier: Boolean(stageRow.is_classifier),
    } as Stage;

    try {
      const matchRow = await db.get<{ organization: string }>(
        'SELECT organization FROM matches WHERE id = ?',
        [matchId],
      );
      if (matchRow?.organization) {
        organization.value = matchRow.organization as Organization;
      }
    } catch {
      // keep default organization
    }

    await loadScores();
  } finally {
    loading.value = false;
  }
});
</script>
