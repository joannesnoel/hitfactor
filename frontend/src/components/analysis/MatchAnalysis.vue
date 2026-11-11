<template>
  <div>
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="2.5em" />
    </div>

    <q-card v-else-if="shooters.length === 0" flat bordered class="q-pa-lg text-center text-grey-7">
      <q-icon name="insights" size="42px" color="grey-5" class="q-mb-sm" />
      <div class="text-subtitle1 q-mb-xs">The analysis will show up here</div>
      <div class="text-caption">
        Once shooters have been scored and results are in, you can see how each
        one's match went, stage by stage.
      </div>
    </q-card>

    <template v-else>
      <!-- Who to analyse, and who to compare them with -->
      <div class="row q-col-gutter-sm q-mb-md">
        <div class="col-12 col-sm-6">
          <q-select
            v-model="selectedRegId"
            :options="shooterOptions"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            use-input
            input-debounce="0"
            dense
            outlined
            label="Shooter"
            @filter="filterShooters"
          >
            <template #prepend><q-icon name="person" /></template>
          </q-select>
        </div>
        <div class="col-12 col-sm-6">
          <q-select
            v-model="compareDivisions"
            :options="divisionOptions"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            multiple
            use-chips
            dense
            outlined
            label="Compare with"
            :hint="fieldHint"
          >
            <template #prepend><q-icon name="groups" /></template>
            <template #after>
              <q-btn
                flat
                dense
                no-caps
                size="sm"
                label="All"
                :disable="allSelected"
                @click="compareDivisions = divisions.map((d) => d.key)"
              />
            </template>
          </q-select>
        </div>
      </div>

      <q-card v-if="!perf" flat bordered class="q-pa-lg text-center text-grey-7">
        <div class="text-subtitle1 q-mb-xs">No scores for {{ subjectName }} yet</div>
        <div class="text-caption">Their analysis appears once they've been scored on a stage.</div>
      </q-card>

      <template v-else>
        <!-- Headline -->
        <div class="row q-col-gutter-sm q-mb-md">
          <div v-for="c in headline" :key="c.label" class="col-6 col-sm-3">
            <q-card flat bordered class="text-center q-pa-sm">
              <div class="text-h6 text-weight-bold text-primary">{{ c.value }}</div>
              <div class="text-caption text-grey-7">{{ c.label }}</div>
            </q-card>
          </div>
        </div>

        <!-- What went well / where ground was lost -->
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-12 col-md-6">
            <q-card flat bordered class="full-height">
              <q-card-section>
                <div class="text-subtitle1 text-weight-medium q-mb-sm">
                  <q-icon name="thumb_up" color="positive" class="q-mr-xs" />What went well
                </div>
                <div v-if="insights.strengths.length === 0" class="text-caption text-grey-7">
                  No standout stages this time.
                </div>
                <div v-for="s in insights.strengths" :key="s.stage_id" class="q-mb-sm">
                  <div class="text-weight-medium">{{ stageLabel(s.stage_number) }}</div>
                  <div class="text-body2 text-grey-8">{{ strengthText(s) }}</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-md-6">
            <q-card flat bordered class="full-height">
              <q-card-section>
                <div class="text-subtitle1 text-weight-medium q-mb-sm">
                  <q-icon name="trending_down" color="warning" class="q-mr-xs" />Where ground was lost
                </div>
                <div v-if="insights.weaknesses.length === 0" class="text-caption text-grey-7">
                  Nothing stands out as a weak spot — the stages were even.
                </div>
                <div v-for="s in insights.weaknesses" :key="s.stage_id" class="q-mb-sm">
                  <div class="text-weight-medium">{{ stageLabel(s.stage_number) }}</div>
                  <div class="text-body2 text-grey-8">{{ weaknessText(s) }}</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <q-banner v-if="focusText" dense rounded class="bg-blue-1 q-mb-md">
          <template #avatar><q-icon name="lightbulb" color="amber-8" /></template>
          {{ focusText }}
        </q-banner>

        <!-- Stage by stage vs the field -->
        <q-card v-if="progression.stages.length > 0" flat bordered class="q-mb-md">
          <q-card-section>
            <div class="row items-center q-mb-xs">
              <div class="text-subtitle1 text-weight-medium">How the match unfolded</div>
              <q-space />
              <q-btn-toggle
                v-model="metric"
                no-caps
                dense
                unelevated
                toggle-color="primary"
                :options="[
                  { label: 'Running place', value: 'place' },
                  { label: '% of leader', value: 'pct' },
                ]"
              />
            </div>
            <div class="text-caption text-grey-7 q-mb-sm">
              {{
                metric === 'place'
                  ? `${subjectName}'s place after each stage, against the selected field. Higher is better.`
                  : `${subjectName}'s running points as a share of the leader's after each stage. 100% means leading.`
              }}
            </div>
            <ProgressionChart :progression="progression" :metric="metric" :me-label="isSelf ? 'You' : subjectName" />
          </q-card-section>
        </q-card>

        <!-- Stage details: each stage against the winner (or runner-up, for a winner) and the field -->
        <q-card v-if="breakdowns.length > 0" flat bordered class="q-mb-md">
          <q-card-section class="q-pb-none">
            <div class="text-subtitle1 text-weight-medium">Stage details</div>
            <div class="text-caption text-grey-7">
              Tap a stage to compare {{ isSelf ? 'yourself' : subjectName }} with the stage winner
              and the rest of the field. On a stage they won, the comparison is with the runner-up.
            </div>
          </q-card-section>
          <q-list separator>
            <q-expansion-item
              v-for="b in breakdowns"
              :key="b.stage_id"
              :label="stageLabel(b.stage_number)"
              :caption="stageCaption(b)"
              dense
            >
              <div v-if="!b.me" class="q-pa-md text-caption text-grey-7">No score was recorded on this stage.</div>
              <div v-else class="q-px-md q-pb-md">
                <div v-if="gapText(b)" class="text-body2 q-mb-sm">{{ gapText(b) }}</div>
                <!-- One group per measure, each row a labelled bar: always fits the
                     screen width, so no sideways scrolling on a phone. -->
                <div v-for="g in detailGroups(b)" :key="g.label" class="cmp-group">
                  <div class="cmp-title">
                    {{ g.label }}<span v-if="g.hint" class="cmp-hint"> · {{ g.hint }}</span>
                  </div>
                  <div v-for="r in g.rows" :key="r.key" class="cmp-row">
                    <div class="cmp-name" :title="r.name">{{ r.name }}</div>
                    <div class="cmp-track">
                      <div class="cmp-bar" :class="'cmp-bar-' + r.key" :style="{ width: r.frac * 100 + '%' }" />
                    </div>
                    <div class="cmp-value" :class="{ 'text-weight-bold': r.key === 'me' }">{{ r.text }}</div>
                  </div>
                </div>
              </div>
            </q-expansion-item>
          </q-list>
        </q-card>

        <!-- Stage-by-stage table -->
        <q-card flat bordered>
          <q-card-section class="q-pb-none">
            <div class="text-subtitle1 text-weight-medium">Stage by stage</div>
          </q-card-section>
          <q-markup-table flat dense separator="horizontal">
            <thead>
              <tr>
                <th class="text-left">Stage</th>
                <th class="text-right">Place</th>
                <th class="text-right">Stage %</th>
                <th class="text-right">Points down</th>
                <th class="text-right">A hits</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in perf.stages" :key="s.stage_id">
                <td class="text-left">{{ stageLabel(s.stage_number) }}</td>
                <td class="text-right">{{ s.dqed || s.dnf ? '–' : s.place }}</td>
                <td class="text-right">{{ s.dqed || s.dnf ? '–' : `${s.stage_percentage}%` }}</td>
                <td class="text-right">{{ s.dqed || s.dnf ? '–' : s.points_down }}</td>
                <td class="text-right">{{ s.alpha_pct === null ? '–' : `${s.alpha_pct}%` }}</td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-card>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { whenPowerSyncReady } from 'src/boot/powersync';
