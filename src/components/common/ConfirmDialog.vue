<script setup>
defineProps({ show: Boolean, title: String, message: String })
const emit = defineEmits(["confirm", "cancel"])
</script>
<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    @click.self="$emit('cancel')"
  >
    <div class="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
      <h3 class="text-lg font-semibold mb-2">{{ title }}</h3>
      <p class="text-sm text-gray-600 mb-6">{{ message }}</p>
      <div class="flex gap-3 justify-end">
        <button @click="$emit('cancel')" class="px-4 py-2 border rounded-lg text-sm text-gray-600">取消</button
        ><button @click="$emit('confirm')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">确认</button>
      </div>
    </div>
  </div>
</template>
