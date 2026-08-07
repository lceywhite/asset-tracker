<script setup>
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"
import { getCheckKindForTrip, getCheckSummary, getTripEndAt, getTripLegs, getTripStartAt } from "@/domain/tripModel"
import * as sessionService from "@/services/checkSessionService"
import ItemEditSheet from "@/components/item/ItemEditSheet.vue"
import TripCarryListEditor from "@/components/trip/TripCarryListEditor.vue"

const route = useRoute()
const router = useRouter()
const store = useActivityStore()
const trip = ref(null)
const sessions = ref([])
const showNewItem = ref(false)
const pendingNewItem = ref(null)
const showTargetSheet = ref(false)
const message = ref("")
const showCarryModal = ref(false)

const typeMeta = {
  commute: ["通勤", "🚇"],
  daily: ["日常外出", "🚶"],
  daily_carry: ["日常外出", "🚶"],
  travel: ["旅行", "🧳"],
  move: ["搬家", "📦"],
  custom: ["自定义", "⌁"],
}

const groups = computed(() =>
  (trip.value?.containerRefs || []).map((container) => ({
    ...container,
    items: (trip.value?.packingItems || []).filter((entry) => entry.containerId === container.containerId),
  })),
)
const legs = computed(() => getTripLegs(trip.value))
const outboundLeg = computed(() => legs.value.find((leg) => leg.direction === "outbound") || legs.value[0] || null)
const returnLeg = computed(() => legs.value.find((leg) => leg.direction === "return") || null)
const currentCheckKind = computed(() => getCheckKindForTrip(trip.value))
const latestSession = computed(
  () =>
    [...sessions.value]
      .filter((session) => session.kind === currentCheckKind.value)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0] || null,
)
const latestSummary = computed(() => getCheckSummary(latestSession.value))
const checkLabel = computed(() => {
  if (currentCheckKind.value === "anytime") return "随时核对"
  if (currentCheckKind.value === "end") return "结束核对"
  return "出发核对"
})
const durationText = computed(() => {
  const startValue = getTripStartAt(trip.value)
  const endValue = getTripEndAt(trip.value)
  if (!startValue || !endValue || trip.value?.endTimePending) return "待补充"
  const start = new Date(startValue)
  const end = new Date(endValue)
  const minutes = Math.round((end - start) / 60_000)
  if (!Number.isFinite(minutes) || minutes < 0) return "—"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours ? `${hours} 小时` : ""}${rest ? ` ${rest} 分钟` : ""}`.trim() || "少于 1 分钟"
})

onMounted(load)

async function load() {
  trip.value = await store.loadById(route.params.id)
  if (trip.value) sessions.value = await sessionService.getByPlan(trip.value.id)
}

function formatDateTime(value) {
  if (!value) return "未设置"
  const date = new Date(value.length === 10 ? `${value}T00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
    hour12: false,
  })
}

function typeLabel() {
  return typeMeta[trip.value?.type]?.[0] || trip.value?.type || "自定义"
}

function typeIcon() {
  return typeMeta[trip.value?.type]?.[1] || "⌁"
}

function phaseHint() {
  const startAt = getTripStartAt(trip.value)
  if (!startAt) return "时间待完善"
  const departure = new Date(startAt)
  const diff = departure - new Date()
  if (diff > 0 && diff < 86_400_000) return `${Math.max(1, Math.round(diff / 60_000))} 分钟后出发`
  if (diff > 0) return `${Math.ceil(diff / 86_400_000)} 天后出发`
  if (currentCheckKind.value === "anytime") return "行程进行中"
  return "行程已结束"
}

function openCarryList() {
  showCarryModal.value = true
}

function onCarryUpdated(updatedTrip) {
  if (updatedTrip) trip.value = updatedTrip
}

function startCheck() {
  if (!trip.value?.packingItems?.length) return
  router.push(`/plans/${trip.value.id}/check/${currentCheckKind.value}`)
}

async function deleteTrip() {
  if (!window.confirm("删除这份行程档案？携带清单和核对记录会一并删除，物品库档案不会受影响。")) return
  await store.del(trip.value.id)
  router.replace("/plans")
}