import { useAuthStore } from 'src/stores/auth.store';
import {
  buildComparisonBundle,
  buildMatchInsights,
  buildProgression,
  buildStageBreakdowns,
  computeShooterPerformance,
  getDivisionLabel,
} from '@hitfactor/shared';
import type {
  MatchResultEntry,
  Organization,
  StageBreakdown,
  StageInsight,
  StageResultEntry,
} from '@hitfactor/shared';
import ProgressionChart from './ProgressionChart.vue';

const props = defineProps<{
  matchId: string;
  matchName: string;
  matchDate: string;
  organization: string;
}>();

const auth = useAuthStore();
const abort = new AbortController();

const loading = ref(true);
const myRegIds = ref<string[]>([]);
const stageRows = ref<{ id: string; stage_number: number; max_points: number; scoring_type: string }[]>([]);
const stageResultRows = ref<{ stage_id: string; division: string; results: string }[]>([]);
const matchResultRows = ref<{ division: string; results: string }[]>([]);
const metric = ref<'place' | 'pct'>('place');

const selectedRegId = ref<string | null>(null);
const compareDivisions = ref<string[]>([]);
const shooterFilter = ref('');

function rows<T>(res: { rows?: { _array?: unknown[] } }): T[] {
  return (res.rows?._array as T[] | undefined) ?? [];
}

