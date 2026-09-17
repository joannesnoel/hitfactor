<template>
  <canvas ref="canvas" :aria-label="`QR code for ${value}`" role="img" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import QRCode from 'qrcode';

const props = withDefaults(
  defineProps<{ value: string; size?: number }>(),
  { size: 220 },
);

const canvas = ref<HTMLCanvasElement | null>(null);

async function render() {
  if (!canvas.value || !props.value) return;
  await QRCode.toCanvas(canvas.value, props.value, {
    width: props.size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

onMounted(render);
watch(() => [props.value, props.size], render);
</script>
