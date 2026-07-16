<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useChecklistStore } from "@/stores/useChecklistStore"
import DepartureMode from "@/components/checklist/DepartureMode.vue"
const route = useRoute()
const router = useRouter()
const store = useChecklistStore()
const mode = ref("pack")
const showDeparture = ref(false)
onMounted(async () => {
  await store.loadById(route.params.id)
})
async function handleToggle(itemId) {
  await store.toggleItem(route.params.id, itemId)
}
async function handleMarkReturned(itemId, returned) {
  await store.markReturned(route.params.id, itemId, returned)
}
async function finishCheck() {
  if (mode.value === "pack")
    await store.update(route.params.id, { status: "active", departureTime: new Date().toISOString() })
  else await store.update(route.params.id, { status: "completed", returnTime: new Date().toISOString() })
  router.push("/checklists")
}
const grouped = computed(() => {
  const g = {}
  ;(store.currentChecklist?.items || []).forEach((item) => {
    const c = item.category || "其他"
    if (!g[c]) g[c] = []
    g[c].push(item)
  })
  return g
})
const progress = computed(() => {
  const items = store.currentChecklist?.items || []
  if (!items.length) return 0
  return Math.round((items.filter((i) => i.checked).length / items.length) * 100)
})
</script>
<template>
  <div class="p-6 max-w-3xl mx-auto">
    <button @click="router.back()" class="text-sm text-gray-500 mb-4">&larr; 返回</button>
    <div v-if="store.currentChecklist">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-lg font-bold">{{ store.currentChecklist.name }}</h2>
          <div class="text-xs text-gray-500 mt-1">{{ mode === "pack" ? "出发核对" : "回程核对" }}</div>
        </div>
        <div class="flex gap-2">
          <button
            @click="mode = 'pack'"
            :class="mode === 'pack' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'"
            class="px-3 py-1.5 rounded-lg text-xs"
          >
            出发
          </button>
          <button
            @click="mode = 'return'"
            :class="mode === 'return' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'"
            class="px-3 py-1.5 rounded-lg text-xs"
          >
            回程
          </button>
        </div>
      </div>
      <button
        v-if="store.currentChecklist.type === 'daily_carry'"
        @click="showDeparture = true"
        class="w-full mb-4 py-3 bg-blue-600 text-white rounded-xl text-base font-medium hover:bg-blue-700"
      >
        &#128694; 我要出门了
      </button>
      <div class="flex items-center gap-3 mb-6">
        <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-green-500 rounded-full transition-all" :style="{ width: progress + '%' }"></div>
        </div>
        <span class="text-sm text-gray-500">{{ progress }}%</span>
      </div>
      <div v-for="(group, cat) in grouped" :key="cat" class="mb-4">
        <h4 class="text-xs font-medium text-gray-400 uppercase mb-2 px-1">{{ cat }}</h4>
        <div class="bg-white rounded-xl border divide-y divide-gray-50">
          <div v-for="item in group" :key="item.itemId" class="flex items-center gap-3 px-4 py-3">
            <button
              @click="handleToggle(item.itemId)"
              class="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
              :class="item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'"
            >
              <span v-if="item.checked" class="text-xs">&#10003;</span>
            </button>
            <div class="flex-1 min-w-0">
              <div class="text-sm" :class="item.checked ? 'text-gray-400 line-through' : 'text-gray-800'">
                {{ item.name }}
              </div>
              <div v-if="item.required && !item.checked" class="text-xs text-red-500">必带</div>
            </div>
            <button
              v-if="mode === 'return' && item.checked"
              @click="handleMarkReturned(item.itemId, !item.returned)"
              class="text-xs px-2 py-1 rounded"
              :class="item.returned ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
            >
              {{ item.returned ? "已带回" : "待确认" }}
            </button>
          </div>
        </div>
      </div>
      <button
        @click="finishCheck"
        class="mt-6 w-full py-3 rounded-xl text-sm font-medium"
        :class="mode === 'pack' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'"
      >
        {{ mode === "pack" ? "&#10004; 已完成打包/出门" : "&#10004; 已全部带回" }}
      </button>
    </div>
    <DepartureMode
      v-if="showDeparture"
      :items="store.currentChecklist?.items || []"
      :checklist-name="store.currentChecklist?.name"
      @complete="
        () => {
          showDeparture = false
          finishCheck()
        }
      "
      @exit="showDeparture = false"
    />
  </div>
</template>
