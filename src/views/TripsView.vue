<script setup>
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"
import { getTripEndAt, getTripLegs, getTripStartAt, tripOccursOnDate } from "@/domain/tripModel"

const router = useRouter()
const store = useActivityStore()
const query = ref("")
const calendarOpen = ref(false)

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date, amount) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function mondayOf(date) {
  const result = new Date(date)
  const weekday = result.getDay() || 7
  result.setDate(result.getDate() - weekday + 1)
  result.setHours(0, 0, 0, 0)
  return result
}

const selectedDate = ref(dateKey(new Date()))
const calendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const weekDays = computed(() => {
  const monday = mondayOf(parseDate(selectedDate.value))
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index)
    return { key: dateKey(date), date, weekday: "一二三四五六日"[index] }
  })
})
const weekLabel = computed(() => {
  const first = weekDays.value[0].date
  const last = weekDays.value[6].date
  return `本周 · ${first.getMonth() + 1}月${first.getDate()}日—${last.getMonth() + 1}月${last.getDate()}日`
})
const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const matchingTrips = computed(() =>
  store.activities.filter((trip) => {
    if (!normalizedQuery.value) return true
    const legs = getTripLegs(trip)
    return [
      trip.title,
      trip.type,
      ...legs.flatMap((leg) => [
        leg.origin,
        leg.destination,
        leg.transportMode,
        ...(leg.stops || []).map((stop) => stop.name),
      ]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery.value)
  }),
)
const visibleTrips = computed(() => {
  const source = normalizedQuery.value
    ? matchingTrips.value
    : matchingTrips.value.filter((trip) => tripOccursOnDate(trip, selectedDate.value))
  return [...source].sort((a, b) => getTripStartAt(a).localeCompare(getTripStartAt(b)))
})
const upcomingTrips = computed(() => {
  if (normalizedQuery.value) return []
  const end = dateKey(addDays(parseDate(selectedDate.value), 7))
  return store.activities
    .filter((trip) => {
      const start = getTripStartAt(trip).slice(0, 10)
      return start > selectedDate.value && start <= end
    })
    .sort((a, b) => getTripStartAt(a).localeCompare(getTripStartAt(b)))
})
const calendarTitle = computed(() =>
  calendarMonth.value.toLocaleDateString("zh-CN", { year: "numeric", month: "long" }),
)
const calendarCells = computed(() => {
  const year = calendarMonth.value.getFullYear()
  const month = calendarMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const leading = (first.getDay() + 6) % 7
  const start = addDays(first, -leading)
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index)
    return { key: dateKey(date), date, inMonth: date.getMonth() === month }
  })
})

const typeMeta = {
  commute: ["通勤", "🚇"],
  daily: ["日常外出", "🚶"],
  daily_carry: ["日常外出", "🚶"],
  travel: ["旅行", "🧳"],
  move: ["搬家", "📦"],
  custom: ["自定义", "⌁"],
}
const rangePalette = [
  { background: "#2563eb", soft: "#dbeafe" },
  { background: "#0f9f7f", soft: "#d1fae5" },
  { background: "#7c3aed", soft: "#ede9fe" },
  { background: "#e06b3c", soft: "#ffedd5" },
  { background: "#0891b2", soft: "#cffafe" },
  { background: "#db2777", soft: "#fce7f3" },
]

onMounted(() => store.loadAll())

