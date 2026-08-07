<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"
import { JOURNEY_TYPES } from "@/domain/tripModel"
import { generateId } from "@/utils/id"
import TripInfoCardsEditor from "@/components/trip/TripInfoCardsEditor.vue"
import TripCarryListEditor from "@/components/trip/TripCarryListEditor.vue"

const route = useRoute()
const router = useRouter()
const store = useActivityStore()
const saving = ref(false)
const error = ref("")
const errorField = ref("")
const editingId = ref(route.params.id || "")
const useReverseReturn = ref(true)
const showCarryModal = ref(false)

const typeOptions = [
  { value: "commute", label: "通勤", icon: "🚇" },
  { value: "daily", label: "日常外出", icon: "🚶" },
  { value: "travel", label: "旅行", icon: "🧳" },
  { value: "move", label: "搬家", icon: "📦" },
  { value: "custom", label: "自定义", icon: "＋" },
]
const transportOptions = ["步行", "骑行", "地铁 / 公共交通", "驾车", "火车", "飞机", "搬运车辆", "其他"]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function localDateTime(date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const defaultStart = new Date()
defaultStart.setMinutes(0, 0, 0)
defaultStart.setHours(defaultStart.getHours() + 1)
const defaultEnd = new Date(defaultStart)
defaultEnd.setHours(defaultEnd.getHours() + 2)
const routeDate = typeof route.query.date === "string" ? route.query.date : ""

function blankLeg(direction, departureAt = "", arrivalAt = "") {
  return {
    id: generateId(),
    direction,
    origin: "",
    destination: "",
    stops: [],
    transportMode: "地铁 / 公共交通",
    departureAt,
    arrivalAt,
  }
}

const form = reactive({
  title: "",
  type: "commute",
  customTypeName: "",
  journeyType: JOURNEY_TYPES.ONE_WAY,
  startsAt: routeDate ? `${routeDate}T08:00` : localDateTime(defaultStart),
  endsAt: routeDate ? `${routeDate}T10:00` : localDateTime(defaultEnd),
  legs: [],
  containerRefs: [],
  packingItems: [],
  notes: "",
  infoCards: [],
  status: "draft",
})
form.legs = [blankLeg("outbound", form.startsAt, form.endsAt)]

const outboundLeg = computed(() => form.legs.find((leg) => leg.direction === "outbound") || form.legs[0])
const returnLeg = computed(() => form.legs.find((leg) => leg.direction === "return") || null)
const totalItems = computed(() => form.packingItems.length)
const totalStarred = computed(() => form.packingItems.filter((entry) => entry.starred).length)
const containerSummaries = computed(() =>
  form.containerRefs.map((container) => {
    const items = form.packingItems.filter((entry) => entry.containerId === container.containerId)
    return {
      ...container,
      itemCount: items.length,
      starredCount: items.filter((entry) => entry.starred).length,
    }
  }),
)

function hydrate(trip) {
  form.title = trip.isUntitled ? "" : trip.title || ""
  form.type = typeOptions.some((option) => option.value === trip.type) ? trip.type : "custom"
  form.customTypeName = form.type === "custom" ? (trip.type === "custom" ? "" : trip.type) : ""
  form.journeyType = trip.journeyType || trip.tripMode || JOURNEY_TYPES.ONE_WAY
  form.startsAt = trip.startsAt || trip.departureAt || ""
  form.endsAt = trip.endsAt || trip.returnAt || form.startsAt
  form.legs = clone(trip.legs || [])
  if (!form.legs.length) form.legs = [blankLeg("outbound", form.startsAt, form.endsAt)]
  form.containerRefs = clone(trip.containerRefs || [])
  form.packingItems = clone(trip.packingItems || [])
  form.notes = trip.notes || ""
  form.infoCards = clone(trip.infoCards || [])
  form.status = trip.status || "draft"
  useReverseReturn.value = isReverseRoute()
}

onMounted(async () => {
  if (!editingId.value) return
  const trip = await store.loadById(editingId.value)
  if (!trip) {
    error.value = "没有找到这份行程档案"
    return
  }
  hydrate(trip)
})

watch(
  () => form.startsAt,
  (value) => {
    if (outboundLeg.value) outboundLeg.value.departureAt = value
    if (returnLeg.value?.departureAt && returnLeg.value.departureAt < value) {
      returnLeg.value.departureAt = suggestedReturnDeparture()
    }
  },
)

watch(
  () => form.endsAt,
  (value, previousValue) => {
    if (form.journeyType === JOURNEY_TYPES.ONE_WAY && outboundLeg.value) outboundLeg.value.arrivalAt = value
    if (returnLeg.value) {
      if (
        !returnLeg.value.departureAt ||
        returnLeg.value.departureAt === suggestedReturnDeparture(previousValue) ||
        returnLeg.value.departureAt > value
      ) {
        returnLeg.value.departureAt = suggestedReturnDeparture(value)
      }
      returnLeg.value.arrivalAt = value
    }
  },
)

watch(
  () => [outboundLeg.value?.origin, outboundLeg.value?.destination, outboundLeg.value?.transportMode],
  () => {
    if (form.journeyType === JOURNEY_TYPES.ROUND_TRIP && useReverseReturn.value) applyReverseRoute()
  },
)

function isReverseRoute() {
  if (!returnLeg.value || !outboundLeg.value) return true
  return (
    returnLeg.value.origin === outboundLeg.value.destination &&
    returnLeg.value.destination === outboundLeg.value.origin &&
    returnLeg.value.transportMode === outboundLeg.value.transportMode
  )
}

function suggestedReturnDeparture(endValue = form.endsAt) {
  if (!endValue) return ""
  const start = new Date(form.startsAt)
  const end = new Date(endValue)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return ""
  const oneHourBeforeEnd = new Date(end.getTime() - 60 * 60_000)
  const suggestion = oneHourBeforeEnd > start ? oneHourBeforeEnd : new Date((start.getTime() + end.getTime()) / 2)
  return localDateTime(suggestion)
}

function ensureReturnLeg() {
  if (returnLeg.value) return returnLeg.value
  const leg = blankLeg("return", suggestedReturnDeparture(), form.endsAt)
  form.legs.push(leg)
  return leg
}

function applyReverseRoute() {
  const leg = ensureReturnLeg()
  leg.origin = outboundLeg.value?.destination || ""
  leg.destination = outboundLeg.value?.origin || ""
  leg.transportMode = outboundLeg.value?.transportMode || ""
  leg.stops = [...(outboundLeg.value?.stops || [])].reverse().map((stop) => ({ ...clone(stop), id: generateId() }))
}

function setJourneyType(type) {
  form.journeyType = type
  if (type === JOURNEY_TYPES.ROUND_TRIP) {
    ensureReturnLeg()
    useReverseReturn.value = true
    applyReverseRoute()
  } else {
    form.legs = form.legs.filter((leg) => leg.direction !== "return")
    outboundLeg.value.arrivalAt = form.endsAt
  }
}

function toggleReverseReturn() {
  useReverseReturn.value = !useReverseReturn.value
  if (useReverseReturn.value) applyReverseRoute()
}

function addStop(direction) {
  const leg = direction === "return" ? ensureReturnLeg() : outboundLeg.value
  leg.stops.push({ id: generateId(), name: "", arrivalAt: "", departureAt: "", notes: "", sortOrder: leg.stops.length })
}

function removeStop(direction, id) {
  const leg = direction === "return" ? returnLeg.value : outboundLeg.value
  if (!leg) return
  leg.stops = leg.stops.filter((stop) => stop.id !== id).map((stop, index) => ({ ...stop, sortOrder: index }))
}

function moveStop(direction, index, offset) {
  const leg = direction === "return" ? returnLeg.value : outboundLeg.value
  const target = index + offset
  if (!leg || target < 0 || target >= leg.stops.length) return
  ;[leg.stops[index], leg.stops[target]] = [leg.stops[target], leg.stops[index]]
  leg.stops = leg.stops.map((stop, sortOrder) => ({ ...stop, sortOrder }))
}

function payload(status = form.status) {
  const legs = clone(form.legs).map((leg, index) => ({
    ...leg,
    sortOrder: index,
    stops: (leg.stops || []).filter((stop) => stop.name.trim()).map((stop, sortOrder) => ({ ...stop, sortOrder })),
  }))
  return {
    ...clone(form),
    title: form.title.trim(),
    isUntitled: !form.title.trim(),
    type: form.type === "custom" ? form.customTypeName.trim() || "custom" : form.type,
    journeyType: form.journeyType,
    tripMode: form.journeyType,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    endTimePending: false,
    legs,
    status,
  }
}

function validateFinal() {
  if (!form.title.trim()) return { message: "请填写行程名称", field: "title" }
  if (form.type === "custom" && !form.customTypeName.trim()) return { message: "请填写自定义类型", field: "customType" }
  if (!form.startsAt) return { message: "请选择开始时间", field: "startsAt" }
  if (!form.endsAt) return { message: "请选择结束时间", field: "endsAt" }
  if (form.endsAt < form.startsAt) return { message: "结束时间不能早于开始时间", field: "endsAt" }
  if (!outboundLeg.value?.origin.trim()) return { message: "请填写起点", field: "origin" }
  if (!outboundLeg.value?.destination.trim()) return { message: "请填写终点", field: "destination" }
  if (form.journeyType === JOURNEY_TYPES.ROUND_TRIP) {
    if (!returnLeg.value?.departureAt) return { message: "请选择返程出发时间", field: "returnDeparture" }
    if (returnLeg.value.departureAt < form.startsAt || returnLeg.value.departureAt > form.endsAt) {
      return { message: "返程出发时间需要位于行程开始与结束之间", field: "returnDeparture" }
    }
  }
  return null
}

function focusError(field) {
  window.setTimeout(() => {
    const target = document.querySelector(`[data-trip-field="${field}"]`)
    target?.scrollIntoView({ behavior: "smooth", block: "center" })
    target?.querySelector("input, select, textarea")?.focus()
  })
}

async function persist(status, { validate = false } = {}) {
  error.value = ""
  errorField.value = ""
  if (validate) {
    const issue = validateFinal()
    if (issue) {
      error.value = issue.message
      errorField.value = issue.field
      focusError(issue.field)
      return null
    }
  }
  saving.value = true
  try {
    const trip = editingId.value
      ? await store.update(editingId.value, payload(status))
      : await store.create(payload(status))
    editingId.value = trip.id
    hydrate(trip)
    return trip
  } catch (cause) {
    error.value = cause.message || "行程保存失败"
    return null
  } finally {
    saving.value = false
  }
}

async function saveDraft() {
  const trip = await persist("draft")
  if (trip) router.replace(`/plans/${trip.id}`)
}

async function saveTrip() {
  const trip = await persist("planned", { validate: true })
  if (trip) router.replace(`/plans/${trip.id}`)
}

async function openCarryList() {
  const trip = await persist("draft")
  if (!trip) return
  showCarryModal.value = true
}

function onCarryUpdated(updatedTrip) {
  if (updatedTrip) hydrate(updatedTrip)
}

async function closeCarryList() {
  showCarryModal.value = false
  const returnPath = `/plans/${editingId.value}/edit`
  if (editingId.value && route.path !== returnPath) await router.replace(returnPath)
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push(editingId.value ? `/plans/${editingId.value}` : "/plans")
}
</script>

<template>
  <div class="trip-page">
    <header class="trip-topbar">
      <button aria-label="返回" @click="goBack">‹</button>
      <h1>{{ editingId ? "编辑行程" : "新建行程" }}</h1>
      <button :disabled="saving" @click="saveDraft">存草稿</button>
    </header>

    <main class="trip-scroll">
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <section class="trip-card">
        <h2>基本信息</h2>
        <label class="trip-field" data-trip-field="title" :class="{ invalid: errorField === 'title' }">
          <span>行程名称</span><input v-model="form.title" placeholder="例如：工作日通勤" />
        </label>
        <div class="trip-type-grid">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            type="button"
            :class="{ active: form.type === option.value }"
            @click="form.type = option.value"
          >
            <b>{{ option.icon }}</b
            >{{ option.label }}
          </button>
        </div>
        <label
          v-if="form.type === 'custom'"
          class="trip-field"
          data-trip-field="customType"
          :class="{ invalid: errorField === 'customType' }"
        >
          <span>自定义类型名称</span><input v-model="form.customTypeName" placeholder="例如：露营、探亲" />
        </label>
      </section>

      <section class="trip-card">
        <div class="trip-section-head">
          <h2>行程信息</h2>
          <span>所有行程都有开始与结束</span>
        </div>
        <div class="trip-segment">
          <button
            type="button"
            :class="{ active: form.journeyType === JOURNEY_TYPES.ONE_WAY }"
            @click="setJourneyType(JOURNEY_TYPES.ONE_WAY)"
          >
            单程
          </button>
          <button
            type="button"
            :class="{ active: form.journeyType === JOURNEY_TYPES.ROUND_TRIP }"
            @click="setJourneyType(JOURNEY_TYPES.ROUND_TRIP)"
          >
            往返
          </button>
        </div>
        <div class="trip-two-cols">
          <label class="trip-field" data-trip-field="startsAt" :class="{ invalid: errorField === 'startsAt' }">
            <span>开始时间</span><input v-model="form.startsAt" type="datetime-local" />
          </label>
          <label class="trip-field" data-trip-field="endsAt" :class="{ invalid: errorField === 'endsAt' }">
            <span>结束时间</span><input v-model="form.endsAt" type="datetime-local" />
          </label>
        </div>

        <div class="route-editor-card">
          <header>
            <b>{{ form.journeyType === JOURNEY_TYPES.ROUND_TRIP ? "去程路线" : "单程路线" }}</b>
          </header>
          <label class="route-stop" data-trip-field="origin" :class="{ invalid: errorField === 'origin' }">
            <i class="origin-dot"></i
            ><span><small>起点</small><input v-model="outboundLeg.origin" placeholder="从哪里出发" /></span>
          </label>
          <label v-for="(stop, index) in outboundLeg.stops" :key="stop.id" class="route-stop waypoint-stop">
            <i></i
            ><span
              ><small>途经点 {{ index + 1 }}</small
              ><input v-model="stop.name" placeholder="输入途经地点"
            /></span>
            <span class="stop-tools">
              <button
                type="button"
                :disabled="index === 0"
                aria-label="上移途经点"
                @click="moveStop('outbound', index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                :disabled="index === outboundLeg.stops.length - 1"
                aria-label="下移途经点"
                @click="moveStop('outbound', index, 1)"
              >
                ↓
              </button>
              <button type="button" aria-label="删除途经点" @click="removeStop('outbound', stop.id)">×</button>
            </span>
          </label>
          <label class="route-stop" data-trip-field="destination" :class="{ invalid: errorField === 'destination' }">
            <i class="destination-dot"></i
            ><span><small>终点</small><input v-model="outboundLeg.destination" placeholder="要去哪里" /></span>
          </label>
          <button class="add-stop" type="button" @click="addStop('outbound')">＋ 添加途经点</button>
          <div class="route-options">
            <label class="trip-field">
              <span>去程方式</span>
              <select v-model="outboundLeg.transportMode">
                <option v-for="option in transportOptions" :key="option">{{ option }}</option>
              </select>
            </label>
            <label v-if="form.journeyType === JOURNEY_TYPES.ROUND_TRIP" class="trip-field">
              <span>去程到达（可选）</span><input v-model="outboundLeg.arrivalAt" type="datetime-local" />
            </label>
          </div>
        </div>

        <div v-if="form.journeyType === JOURNEY_TYPES.ROUND_TRIP && returnLeg" class="return-editor-card">
          <header>
            <span><b>返程路线</b><small>结束时间为返程到达时间</small></span>
            <button type="button" :class="{ active: useReverseReturn }" @click="toggleReverseReturn">
              {{ useReverseReturn ? "已使用反向路线" : "使用去程反向路线" }}
            </button>
          </header>
          <div class="trip-two-cols">
            <label
              class="trip-field"
              data-trip-field="returnDeparture"
              :class="{ invalid: errorField === 'returnDeparture' }"
            >
              <span>返程出发时间</span><input v-model="returnLeg.departureAt" type="datetime-local" />
            </label>
            <label class="trip-field"
              ><span>返程到达时间</span><input v-model="form.endsAt" type="datetime-local"
            /></label>
          </div>
          <label class="route-stop">
            <i class="origin-dot"></i
            ><span><small>返程起点</small><input v-model="returnLeg.origin" :disabled="useReverseReturn" /></span>
          </label>
          <label v-for="(stop, index) in returnLeg.stops" :key="stop.id" class="route-stop waypoint-stop">
            <i></i
            ><span
              ><small>返程途经点 {{ index + 1 }}</small
              ><input v-model="stop.name" :disabled="useReverseReturn"
            /></span>
            <span v-if="!useReverseReturn" class="stop-tools">
              <button type="button" :disabled="index === 0" @click="moveStop('return', index, -1)">↑</button>
              <button
                type="button"
                :disabled="index === returnLeg.stops.length - 1"
                @click="moveStop('return', index, 1)"
              >
                ↓
              </button>
              <button type="button" @click="removeStop('return', stop.id)">×</button>
            </span>
          </label>
          <label class="route-stop">
            <i class="destination-dot"></i
            ><span><small>返程终点</small><input v-model="returnLeg.destination" :disabled="useReverseReturn" /></span>
          </label>
          <button v-if="!useReverseReturn" class="add-stop" type="button" @click="addStop('return')">
            ＋ 添加返程途经点
          </button>
          <label class="trip-field">
            <span>返程方式</span>
            <select v-model="returnLeg.transportMode" :disabled="useReverseReturn">
              <option v-for="option in transportOptions" :key="option">{{ option }}</option>
            </select>
          </label>
        </div>
      </section>

      <section class="trip-card">
        <div class="trip-section-head">
          <h2>携带物品清单</h2>
          <span v-if="totalItems">{{ totalItems }} 项 · {{ totalStarred }} 项星标</span>
        </div>
        <div v-if="containerSummaries.length" class="trip-list">
          <button
            v-for="container in containerSummaries"
            :key="container.containerId"
            type="button"
            @click="openCarryList"
          >
            <span class="trip-list-icon">{{ container.iconSnapshot || "🎒" }}</span>
            <span
              ><b>{{ container.nameSnapshot }}</b
              ><small>{{ container.itemCount }} 项 · {{ container.starredCount }} 项星标</small></span
            >
            <i>›</i>
          </button>
        </div>
        <button class="trip-dashed-action" type="button" @click="openCarryList">＋ 添加物品</button>
      </section>

      <section class="trip-card">
        <h2>通用信息</h2>
        <label class="notes-card"
          ><span>备注</span><textarea v-model="form.notes" rows="4" placeholder="记录需要特别留意的事项"></textarea>
        </label>
        <TripInfoCardsEditor v-model="form.infoCards" />
      </section>

      <button class="trip-primary" :disabled="saving" @click="saveTrip">
        {{ saving ? "正在保存…" : "保存行程档案" }}
      </button>
    </main>
    <TripCarryListEditor
      v-if="showCarryModal && editingId"
      :trip-id="editingId"
      embedded
      @updated="onCarryUpdated"
      @close="closeCarryList"
    />
  </div>
</template>

<style scoped>
.trip-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f6f5f1;
  color: #111827;
}
.trip-topbar {
  flex: none;
  min-height: 58px;
  padding: max(10px, env(safe-area-inset-top)) 16px 10px;
  display: grid;
  grid-template-columns: 64px 1fr 64px;
  align-items: end;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}
