<script setup>
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { CHECK_KINDS, CHECK_STATES, getCheckKindForTrip, getCheckSummary } from "@/domain/tripModel"
import { useActivityStore } from "@/stores/useActivityStore"
import * as checkService from "@/services/checkSessionService"
import * as itemService from "@/services/itemService"
import * as nodeService from "@/services/spaceNodeService"

const route = useRoute()
const router = useRouter()
const store = useActivityStore()
const trip = ref(null)
const session = ref(null)
const items = ref([])
const nodes = ref([])
const currentEntryId = ref("")
const showSummary = ref(false)
const loading = ref(true)

const kind = computed(() =>
  Object.values(CHECK_KINDS).includes(route.params.kind) ? route.params.kind : getCheckKindForTrip(trip.value),
)
const kindLabel = computed(() =>
  kind.value === CHECK_KINDS.DEPARTURE ? "出发核对" : kind.value === CHECK_KINDS.ANYTIME ? "随时核对" : "结束核对",
)
const orderedEntries = computed(() => {
  const containerOrder = new Map(
    (trip.value?.containerRefs || []).map((container, index) => [container.containerId, index]),
  )
  return [...(trip.value?.packingItems || [])].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1
    const containerDiff = (containerOrder.get(a.containerId) ?? 999) - (containerOrder.get(b.containerId) ?? 999)
    return containerDiff || (a.addedAt || "").localeCompare(b.addedAt || "")
  })
})
const pendingEntries = computed(() =>
  orderedEntries.value.filter(
    (entry) => (session.value?.results?.[entry.id]?.state || CHECK_STATES.PENDING) === CHECK_STATES.PENDING,
  ),
)
const currentEntry = computed(
  () => orderedEntries.value.find((entry) => entry.id === currentEntryId.value) || pendingEntries.value[0] || null,
)
const summary = computed(() => getCheckSummary(session.value))
const progressPercent = computed(() =>
  summary.value.total ? (summary.value.completed / summary.value.total) * 100 : 0,
)
const currentItem = computed(() => items.value.find((item) => item.id === currentEntry.value?.itemId) || null)
const currentContainer = computed(() =>
  trip.value?.containerRefs?.find((container) => container.containerId === currentEntry.value?.containerId),
)
const currentLocation = computed(
  () => nodes.value.find((node) => node.id === currentItem.value?.locationNodeId)?.name || "位置未记录",
)
const missingEntries = computed(() =>
  orderedEntries.value.filter((entry) => session.value?.results?.[entry.id]?.state === CHECK_STATES.MISSING),
)

onMounted(async () => {
  try {
    ;[trip.value, items.value, nodes.value] = await Promise.all([
      store.loadById(route.params.id),
      itemService.getAllItems(),
      nodeService.getAllNodes(),
    ])
    if (!trip.value?.packingItems?.length) {
      router.replace(`/plans/${route.params.id}`)
      return
    }
    const sessions = await checkService.getByPlan(trip.value.id)
    session.value =
      sessions
        .filter((candidate) => candidate.kind === kind.value && candidate.status === "in_progress")
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0] ||
      (await checkService.create(trip.value.id, kind.value, orderedEntries.value))
    const first = pendingEntries.value[0]
    if (first) currentEntryId.value = first.id
    else showSummary.value = true
  } finally {
    loading.value = false
  }
})

function entryImage(entry) {
  return entry?.imageSnapshot || items.value.find((item) => item.id === entry?.itemId)?.photo || ""
}