onMounted(async () => {
  const db = await whenPowerSyncReady();
  if (!db || !auth.user) {
    loading.value = false;
    return;
  }
  const opts = { signal: abort.signal };
  // All reactive, so the analysis updates live as scores and results sync in.
  db.watch(
    'SELECT id FROM registrations WHERE match_id = ? AND user_id = ?',
    [props.matchId, auth.user.id],
    { onResult: (r) => (myRegIds.value = rows<{ id: string }>(r).map((x) => x.id)) },
    opts,
  );
  db.watch(
    'SELECT id, stage_number, max_points, scoring_type FROM stages WHERE match_id = ?',
    [props.matchId],
    { onResult: (r) => (stageRows.value = rows(r)) },
    opts,
  );
  db.watch(
    'SELECT stage_id, division, results FROM stage_results WHERE match_id = ?',
    [props.matchId],
    { onResult: (r) => (stageResultRows.value = rows(r)) },
    opts,
  );
  db.watch(
    'SELECT division, results FROM match_results WHERE match_id = ?',
    [props.matchId],
    {
      onResult: (r) => {
        matchResultRows.value = rows(r);
        loading.value = false;
      },
      onError: () => (loading.value = false),
    },
    opts,
  );
  // Don't spin forever if nothing has synced yet.
  setTimeout(() => (loading.value = false), 4000);
});
onUnmounted(() => abort.abort());

function parse<T>(json: string): T[] {
  try {
    return JSON.parse(json) as T[];
  } catch {
    return [];
  }
}

const divLabel = (d: string) => getDivisionLabel(props.organization as Organization, d);