function onNewItemCreated(item) {
  showNewItem.value = false
  pendingNewItem.value = item
  if (!groups.value.length) {
    window.alert("物品已经保存到物品库。请先为行程添加移动容器，再把它加入携带清单。")
    openCarryList()
    return
  }
  showTargetSheet.value = true
}

async function attachNewItem(containerId) {
  const item = pendingNewItem.value
  if (!item) return
  trip.value = await store.update(trip.value.id, {
    containerRefs: trip.value.containerRefs,
    packingItems: [
      ...trip.value.packingItems,
      {
        itemId: item.id,
        containerId,
        nameSnapshot: item.name,
        categorySnapshot: item.category,
        imageSnapshot: item.photo || "",
        starred: false,
        addedAt: new Date().toISOString(),
      },
    ],
  })
  showTargetSheet.value = false
  pendingNewItem.value = null
  message.value = "新物品已同步到物品库和本次行程"
  window.setTimeout(() => (message.value = ""), 2400)
}

function cardRows(card) {
  if (Array.isArray(card.data?.rows)) return card.data.rows
  if (card.data && typeof card.data === "object") {
    return Object.entries(card.data)
      .filter(([, value]) => typeof value !== "object")
      .map(([label, value]) => ({ label, value }))
  }
  return []
}

function cardTimeline(card) {
  return card.data?.pages?.[0]?.events || card.data?.events || []
}

function cardPages(card) {
  return card.data?.pages || []
}

function routeText(leg) {
  if (!leg) return "路线待完善"
  return [leg.origin, ...(leg.stops || []).map((stop) => stop.name), leg.destination].filter(Boolean).join(" → ")
}

function amountTotal(card) {
  return (card.data?.rows || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0)
}
</script>

