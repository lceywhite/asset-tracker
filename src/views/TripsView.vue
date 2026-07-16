<script setup>
import { ref, computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"
import TripForm from "@/components/trip/TripForm.vue"
const router = useRouter()
const store = useActivityStore()
const viewMode = ref("list")
const showForm = ref(false)
const selectedDate = ref("")
const year = ref(new Date().getFullYear())
const month = ref(new Date().getMonth() + 1)
function openCreateForm() {
  showForm.value = true
  selectedDate.value = ""
}

onMounted(() => store.loadAll())
const monthName = (m) =>
  ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"][m - 1]
const daysInMonth = computed(() => new Date(year.value, month.value, 0).getDate())
const firstDay = computed(() => new Date(year.value, month.value - 1, 1).getDay())
const today = new Date()

async function toggleStatus(a) {
  var ns = a.status === "completed" ? "active" : "completed"
  await store.update(a.id, { status: ns })
  await store.loadAll()
}
function prevMonth() {
  if (month.value === 1) {
    month.value = 12
    year.value--
  } else {
    month.value--
  }
}
function nextMonth() {
  if (month.value === 12) {
    month.value = 1
    year.value++
  } else {
    month.value++
  }
}

const activityMap = computed(() => {
  const m = {}
  for (const a of store.activities) {
    if (a.startDate) {
      if (!m[a.startDate]) m[a.startDate] = []
      m[a.startDate].push(a)
      if (a.endDate && a.endDate !== a.startDate) {
        if (!m[a.endDate]) m[a.endDate] = []
        m[a.endDate].push(a)
      }
    }
  }
  return m
})
const dayRange = computed(() => {
  const r = {}
  for (const a of store.activities) {
    if (!a.startDate) continue
    var s = new Date(a.startDate)
    var e = a.endDate ? new Date(a.endDate) : new Date(a.startDate)
    var d = new Date(s)
    while (d <= e) {
      if (d.getFullYear() === year.value && d.getMonth() + 1 === month.value) {
        var day = d.getDate()
        if (!r[day]) r[day] = []
        r[day].push({
          isStart: d.getTime() === s.getTime(),
          isEnd: d.getTime() === e.getTime() || a.startDate === a.endDate,
        })
      }
      d.setDate(d.getDate() + 1)
    }
  }
  return r
})
const daysWithActivities = computed(() => {
  const d = {}
  for (const dateStr of Object.keys(activityMap.value || {})) {
    if (dateStr.startsWith(year.value + "-" + String(month.value).padStart(2, "0"))) {
      d[parseInt(dateStr.split("-")[2])] = activityMap.value[dateStr]
    }
  }
  return d
})
const groupedByMonth = computed(() => {
  const g = {}
  for (const a of [...store.activities].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))) {
    const m = (a.startDate || "").substring(0, 7)
    if (!g[m]) g[m] = []
    g[m].push(a)
  }
  return g
})