// Everyone with a result in a real division (the cross-division "combined" rows
// aren't a field of their own).
const shooters = computed(() => {
  const out: { registration_id: string; name: string; division: string }[] = [];
  const seen = new Set<string>();
  for (const row of matchResultRows.value) {
    if (row.division === 'combined') continue;
    for (const e of parse<MatchResultEntry>(row.results)) {
      if (e.combined || seen.has(e.registration_id)) continue;
      seen.add(e.registration_id);
      out.push({ registration_id: e.registration_id, name: e.shooter_name, division: row.division });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
});

const divisions = computed(() =>
  [...new Set(shooters.value.map((s) => s.division))]
    .sort((a, b) => divLabel(a).localeCompare(divLabel(b)))
    .map((key) => ({ key, label: divLabel(key) })),
);
const divisionOptions = computed(() => divisions.value.map((d) => ({ value: d.key, label: d.label })));
const allSelected = computed(
  () => divisions.value.length > 0 && divisions.value.every((d) => compareDivisions.value.includes(d.key)),
);

const shooterOptions = computed(() => {
  const q = shooterFilter.value.trim().toLowerCase();
  return shooters.value
    .filter((s) => !q || s.name.toLowerCase().includes(q))
    .map((s) => ({
      value: s.registration_id,
      label: `${s.name} · ${divLabel(s.division)}${myRegIds.value.includes(s.registration_id) ? ' (you)' : ''}`,
    }));
});
function filterShooters(val: string, update: (fn: () => void) => void) {
  update(() => {
    shooterFilter.value = val;
  });
}

// Default to yourself when you're in the match, otherwise the first shooter.
watch(
  shooters,
  (list) => {
    if (list.length === 0) return;
    if (!selectedRegId.value || !list.some((s) => s.registration_id === selectedRegId.value)) {
      selectedRegId.value =
        list.find((s) => myRegIds.value.includes(s.registration_id))?.registration_id ??
        list[0].registration_id;
    }
  },
  { immediate: true },
);
watch(myRegIds, () => {
  // My entry may arrive after the list; prefer it as the starting selection.
  const mine = shooters.value.find((s) => myRegIds.value.includes(s.registration_id));
  if (mine && !touchedShooter.value) selectedRegId.value = mine.registration_id;
});
const touchedShooter = ref(false);

const selected = computed(() => shooters.value.find((s) => s.registration_id === selectedRegId.value) ?? null);

// Picking a different shooter resets the comparison to their own division.
watch(selectedRegId, (id, prev) => {
  if (prev !== null && prev !== undefined) touchedShooter.value = true;
  const s = shooters.value.find((x) => x.registration_id === id);
  if (s) compareDivisions.value = [s.division];
});

const isSelf = computed(() => !!selectedRegId.value && myRegIds.value.includes(selectedRegId.value));
const subjectName = computed(() => (isSelf.value ? 'You' : selected.value?.name ?? 'This shooter'));

const bundle = computed(() => {
  const s = selected.value;
  if (!s) return null;
  const byStage = new Map<string, Record<string, StageResultEntry[]>>();
  for (const row of stageResultRows.value) {
    if (row.division === 'combined') continue;
    const m = byStage.get(row.stage_id) ?? {};
    m[row.division] = parse<StageResultEntry>(row.results).filter((e) => !e.combined);
    byStage.set(row.stage_id, m);
  }
  return buildComparisonBundle({
    match: { id: props.matchId, name: props.matchName, date: props.matchDate, organization: props.organization },
    shooter: { registration_id: s.registration_id, division: s.division },
    stages: stageRows.value.map((st) => ({
      stage_id: st.id,
      stage_number: Number(st.stage_number),
      max_points: Number(st.max_points),
      scoring_type: st.scoring_type,
      byDivision: byStage.get(st.id) ?? {},
    })),
    compareDivisions: compareDivisions.value.length ? compareDivisions.value : [s.division],
  });
});

const perf = computed(() => {
  if (!bundle.value || bundle.value.stages.length === 0) return null;
  return computeShooterPerformance([bundle.value]).matches[0] ?? null;
});

const progression = computed(() =>
  buildProgression(bundle.value?.stages ?? [], selectedRegId.value ?? ''),
);

const breakdowns = computed(() =>
  buildStageBreakdowns(bundle.value?.stages ?? [], selectedRegId.value ?? ''),
);
const breakdownById = computed(() => new Map(breakdowns.value.map((b) => [b.stage_id, b])));

const insights = computed(() =>
  perf.value ? buildMatchInsights(perf.value) : { strengths: [], weaknesses: [], focus: null },
);

const fieldHint = computed(() => {
  const n = bundle.value?.match_results.length ?? 0;
  return n > 0 ? `${n} shooter${n === 1 ? '' : 's'} in this comparison` : undefined;
});

function ordinal(v: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`;
}

const headline = computed(() => {
  const p = perf.value;
  if (!p) return [];
  return [
    { label: 'Place', value: p.dqed ? 'DQ' : `${ordinal(p.place)} of ${p.field_size}` },
    { label: 'Match %', value: `${p.total_percentage}%` },
    { label: 'Match points', value: String(p.match_points) },
    { label: 'Stage wins', value: String(p.stage_wins) },
  ];
});

function stageLabel(n: number): string {
  return `Stage ${n}`;
}

const pctOf = (v: number | null) => (v === null ? null : Math.round(v * 100));
const who = computed(() => (isSelf.value ? 'You' : subjectName.value));

function strengthText(s: StageInsight): string {
  if (s.place === 1) {
    const b = breakdownById.value.get(s.stage_id);
    if (b?.benchmark && b.vs) {
      return `${who.value} won this stage, ${Math.abs(Math.round(b.vs.hit_factor_pct))}% ahead of ${b.benchmark.name} on hit factor.`;
    }
    return `${who.value} won this stage — the best hit factor in the field.`;
  }
  return `${who.value} scored ${Math.round(s.stage_percentage)}% of the stage winner, one of the strongest stages (${ordinal(s.place)}).`;
}

function weaknessText(s: StageInsight): string {
  if (s.cause === 'unscored') return 'No score was recorded here (DQ or did not finish).';
  const acc = pctOf(s.accuracy_factor);
  const spd = pctOf(s.speed_factor);
  const both = acc !== null && spd !== null;
  const base = `${Math.round(s.stage_percentage)}% of the stage winner (${ordinal(s.place)}).`;
  // Advice only makes sense when the viewer is the shooter.
  if (s.cause === 'accuracy' && both) {
    return `${base} Points were the bigger gap: ${acc}% of the winner's points against ${spd}% of their pace.${isSelf.value ? ' Cleaner hits are the quickest gain.' : ''}`;
  }
  if (s.cause === 'speed' && both) {
    return `${base} Pace was the bigger gap: ${spd}% of the winner's speed against ${acc}% of their points.${isSelf.value ? ' Moving faster between positions would help.' : ''}`;
  }
  if (both) return `${base} Behind on both points (${acc}%) and pace (${spd}%).`;
  return base;
}

// ── Stage details ──
const fmt = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? '–' : n.toFixed(d));