function rangeSegments(trips, days) {
  if (!days.length) return []
  const rangeStart = days[0].key
  const rangeEnd = days.at(-1).key
  const segments = []
  for (const trip of trips) {
    const start = getTripStartAt(trip).slice(0, 10)
    const end = getTripEndAt(trip).slice(0, 10) || start
    if (!start || end < rangeStart || start > rangeEnd) continue
    const colors = rangeColor(trip)
    const firstIndex = Math.max(
      0,
      days.findIndex((day) => day.key >= start),
    )
    let lastIndex = days.findLastIndex((day) => day.key <= end)
    if (lastIndex < 0) lastIndex = days.length - 1
    let cursor = firstIndex
    while (cursor <= lastIndex) {
      const row = Math.floor(cursor / 7)
      const rowEnd = Math.min(lastIndex, row * 7 + 6)
      segments.push({
        id: `${trip.id}-${row}`,
        tripId: trip.id,
        title: trip.title,
        background: colors.background,
        soft: colors.soft,
        row,
        startColumn: (cursor % 7) + 1,
        endColumn: (rowEnd % 7) + 2,
        startsHere: days[cursor].key === start,
        endsHere: days[rowEnd].key === end,
      })
      cursor = rowEnd + 1
    }
  }
  const rowLanes = new Map()
  return segments.map((segment) => {
    const lanes = rowLanes.get(segment.row) || []
    let lane = lanes.findIndex((endColumn) => endColumn <= segment.startColumn)
    if (lane < 0) lane = lanes.length
    lanes[lane] = segment.endColumn
    rowLanes.set(segment.row, lanes)
    return { ...segment, lane }
  })
}

function rangeColor(trip) {
  const seed = String(trip.id || trip.title || trip.type || "trip")
  const index = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0) % rangePalette.length
  return rangePalette[index]
}

const calendarSegments = computed(() => rangeSegments(store.activities, calendarCells.value))
const calendarRowHeights = computed(() =>
  Array.from({ length: 6 }, (_, row) => {
    const maxLane = Math.max(
      -1,
      ...calendarSegments.value.filter((segment) => segment.row === row).map((segment) => segment.lane),
    )
    return 38 + (maxLane + 1) * 17
  }),
)

function hasTrip(date) {
  return store.activities.some((trip) => tripOccursOnDate(trip, date))
}

function selectDate(key) {
  selectedDate.value = key
  const date = parseDate(key)
  calendarMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
}

function changeMonth(amount) {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + amount, 1)
}

function dateTimeParts(value) {
  if (!value) return { date: "待定", time: "" }
  const date = new Date(value.length === 10 ? `${value}T00:00` : value)
  if (Number.isNaN(date.getTime())) return { date: value, time: "" }
  return {
    date: date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
    time: value.includes("T") ? value.slice(11, 16) : "",
  }
}

function typeLabel(trip) {
  return typeMeta[trip.type]?.[0] || trip.type || "自定义"
}

function typeIcon(trip) {
  return typeMeta[trip.type]?.[1] || "⌁"
}

function outboundLeg(trip) {
  const legs = getTripLegs(trip)
  return legs.find((leg) => leg.direction === "outbound") || legs[0] || null
}

function routeText(trip) {
  const leg = outboundLeg(trip)
  if (!leg) return "路线待完善"
  return [leg.origin, ...(leg.stops || []).map((stop) => stop.name), leg.destination].filter(Boolean).join(" → ")
}

function createTrip() {
  router.push({ path: "/plans/new", query: { date: selectedDate.value } })
}
</script>

