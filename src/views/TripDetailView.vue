<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"
import { useBagStore } from "@/stores/useBagStore"
import * as sessionService from "@/services/checkSessionService"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import TripForm from "@/components/trip/TripForm.vue"

const route = useRoute()
const router = useRouter()
const store = useActivityStore()
const bagStore = useBagStore()
const trip = ref(null)
const editing = ref(false)
const checkMode = ref(false)
const checkKind = ref("departure")
const checkIdx = ref(0)
const sessions = ref([])
const currentSession = ref(null)
const typeEmoji = { travel: "✈️", daily_carry: "🚶", move: "📦" }
const typeLabels = { travel: "旅行", daily_carry: "日常", move: "搬家", custom: "自定义" }

const latestSession = computed(
  () => [...sessions.value].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null,
)
const displayResults = computed(() => currentSession.value?.results || latestSession.value?.results || {})
const checkedCount = computed(
  () => (trip.value?.packingItems || []).filter((entry) => displayResults.value[entry.id]?.checked).length,
)
const checkEntries = computed(() => {
  const entries = trip.value?.packingItems || []
  return checkKind.value === "return" ? entries.filter((entry) => entry.reminderType === "return") : entries
})
const completedChecks = computed(
  () => checkEntries.value.filter((entry) => currentSession.value?.results?.[entry.id]?.checkedAt).length,
)

const packedGroups = computed(() => {
  const groups = {}
  for (const item of trip.value?.packingItems || []) {
    const key = item.sourceBagId || "_other"
    if (!groups[key]) groups[key] = { bagId: key, bagName: "", items: [] }
    groups[key].items.push(item)
  }
  for (const key of Object.keys(groups)) {
    const bag = bagStore.bags.find((entry) => entry.id === key)
    groups[key].bagName = key === "_other" ? "📦 其他" : bag ? `${bag.icon || "🎒"} ${bag.name}` : "🎒 未知容器"
  }
  return Object.values(groups).sort((a, b) => (a.bagId === "_other" ? 1 : b.bagId === "_other" ? -1 : 0))
})

