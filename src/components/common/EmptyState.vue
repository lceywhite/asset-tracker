<script setup>
defineProps({ icon: String, text: String })
</script>
<template>
  <div class="flex flex-col items-center py-12 text-gray-400">
    <span class="text-4xl mb-3">{{ icon || "📭" }}</span>
    <p class="text-sm">{{ text || "暂无数据" }}</p>
  </div>
</template>