<template>
  <div class="trips-page">
    <header class="trip-home-tools">
      <label
        ><span>⌕</span
        ><input v-model="query" type="search" placeholder="搜索行程、地点或类型" aria-label="搜索行程、地点或类型"
      /></label>
      <button aria-label="新建行程" @click="createTrip">＋</button>
    </header>

    <main class="trips-scroll">
      <button class="calendar-reveal" :aria-expanded="calendarOpen" @click="calendarOpen = !calendarOpen">
        <span>{{ normalizedQuery ? "搜索结果" : weekLabel }}</span
        ><small>{{ calendarOpen ? "⌃" : "⌄" }}</small>
      </button>

      <template v-if="!normalizedQuery">
        <nav class="week-strip" aria-label="本周日期">
          <button
            v-for="day in weekDays"
            :key="day.key"
            :class="{ active: selectedDate === day.key, marked: hasTrip(day.key) }"
            @click="selectDate(day.key)"
          >
            <small>{{ day.weekday }}</small
            ><strong>{{ day.date.getDate() }}</strong
            ><i v-if="hasTrip(day.key)" class="trip-dot" aria-hidden="true"></i>
          </button>
        </nav>
      </template>

      <section v-if="calendarOpen && !normalizedQuery" class="calendar-panel">
        <header>
          <button aria-label="上个月" @click="changeMonth(-1)">‹</button><b>{{ calendarTitle }}</b
          ><button aria-label="下个月" @click="changeMonth(1)">›</button>
        </header>
        <div class="calendar-weekdays">
          <span v-for="label in ['一', '二', '三', '四', '五', '六', '日']" :key="label">{{ label }}</span>
        </div>
        <div
          class="calendar-grid"
          :style="{ gridTemplateRows: calendarRowHeights.map((height) => `${height}px`).join(' ') }"
        >
          <button
            v-for="(cell, index) in calendarCells"
            :key="cell.key"
            :style="{ gridColumn: (index % 7) + 1, gridRow: Math.floor(index / 7) + 1 }"
            :class="{ muted: !cell.inMonth, active: selectedDate === cell.key, marked: hasTrip(cell.key) }"
            @click="selectDate(cell.key)"
          >
            {{ cell.date.getDate() }}
          </button>
          <button
            v-for="segment in calendarSegments"
            :key="segment.id"
            type="button"
            class="calendar-range"
            :style="{
              gridColumn: `${segment.startColumn} / ${segment.endColumn}`,
              gridRow: segment.row + 1,
              '--range-lane': segment.lane,
              '--range-color': segment.background,
            }"
            :class="{ start: segment.startsHere, end: segment.endsHere }"
            :aria-label="segment.title"
            @click.stop="router.push(`/plans/${segment.tripId}`)"
          >
            <span>{{ segment.title }}</span>
          </button>
        </div>
      </section>

      <section class="timeline">
        <article v-for="trip in visibleTrips" :key="trip.id" class="timeline-row">
          <div class="time-range" :style="{ '--timeline-color': rangeColor(trip).background }">
            <span class="time-point start">
              <b>{{ dateTimeParts(getTripStartAt(trip)).date }}</b>
              <time>{{ dateTimeParts(getTripStartAt(trip)).time }}</time>
            </span>
            <i class="time-track"></i>
            <span class="time-point end">
              <b>{{ trip.endTimePending ? "待补充" : dateTimeParts(getTripEndAt(trip)).date }}</b>
              <time>{{ trip.endTimePending ? "结束时间" : dateTimeParts(getTripEndAt(trip)).time }}</time>
            </span>
          </div>
          <button class="trip-card" @click="router.push(`/plans/${trip.id}`)">
            <div class="trip-card-head">
              <span class="trip-card-icon">{{ typeIcon(trip) }}</span>
              <span
                ><b>{{ trip.title }}</b
                ><small
                  >{{ routeText(trip)
                  }}<template v-if="outboundLeg(trip)?.transportMode">
                    · {{ outboundLeg(trip).transportMode }}</template
                  ></small
                ></span
              >
              <em>{{ typeLabel(trip) }}</em>
            </div>
            <div class="trip-tags">
              <span
                >结束
                {{
                  trip.endTimePending
                    ? "待补充"
                    : `${dateTimeParts(getTripEndAt(trip)).date} ${dateTimeParts(getTripEndAt(trip)).time}`
                }}</span
              >
              <span>{{ trip.packingItems?.length || 0 }} 件物品</span>
              <span>{{ trip.containerRefs?.length || 0 }} 个移动容器</span>
              <span v-if="trip.packingItems?.some((entry) => entry.starred)" class="warm"
                >{{ trip.packingItems.filter((entry) => entry.starred).length }} 项星标</span
              >
            </div>
          </button>
        </article>
        <div v-if="!visibleTrips.length" class="empty-day">
          <span>⌁</span><b>{{ normalizedQuery ? "没有匹配的行程" : "这一天还没有行程" }}</b>
          <small>{{ normalizedQuery ? "换一个名称、地点或类型试试" : "需要带物品出门时，可以在这里建立档案" }}</small>
          <button v-if="!normalizedQuery" @click="createTrip">新建行程</button>
        </div>
      </section>

      <template v-if="upcomingTrips.length">
        <div class="next-heading">
          <h2>接下来</h2>
          <span>未来 7 天</span>
        </div>
        <section class="upcoming-card">
          <button v-for="trip in upcomingTrips" :key="trip.id" @click="router.push(`/plans/${trip.id}`)">
            <span>{{ typeIcon(trip) }}</span
            ><span
              ><b>{{ trip.title }}</b
              ><small
                >{{ dateTimeParts(getTripStartAt(trip)).date }} ·
                {{ trip.journeyType === "round_trip" ? "往返" : "单程" }} ·
                {{ trip.containerRefs?.length || 0 }} 个移动容器</small
              ></span
            ><i>›</i>
          </button>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.trips-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f6f5f1;
  color: #111827;
}
.trip-home-tools {
  flex: none;
  display: grid;
  grid-template-columns: 1fr 40px;
  gap: 10px;
  padding: max(14px, env(safe-area-inset-top)) 14px 10px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}
