<template>
  <q-dialog
    :model-value="modelValue"
    :maximized="$q.screen.lt.sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <q-card class="queue-builder column no-wrap">
      <q-card-section class="row items-center q-py-sm">
        <div>
          <div class="text-h6">Shooting order</div>
          <div class="text-caption text-grey">
            Pick who's at the bay and drag to set the call order.
          </div>
        </div>
        <q-space />
        <q-btn flat round dense icon="close" @click="$emit('update:modelValue', false)" />
      </q-card-section>

      <q-separator />

      <!-- Pick participants -->
      <q-card-section class="q-py-sm">
        <div class="row q-col-gutter-sm items-center">
          <div class="col-12 col-sm">
            <q-select
              v-model="squadFilter"
              :options="squadOptions"
              label="Squad"
              dense
              outlined
              emit-value
              map-options
              clearable
            />
          </div>
          <div class="col-12 col-sm">
            <q-input v-model="search" dense outlined clearable placeholder="Search name / member #">
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </div>
          <div class="col-auto">
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              icon="playlist_add"
              :label="`Add all (${available.length})`"
              :disable="available.length === 0"
              @click="addAll"
            />
          </div>
        </div>
      </q-card-section>

      <div class="queue-builder__lists col column no-wrap">
        <!-- Available -->
        <div class="text-caption text-grey-7 q-px-md">Tap to add</div>
        <q-list separator class="queue-builder__available">
          <q-item
            v-for="r in available"
            :key="r.id"
            clickable
            @click="add(r.id)"
          >
            <q-item-section>
              <q-item-label>{{ r.shooter_name }}</q-item-label>
              <q-item-label caption>
                {{ divLabel(r.division) }}<template v-if="r.classification"> · {{ r.classification }}</template><template v-if="r.member_number"> · #{{ r.member_number }}</template>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon
                v-if="scored.has(r.id)"
                name="check_circle"
                color="positive"
                size="18px"
              ><q-tooltip>Already scored</q-tooltip></q-icon>
            </q-item-section>
            <q-item-section side><q-icon name="add" color="primary" /></q-item-section>
          </q-item>
          <q-item v-if="available.length === 0">
            <q-item-section class="text-grey text-center">
              No more shooters match this filter.
            </q-item-section>
          </q-item>
        </q-list>

        <q-separator />

        <!-- Working order (draggable) -->
        <div class="row items-center q-px-md q-pt-sm">
          <div class="text-subtitle2">Shooting order ({{ order.length }})</div>
        </div>
        <div v-if="order.length === 0" class="text-grey text-center q-pa-md">
          No shooters added yet — tap shooters above to build the order.
        </div>
        <VueDraggable
          v-else
          v-model="order"
          handle=".drag-handle"
          :animation="150"
          class="queue-builder__order"
        >
          <div
            v-for="(id, i) in order"
            :key="id"
            class="row items-center no-wrap q-py-xs q-px-md order-row"
          >
            <q-icon class="drag-handle" name="drag_indicator" color="grey-6" size="24px" />
            <div class="order-num text-weight-bold text-grey-7 q-mx-sm">{{ i + 1 }}</div>
            <div class="col" style="min-width: 0">
              <div class="ellipsis">{{ regName(id) }}</div>
              <div class="text-caption text-grey ellipsis">{{ regCaption(id) }}</div>
            </div>
            <q-icon
              v-if="scored.has(id)"
              name="check_circle"
              color="positive"
              size="18px"
              class="q-mr-xs"
            />
            <q-btn flat round dense icon="close" size="sm" color="grey-7" @click="remove(id)" />
          </div>
        </VueDraggable>
      </div>

      <q-separator />
      <q-card-actions align="right" class="q-py-sm">
        <q-btn flat label="Cancel" @click="$emit('update:modelValue', false)" />
        <q-btn
          color="primary"
          unelevated
          :label="`Start scoring (${order.length})`"
          :disable="order.length === 0"
          @click="start"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { VueDraggable } from 'vue-draggable-plus';
import type { Registration, Organization } from '@hitfactor/shared';
import { getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    participants: Registration[];
    squads: { id: string; squad_number: number; name: string | null }[];
    scoredIds: string[];
    organization?: Organization;
    initialOrder?: string[];
  }>(),
  { organization: DEFAULT_ORGANIZATION, initialOrder: () => [] },
);

const emit = defineEmits<{
  'update:modelValue': [boolean];
  start: [string[]];
}>();

const $q = useQuasar();

const order = ref<string[]>([]);
const search = ref('');
const squadFilter = ref<string | null>(null);

// Seed the order from the current queue each time the dialog opens.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      order.value = [...props.initialOrder];
      search.value = '';
      squadFilter.value = null;
    }
  },
);

const scored = computed(() => new Set(props.scoredIds));

const byId = computed(() => {
  const m = new Map<string, Registration>();
  for (const r of props.participants) m.set(r.id, r);
  return m;
});

const squadOptions = computed(() => [
  ...props.squads.map((s) => ({
    label: `Squad ${s.squad_number}${s.name ? ` - ${s.name}` : ''}`,
    value: s.id,
  })),
]);

function divLabel(division: string): string {
  return getDivisionLabel(props.organization, division);
}
function regName(id: string): string {
  return byId.value.get(id)?.shooter_name ?? '(removed)';
}
function regCaption(id: string): string {
  const r = byId.value.get(id);
  if (!r) return '';
  let c = divLabel(r.division);
  if (r.classification) c += ` · ${r.classification}`;
  if (r.member_number) c += ` · #${r.member_number}`;
  return c;
}

// Participants not yet added, matching the squad + search filters.
const available = computed(() => {
  const inOrder = new Set(order.value);
  const q = search.value.trim().toLowerCase();
  return props.participants.filter((r) => {
    if (inOrder.has(r.id)) return false;
    if (squadFilter.value && r.squad_id !== squadFilter.value) return false;
    if (q) {
      const hay = `${r.shooter_name} ${r.member_number ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

function add(id: string) {
  if (!order.value.includes(id)) order.value = [...order.value, id];
}
function addAll() {
  const ids = available.value.map((r) => r.id);
  order.value = [...order.value, ...ids];
}
function remove(id: string) {
  order.value = order.value.filter((x) => x !== id);
}
function start() {
  emit('start', [...order.value]);
  emit('update:modelValue', false);
}
</script>

<style scoped>
.queue-builder {
  width: 560px;
  max-width: 95vw;
  height: 90vh;
  max-height: 90vh;
}
.queue-builder__lists {
  overflow: hidden;
}
.queue-builder__available {
  overflow-y: auto;
  max-height: 34vh;
}
.queue-builder__order {
  overflow-y: auto;
  flex: 1 1 auto;
}
.order-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.drag-handle {
  cursor: grab;
  touch-action: none;
}
.order-num {
  min-width: 1.5rem;
  text-align: right;
}
</style>