<template>
  <div class="detail-page">
    <header class="detail-topbar">
      <button aria-label="返回" @click="router.push('/plans')">‹</button>
      <h1>行程档案</h1>
      <button v-if="trip" @click="router.push(`/plans/${trip.id}/edit`)">编辑</button>
    </header>

    <main v-if="trip" class="detail-scroll">
      <section class="hero-card">
        <div class="hero-head">
          <span>
            <small>{{ phaseHint() }}</small>
            <b>{{ trip.title }}</b>
            <em>{{ trip.journeyType === "round_trip" ? "往返" : "单程" }} · {{ groups.length }} 个移动容器</em>
          </span>
          <i>{{ typeIcon() }} {{ typeLabel() }}</i>
        </div>
        <div class="route-summary">
          <span
            ><small>{{ trip.journeyType === "round_trip" ? "去程" : "路线" }}</small
            ><b>{{ routeText(outboundLeg) }}</b></span
          >
          <em>{{ outboundLeg?.transportMode || "出行方式待定" }}</em>
        </div>
        <div v-if="returnLeg" class="route-summary return-route">
          <span
            ><small>返程</small><b>{{ routeText(returnLeg) }}</b></span
          ><em>{{ returnLeg.transportMode || "未设置" }}</em>
        </div>
        <div class="fact-grid">
          <div>
            <span>开始时间</span><b>{{ formatDateTime(getTripStartAt(trip)) }}</b>
          </div>
          <div>
            <span>结束时间</span><b>{{ trip.endTimePending ? "待补充" : formatDateTime(getTripEndAt(trip)) }}</b>
          </div>
          <div v-if="returnLeg">
            <span>返程出发</span><b>{{ formatDateTime(returnLeg.departureAt) }}</b>
          </div>
          <div>
            <span>行程时长</span><b>{{ durationText }}</b>
          </div>
        </div>
      </section>

      <div class="detail-heading">
        <h2>物品清单</h2>
        <span>{{ groups.length }} 个移动容器 · {{ trip.packingItems.length }} 项</span>
      </div>
      <section class="detail-card packing-card">
        <button v-for="group in groups" :key="group.containerId" @click="openCarryList">
          <span>{{ group.iconSnapshot || "🎒" }}</span
          ><span
            ><b>{{ group.nameSnapshot }}</b
            ><small
              >{{ group.items.length }} 项 · {{ group.items.filter((item) => item.starred).length }} 项星标</small
            ></span
          ><i>›</i>
        </button>
        <div v-if="!groups.length" class="empty-packing">还没有添加移动容器和物品</div>
        <button class="list-action" @click="openCarryList">
          <span>＋</span><span><b>添加物品</b><small>按移动容器添加、标记、移动或移出物品</small></span
          ><i>›</i>
        </button>
        <button class="list-action" @click="showNewItem = true">
          <span>＋</span><span><b>行程中新增物品</b><small>建立正式档案，同步物品库后加入移动容器</small></span
          ><i>›</i>
        </button>
      </section>

      <section class="check-card">
        <template v-if="latestSession && latestSummary.total">
          <div class="check-status">
            <span>物品核对状态</span><b>{{ latestSummary.completed }} / {{ latestSummary.total }}</b>
          </div>
          <div class="progress">
            <span :style="{ width: `${(latestSummary.completed / latestSummary.total) * 100}%` }"></span>
          </div>
          <div class="check-tags">
            <span>{{ latestSummary.confirmed }} 项已确认</span
            ><span v-if="latestSummary.missing" class="danger">{{ latestSummary.missing }} 项未找到</span
            ><span v-if="latestSummary.skipped" class="warm">{{ latestSummary.skipped }} 项跳过</span>
          </div>
        </template>
        <button :disabled="!trip.packingItems.length" @click="startCheck">{{ checkLabel }}</button>
      </section>

      <div v-if="trip.notes || trip.infoCards?.length" class="detail-heading"><h2>通用信息</h2></div>
      <section v-if="trip.notes" class="detail-card info-card">
        <header>
          <span
            ><b>备注</b><small>{{ new Date(trip.updatedAt).toLocaleDateString("zh-CN") }} 更新</small></span
          >
        </header>
        <p>{{ trip.notes }}</p>
      </section>

      <section v-for="card in trip.infoCards" :key="card.id" class="detail-card info-card">
        <header>
          <span
            ><b>{{ card.title }}</b></span
          ><i>›</i>
        </header>
        <div v-if="card.type === 'timeline'" class="mini-timeline">
          <div v-for="event in cardTimeline(card)" :key="`${event.time}-${event.title}`">
            <time>{{ event.time }}</time
            ><span
              ><b>{{ event.title }}</b
              ><small>{{ event.notes || event.description }}</small></span
            >
          </div>
        </div>
        <div v-else-if="card.type === 'paged_schedule'" class="page-schedule">
          <section v-for="page in cardPages(card)" :key="page.id || page.title">
            <b>{{ page.title }}</b>
            <div v-for="event in page.events || []" :key="event.id || `${event.time}-${event.title}`">
              <time>{{ event.time }}</time
              ><span>{{ event.title }}</span>
            </div>
          </section>
        </div>
        <div v-else-if="card.type === 'checklist'" class="info-list">
          <div v-for="item in card.data?.items || []" :key="item.id || item.label">
            <span>{{ item.done ? "✓" : "○" }}</span
            ><b>{{ item.label || item.text }}</b>
          </div>
        </div>
        <div v-else-if="card.type === 'amount'" class="amount-card">
          <div v-for="row in cardRows(card)" :key="row.id || row.label">
            <span>{{ row.label }}</span
            ><b>¥{{ row.value }}</b>
          </div>
          <strong>合计 ¥{{ amountTotal(card) }}</strong>
        </div>
        <div v-else class="key-values">
          <div v-for="row in cardRows(card)" :key="row.id || row.label">
            <span>{{ row.label }}</span
            ><b>{{ row.value }}</b>
          </div>
        </div>
      </section>

      <button class="delete-trip" @click="deleteTrip">删除此行程档案</button>
    </main>

    <div v-else class="detail-loading">正在加载行程档案…</div>

    <ItemEditSheet :show="showNewItem" @close="showNewItem = false" @created="onNewItemCreated" />
    <div v-if="showTargetSheet" class="target-layer" @click.self="showTargetSheet = false">
      <section>
        <div class="target-handle"></div>
        <h2>放入哪个移动容器？</h2>
        <p>{{ pendingNewItem?.name }} 已经进入物品库，选择它在本次行程中的容器。</p>
        <button v-for="group in groups" :key="group.containerId" @click="attachNewItem(group.containerId)">
          <span>{{ group.iconSnapshot || "🎒" }}</span
          ><b>{{ group.nameSnapshot }}</b
          ><i>›</i>
        </button>
      </section>
    </div>
    <div v-if="message" class="detail-toast">{{ message }}</div>
    <TripCarryListEditor
      v-if="showCarryModal && trip"
      :trip-id="trip.id"
      embedded
      @updated="onCarryUpdated"
      @close="showCarryModal = false"
    />
  </div>
