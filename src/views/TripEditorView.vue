<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"

const route = useRoute()
const router = useRouter()
const store = useActivityStore()
const saving = ref(false)
const error = ref("")
const editingId = ref(route.params.id || "")

const typeOptions = [
  { value: "commute", label: "通勤", icon: "🚇" },
  { value: "daily", label: "日常外出", icon: "🚶" },
  { value: "travel", label: "旅行", icon: "🧳" },
  { value: "move", label: "搬家", icon: "📦" },
  { value: "custom", label: "自定义", icon: "＋" },
]
const transportOptions = ["步行", "骑行", "地铁 / 公共交通", "驾车", "火车 / 飞机", "搬运车辆", "其他"]

function localDateTime(date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const defaultDeparture = new Date()
defaultDeparture.setMinutes(0, 0, 0)
defaultDeparture.setHours(defaultDeparture.getHours() + 1)
const defaultReturn = new Date(defaultDeparture)
defaultReturn.setHours(defaultReturn.getHours() + 9)

const form = reactive({
  title: "",
  type: "commute",
  customTypeName: "",
  tripMode: "round_trip",
  departureAt: route.query.date ? `${route.query.date}T08:00` : localDateTime(defaultDeparture),
  returnAt: route.query.date ? `${route.query.date}T18:00` : localDateTime(defaultReturn),
  origin: "",
  destination: "",
  transportMode: "地铁 / 公共交通",
  containerRefs: [],
  packingItems: [],
  notes: "",
  infoCards: [],
  status: "draft",
})

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
const totalItems = computed(() => form.packingItems.length)
const totalStarred = computed(() => form.packingItems.filter((entry) => entry.starred).length)

function hydrate(trip) {
  for (const key of Object.keys(form)) {
    if (trip[key] !== undefined) form[key] = Array.isArray(trip[key]) ? [...trip[key]] : trip[key]
  }
  if (!typeOptions.some((option) => option.value === form.type)) {
    form.customTypeName = trip.customTypeName || form.type
    form.type = "custom"
  }
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

function payload(status = form.status) {
  return {
    ...form,
    type: form.type === "custom" ? form.customTypeName.trim() || "custom" : form.type,
    returnAt: form.tripMode === "round_trip" ? form.returnAt : "",
    status,
  }
}

function validate() {
  if (!form.title.trim()) return "请填写行程名称"
  if (form.type === "custom" && !form.customTypeName.trim()) return "请填写自定义类型"
  if (!form.departureAt) return "请选择出发时间"
  if (form.tripMode === "round_trip" && !form.returnAt) return "请选择返程时间"
  if (form.tripMode === "round_trip" && form.returnAt < form.departureAt) return "返程时间不能早于出发时间"
  return ""
}

async function persist(status) {
  error.value = validate()
  if (error.value) return null
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
  const trip = await persist("planned")
  if (trip) router.replace(`/plans/${trip.id}`)
}

async function openCarryList() {
  const trip = await persist(form.status === "draft" ? "draft" : "planned")
  if (!trip) return
  const returnPath = `/plans/${trip.id}/edit`
  if (route.path !== returnPath) await router.replace(returnPath)
  router.push({ path: `/plans/${trip.id}/carry`, query: { return: returnPath } })
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push(editingId.value ? `/plans/${editingId.value}` : "/plans")
}
</script>

<template>
  <div class="trip-page">
    <header class="trip-topbar">
      <button class="trip-back" aria-label="返回" @click="goBack">‹</button>
      <h1>{{ editingId ? "编辑行程" : "新建行程" }}</h1>
      <button class="trip-link" :disabled="saving" @click="saveDraft">存草稿</button>
    </header>

    <main class="trip-scroll">
      <p v-if="error" class="trip-error">{{ error }}</p>

      <section class="trip-card">
        <h2>基本信息</h2>
        <label class="trip-field">
          <span>行程名称</span>
          <input v-model="form.title" placeholder="例如：工作日通勤" />
        </label>
        <div class="trip-field">
          <span>类型</span>
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
        </div>
        <label v-if="form.type === 'custom'" class="trip-field">
          <span>自定义类型名称</span>
          <input v-model="form.customTypeName" placeholder="例如：露营、探亲" />
        </label>
      </section>

      <section class="trip-card">
        <h2>行程信息</h2>
        <div class="trip-segment">
          <button type="button" :class="{ active: form.tripMode === 'one_way' }" @click="form.tripMode = 'one_way'">
            单程
          </button>
          <button
            type="button"
            :class="{ active: form.tripMode === 'round_trip' }"
            @click="form.tripMode = 'round_trip'"
          >
            往返
          </button>
        </div>
        <div class="trip-two-cols">
          <label class="trip-field">
            <span>出发时间</span>
            <input v-model="form.departureAt" type="datetime-local" />
          </label>
          <label v-if="form.tripMode === 'round_trip'" class="trip-field">
            <span>返程时间</span>
            <input v-model="form.returnAt" type="datetime-local" />
          </label>
        </div>
        <div class="trip-two-cols">
          <label class="trip-field">
            <span>出发地点</span>
            <input v-model="form.origin" placeholder="从哪里出发" />
          </label>
          <label class="trip-field">
            <span>到达地点</span>
            <input v-model="form.destination" placeholder="要去哪里" />
          </label>
        </div>
        <label class="trip-field">
          <span>出行方式</span>
          <select v-model="form.transportMode">
            <option v-for="option in transportOptions" :key="option">{{ option }}</option>
          </select>
        </label>
      </section>

      <section class="trip-card">
        <div class="trip-section-head">
          <h2>携带物品清单</h2>
          <span v-if="totalItems">{{ totalItems }} 项 · {{ totalStarred }} 项星标</span>
        </div>
        <div v-if="containerSummaries.length" class="trip-list">
          <button v-for="container in containerSummaries" :key="container.containerId" @click="openCarryList">
            <span class="trip-list-icon">{{ container.iconSnapshot || "🎒" }}</span>
            <span
              ><b>{{ container.nameSnapshot }}</b
              ><small>{{ container.itemCount }} 项 · {{ container.starredCount }} 项星标</small></span
            >
            <i>›</i>
          </button>
        </div>
        <button class="trip-list-action" type="button" @click="openCarryList">
          <span class="trip-list-icon">＋</span>
          <span><b>添加物品</b><small>添加移动容器，并在容器内选择物品</small></span>
          <i>›</i>
        </button>
      </section>

      <section class="trip-card">
        <h2>通用信息</h2>
        <label class="trip-field">
          <span>备注</span>
          <textarea v-model="form.notes" rows="4" placeholder="记录需要特别留意的事项"></textarea>
        </label>
      </section>

      <button class="trip-primary" :disabled="saving" @click="saveTrip">
        {{ saving ? "正在保存…" : "保存行程档案" }}
      </button>
    </main>
  </div>
</template>

<style scoped>
.trip-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7f5ef;
}
.trip-topbar {
  flex: none;
  min-height: 58px;
  padding: max(10px, env(safe-area-inset-top)) 16px 10px;
  display: grid;
  grid-template-columns: 42px 1fr 58px;
  align-items: end;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid #e8e4db;
}
.trip-topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 750;
}
.trip-back,
.trip-link {
  border: 0;
  background: transparent;
  color: #197b72;
}
.trip-back {
  font-size: 30px;
  line-height: 30px;
  text-align: left;
}
.trip-link {
  font-size: 13px;
  font-weight: 700;
  text-align: right;
}
.trip-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px max(28px, env(safe-area-inset-bottom));
}
.trip-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fdecec;
  color: #b83333;
  font-size: 12px;
}
.trip-card {
  margin-bottom: 12px;
  padding: 16px;
  border: 1px solid #e5e1d8;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(54, 50, 40, 0.025);
}
.trip-card h2 {
  margin: 0 0 14px;
  font-size: 15px;
}
.trip-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.trip-section-head span {
  color: #9a968d;
  font-size: 11px;
}
.trip-field {
  display: block;
  margin-top: 13px;
}
.trip-field > span {
  display: block;
  margin-bottom: 6px;
  color: #77736b;
  font-size: 11px;
  font-weight: 650;
}
.trip-field input,
.trip-field select,
.trip-field textarea {
  width: 100%;
  min-height: 45px;
  border: 1px solid #dedad1;
  border-radius: 13px;
  padding: 10px 12px;
  background: #fbfaf7;
  font-size: 14px;
  outline: none;
}
.trip-field input:focus,
.trip-field select:focus,
.trip-field textarea:focus {
  border-color: #1c8b80;
  box-shadow: 0 0 0 3px rgba(28, 139, 128, 0.09);
}
.trip-field textarea {
  resize: vertical;
}
.trip-type-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}
.trip-type-grid button {
  min-height: 62px;
  padding: 6px 2px;
  border: 1px solid #e5e1d8;
  border-radius: 13px;
  background: #fbfaf7;
  color: #68645d;
  font-size: 10px;
}
.trip-type-grid button b {
  display: block;
  margin-bottom: 3px;
  font-size: 20px;
}
.trip-type-grid button.active {
  border-color: #1c8b80;
  background: #e8f5f2;
  color: #176f67;
  font-weight: 700;
}
.trip-segment {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 3px;
  border-radius: 12px;
  background: #f0eee8;
}
.trip-segment button {
  border: 0;
  border-radius: 10px;
  padding: 9px;
  background: transparent;
  color: #77736b;
  font-size: 12px;
}
.trip-segment button.active {
  background: #fff;
  color: #176f67;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.trip-two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.trip-list {
  border-top: 1px solid #eeeae2;
}
.trip-list button,
.trip-list-action {
  width: 100%;
  display: grid;
  grid-template-columns: 38px 1fr 16px;
  align-items: center;
  gap: 10px;
  border: 0;
  border-top: 1px solid #eeeae2;
  padding: 12px 0;
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
  background: #f4eee5;
  font-size: 19px;
}
.trip-list b,
.trip-list small {
  display: block;
}
.trip-list b {
  font-size: 13px;
}
.trip-list small {
  margin-top: 3px;
  color: #99958d;
  font-size: 10px;
}
.trip-list i,
.trip-list-action i {
  color: #b2aea6;
  font-style: normal;
}
.trip-primary {
  width: 100%;
  min-height: 50px;
  border: 0;
  border-radius: 16px;
  background: #1b8b80;
  color: #fff;
  font-size: 14px;
  font-weight: 750;
  box-shadow: 0 8px 18px rgba(27, 139, 128, 0.18);
}
.trip-primary:disabled {
  opacity: 0.55;
}
@media (max-width: 370px) {
  .trip-two-cols {
    grid-template-columns: 1fr;
  }
  .trip-type-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
