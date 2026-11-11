<template>
  <q-dialog
    :model-value="modelValue"
    maximized
    @update:model-value="$emit('update:modelValue', $event)"
    @show="start"
    @hide="stop"
  >
    <q-card class="column no-wrap bg-black text-white">
      <q-toolbar>
        <q-toolbar-title>Scan to join</q-toolbar-title>
        <q-btn flat round dense icon="close" aria-label="Close" v-close-popup />
      </q-toolbar>

      <!-- Camera -->
      <div class="col relative-position flex flex-center" style="min-height: 0">
        <video ref="video" class="scan-video" playsinline muted />
        <div v-if="starting" class="absolute-center">
          <q-spinner color="white" size="2.5em" />
        </div>
        <div v-if="error" class="absolute-center text-center q-pa-md" style="max-width: 320px">
          <q-icon name="no_photography" size="42px" class="q-mb-sm" />
          <div>{{ error }}</div>
        </div>
      </div>

      <!-- Fallback: type or paste the invite instead -->
      <q-card-section class="bg-white text-dark">
        <div class="text-caption text-grey-7 q-mb-xs">
          Point your camera at the host's QR code — or paste the invite link.
        </div>
        <q-input
          v-model="manual"
          dense
          outlined
          placeholder="Invite link or code"
          @keyup.enter="submitManual"
        >
          <template #append>
            <q-btn flat dense no-caps color="primary" label="Join" @click="submitManual" />
          </template>
        </q-input>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import type QrScanner from 'qr-scanner';
import { parseJoinToken } from 'src/composables/parseJoinToken';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const router = useRouter();
const $q = useQuasar();

const video = ref<HTMLVideoElement | null>(null);
const starting = ref(false);
const error = ref('');
const manual = ref('');
let scanner: QrScanner | null = null;
let lastRejected = '';

function go(token: string) {
  emit('update:modelValue', false);
  void router.push(`/join/${token}`);
}

function onDecoded(data: string) {
  const token = parseJoinToken(data);
  if (token) {
    go(token);
    return;
  }
  // Keep scanning, but only tell the user once per distinct code.
  if (data !== lastRejected) {
    lastRejected = data;
    $q.notify({ type: 'warning', message: "That isn't a HitFactor match code", timeout: 1800 });
  }
}

function submitManual() {
  const token = parseJoinToken(manual.value);
  if (token) go(token);
  else $q.notify({ type: 'negative', message: 'Enter a match invite link or code' });
}

async function start() {
  error.value = '';
  lastRejected = '';
  if (!video.value) return;
  starting.value = true;
  try {
    // Loaded on demand so the scanner library isn't part of the main bundle.
    const { default: Scanner } = await import('qr-scanner');
    scanner = new Scanner(video.value, (r) => onDecoded(r.data), {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      returnDetailedScanResult: true,
    });
    await scanner.start();
  } catch (err) {
    const name = (err as { name?: string })?.name ?? String(err);
    error.value =
      name === 'NotAllowedError' || String(err).includes('Permission')
        ? 'Camera access is blocked. Allow it in your browser settings, or paste the invite link below.'
        : 'No camera found. Paste the invite link below instead.';
  } finally {
    starting.value = false;
  }
}

function stop() {
  scanner?.stop();
  scanner?.destroy();
  scanner = null;
  manual.value = '';
}

onBeforeUnmount(stop);
</script>

<style scoped>
.scan-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