function stageCaption(b: StageBreakdown): string {
  if (!b.me) return 'Not scored';
  return `${ordinal(b.me.place)} · HF ${fmt(b.me.hit_factor)}`;
}

function benchmarkLabel(b: StageBreakdown): string {
  if (!b.benchmark) return '';
  return `${b.benchmark.role === 'winner' ? 'Winner' : 'Runner-up'} · ${b.benchmark.name}`;
}

interface CmpRow {
  key: 'me' | 'bench' | 'avg';
  name: string;
  text: string;
  /** Bar length, 0–1, relative to the largest value in the group. */
  frac: number;
}

// The comparison as stacked groups (one per measure) rather than a wide table.
function detailGroups(b: StageBreakdown): { label: string; hint?: string; rows: CmpRow[] }[] {
  const m = b.me!;
  const k = b.benchmark;
  const a = b.fieldAvg;

  const group = (
    label: string,
    pick: (s: { hit_factor: number; points: number; time: number; alpha_pct: number | null }) => number | null,
    format: (v: number) => string,
    hint?: string,
  ) => {
    const entries: { key: CmpRow['key']; name: string; v: number | null }[] = [
      { key: 'me', name: isSelf.value ? 'You' : subjectName.value, v: pick(m) },
    ];
    if (k) entries.push({ key: 'bench', name: benchmarkLabel(b), v: pick(k) });
    if (a) entries.push({ key: 'avg', name: 'Field average', v: pick(a) });
    const top = Math.max(0, ...entries.map((e) => e.v ?? 0));
    return {
      label,
      hint,
      rows: entries.map((e) => ({
        key: e.key,
        name: e.name,
        text: e.v === null ? '–' : format(e.v),
        frac: e.v !== null && top > 0 ? e.v / top : 0,
      })),
    };
  };

  return [
    group('Hit factor', (s) => s.hit_factor, (v) => v.toFixed(2)),
    group('Points', (s) => s.points, (v) => String(Math.round(v))),
    group('Time', (s) => s.time, (v) => `${v.toFixed(2)}s`, 'lower is faster'),
    group('A hits', (s) => s.alpha_pct, (v) => `${Math.round(v)}%`),
  ];
}