.trip-home-tools label {
  min-height: 40px;
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  border-radius: 12px;
  padding: 0 12px;
  background: #f3f4f6;
  color: #9ca3af;
}
.trip-home-tools input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
}
.trip-home-tools > button {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  font-size: 23px;
}
.trips-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px 28px;
}
.calendar-reveal {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  padding: 9px 2px 8px;
  background: transparent;
  color: #6b7280;
  font-size: 11px;
  font-weight: 650;
}
.calendar-reveal small {
  color: #9ca3af;
}
.week-strip {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 14px;
}
.week-strip button {
  position: relative;
  min-height: 54px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #6b7280;
}
.week-strip small,
.week-strip strong {
  display: block;
}
.week-strip small {
  font-size: 9px;
}
.week-strip strong {
  margin-top: 4px;
  font-size: 15px;
}
.week-strip button.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 700;
}
.week-strip .trip-dot {
  position: absolute;
  left: 50%;
  bottom: 4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #2563eb;
  transform: translateX(-50%);
}
.week-strip button.active .trip-dot {
  background: #1d4ed8;
}
.calendar-panel {
  margin: -4px 0 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 13px;
  background: #fff;
}
.calendar-panel > header {
  display: grid;
  grid-template-columns: 34px 1fr 34px;
  align-items: center;
  text-align: center;
}
.calendar-panel > header button {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 21px;
}
.calendar-panel > header b {
  font-size: 12px;
}
.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}
.calendar-weekdays {
  margin-top: 8px;
  color: #9ca3af;
  font-size: 9px;
}
.calendar-grid button {
  z-index: 1;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #374151;
  font-size: 11px;
}
.calendar-grid > button:not(.calendar-range) {
  align-self: start;
  height: 34px;
}
.calendar-grid button.muted {
  color: #d1d5db;
}
.calendar-grid button.marked {
  font-weight: 650;
}
.calendar-grid button.active {
  background: #eff6ff;
  color: #2563eb;
}
.calendar-grid > .calendar-range {
  z-index: 3;
  align-self: end;
  min-width: 0;
  height: 15px;
  margin: 0 1px calc(3px + var(--range-lane) * 17px);
  overflow: hidden;
  padding: 0 5px;
  background: var(--range-color);
  color: #fff;
  text-align: left;
  white-space: nowrap;
}
.calendar-grid > .calendar-range span {
  display: block;
  overflow: hidden;
  font-size: 8px;
  font-weight: 700;
  line-height: 15px;
  text-overflow: ellipsis;
}
.calendar-grid > .calendar-range.start {
  border-radius: 999px 0 0 999px;
}
.calendar-grid > .calendar-range.end {
  border-radius: 0 999px 999px 0;
}
.calendar-grid > .calendar-range.start.end {
  border-radius: 999px;
}
.timeline-row {
  display: grid;
  grid-template-columns: 50px 1fr;
  gap: 10px;
  margin-bottom: 12px;
}
.time-range {
  min-height: 132px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: stretch;
  padding: 10px 0;
  color: #6b7280;
}
.time-point {
  position: relative;
  display: grid;
  justify-items: end;
  padding-right: 13px;
}
.time-point::after {
  position: absolute;
  top: 50%;
  right: 0;
  width: 8px;
  height: 8px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--timeline-color);
  box-shadow: 0 0 0 1px var(--timeline-color);
  content: "";
  transform: translateY(-50%);
}
.time-point.end::after {
  background: #8b5cf6;
  box-shadow: 0 0 0 1px #8b5cf6;
}
.time-point b,
.time-point time {
  font-size: 9px;
  font-weight: 600;
}
.time-track {
  flex: 1;
  width: 2px;
  min-height: 28px;
  margin: 8px 3px 8px 0;
  border-radius: 999px;
  background: repeating-linear-gradient(
    to bottom,
    var(--timeline-color) 0,
    var(--timeline-color) 4px,
    #8b5cf6 4px,
    #8b5cf6 7px,
    transparent 7px,
    transparent 10px
  );
}
.trip-card {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 13px;
  background: #fff;
  color: #111827;
  text-align: left;
}
.trip-card-head {
  display: grid;
  grid-template-columns: 38px 1fr auto;
  align-items: start;
  gap: 9px;
}
.trip-card-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #eff6ff;
}
.trip-card-head b,
.trip-card-head small {
  display: block;
}
.trip-card-head b {
  font-size: 13px;
}
.trip-card-head small {
  margin-top: 4px;
  color: #6b7280;
  font-size: 9px;
  line-height: 1.5;
}
.trip-card-head em {
  border-radius: 8px;
  padding: 4px 7px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 9px;
  font-style: normal;
  font-weight: 650;
}
.trip-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 11px;
  padding-left: 47px;
}
.trip-tags span {
  border-radius: 7px;
  padding: 4px 7px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 9px;
}
.trip-tags span.warm {
  background: #fff7ed;
  color: #b45309;
}
.empty-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1.5px dashed #d1d5db;
  border-radius: 16px;
  padding: 32px 20px;
  text-align: center;
}
.empty-day > span {
  color: #93c5fd;
  font-size: 27px;
}
.empty-day b {
  margin-top: 8px;
  font-size: 13px;
}
.empty-day small {
  margin-top: 5px;
  color: #9ca3af;
  font-size: 10px;
}
.empty-day button {
  margin-top: 13px;
  border: 0;
  border-radius: 10px;
  padding: 9px 13px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 650;
}
.next-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 2px 8px;
}
.next-heading h2 {
  margin: 0;
  font-size: 15px;
}
.next-heading span {
  color: #9ca3af;
  font-size: 10px;
}
.upcoming-card {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
}
.upcoming-card button {
  width: 100%;
  min-height: 60px;
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 10px;
  border: 0;
  border-top: 1px solid #f0f1f3;
  padding: 10px 13px;
  background: #fff;
  text-align: left;
}
.upcoming-card button:first-child {
  border-top: 0;
}
.upcoming-card button > span:first-child {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f3f4f6;
}
.upcoming-card b,
.upcoming-card small {
  display: block;
}
.upcoming-card b {
  font-size: 12px;
}
.upcoming-card small {
  margin-top: 3px;
  color: #9ca3af;
  font-size: 10px;
}
.upcoming-card i {
  color: #9ca3af;
  font-style: normal;
}
</style>
