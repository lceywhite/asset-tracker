<script setup>
import { ref, watch, onMounted } from "vue"
import QRCode from "qrcode"
const props = defineProps({ content: String, size: { type: Number, default: 200 } })
const dataUrl = ref("")
async function generate() {
  if (props.content)
    dataUrl.value = await QRCode.toDataURL(props.content, {
      width: props.size,
      margin: 2,
      color: { dark: "#1f2937", light: "#ffffff" },
    })
}
watch(() => props.content, generate)
onMounted(generate)
</script>
<template>
  <div class="inline-flex flex-col items-center">
    <img v-if="dataUrl" :src="dataUrl" :width="size" :height="size" class="rounded" />
    <div v-else class="bg-gray-100 rounded" :style="{ width: size + 'px', height: size + 'px' }"></div>
  </div>
</template>