</template>

<style scoped>
.detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f6f5f1;
  color: #111827;
}
.detail-topbar {
  flex: none;
  min-height: 58px;
  padding: max(10px, env(safe-area-inset-top)) 16px 10px;
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: end;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.detail-topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 17px;
}
.detail-topbar button {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-weight: 700;
}
.detail-topbar button:first-child {
  text-align: left;
  font-size: 30px;
  line-height: 28px;
}
.detail-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 28px;
}
.hero-card,
.detail-card,
.check-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 3px 12px rgba(54, 50, 40, 0.03);
}
.hero-card {
  padding: 16px;
}
.hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.hero-head small,
.hero-head b,
.hero-head em {
  display: block;
}
.hero-head small {
  color: #2563eb;
  font-size: 10px;
  font-weight: 700;
}
.hero-head b {
  margin-top: 5px;
  font-size: 21px;
}
.hero-head em {
  margin-top: 5px;
  color: #6b7280;
  font-size: 10px;
  font-style: normal;
}
.hero-head > i {
  padding: 5px 8px;
  border-radius: 9px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
}
.route-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  border-radius: 12px;
  padding: 10px 11px;
  background: #f9fafb;
}
.route-summary.return-route {
  margin-top: 7px;
  background: #eff6ff;
}
.route-summary span,
.route-summary small,
.route-summary b {
  display: block;
}
.route-summary span {
  min-width: 0;
}
.route-summary small {
  margin-bottom: 3px;
  color: #9ca3af;
  font-size: 9px;
}
.route-summary b {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.route-summary em {
  flex: none;
  color: #6b7280;
  font-size: 9px;
  font-style: normal;
}
.fact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-top: 13px;
  border-top: 1px solid #e5e7eb;
}
.fact-grid div {
  padding: 9px;
  border-radius: 12px;
  background: #f9fafb;
}
.fact-grid span,
.fact-grid b {
  display: block;
}
.fact-grid span {
  color: #9ca3af;
  font-size: 9px;
}
.fact-grid b {
  margin-top: 4px;
  font-size: 11px;
}
.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 2px 8px;
}
.detail-heading h2 {
  margin: 0;
  font-size: 15px;
}
.detail-heading span {
  color: #9ca3af;
  font-size: 10px;
}
.packing-card {
  overflow: hidden;
}
.packing-card > button {
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 10px;
  border: 0;
  border-top: 1px solid #e5e7eb;
  padding: 9px 13px;
  background: #fff;
  text-align: left;
}
.packing-card > button:first-child {
  border-top: 0;
}
.packing-card > button > span:first-child {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f3f4f6;
  font-size: 19px;
}
.packing-card b,
.packing-card small {
  display: block;
}
.packing-card b {
  font-size: 13px;
}
.packing-card small {
  margin-top: 3px;
  color: #9ca3af;
  font-size: 10px;
}
.packing-card i {
  color: #9ca3af;
  font-style: normal;
}
.packing-card button.list-action > span:first-child {
  background: #eff6ff;
  color: #2563eb;
}
.empty-packing {
  padding: 22px;
  text-align: center;
  color: #9ca3af;
  font-size: 11px;
}
.check-card {
  margin-top: 12px;
  padding: 14px;
}
.check-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #77736b;
  font-size: 11px;
}
.check-status b {
  color: #2d2a24;
  font-size: 12px;
}
.progress {
  height: 7px;
  margin: 9px 0;
  overflow: hidden;
  border-radius: 7px;
  background: #ece9e2;
}
.progress span {
  display: block;
  height: 100%;
  border-radius: 7px;
  background: #2563eb;
}
.check-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 11px;
}
.check-tags span {
  padding: 4px 7px;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 9px;
}
.check-tags span.danger {
  background: #fdeceb;
  color: #b8453f;
}
.check-tags span.warm {
  background: #f8ebda;
  color: #956224;
}
.check-card > button {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 15px;
  background: #2563eb;
  color: #fff;
  font-size: 13px;
  font-weight: 750;
}
.check-card > button:disabled {
  background: #d1d5db;
}
.info-card {
  margin-bottom: 10px;
  padding: 14px;
}
.info-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.info-card header b,
.info-card header small {
  display: block;
}
.info-card header b {
  font-size: 13px;
}
.info-card header small {
  margin-top: 3px;
  color: #9ca3af;
  font-size: 9px;
}
.info-card header i {
  color: #9ca3af;
  font-style: normal;
}
.info-card > p {
  margin: 12px 0 0;
  color: #5f5b54;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
}
.key-values > div,
.info-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-top: 1px solid #e5e7eb;
  font-size: 11px;
}
.key-values {
  margin-top: 10px;
}
.key-values span {
  color: #6b7280;
}
.mini-timeline {
  margin-top: 12px;
}
.mini-timeline > div {
  display: grid;
  grid-template-columns: 46px 1fr;
  gap: 10px;
  padding: 7px 0;
}
.mini-timeline time {
  color: #2563eb;
  font-size: 10px;
  font-weight: 700;
}
.mini-timeline b,
.mini-timeline small {
  display: block;
}
.mini-timeline b {
  font-size: 11px;
}
.mini-timeline small {
  margin-top: 3px;
  color: #9ca3af;
  font-size: 9px;
}
.page-schedule {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  overflow-x: auto;
}
.page-schedule > section {
  min-width: 160px;
  border-radius: 12px;
  padding: 10px;
  background: #f9fafb;
}
.page-schedule > section > b {
  color: #2563eb;
  font-size: 11px;
}
.page-schedule > section > div {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 7px;
  padding-top: 7px;
  font-size: 10px;
}
.page-schedule time {
  color: #9ca3af;
}
.amount-card {
  margin-top: 10px;
}
.amount-card > div {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #f0f1f3;
  padding: 8px 0;
  font-size: 11px;
}
.amount-card > div span {
  color: #6b7280;
}
.amount-card > strong {
  display: block;
  border-top: 1px solid #e5e7eb;
  padding-top: 9px;
  text-align: right;
  color: #2563eb;
  font-size: 12px;
}
.delete-trip {
  width: 100%;
  margin-top: 12px;
  border: 0;
  padding: 12px;
  background: transparent;
  color: #c34b45;
  font-size: 12px;
}
.detail-loading {
  flex: 1;
  display: grid;
  place-items: center;
  color: #9ca3af;
  font-size: 12px;
}
.target-layer {
  position: fixed;
  z-index: 55;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(20, 18, 14, 0.34);
}
.target-layer > section {
  width: 100%;
  padding: 10px 18px max(24px, env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  background: #fff;
}
.target-handle {
  width: 38px;
  height: 4px;
  margin: 0 auto 16px;
  border-radius: 4px;
  background: #ddd8cf;
}
.target-layer h2 {
  margin: 0;
  font-size: 17px;
}
.target-layer p {
  color: #6b7280;
  font-size: 11px;
}
.target-layer button {
  width: 100%;
  min-height: 54px;
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 10px;
  border: 0;
  border-top: 1px solid #e5e7eb;
  background: #fff;
  text-align: left;
}
.target-layer button span {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f3f4f6;
}
.target-layer button i {
  color: #9ca3af;
  font-style: normal;
}
.detail-toast {
  position: fixed;
  z-index: 70;
  left: 50%;
  bottom: 86px;
  transform: translateX(-50%);
  padding: 9px 14px;
  border-radius: 12px;
  background: rgba(31, 29, 25, 0.9);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
}
</style>