.trip-topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 17px;
}
.trip-topbar button {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 650;
}
.trip-topbar button:first-child {
  text-align: left;
  font-size: 28px;
  line-height: 24px;
}
.trip-topbar button:last-child {
  text-align: right;
}
.trip-topbar button:disabled {
  opacity: 0.45;
}
.trip-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 32px;
}
.form-error {
  position: sticky;
  z-index: 10;
  top: 0;
  margin: 0 0 10px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
}
.trip-card {
  margin-bottom: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(17, 24, 39, 0.03);
}
.trip-card h2 {
  margin: 0 0 13px;
  font-size: 15px;
}
.trip-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.trip-section-head span {
  color: #9ca3af;
  font-size: 10px;
}
.trip-field {
  display: block;
  margin-top: 12px;
}
.trip-field > span,
.notes-card > span {
  display: block;
  margin-bottom: 6px;
  color: #6b7280;
  font-size: 11px;
  font-weight: 650;
}
.trip-field input,
.trip-field select,
.trip-field textarea,
.notes-card textarea,
.route-stop input {
  width: 100%;
  min-height: 44px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
  color: #111827;
  font-size: 13px;
  outline: none;
}
.trip-field input:focus,
.trip-field select:focus,
.trip-field textarea:focus,
.notes-card textarea:focus,
.route-stop input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
.trip-field.invalid input,
.route-stop.invalid input {
  border-color: #dc2626;
}
.trip-field input:disabled,
.trip-field select:disabled,
.route-stop input:disabled {
  background: #f3f4f6;
  color: #6b7280;
}
.trip-type-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  margin-top: 12px;
}
.trip-type-grid button {
  min-height: 58px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 6px 2px;
  background: #fff;
  color: #6b7280;
  font-size: 10px;
}
.trip-type-grid button b {
  display: block;
  margin-bottom: 3px;
  font-size: 19px;
}
.trip-type-grid button.active {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 700;
}
.trip-segment {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 3px;
  border-radius: 12px;
  background: #f3f4f6;
}
.trip-segment button {
  border: 0;
  border-radius: 9px;
  padding: 9px;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
}
.trip-segment button.active {
  background: #fff;
  color: #2563eb;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(17, 24, 39, 0.08);
}
.trip-two-cols,
.route-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.route-editor-card,
.return-editor-card {
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 0 12px 12px;
  background: #f9fafb;
}
.route-editor-card > header,
.return-editor-card > header {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 -12px;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 12px;
  background: #fff;
}
.route-editor-card > header b,
.return-editor-card > header b {
  font-size: 12px;
}
.return-editor-card > header span,
.return-editor-card > header small {
  display: block;
}
.return-editor-card > header small {
  margin-top: 2px;
  color: #9ca3af;
  font-size: 9px;
}
.return-editor-card > header button {
  border: 0;
  border-radius: 8px;
  padding: 6px 8px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 9px;
}
.return-editor-card > header button.active {
  background: #eff6ff;
  color: #2563eb;
}
.route-stop {
  position: relative;
  display: grid;
  grid-template-columns: 18px 1fr auto;
  align-items: center;
  gap: 7px;
  padding-top: 10px;
}
.route-stop::after {
  content: "";
  position: absolute;
  left: 8px;
  top: 33px;
  bottom: -18px;
  width: 1px;
  background: #d1d5db;
}
.route-stop > i {
  z-index: 1;
  width: 8px;
  height: 8px;
  justify-self: center;
  border-radius: 50%;
  background: #9ca3af;
  box-shadow: 0 0 0 3px #f9fafb;
}
.route-stop > i.origin-dot {
  background: #2563eb;
}
.route-stop > i.destination-dot {
  border-radius: 2px;
  background: #ef4444;
}
.route-stop > span:not(.stop-tools),
.route-stop small {
  display: block;
}
.route-stop small {
  margin-bottom: 4px;
  color: #9ca3af;
  font-size: 9px;
}
.route-stop input {
  min-height: 40px;
}
.stop-tools {
  display: flex;
  gap: 3px;
  padding-top: 14px;
}
.stop-tools button {
  border: 0;
  border-radius: 7px;
  padding: 5px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 9px;
}
.stop-tools button:disabled {
  opacity: 0.3;
}
.add-stop {
  margin: 10px 0 0 25px;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 11px;
  font-weight: 650;
}
.trip-list {
  border-top: 1px solid #f0f1f3;
}
.trip-list button {
  width: 100%;
  display: grid;
  grid-template-columns: 38px 1fr 16px;
  align-items: center;
  gap: 10px;
  border: 0;
  border-top: 1px solid #f0f1f3;
  padding: 11px 0;
  background: transparent;
  text-align: left;
}
.trip-list button:first-child {
  border-top: 0;
}
.trip-list-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f3f4f6;
  font-size: 18px;
}
.trip-list b,
.trip-list small {
  display: block;
}
.trip-list b {
  font-size: 12px;
}
.trip-list small {
  margin-top: 3px;
  color: #9ca3af;
  font-size: 10px;
}
.trip-list i {
  color: #9ca3af;
  font-style: normal;
}
.trip-dashed-action {
  width: 100%;
  margin-top: 9px;
  border: 1.5px dashed #bfdbfe;
  border-radius: 12px;
  padding: 11px;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 650;
}
.notes-card {
  display: block;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  background: #f9fafb;
}
.notes-card textarea {
  min-height: 90px;
  resize: vertical;
}
.trip-primary {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.15);
}
.trip-primary:disabled {
  opacity: 0.5;
}
@media (max-width: 370px) {
  .trip-two-cols,
  .route-options {
    grid-template-columns: 1fr;
  }
  .trip-type-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
