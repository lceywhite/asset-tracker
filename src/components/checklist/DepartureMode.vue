<script setup>
import { ref, computed, onMounted } from "vue"
const props = defineProps({
  items: { type: Array, default: () => [] },
  checklistName: { type: String, default: "日常" },
})
const emit = defineEmits(["complete", "exit"])
const states = ref({})
onMounted(() => {
  props.items.forEach((i) => {
    states.value[i.itemId || i.name] = false
  })
})
const allDone = computed(() => props.items.length > 0 && props.items.every((i) => states.value[i.itemId || i.name]))
const unchecked = computed(() => props.items.filter((i) => !states.value[i.itemId || i.name]))
function toggle(id) {
  states.value[id] = !states.value[id]
}
function finish() {
  emit("complete", { ...states.value })
}
</script>
<template>
  <div class="fixed inset-0 z-50 bg-white flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 border-b">
      <div>
        <h2 class="text-lg font-bold">{{ checklistName }}</h2>
        <p class="text-sm text-gray-500">出门前检查</p>
      </div>
      <button @click="$emit('exit')" class="text-sm text-gray-400 px-3 py-1.5 rounded-lg border">退出</button>
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <div
        v-for="item in items"
        :key="item.itemId || item.name"
        @click="toggle(item.itemId || item.name)"
        class="flex items-center justify-between p-5 rounded-2xl transition-all duration-150 cursor-pointer select-none"
        :class="
          states[item.itemId || item.name]
            ? 'bg-green-50 border-2 border-green-200'
            : 'bg-gray-50 border-2 border-gray-100'
        "
      >
        <div class="flex items-center gap-4">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-lg"
            :class="states[item.itemId || item.name] ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-500'"
          >
            {{ states[item.itemId || item.name] ? "&#10003;" : "&#9675;" }}
          </div>
          <div>
            <div
              class="text-lg font-medium"
              :class="states[item.itemId || item.name] ? 'text-green-700 line-through' : 'text-gray-800'"
            >
              {{ item.name }}
            </div>
            <div v-if="item.required && !states[item.itemId || item.name]" class="text-xs text-red-500">必带</div>
          </div>
        </div>
        <div v-if="states[item.itemId || item.name]" class="text-green-500">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    </div>
    <div class="px-6 py-4 border-t bg-white">
      <div v-if="!allDone && unchecked.length > 0" class="text-sm text-orange-600 mb-2 text-center">
        还有 {{ unchecked.length }} 件未确认
      </div>
      <button
        @click="finish"
        class="w-full py-4 text-lg font-bold rounded-2xl"
        :class="allDone ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'"
      >
        {{ allDone ? "&#127881; 全部确认，出门！" : "确认出门（" + unchecked.length + "项未带）" }}
      </button>
    </div>
  </div>
</template>
