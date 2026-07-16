<script setup>
const props = defineProps({
  show: Boolean,
  presetDate: { type: String, default: "" },
  editTrip: { type: Object, default: null },
})
import { ref, reactive, computed, onMounted, watch } from "vue"
import { useActivityStore } from "@/stores/useActivityStore"
import { useItemStore } from "@/stores/useItemStore"
import * as nodeService from "@/services/spaceNodeService"
import * as itemService from "@/services/itemService"
const emit = defineEmits(["close", "created"])
const store = useActivityStore()
const itemStore = useItemStore()
const spaceNodes = ref([])
const mobileContainers = computed(() =>
  spaceNodes.value.filter((node) => node.kind === "container" && node.mobility === "mobile"),
)
const fixedLocations = computed(() => spaceNodes.value.filter((node) => node.mobility !== "mobile"))
async function loadSpaceNodes() {
  spaceNodes.value = await nodeService.getAllNodes()
}
const today = new Date().toISOString().split("T")[0]
const form = reactive({
  title: "",
  type: "travel",
  startDate: props.presetDate || today,
  endDate: props.presetDate || today,
  destination: "",
  description: "",
  bagIds: [],
})
const saving = ref(false)
const packingItems = ref([])
const combineMode = ref(false)
const combineSel = ref([])
function cancelCombine() {
  combineMode.value = false
  combineSel.value = []
}
const showCustomType = ref(false)
const custTypeName = ref("")
const custTypeRecurring = ref(false)
const showTypeMenu = ref(false)
const typeMenuTarget = ref(null)

const builtInTypes = [
  { k: "daily_carry", l: "日常", e: "🚶", recurring: true, recurringType: "daily" },
  { k: "travel", l: "旅行", e: "✈️", recurring: false },
  { k: "move", l: "搬家", e: "📦", recurring: false },
]
const CUSTOM_KEY = "asset-guard-custom-types"
function loadCustom() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]")
  } catch {
    return []
  }
}
function saveCustom(ts) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(ts))
}
const customTypes = ref(loadCustom())
const allTypes = computed(() => [...builtInTypes, ...customTypes.value.map((t) => ({ ...t, isCustom: true }))])
const packedGroups = computed(() => {
  const g = {}
  for (const item of packingItems.value) {
    const k = item.sourceBagId || "_other"
    if (!g[k]) g[k] = { bagId: k, bagName: "", items: [] }
    g[k].items.push(item)
  }
  for (const k of Object.keys(g)) {
    if (k === "_other") {
      g[k].bagName = "📦 其他"
    } else {
      const b = mobileContainers.value.find((x) => x.id === k)
      g[k].bagName = b ? (b.icon || "🎒") + " " + b.name : "🎒 未知"
    }
  }
  return Object.values(g).sort((a, b) => {
    if (a.bagId === "_other") return 1
    if (b.bagId === "_other") return -1
    return 0
  })
})
function toggleCombine(item) {
  const i = combineSel.value.indexOf(item)
  if (i >= 0) combineSel.value.splice(i, 1)
  else combineSel.value.push(item)
}
async function doCombine() {
  const n = prompt("新移动容器名称：")
  if (!n) return
  const bag = await nodeService.createNode({
    name: n,
    sectionId: "section-bags",
    parentId: "",
    kind: "container",
    mobility: "mobile",
    icon: "🎒",
  })
  for (const item of combineSel.value) {
    const idx = packingItems.value.indexOf(item)
    if (idx >= 0) {
      const dbItem = itemStore.items.find((i) => i.name === item.name)
      if (dbItem) {
        await itemService.moveItem(dbItem.id, bag.id, { reason: "行程中组合为移动容器" })
      }
      packingItems.value[idx] = Object.assign({}, packingItems.value[idx], { sourceBagId: bag.id })
    }
  }
  await loadSpaceNodes()
  await itemStore.loadItems()
  combineMode.value = false
  combineSel.value = []
}
const showSel = ref(false)
const selTab = ref("bag")
const selBagExpand = ref({})
const selItems = ref([])
const selQ = ref("")
const selBatchReminder = ref("return")