// One sentence on where the gap to the benchmark came from: points and/or time.
function gapText(b: StageBreakdown): string {
  if (!b.me || !b.benchmark || !b.vs) return '';
  const winner = b.benchmark.role === 'runner_up';
  const gap = Math.abs(Math.round(b.vs.hit_factor_pct));
  // Describe from the leader's side: the shooter if they won, otherwise the winner.
  const lead = winner ? who.value : b.benchmark.name;
  const trail = winner ? b.benchmark.name : who.value;
  const pts = winner ? b.vs.points : -b.vs.points; // leader minus trailer
  const secs = winner ? b.vs.time : -b.vs.time; // leader minus trailer (negative = faster)
  const parts: string[] = [];
  if (Math.round(pts) !== 0) parts.push(`${Math.abs(Math.round(pts))} ${pts > 0 ? 'more' : 'fewer'} points`);
  if (Math.abs(secs) >= 0.05) parts.push(`${Math.abs(secs).toFixed(2)}s ${secs < 0 ? 'faster' : 'slower'}`);
  const how = parts.length ? `: ${parts.join(' and ')}` : '';
  const trailName = trail === 'You' ? 'you' : trail;
  return `${lead} ${lead === 'You' ? 'were' : 'was'} ${gap}% ahead of ${trailName} on hit factor${how}.`;
}

const focusText = computed(() => {
  const self = isSelf.value;
  switch (insights.value.focus) {
    case 'accuracy':
      return self
        ? 'Over the match, you gave up more to accuracy than to speed. Cleaner hits are where the next points are.'
        : 'Over the match, more was lost to accuracy than to speed.';
    case 'speed':
      return self
        ? 'Over the match, you gave up more to speed than to accuracy. Your hits were good — pushing the pace is where the next points are.'
        : 'Over the match, more was lost to speed than to accuracy.';
    case 'balanced':
      return self
        ? 'Accuracy and speed were about even for you this match. Improving either one moves you up.'
        : 'Accuracy and speed were about even this match.';
    default:
      return '';
  }
});
</script>

<style scoped>
/* Stacked comparison bars. Series colours match the progression chart:
   the analysed shooter in blue, the benchmark in orange, the field in grey. */
.cmp-group { margin-top: 12px; }
.cmp-title { font-size: 12px; font-weight: 600; color: var(--q-grey-8, #424242); margin-bottom: 4px; }
.cmp-hint { font-weight: 400; color: #7b7a76; }
.cmp-row { display: flex; align-items: center; gap: 8px; min-height: 22px; }
.cmp-name { flex: 0 0 38%; min-width: 0; font-size: 12px; color: #52514e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmp-track { flex: 1 1 auto; min-width: 0; height: 8px; border-radius: 4px; background: #eeeeea; overflow: hidden; }
.cmp-bar { height: 100%; border-radius: 4px; }
.cmp-bar-me { background: #2a78d6; }
.cmp-bar-bench { background: #eb6834; }
.cmp-bar-avg { background: #9a9994; }
.cmp-value { flex: 0 0 58px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; }
</style>