async function record(state) {
  if (!currentEntry.value || !session.value) return
  session.value = await checkService.record(session.value.id, currentEntry.value.id, state)
  Haptics.impact({ style: state === CHECK_STATES.CONFIRMED ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {})
  const next = pendingEntries.value[0]
  if (next) {
    currentEntryId.value = next.id
    return
  }
  session.value = await checkService.complete(session.value.id)
  showSummary.value = true
}

async function retryUnresolved() {
  session.value = await checkService.reopenUnresolved(session.value.id)
  showSummary.value = false
  currentEntryId.value = pendingEntries.value[0]?.id || ""
}

function leave() {
  router.replace(`/plans/${trip.value.id}`)
}
</script>

<template>
  <div class="check-page">
    <div v-if="loading" class="check-loading">正在准备核对清单…</div>

    <template v-else-if="trip && session && !showSummary">
      <header class="check-topbar">
        <button aria-label="退出核对" @click="leave">×</button>
        <span>{{ summary.completed + 1 }} / {{ summary.total }}</span>
        <button @click="leave">暂存</button>
      </header>
      <div class="check-progress"><span :style="{ width: `${progressPercent}%` }"></span></div>

      <main v-if="currentEntry" class="check-main">
        <div class="check-group">{{ kindLabel }} · {{ currentContainer?.nameSnapshot || "待整理物品" }}</div>
        <div class="item-orb">
          <img v-if="entryImage(currentEntry)" :src="entryImage(currentEntry)" alt="" />
          <span v-else>▣</span>
        </div>
        <h1>{{ currentEntry.nameSnapshot }}</h1>
        <p>物品 ID · {{ currentItem?.itemCode || "历史条目" }}<br />档案位置：{{ currentLocation }}</p>
        <div class="entry-tags">
          <span v-if="currentEntry.starred" class="starred">星标物品</span
          ><span>{{ currentEntry.categorySnapshot || "未分类" }}</span>
        </div>
      </main>

      <footer class="check-actions">
        <button class="missing" @click="record(CHECK_STATES.MISSING)">未找到</button>
        <button class="skipped" @click="record(CHECK_STATES.SKIPPED)">跳过</button>
        <button class="confirmed" @click="record(CHECK_STATES.CONFIRMED)">已确认</button>
      </footer>
    </template>

    <main v-else-if="trip && session" class="summary-page">
      <div class="summary-mark">✓</div>
      <header>
        <h1>{{ kindLabel }}完成</h1>
        <p>
          {{ trip.title }} ·
          {{
            new Date(session.completedAt || session.updatedAt).toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          }}
        </p>
      </header>
      <section class="result-grid">
        <div>
          <b>{{ summary.confirmed }}</b
          ><span>已确认</span>
        </div>
        <div>
          <b class="danger">{{ summary.missing }}</b
          ><span>未找到</span>
        </div>
        <div>
          <b class="warm">{{ summary.skipped }}</b
          ><span>已跳过</span>
        </div>
      </section>
      <section v-if="missingEntries.length" class="needs-card">
        <div class="needs-heading">
          <h2>需要处理</h2>
          <span>{{ missingEntries.length }} 项</span>
        </div>
        <div v-for="entry in missingEntries" :key="entry.id">
          <span
            ><b>{{ entry.nameSnapshot }}</b
            ><small
              >{{
                trip.containerRefs.find((container) => container.containerId === entry.containerId)?.nameSnapshot ||
                "待整理"
              }}<template v-if="entry.starred"> · 星标物品</template></small
            ></span
          ><em>未找到</em>
        </div>
      </section>
      <button v-if="summary.missing || summary.skipped" class="retry-button" @click="retryUnresolved">
        重新核对未完成项
      </button>
      <button class="return-button" @click="leave">返回行程档案</button>
    </main>
  </div>
</template>

<style scoped>
.check-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f6f5f1;
  color: #111827;
}
.check-loading {
  flex: 1;
  display: grid;
  place-items: center;
  color: #9ca3af;
  font-size: 12px;
}
.check-topbar {
  flex: none;
  min-height: 58px;
  padding: max(12px, env(safe-area-inset-top)) 16px 8px;
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: end;
}
.check-topbar span {
  text-align: center;
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
}
.check-topbar button {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}
.check-topbar button:first-child {
  text-align: left;
  color: #6b7280;
  font-size: 25px;
}
.check-progress {
  flex: none;
  height: 7px;
  margin: 4px 18px 0;
  overflow: hidden;
  border-radius: 7px;
  background: #e5e7eb;
}
.check-progress span {
  display: block;
  height: 100%;
  border-radius: 7px;
  background: #2563eb;
  transition: width 0.2s ease;
}
.check-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 26px;
  text-align: center;
}
.check-group {
  margin-bottom: 24px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 750;
}
.item-orb {
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 34px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 44px;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.1);
}
.item-orb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.check-main h1 {
  margin: 22px 0 0;
  font-size: 24px;
}
.check-main p {
  margin: 10px 0 0;
  color: #8e8a82;
  font-size: 11px;
  line-height: 1.65;
}
.entry-tags {
  display: flex;
  gap: 7px;
  margin-top: 13px;
}
.entry-tags span {
  padding: 5px 8px;
  border-radius: 9px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 9px;
}
.entry-tags span.starred {
  background: #f8ebda;
  color: #996325;
}
.check-actions {
  flex: none;
  display: grid;
  grid-template-columns: 1fr 1fr 1.35fr;
  gap: 9px;
  padding: 12px 14px max(16px, env(safe-area-inset-bottom));
}
.check-actions button {
  min-height: 52px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 750;
}
.check-actions .missing {
  border: 1px solid #e9c4c1;
  background: #fdeceb;
  color: #b8433e;
}
.check-actions .skipped {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #6b7280;
}
.check-actions .confirmed {
  border: 0;
  background: #2563eb;
  color: #fff;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
}
.summary-page {
  flex: 1;
  overflow-y: auto;
  padding: max(28px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom));
  text-align: center;
}
.summary-mark {
  width: 70px;
  height: 70px;
  display: grid;
  place-items: center;
  margin: 12px auto 18px;
  border-radius: 24px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 32px;
  font-weight: 800;
}
.summary-page header h1 {
  margin: 0;
  font-size: 23px;
}
.summary-page header p {
  margin: 7px 0 0;
  color: #9ca3af;
  font-size: 10px;
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 24px 0 16px;
}
.result-grid div {
  padding: 15px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 17px;
  background: #fff;
}
.result-grid b,
.result-grid span {
  display: block;
}
.result-grid b {
  color: #2563eb;
  font-size: 24px;
}
.result-grid b.danger {
  color: #c04a44;
}
.result-grid b.warm {
  color: #a66c27;
}
.result-grid span {
  margin-top: 5px;
  color: #6b7280;
  font-size: 10px;
}
.needs-card {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  text-align: left;
}
.needs-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px;
}
.needs-heading h2 {
  margin: 0;
  font-size: 14px;
}
.needs-heading span {
  color: #9ca3af;
  font-size: 10px;
}
.needs-card > div:not(.needs-heading) {
  min-height: 55px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 13px;
  border-top: 1px solid #e5e7eb;
}
.needs-card b,
.needs-card small {
  display: block;
}
.needs-card b {
  font-size: 12px;
}
.needs-card small {
  margin-top: 3px;
  color: #9ca3af;
  font-size: 9px;
}
.needs-card em {
  color: #c04a44;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
}
.retry-button,
.return-button {
  width: 100%;
  min-height: 50px;
  margin-top: 12px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 750;
}
.retry-button {
  border: 0;
  background: #2563eb;
  color: #fff;
}
.return-button {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #4b5563;
}
</style>