onMounted(() => {
  loadSpaceNodes()
  itemStore.loadItems()
})
watch(
  () => props.show,
  (v) => {
    if (v) {
      if (props.editTrip) {
        form.title = props.editTrip.title
        form.type = props.editTrip.type
        form.startDate = props.editTrip.startDate
        form.endDate = props.editTrip.endDate || props.editTrip.startDate
        form.destination = props.editTrip.destination || ""
        form.description = props.editTrip.description || ""
        form.isRecurring = props.editTrip.isRecurring || false
        form.recurringType = props.editTrip.recurringType || ""
        packingItems.value = (props.editTrip.packingItems || []).map((p) => ({ ...p }))
        saving.value = false
      } else {
        form.startDate = props.presetDate || today
        form.endDate = props.presetDate || today
        packingItems.value = []
        saving.value = false
        showCustomType.value = false
      }
    }
  },
)

function confirmCustomType() {
  const t = custTypeName.value.trim()
  if (!t) return
  const ct = {
    k: "custom-" + Date.now(),
    l: t,
    e: "📋",
    isCustom: true,
    recurring: custTypeRecurring.value,
    recurringType: custTypeRecurring.value ? "daily" : "",
  }
  const list = loadCustom()
  list.push(ct)
  saveCustom(list)
  customTypes.value = list
  form.type = ct.k
  showCustomType.value = false
  custTypeName.value = ""
  custTypeRecurring.value = false
}
function openTypeMenu(t) {
  typeMenuTarget.value = t
  showTypeMenu.value = true
}
const isBuiltinType = computed(() => typeMenuTarget.value && !typeMenuTarget.value.isCustom)
function deleteCustomType() {
  if (!typeMenuTarget.value) return
  const list = loadCustom().filter((c) => c.k !== typeMenuTarget.value.k)
  saveCustom(list)
  customTypes.value = list
  showTypeMenu.value = false
  if (form.type === typeMenuTarget.value.k) form.type = "travel"
}
function toggleReminder(item) {
  var items = packingItems.value
  if (!items) return
  var idx = items.indexOf(item)
  if (idx < 0) return
  var rt = ["return", "daily", "selfcheck"]
  var ri = rt.indexOf(item.reminderType)
  items[idx] = Object.assign({}, items[idx], { reminderType: rt[(ri + 1) % 3] })
}
function setAllReminder(t) {
  var arr = packingItems.value
  if (!arr) return
  for (var i = 0; i < arr.length; i++) arr[i].reminderType = t
}
function openSel() {
  selTab.value = "bag"
  selItems.value = []
  selQ.value = ""
  showSel.value = true
  itemStore.loadItems()
  loadSpaceNodes()
}
function toggleSelItem(itemId) {
  const i = selItems.value.indexOf(itemId)
  if (i >= 0) selItems.value.splice(i, 1)
  else selItems.value.push(itemId)
}
function toggleBagAll(bagId, itemIds) {
  const allIn = itemIds.filter((id) => !selItems.value.includes(id))
  if (allIn.length > 0) {
    for (const id of itemIds) {
      if (!selItems.value.includes(id)) selItems.value.push(id)
    }
  } else {
    for (const id of itemIds) {
      const i = selItems.value.indexOf(id)
      if (i >= 0) selItems.value.splice(i, 1)
    }
  }
}
function confirmSel() {
  for (const id of selItems.value) {
    const it = itemStore.items.find((i) => i.id === id)
    if (it && !packingItems.value.find((p) => p.name === it.name)) {
      packingItems.value.push({
        name: it.name,
        category: it.category || "日用",
        reminderType: selBatchReminder.value,
        sourceBagId: mobileContainers.value.some((node) => node.id === it.locationNodeId) ? it.locationNodeId : "",
      })
    }
  }
  showSel.value = false
}
const searchedSel = computed(() => {
  if (!selQ.value) return []
  const q = selQ.value.toLowerCase()
  return itemStore.items.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
})
const bagItems = (bagId) => itemStore.items.filter((i) => i.locationNodeId === bagId)
const roomItems = (roomId) => itemStore.items.filter((i) => i.locationNodeId === roomId)