function clickDay(day) {
  selectedDate.value = year.value + "-" + String(month.value).padStart(2, "0") + "-" + String(day).padStart(2, "0")
  showForm.value = true
}
async function handleCreated(trip) {
  showForm.value = false
  await store.loadAll()
  router.push("/plans/" + trip.id)
}
</script>
<template>
  <div class="flex flex-col h-full" style="background: var(--color-bg)">
    <div
      class="flex items-center justify-between px-4 py-3 bg-white border-b"
      style="border-color: var(--color-border)"
    >
      <button
        @click="viewMode = viewMode === 'calendar' ? 'list' : 'calendar'"
        class="text-xs font-medium px-3 py-1.5 rounded-lg"
        style="color: var(--brand-primary); background: var(--brand-primary-light)"
      >
        {{ viewMode === "calendar" ? "列表视图" : "日历视图" }}
      </button>
      <h1 class="text-base font-bold" style="color: var(--color-text-primary)">行程</h1>
      <button
        @click="openCreateForm"
        class="text-xs font-medium px-3 py-1.5 rounded-lg"
        style="color: white; background: var(--brand-primary)"
      >
        + 新建
      </button>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div v-if="viewMode === 'calendar'" class="p-4">
        <div class="flex items-center justify-between mb-4">
          <button
            @click="prevMonth"
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            style="color: var(--color-text-secondary); background: var(--color-surface)"
          >
            &larr;
          </button>
          <div class="text-base font-bold" style="color: var(--color-text-primary)">
            {{ year }}年 {{ monthName(month) }}
          </div>
          <button
            @click="nextMonth"
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            style="color: var(--color-text-secondary); background: var(--color-surface)"
          >
            &rarr;
          </button>
        </div>
        <div class="grid grid-cols-7 text-center mb-2">
          <div
            v-for="d in ['日', '一', '二', '三', '四', '五', '六']"
            :key="d"
            class="text-xs font-medium py-1"
            style="color: var(--color-text-tertiary)"
          >
            {{ d }}
          </div>
        </div>
        <div class="grid grid-cols-7 text-center">
          <div v-for="i in firstDay" :key="'e' + i"></div>
          <div
            v-for="day in daysInMonth"
            :key="day"
            @click="clickDay(day)"
            class="relative py-2 cursor-pointer hover:bg-white/50 rounded-lg transition-colors"
            :class="
              day === today.getDate() && month.value === today.getMonth() + 1 && year.value === today.getFullYear()
                ? 'font-bold'
                : ''
            "
            :style="
              day === today.getDate() && month.value === today.getMonth() + 1 && year.value === today.getFullYear()
                ? 'color:var(--brand-primary)'
                : 'color:var(--color-text-primary)'
            "
          >
            <span class="text-sm">{{ day }}</span>
            <div v-if="daysWithActivities[day]" class="flex justify-center gap-0.5 mt-0.5">
              <span
                v-for="n in Math.min(daysWithActivities[day].length, 3)"
                :key="n"
                class="w-1 h-1 rounded-full"
                style="background: var(--brand-primary)"
              ></span>
            </div>
          </div>
        </div>
        <div class="mt-4" v-if="daysWithActivities[today.getDate()]">
          <div class="text-xs font-semibold mb-2" style="color: var(--color-text-secondary)">今日活动</div>
          <div
            v-for="a in daysWithActivities[today.getDate()]"
            :key="a.id"
            @click="router.push('/plans/' + a.id)"
            class="flex items-center gap-3 p-3 bg-white rounded-xl mb-2 cursor-pointer"
            style="border: 1px solid var(--color-border-light)"
          >
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style="background: var(--brand-primary-light); color: var(--brand-primary)"
            >
              {{ a.type === "travel" ? "✈️" : a.type === "move" ? "📦" : "🚶" }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold truncate">{{ a.title }}</div>
              <div class="text-xs" style="color: var(--color-text-tertiary)">
                {{ a.startDate }}<span v-if="a.endDate !== a.startDate"> ~ {{ a.endDate }}</span>
              </div>
            </div>
            <span
              class="text-[10px] px-2 py-0.5 rounded-full"
              :style="
                a.status === 'completed'
                  ? 'background:var(--state-success-bg);color:var(--state-success)'
                  : a.status === 'active'
                    ? 'background:var(--brand-primary-light);color:var(--brand-primary)'
                    : 'background:var(--color-divider);color:var(--color-text-tertiary)'
              "
              >{{ a.status === "completed" ? "\u2713 \u5DF2\u5B8C\u6210" : "\u25CB \u5F85\u5B8C\u6210" }}</span
            >
          </div>
        </div>
      </div>
      <div v-if="viewMode === 'list'" class="p-4">
        <div
          v-if="Object.keys(groupedByMonth).length === 0"
          class="text-center py-12 text-sm"
          style="color: var(--color-text-tertiary)"
        >
          暂无行程
        </div>
        <div v-for="(group, ym) in groupedByMonth" :key="ym" class="mb-6">
          <div class="text-sm font-bold mb-3" style="color: var(--color-text-primary)">{{ ym }}</div>
          <div
            v-for="a in group"
            :key="a.id"
            @click="router.push('/plans/' + a.id)"
            class="flex items-center gap-3 p-4 bg-white rounded-xl mb-2 cursor-pointer"
            style="border: 1px solid var(--color-border-light)"
          >
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center text-sm"
              style="background: var(--brand-primary-light)"
            >
              {{ a.type === "travel" ? "✈️" : a.type === "move" ? "📦" : "🚶" }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold truncate" style="color: var(--color-text-primary)">{{ a.title }}</div>
              <div class="text-xs mt-0.5" style="color: var(--color-text-tertiary)">
                {{ a.startDate }}<span v-if="a.endDate !== a.startDate"> ~ {{ a.endDate }}</span>
              </div>
            </div>
            <span
              @click.stop="toggleStatus(a)"
              class="text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer select-none"
              :style="
                a.status === 'completed'
                  ? 'background:var(--state-success-bg);color:var(--state-success)'
                  : 'background:var(--color-divider);color:var(--color-text-tertiary)'
              "
              >{{ a.status === "completed" ? "✓ 已完成" : "○ 待完成" }}</span
            >
          </div>
        </div>
      </div>
    </div>
    <TripForm :show="showForm" :preset-date="selectedDate" @close="showForm = false" @created="handleCreated" />
  </div>
</template>