function isChecked(item) {
  return Boolean(displayResults.value[item.id]?.checked)
}
function formatSession(session) {
  if (!session) return "尚未核对"
  const kind = session.kind === "return" ? "返程" : "出发"
  const status = session.status === "completed" ? "已完成" : "进行中"
  return `${kind}核对 · ${status} · ${new Date(session.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
}
async function loadSessions() {
  sessions.value = trip.value ? await sessionService.getByPlan(trip.value.id) : []
}
onMounted(async () => {
  await Promise.all([store.loadAll(), bagStore.loadAll()])
  trip.value = store.activities.find((activity) => activity.id === route.params.id) || null
  await loadSessions()
})
async function persistPackingItems(items) {
  if (!trip.value) return
  trip.value = await store.update(trip.value.id, { packingItems: items })
}
async function toggleReminder(item) {
  const items = trip.value?.packingItems || []
  const index = items.indexOf(item)
  if (index < 0) return
  const reminders = ["return", "daily", "selfcheck"]
  const nextIndex = (reminders.indexOf(item.reminderType) + 1) % reminders.length
  await persistPackingItems(
    items.map((entry, i) => (i === index ? { ...entry, reminderType: reminders[nextIndex] } : entry)),
  )
}
function reminderLabel(reminder) {
  return reminder === "return" ? "需带回" : reminder === "daily" ? "每天" : "自行"
}
async function onEdited() {
  editing.value = false
  await store.loadAll()
  trip.value = store.activities.find((activity) => activity.id === route.params.id)
}
async function deleteTrip() {
  if (!trip.value) return
  await store.del(trip.value.id)
  router.push("/plans")
}
async function startCheck(kind) {
  checkKind.value = kind
  if (kind === "return" && !checkEntries.value.length) return
  const resumable = sessions.value
    .filter((session) => session.kind === kind && session.status === "in_progress")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  currentSession.value = resumable || (await sessionService.create(trip.value.id, kind, checkEntries.value))
  const firstPending = checkEntries.value.findIndex((entry) => !currentSession.value.results?.[entry.id]?.checkedAt)
  checkIdx.value = firstPending < 0 ? 0 : firstPending
  checkMode.value = true
}
async function doCheck(checked) {
  const entry = checkEntries.value[checkIdx.value]
  if (!entry || !currentSession.value) return
  currentSession.value = await sessionService.record(currentSession.value.id, entry.id, checked)
  Haptics.impact({ style: checked ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {})
  if (checkIdx.value < checkEntries.value.length - 1) checkIdx.value++
  else {
    currentSession.value = await sessionService.complete(currentSession.value.id)
    checkMode.value = false
    await loadSessions()
  }
}
function prevCheck() {
  if (checkIdx.value > 0) checkIdx.value--
}
</script>

<template>
  <div class="flex flex-col h-full" style="background: var(--color-bg)">
    <header class="flex items-center gap-3 px-4 py-3 bg-white border-b" style="border-color: var(--color-border)">
      <button aria-label="返回" @click="router.back()" class="w-9 h-9 rounded-full bg-gray-50">←</button>
      <div class="flex-1 min-w-0">
        <div class="text-base font-bold truncate">{{ trip?.title || "计划详情" }}</div>
        <div class="text-[11px] text-gray-400">{{ formatSession(latestSession) }}</div>
      </div>
      <button v-if="trip" @click="editing = true" class="text-sm font-semibold text-blue-600">编辑</button>
    </header>

    <main v-if="trip && !checkMode" class="flex-1 overflow-y-auto p-4 pb-8">
      <section class="rounded-2xl p-4 text-white mb-4" style="background: linear-gradient(135deg, #2563eb, #4f46e5)">
        <div class="flex items-center gap-3">
          <span class="text-3xl">{{ typeEmoji[trip.type] || "📋" }}</span>
          <div class="flex-1">
            <div class="text-lg font-bold">{{ trip.title }}</div>
            <div class="text-xs text-white/75">{{ typeLabels[trip.type] || trip.type }} · {{ trip.startDate }}</div>
          </div>
          <div class="text-right">
            <div class="text-xl font-bold">{{ checkedCount }}/{{ trip.packingItems?.length || 0 }}</div>
            <div class="text-[10px] text-white/70">最近核对</div>
          </div>
        </div>
        <div v-if="trip.destination" class="mt-3 text-xs text-white/85">📍 {{ trip.destination }}</div>
      </section>

      <section class="bg-white rounded-2xl border overflow-hidden mb-4">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <h2 class="text-sm font-bold">携带清单</h2>
          <span class="text-xs text-gray-400">{{ trip.packingItems?.length || 0 }} 项</span>
        </div>
        <div v-if="!trip.packingItems?.length" class="p-8 text-center text-sm text-gray-400">还没有添加物品</div>
        <template v-for="group in packedGroups" :key="group.bagId">
          <div class="px-4 py-2 text-xs font-semibold bg-gray-50 text-gray-500">{{ group.bagName }}</div>
          <div v-for="item in group.items" :key="item.id" class="flex items-center gap-3 px-4 py-3 border-t">
            <span
              class="w-6 h-6 rounded-full flex items-center justify-center text-xs"
              :class="isChecked(item) ? 'bg-green-500 text-white' : 'border-2 border-gray-200'"
              >{{ isChecked(item) ? "✓" : "" }}</span
            >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium" :class="isChecked(item) ? 'text-gray-400 line-through' : ''">
                {{ item.name }}
              </div>
              <div class="text-[10px] text-gray-400">{{ item.category || "未分类" }}</div>
            </div>
            <button @click="toggleReminder(item)" class="px-2 py-1 rounded-lg text-[10px] bg-blue-50 text-blue-600">
              {{ reminderLabel(item.reminderType) }}
            </button>
          </div>
        </template>
      </section>

      <section v-if="trip.packingItems?.length" class="grid grid-cols-2 gap-3 mb-4">
        <button @click="startCheck('departure')" class="rounded-2xl bg-blue-600 text-white p-4 text-left">
          <div class="text-xl">🧳</div>
          <div class="font-bold mt-2">出发核对</div>
          <div class="text-[11px] text-white/75">确认全部携带物品</div>
        </button>
        <button
          :disabled="!trip.packingItems.some((entry) => entry.reminderType === 'return')"
          @click="startCheck('return')"
          class="rounded-2xl bg-white border p-4 text-left disabled:opacity-40"
        >
          <div class="text-xl">🏠</div>
          <div class="font-bold mt-2">返程核对</div>
          <div class="text-[11px] text-gray-400">只检查需要带回的物品</div>
        </button>
      </section>

      <button @click="deleteTrip" class="w-full py-3 text-sm text-red-500">删除此计划</button>
    </main>

    <div v-else-if="!trip" class="flex-1 flex items-center justify-center text-sm text-gray-400">正在加载计划…</div>

    <div v-if="checkMode && checkEntries.length" class="fixed inset-0 z-50 flex flex-col bg-white">
      <header class="flex items-center gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3 border-b">
        <button @click="checkMode = false" class="text-sm text-gray-500">退出</button>
        <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-green-500 transition-all"
            :style="{ width: (completedChecks / checkEntries.length) * 100 + '%' }"
          ></div>
        </div>
        <span class="text-xs text-gray-400">{{ completedChecks }}/{{ checkEntries.length }}</span>
      </header>
      <main class="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div class="text-sm text-blue-600 font-semibold mb-8">
          {{ checkKind === "return" ? "返程核对" : "出发核对" }}
        </div>
        <div class="w-24 h-24 rounded-3xl bg-blue-50 flex items-center justify-center text-5xl mb-6">📦</div>
        <h2 class="text-2xl font-bold">{{ checkEntries[checkIdx]?.name }}</h2>
        <p class="text-sm text-gray-400 mt-2">{{ checkEntries[checkIdx]?.category || "未分类" }}</p>
        <div class="flex gap-6 mt-12">
          <button
            aria-label="未确认"
            @click="doCheck(false)"
            class="w-20 h-20 rounded-3xl bg-red-50 text-red-500 text-3xl"
          >
            ×</button
          ><button
            aria-label="已确认"
            @click="doCheck(true)"
            class="w-20 h-20 rounded-3xl bg-green-50 text-green-600 text-3xl"
          >
            ✓
          </button>
        </div>
        <button v-if="checkIdx > 0" @click="prevCheck" class="mt-8 text-sm text-gray-400">上一个</button>
      </main>
    </div>
  </div>
  <TripForm :show="editing" :edit-trip="trip" @close="editing = false" @created="onEdited" />
</template>