async function submit() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    const bt = builtInTypes.find((t) => t.k === form.type) || {}
    const ct = customTypes.value.find((t) => t.k === form.type)
    const rec = bt.recurring || ct?.recurring || false
    const recType = bt.recurringType || ct?.recurringType || ""
    const data = {
      title: form.title.trim(),
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      destination: form.destination || "",
      description: form.description || "",
      isRecurring: rec,
      recurringType: recType,
      bagIds: [],
      packingItems: packingItems.value.map((p) => ({
        name: p.name,
        category: p.category,
        reminderType: p.reminderType,
        quantity: 1,
        sourceBagId: p.sourceBagId || "",
      })),
      status: "active",
    }
    const trip = props.editTrip ? await store.update(props.editTrip.id, data) : await store.create(data)
    saving.value = false
    emit("created", trip)
  } catch (e) {
    console.error("Trip create failed:", e)
    saving.value = false
  }
}
</script>
<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-end justify-center bg-black/30" @click.self="$emit('close')">
    <div class="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto px-5 pt-4 pb-6">
      <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
      <h3 class="text-base font-bold text-center mb-4" style="color: var(--color-text-primary)">
        {{ props.editTrip ? "编辑行程" : "新建出行" }}
      </h3>
      <div class="space-y-3">
        <input
          v-model="form.title"
          class="w-full border rounded-xl px-3 py-2.5 text-sm"
          placeholder="标题 *"
          style="border-color: var(--color-border)"
        />

        <div>
          <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary)">出行类型</label>
          <div class="grid grid-cols-4 gap-2">
            <div v-for="t in allTypes" :key="t.k" class="relative">
              <button
                @click="form.type = t.k"
                class="w-full py-2.5 rounded-xl text-xs font-medium"
                :style="
                  form.type === t.k
                    ? 'background:var(--brand-primary-light);color:var(--brand-primary);border:1px solid var(--brand-primary)'
                    : 'background:var(--color-bg);color:var(--color-text-secondary);border:1px solid var(--color-border)'
                "
              >
                {{ t.e }} {{ t.l }}
              </button>
              <button
                v-if="t.isCustom"
                @click.stop="openTypeMenu(t)"
                class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[8px] cursor-pointer hover:bg-gray-300"
              >
                ...
              </button>
            </div>
            <button
              @click="showCustomType = true"
              class="py-2.5 rounded-xl text-xs font-medium"
              style="
                background: var(--color-bg);
                color: var(--color-text-secondary);
                border: 1px dashed var(--color-border);
              "
            >
              +
            </button>
          </div>
        </div>

        <div
          v-if="showCustomType"
          class="p-3 rounded-xl"
          style="background: var(--brand-primary-light); border: 1px solid var(--brand-primary)"
        >
          <div class="text-xs font-semibold mb-2" style="color: var(--brand-primary)">自定义出行类型</div>
          <input
            v-model="custTypeName"
            class="w-full border rounded-lg px-3 py-2 text-sm mb-2 bg-white"
            placeholder="类型名称"
            style="border-color: var(--color-border)"
          />
          <label class="flex items-center gap-2 text-xs cursor-pointer" style="color: var(--color-text-secondary)"
            ><input type="checkbox" v-model="custTypeRecurring" class="w-4 h-4" /> 周期循环</label
          >
          <div class="flex gap-2 mt-2">
            <button
              @click="showCustomType = false"
              class="flex-1 py-1.5 border rounded-lg text-xs"
              style="border-color: var(--color-border)"
            >
              取消
            </button>
            <button
              @click="confirmCustomType()"
              class="flex-1 py-1.5 rounded-lg text-xs text-white"
              style="background: var(--brand-primary)"
            >
              确认
            </button>
          </div>
        </div>

        <div v-if="showTypeMenu" class="fixed inset-0 z-[70]" @click="showTypeMenu = false">
          <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl px-4 pb-6 pt-3">
            <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
            <div class="text-center text-sm mb-4" style="color: var(--color-text-tertiary)">
              {{ typeMenuTarget?.l }}
            </div>
            <template v-if="typeMenuTarget?.isCustom">
              <button
                @click="showTypeMenu = false"
                class="w-full py-3 text-sm font-medium hover:bg-gray-50 rounded-xl"
                style="color: var(--color-text-primary)"
              >
                编辑
              </button>
              <button
                @click="deleteCustomType()"
                class="w-full py-3 text-sm font-medium hover:bg-red-50 rounded-xl"
                style="color: var(--state-error)"
              >
                删除
              </button>
            </template>
            <template v-else>
              <div class="px-4 py-2 text-xs space-y-1" style="color: var(--color-text-secondary)">
                <div>周期循环：{{ typeMenuTarget?.recurring ? "是" : "否" }}</div>
                <div v-if="typeMenuTarget?.recurring">
                  重复：{{
                    typeMenuTarget?.recurringType === "daily"
                      ? "每天"
                      : typeMenuTarget?.recurringType === "weekly"
                        ? "每周"
                        : "每月"
                  }}
                </div>
              </div>
              <button
                @click="showTypeMenu = false"
                class="w-full py-3 text-sm font-medium hover:bg-gray-50 rounded-xl mt-2"
                style="color: var(--brand-primary)"
              >
                知道了
              </button>
            </template>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary)">出发</label
            ><input
              v-model="form.startDate"
              type="date"
              class="w-full border rounded-xl px-3 py-2 text-sm"
              style="border-color: var(--color-border)"
            />
          </div>
          <div>
            <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary)">返程</label
            ><input
              v-model="form.endDate"
              type="date"
              class="w-full border rounded-xl px-3 py-2 text-sm"
              style="border-color: var(--color-border)"
            />
          </div>
        </div>

        <input
          v-model="form.destination"
          class="w-full border rounded-xl px-3 py-2 text-sm"
          placeholder="目的地（可选）"
          style="border-color: var(--color-border)"
        />
        <textarea
          v-model="form.description"
          class="w-full border rounded-xl px-3 py-2 text-sm"
          rows="2"
          placeholder="行程描述"
          style="border-color: var(--color-border)"
        ></textarea>

        <div>
          <label class="text-xs font-medium mb-2 block" style="color: var(--color-text-secondary)">🎒 携带物品</label>
          <div
            @click="openSel()"
            class="flex items-center gap-2 py-2 px-3 border rounded-xl cursor-pointer text-xs hover:bg-gray-50"
            style="border-color: var(--color-border); color: var(--brand-primary)"
          >
            <span>📋</span><span>选择物品（{{ packingItems.length }} 件已选）</span>
          </div>

          <!-- Grouped packing list -->
          <div v-for="(group, gi) in packedGroups" :key="gi" class="mt-2">
            <div class="text-xs font-semibold mb-1 px-1" style="color: var(--color-text-secondary)">
              {{ group.bagName }}
            </div>
            <div
              v-for="(item, ii) in group.items"
              :key="ii"
              class="flex items-center gap-2 py-2 px-3 mb-1 rounded-lg text-xs"
              style="background: var(--color-bg)"
            >
              <div
                v-if="combineMode"
                @click="toggleCombine(item)"
                class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer"
                :style="
                  combineSel.includes(item)
                    ? 'background:var(--brand-primary);border-color:var(--brand-primary)'
                    : 'border-color:var(--color-border)'
                "
              >
                <span v-if="combineSel.includes(item)" class="text-white text-[9px]">✓</span>
              </div>
              <span class="flex-1 font-medium truncate">{{ item.name }}</span>
              <span style="color: var(--color-text-tertiary)">{{ item.category }}</span>
              <button
                @click="toggleReminder(item)"
                class="px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                :style="
                  item.reminderType === 'return'
                    ? 'background:var(--brand-primary-light);color:var(--brand-primary)'
                    : item.reminderType === 'daily'
                      ? 'background:var(--state-warning-bg);color:var(--state-warning)'
                      : 'background:var(--color-bg);color:var(--color-text-secondary)'
                "
              >
                {{ item.reminderType === "return" ? "返程" : item.reminderType === "daily" ? "每天" : "自行" }}
              </button>
              <button
                @click="packingItems.splice(packingItems.indexOf(item), 1)"
                style="color: var(--state-error)"
                class="flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Batch reminder + combine controls -->
          <div class="flex items-center gap-2 mt-2" v-if="packingItems.length > 0">
            <div class="flex-1">
              <button
                @click="setAllReminder('return')"
                class="px-2 py-0.5 rounded text-[10px] font-medium"
                style="background: var(--brand-primary-light); color: var(--brand-primary)"
              >
                全部返程提醒
              </button>
              <button
                @click="setAllReminder('daily')"
                class="ml-1 px-2 py-0.5 rounded text-[10px] font-medium"
                style="background: var(--state-warning-bg); color: var(--state-warning)"
              >
                全部每天</button
              ><button
                @click="setAllReminder('selfcheck')"
                class="ml-1 px-2 py-0.5 rounded text-[10px] font-medium"
                style="background: var(--color-bg); color: var(--color-text-secondary)"
              >
                全部自行
              </button>
            </div>
            <button
              v-if="!combineMode"
              @click="combineMode = true"
              class="text-xs whitespace-nowrap"
              style="color: var(--brand-primary)"
            >
              🔗 组合为新包
            </button>
            <template v-if="combineMode">
              <button
                @click="cancelCombine"
                class="text-xs px-3 py-1.5 border rounded-lg"
                style="border-color: var(--color-border); color: var(--color-text-secondary)"
              >
                取消
              </button>
              <button
                @click="doCombine()"
                :disabled="combineSel.length < 1"
                class="text-xs px-3 py-1.5 rounded-lg text-white"
                :style="
                  combineSel.length >= 2 ? 'background:var(--brand-primary)' : 'background:var(--color-text-tertiary)'
                "
              >
                组合为包（{{ combineSel.length }}）
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="flex gap-3 mt-6">
        <button
          @click="$emit('close')"
          class="flex-1 py-2.5 border rounded-xl text-sm font-medium"
          style="border-color: var(--color-border); color: var(--color-text-secondary)"
        >
          取消
        </button>
        <button
          @click="submit"
          :disabled="!form.title.trim() || saving"
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
          :style="
            form.title.trim() && !saving ? 'background:var(--brand-primary)' : 'background:var(--color-text-tertiary)'
          "
        >
          {{ saving ? "创建中..." : "创建" }}
        </button>
      </div>
    </div>

    <!-- Selection Modal -->
    <div
      v-if="showSel"
      class="fixed inset-0 z-[60] flex flex-col justify-end bg-black/30"
      @click.self="showSel = false"
    >
      <div class="bg-white rounded-t-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3"></div>
        <div
          class="flex items-center justify-center gap-0 py-3 border-b px-4"
          style="border-color: var(--color-border)"
        >
          <button
            @click="selTab = 'bag'"
            class="px-4 py-1.5 text-xs font-medium rounded-lg"
            :style="
              selTab === 'bag'
                ? 'background:var(--brand-primary-light);color:var(--brand-primary)'
                : 'color:var(--color-text-tertiary)'
            "
          >
            🎒 移动容器
          </button>
          <button
            @click="selTab = 'room'"
            class="px-4 py-1.5 text-xs font-medium rounded-lg"
            :style="
              selTab === 'room'
                ? 'background:var(--brand-primary-light);color:var(--brand-primary)'
                : 'color:var(--color-text-tertiary)'
            "
          >
            🏠 固定空间
          </button>
          <button
            @click="selTab = 'search'"
            class="px-4 py-1.5 text-xs font-medium rounded-lg"
            :style="
              selTab === 'search'
                ? 'background:var(--brand-primary-light);color:var(--brand-primary)'
                : 'color:var(--color-text-tertiary)'
            "
          >
            🔍 搜索
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-4 py-2">
          <div v-if="selTab === 'bag'">
            <div v-for="bag in mobileContainers" :key="bag.id" class="mb-3">
              <div class="flex items-center justify-between py-2">
                <span class="text-sm font-semibold">{{ bag.icon || "🎒" }} {{ bag.name }}</span>
                <button
                  @click="
                    toggleBagAll(
                      bag.id,
                      bagItems(bag.id).map((i) => i.id),
                    )
                  "
                  class="text-xs px-2 py-0.5 rounded"
                  style="color: var(--brand-primary); background: var(--brand-primary-light)"
                >
                  全选
                </button>
              </div>
              <div
                v-for="item in bagItems(bag.id)"
                :key="item.id"
                @click="toggleSelItem(item.id)"
                class="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 text-sm"
              >
                <div
                  class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :style="
                    selItems.includes(item.id)
                      ? 'background:var(--brand-primary);border-color:var(--brand-primary)'
                      : 'border-color:var(--color-border)'
                  "
                >
                  <span v-if="selItems.includes(item.id)" class="text-white text-[9px]">✓</span>
                </div>
                <span class="flex-1">{{ item.name }}</span>
                <span style="color: var(--color-text-tertiary)">{{ item.category }}</span>
              </div>
            </div>
          </div>

          <div v-if="selTab === 'room'">
            <div v-for="room in fixedLocations" :key="room.id" class="mb-3">
              <div class="text-sm font-semibold py-2">{{ room.icon || "🚪" }} {{ room.name }}</div>
              <div
                v-for="item in roomItems(room.id)"
                :key="item.id"
                @click="toggleSelItem(item.id)"
                class="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 text-sm"
              >
                <div
                  class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :style="
                    selItems.includes(item.id)
                      ? 'background:var(--brand-primary);border-color:var(--brand-primary)'
                      : 'border-color:var(--color-border)'
                  "
                >
                  <span v-if="selItems.includes(item.id)" class="text-white text-[9px]">✓</span>
                </div>
                <span class="flex-1">{{ item.name }}</span>
                <span style="color: var(--color-text-tertiary)">{{ item.category }}</span>
              </div>
            </div>
          </div>

          <div v-if="selTab === 'search'">
            <input
              v-model="selQ"
              class="w-full border rounded-xl px-3 py-2 text-sm mb-3"
              placeholder="搜索物品..."
              style="border-color: var(--color-border)"
            />
            <div v-if="!selQ" class="text-center py-6 text-xs" style="color: var(--color-text-tertiary)">
              输入关键词搜索
            </div>
            <div
              v-for="item in searchedSel"
              :key="item.id"
              @click="toggleSelItem(item.id)"
              class="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-50 text-sm"
            >
              <div
                class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                :style="
                  selItems.includes(item.id)
                    ? 'background:var(--brand-primary);border-color:var(--brand-primary)'
                    : 'border-color:var(--color-border)'
                "
              >
                <span v-if="selItems.includes(item.id)" class="text-white text-[9px]">✓</span>
              </div>
              <span class="flex-1">{{ item.name }}</span>
              <span style="color: var(--color-text-tertiary)">{{ item.category }}</span>
            </div>
            <div
              v-if="selQ && searchedSel.length === 0"
              class="text-center py-6 text-xs"
              style="color: var(--color-text-tertiary)"
            >
              未找到
            </div>
          </div>
        </div>

        <div class="px-4 py-3 border-t" style="border-color: var(--color-border)">
          <button
            @click="confirmSel"
            :disabled="selItems.length === 0"
            class="w-full py-2.5 rounded-xl text-xs font-medium text-white"
            :style="selItems.length ? 'background:var(--brand-primary)' : 'background:var(--color-text-tertiary)'"
          >
            加入清单（{{ selItems.length }}）
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
