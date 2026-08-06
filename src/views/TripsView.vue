<script setup>
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"
import { tripOccursOnDate } from "@/domain/tripModel"

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

const todayKey = dateKey(new Date())
const selectedDate = ref(todayKey)
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
    return [trip.title, trip.type, trip.origin, trip.destination, trip.transportMode]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery.value)
  }),
)
const visibleTrips = computed(() => {
  const source = normalizedQuery.value
    ? matchingTrips.value
    : matchingTrips.value.filter((trip) => tripOccursOnDate(trip, selectedDate.value))
  return [...source].sort((a, b) => (a.departureAt || "").localeCompare(b.departureAt || ""))
})
const upcomingTrips = computed(() => {
  if (normalizedQuery.value) return []
  const end = dateKey(addDays(parseDate(selectedDate.value), 7))
  return store.activities
    .filter((trip) => {
      const departure = (trip.departureAt || trip.startDate || "").slice(0, 10)
      return departure > selectedDate.value && departure <= end
    })
    .sort((a, b) => (a.departureAt || "").localeCompare(b.departureAt || ""))
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

onMounted(() => store.loadAll())

function hasTrip(date) {
  return store.activities.some((trip) => tripOccursOnDate(trip, date))
}

function selectDate(key) {
  selectedDate.value = key
  const date = parseDate(key)
  calendarMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
  calendarOpen.value = false
}

function changeMonth(amount) {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + amount, 1)
}

function timeText(trip) {
  const value = trip.departureAt || ""
  return value.includes("T") ? value.slice(11, 16) : "待定"
}

function dateText(value) {
  if (!value) return "时间待定"
  const date = new Date(value.length === 10 ? `${value}T00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })
}

function typeLabel(trip) {
  return typeMeta[trip.type]?.[0] || trip.type || "自定义"
}

function typeIcon(trip) {
  return typeMeta[trip.type]?.[1] || "⌁"
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

      <nav v-if="!normalizedQuery" class="week-strip" aria-label="本周日期">
        <button
          v-for="day in weekDays"
          :key="day.key"
          :class="{ active: selectedDate === day.key, marked: hasTrip(day.key) }"
          @click="selectDate(day.key)"
        >
          <small>{{ day.weekday }}</small
          ><strong>{{ day.date.getDate() }}</strong>
        </button>
      </nav>

      <section v-if="calendarOpen && !normalizedQuery" class="calendar-panel">
        <header>
          <button aria-label="上个月" @click="changeMonth(-1)">‹</button><b>{{ calendarTitle }}</b
          ><button aria-label="下个月" @click="changeMonth(1)">›</button>
        </header>
        <div class="calendar-weekdays">
          <span v-for="label in ['一', '二', '三', '四', '五', '六', '日']" :key="label">{{ label }}</span>
        </div>
        <div class="calendar-grid">
          <button
            v-for="cell in calendarCells"
            :key="cell.key"
            :class="{ muted: !cell.inMonth, active: selectedDate === cell.key, marked: hasTrip(cell.key) }"
            @click="selectDate(cell.key)"
          >
            {{ cell.date.getDate() }}
          </button>
        </div>
      </section>

      <section class="timeline">
        <article v-for="trip in visibleTrips" :key="trip.id" class="timeline-row">
          <span class="timeline-dot"></span>
          <div class="time-label">
            <strong>{{ timeText(trip) }}</strong
            ><span>{{ dateText(trip.departureAt) }}</span>
          </div>
          <button class="trip-card" @click="router.push(`/plans/${trip.id}`)">
            <div class="trip-card-head">
              <span class="trip-card-icon">{{ typeIcon(trip) }}</span>
              <span
                ><b>{{ trip.title }}</b
                ><small
                  >{{ trip.origin || "未设置起点" }} → {{ trip.destination || "未设置终点"
                  }}<template v-if="trip.transportMode"> · {{ trip.transportMode }}</template></small
                ></span
              >
              <em>{{ typeLabel(trip) }}</em>
            </div>
            <div class="trip-tags">
              <span>{{ trip.packingItems?.length || 0 }} 件物品</span>
              <span>{{ trip.containerRefs?.length || 0 }} 个移动容器</span>
              <span v-if="trip.packingItems?.some((entry) => entry.starred)" class="warm"
                >{{ trip.packingItems.filter((entry) => entry.starred).length }} 项星标</span
              >
            </div>
          </button>
        </article>
        <div v-if="!visibleTrips.length" class="empty-day">
          <span>⌁</span><b>{{ normalizedQuery ? "没有匹配的行程" : "这一天还没有行程" }}</b
          ><small>{{ normalizedQuery ? "换一个名称、地点或类型试试" : "需要带物品出门时，可以在这里建立档案" }}</small>
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
                >{{ dateText(trip.departureAt) }} · {{ trip.tripMode === "round_trip" ? "往返" : "单程" }} ·
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
  background: #f7f5ef;
  color: #28251f;
}
.trip-home-tools {
  flex: none;
  display: grid;
  grid-template-columns: 1fr 44px;
  gap: 10px;
  padding: max(14px, env(safe-area-inset-top)) 14px 10px;
  background: rgba(247, 245, 239, 0.97);
}
.trip-home-tools label {
  min-height: 44px;
  display: grid;
  grid-template-columns: 24px 1fr;
  align-items: center;
  padding: 0 12px;
  border: 1px solid #dfdbd2;
  border-radius: 15px;
  background: #fff;
  color: #99958d;
}
.trip-home-tools input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
}
.trip-home-tools > button {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 15px;
  background: #1b8b80;
  color: #fff;
  font-size: 25px;
  box-shadow: 0 7px 16px rgba(27, 139, 128, 0.18);
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
  color: #77736b;
  font-size: 11px;
  font-weight: 700;
}
.calendar-reveal small {
  color: #aaa69e;
}
.week-strip {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  margin-bottom: 14px;
}
.week-strip button {
  position: relative;
  min-height: 58px;
  border: 0;
  border-radius: 15px;
  background: transparent;
  color: #77736b;
}
.week-strip small,
.week-strip strong {
  display: block;
}
.week-strip small {
  font-size: 10px;
  font-weight: 600;
}
.week-strip strong {
  margin-top: 5px;
  font-size: 16px;
}
.week-strip button.marked::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 6px;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: #1b8b80;
}
.week-strip button.active {
  background: #1b8b80;
  color: #fff;
  box-shadow: 0 7px 16px rgba(27, 139, 128, 0.16);
}
.week-strip button.active::after {
  background: #fff;
}
.calendar-panel {
  margin: -4px 0 16px;
  padding: 13px;
  border: 1px solid #e5e1d8;
  border-radius: 18px;
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
  color: #197b72;
  font-size: 22px;
}
.calendar-panel > header b {
  font-size: 13px;
}
.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}
.calendar-weekdays {
  margin-top: 8px;
  color: #aaa69e;
  font-size: 9px;
}
.calendar-grid button {
  position: relative;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #49463f;
  font-size: 11px;
}
.calendar-grid button.muted {
  color: #cbc7bf;
}
.calendar-grid button.marked::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 3px;
  width: 3px;
  height: 3px;
  margin-left: -1.5px;
  border-radius: 50%;
  background: #1b8b80;
}
.calendar-grid button.active {
  background: #1b8b80;
  color: #fff;
  font-weight: 700;
}
.calendar-grid button.active::after {
  background: #fff;
}
.timeline {
  position: relative;
}
.timeline-row {
  position: relative;
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 12px;
  padding-bottom: 13px;
}
.timeline-row::before {
  content: "";
  position: absolute;
  left: 63px;
  top: 18px;
  bottom: -8px;
  width: 1px;
  background: #ddd8cf;
}
.timeline-row:last-child::before {
  display: none;
}
.timeline-dot {
  position: absolute;
  z-index: 1;
  left: 59px;
  top: 12px;
  width: 9px;
  height: 9px;
  border: 2px solid #f7f5ef;
  border-radius: 50%;
  background: #1b8b80;
  box-shadow: 0 0 0 1px #1b8b80;
}
.time-label {
  padding-top: 4px;
  text-align: right;
}
.time-label strong,
.time-label span {
  display: block;
}
.time-label strong {
  font-size: 12px;
}
.time-label span {
  margin-top: 3px;
  color: #aaa69e;
  font-size: 9px;
}
.trip-card {
  width: 100%;
  border: 1px solid #e3dfd6;
  border-radius: 19px;
  padding: 14px;
  background: #fff;
  text-align: left;
  box-shadow: 0 3px 12px rgba(54, 50, 40, 0.035);
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
  background: #e7f3f1;
}
.trip-card-head b,
.trip-card-head small {
  display: block;
}
.trip-card-head b {
  font-size: 14px;
}
.trip-card-head small {
  margin-top: 4px;
  color: #87837b;
  font-size: 10px;
  line-height: 1.5;
}
.trip-card-head em {
  padding: 4px 7px;
  border-radius: 8px;
  background: #e7f3f1;
  color: #23786f;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
}
.trip-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 11px;
  padding-left: 47px;
}
.trip-tags span {
  padding: 4px 7px;
  border-radius: 8px;
  background: #f1efe9;
  color: #7d7971;
  font-size: 9px;
}
.trip-tags span.warm {
  background: #f8ebda;
  color: #9a6425;
}
.empty-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 34px 20px;
  border: 1px dashed #d9d4ca;
  border-radius: 19px;
  text-align: center;
}
.empty-day > span {
  font-size: 28px;
  color: #9bbdb8;
}
.empty-day b {
  margin-top: 9px;
  font-size: 13px;
}
.empty-day small {
  margin-top: 5px;
  color: #99958d;
  font-size: 10px;
}
.empty-day button {
  margin-top: 14px;
  border: 0;
  border-radius: 11px;
  padding: 9px 14px;
  background: #e7f3f1;
  color: #197b72;
  font-size: 11px;
  font-weight: 700;
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
  color: #99958d;
  font-size: 10px;
}
.upcoming-card {
  overflow: hidden;
  border: 1px solid #e3dfd6;
  border-radius: 19px;
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
  border-top: 1px solid #eeeae2;
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
  background: #f0ece4;
}
.upcoming-card b,
.upcoming-card small {
  display: block;
}
.upcoming-card b {
  font-size: 13px;
}
.upcoming-card small {
  margin-top: 3px;
  color: #99958d;
  font-size: 10px;
}
.upcoming-card i {
  color: #aaa69e;
  font-style: normal;
}
</style>
