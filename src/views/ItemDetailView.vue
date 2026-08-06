<script setup>
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useItemStore } from "@/stores/useItemStore"
import * as itemService from "@/services/itemService"
import * as locationService from "@/services/locationService"
import * as nodeService from "@/services/spaceNodeService"
import { getEffectiveValuation, getFilledPropertyGroups } from "@/domain/itemModel"
import ItemEditSheet from "@/components/item/ItemEditSheet.vue"

const route = useRoute()
const router = useRouter()
const itemStore = useItemStore()
const item = ref(null)
const nodes = ref([])
const history = ref([])
const showHistory = ref(false)
const showMove = ref(false)
const showEdit = ref(false)
const openGroups = ref(new Set())
const moveReason = ref("")
const selectedLocation = ref("")
const activeImage = ref(0)

async function load() {
  await itemStore.loadItems()
  item.value = itemStore.items.find((candidate) => candidate.id === route.params.id) || null
  ;[nodes.value, history.value] = await Promise.all([
    nodeService.getAllNodes(),
    item.value ? locationService.getByItem(item.value.id) : [],
  ])
  selectedLocation.value = item.value?.locationNodeId || ""
}

onMounted(load)

const currentNode = computed(() => nodes.value.find((node) => node.id === item.value?.locationNodeId))
const homeNode = computed(() => nodes.value.find((node) => node.id === item.value?.homeLocationNodeId))
const filledGroups = computed(() => getFilledPropertyGroups(item.value))
const effectiveValue = computed(() => getEffectiveValuation(item.value))
const coverImages = computed(() => item.value?.images || (item.value?.photo ? [{ url: item.value.photo }] : []))
const sortedHistory = computed(() =>
  [...history.value].sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || ""))),
)
const latestHistory = computed(() => sortedHistory.value[0] || null)

function nodeName(id) {
  return nodes.value.find((node) => node.id === id)?.name || (id ? "已删除的位置" : "未设置")
}

function nodePath(node) {
  if (!node) return "未设置"
  const names = []
  const visited = new Set()
  let current = node
  while (current && !visited.has(current.id)) {
    names.unshift(current.name)
    visited.add(current.id)
    current = nodes.value.find((candidate) => candidate.id === current.parentId)
  }
  return names.join(" / ")
}

function formatMoney(value, currency = "CNY") {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "—"
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value))
}

function formatTime(value) {
  if (!value) return ""
  return new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function toggleGroup(id) {
  const next = new Set(openGroups.value)
  next.has(id) ? next.delete(id) : next.add(id)
  openGroups.value = next
}

async function moveItem() {
  if (!item.value) return
  await itemService.moveItem(item.value.id, selectedLocation.value, { reason: moveReason.value })
  showMove.value = false
  moveReason.value = ""
  await load()
}

async function removeItem() {
  if (!item.value || !window.confirm(`删除物品“${item.value.name}”及其位置历史？`)) return
  await itemStore.removeItem(item.value.id)
  router.replace("/items")
}

async function onEdited() {
  showEdit.value = false
  await load()
}
</script>

<template>
  <div class="flex h-full flex-col bg-[#f6f5f1]">
    <header class="flex items-center gap-3 border-b bg-white px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-gray-500"
        aria-label="返回"
        @click="router.back()"
      >
        ‹
      </button>
      <div class="flex-1 text-center text-sm font-bold">物品档案</div>
      <button class="text-sm font-semibold text-blue-600" @click="showEdit = true">编辑</button>
    </header>

    <main v-if="item" class="flex-1 space-y-3 overflow-y-auto p-4 pb-8">
      <section class="rounded-2xl border bg-white p-4 shadow-sm">
        <div class="grid grid-cols-[1fr_112px] gap-4">
          <div class="min-w-0">
            <h1 class="text-xl font-bold leading-7">{{ item.name }}</h1>
            <p class="mt-1 font-mono text-[10px] tracking-wide text-gray-300">ID · {{ item.itemCode || item.id }}</p>
            <div class="mt-3 flex flex-wrap gap-1.5">
              <span class="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{{
                item.category || "未分类"
              }}</span
              ><span
                v-for="tag in item.tags"
                :key="tag"
                class="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600"
                >{{ tag }}</span
              >
            </div>
          </div>
          <button
            class="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-gray-50 text-4xl"
            @click="activeImage = (activeImage + 1) % Math.max(coverImages.length, 1)"
          >
            <img
              v-if="coverImages.length"
              :src="coverImages[activeImage]?.url || coverImages[0].url"
              class="h-full w-full object-cover"
            /><template v-else>📦</template
            ><span
              v-if="coverImages.length > 1"
              class="absolute bottom-1 right-1 rounded-full bg-black/55 px-2 py-0.5 text-[9px] text-white"
              >{{ activeImage + 1 }}/{{ coverImages.length }}</span
            >
          </button>
        </div>

        <div
          v-if="effectiveValue || item.purchasePrice || item.purchaseDate"
          class="mt-4 grid grid-cols-3 divide-x rounded-xl bg-gray-50 py-3 text-center"
        >
          <div v-if="effectiveValue">
            <span class="block text-[9px] text-gray-400">当前估值</span
            ><strong class="mt-1 block text-sm">{{ formatMoney(effectiveValue, item.currency) }}</strong
            ><small class="text-[8px] text-gray-400">手动估值</small>
          </div>
          <div v-if="item.purchasePrice">
            <span class="block text-[9px] text-gray-400">购入价</span
            ><strong class="mt-1 block text-sm">{{ formatMoney(item.purchasePrice, item.currency) }}</strong
            ><small class="text-[8px] text-gray-400">{{ item.purchaseChannel || "未记录渠道" }}</small>
          </div>
          <div v-if="item.purchaseDate">
            <span class="block text-[9px] text-gray-400">购入时间</span
            ><strong class="mt-1 block text-xs">{{ item.purchaseDate }}</strong
            ><small class="text-[8px] text-gray-400">档案记录</small>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border bg-white p-4">
        <div class="flex items-center justify-between">
          <h2 class="font-bold">当前位置</h2>
          <button class="text-xs font-semibold text-blue-600" @click="showMove = true">移动</button>
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            class="rounded-xl bg-gray-50 p-3 text-left"
            :disabled="!currentNode"
            @click="currentNode && router.push(`/spaces/${currentNode.id}`)"
          >
            <span class="text-[10px] text-gray-400">当前所在</span
            ><strong class="mt-1 block text-sm">{{ currentNode?.icon || "○" }} {{ nodePath(currentNode) }}</strong>
          </button>
          <button
            class="rounded-xl bg-gray-50 p-3 text-left"
            :disabled="!homeNode"
            @click="homeNode && router.push(`/spaces/${homeNode.id}`)"
          >
            <span class="text-[10px] text-gray-400">常驻 / 归位</span
            ><strong class="mt-1 block text-sm">{{ homeNode?.icon || "○" }} {{ nodePath(homeNode) }}</strong>
          </button>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border bg-white">
        <button class="flex w-full items-center justify-between p-4 text-left" @click="showHistory = !showHistory">
          <span
            ><strong class="block text-sm">位置历史</strong
            ><small class="mt-1 block text-[10px] text-gray-400"
              >{{ history.length }} 条记录<span v-if="history.length">
                · 最近 {{ formatTime(latestHistory?.timestamp) }}</span
              ></small
            ></span
          ><span class="text-xs text-gray-400">{{ showHistory ? "收起⌃" : "展开⌄" }}</span>
        </button>
        <div v-if="showHistory" class="border-t px-4 py-3">
          <p v-if="!history.length" class="py-3 text-center text-xs text-gray-400">暂无位置变动</p>
          <div
            v-for="record in sortedHistory"
            :key="record.id"
            class="relative border-l-2 border-blue-100 pb-4 pl-4 last:pb-1"
          >
            <i class="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-500"></i
            ><time class="text-[9px] text-gray-400">{{ formatTime(record.timestamp) }}</time
            ><strong class="mt-1 block text-xs"
              >{{ nodeName(record.fromNodeId || record.fromId) }} →
              {{ nodeName(record.toNodeId || record.toId) }}</strong
            ><small v-if="record.reason || record.notes" class="mt-1 block text-[10px] text-gray-400"
              >{{ record.reason }}{{ record.reason && record.notes ? " · " : "" }}{{ record.notes }}</small
            >
          </div>
        </div>
      </section>

      <section v-if="item.notes" class="rounded-2xl border bg-white p-4">
        <div class="flex items-center justify-between">
          <h2 class="font-bold">备注</h2>
          <span class="text-[10px] text-gray-400">{{ item.updatedAt?.slice(0, 10) }} 更新</span>
        </div>
        <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{{ item.notes }}</p>
      </section>

      <section v-for="group in filledGroups" :key="group.id" class="overflow-hidden rounded-2xl border bg-white">
        <button class="flex w-full items-center justify-between p-4 text-left" @click="toggleGroup(group.id)">
          <span class="min-w-0"
            ><strong class="block text-sm">{{ group.title }}</strong
            ><small class="mt-1 block truncate text-[10px] text-gray-400">{{
              group.fields
                .slice(0, 4)
                .map((field) => field.value)
                .join(" · ")
            }}</small></span
          ><span class="ml-3 text-xs text-gray-400">{{ openGroups.has(group.id) ? "收起⌃" : "展开⌄" }}</span>
        </button>
        <dl v-if="openGroups.has(group.id)" class="border-t px-4 py-2">
          <div
            v-for="property in group.fields"
            :key="property.id"
            class="flex items-start justify-between gap-4 border-b py-2.5 last:border-0"
          >
            <dt class="text-xs text-gray-400">{{ property.label }}</dt>
            <dd class="text-right text-xs font-semibold">
              {{ property.value }}{{ property.unit ? ` ${property.unit}` : "" }}
            </dd>
          </div>
        </dl>
      </section>

      <button class="w-full py-3 text-xs text-red-400" @click="removeItem">删除物品</button>
    </main>
    <div v-else class="flex flex-1 items-center justify-center text-sm text-gray-400">物品不存在</div>

    <div v-if="showMove" class="fixed inset-0 z-50 flex items-end bg-black/35" @click.self="showMove = false">
      <section class="w-full rounded-t-3xl bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div class="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200"></div>
        <h2 class="text-lg font-bold">移动物品</h2>
        <label class="mt-4 block text-xs text-gray-500"
          >目标空间<select v-model="selectedLocation" class="mt-1 w-full rounded-xl border px-3 py-3 text-sm">
            <option value="">无位置</option>
            <option v-for="node in nodes" :key="node.id" :value="node.id">{{ node.icon }} {{ nodePath(node) }}</option>
          </select></label
        ><label class="mt-3 block text-xs text-gray-500"
          >移动原因（可选）<input
            v-model="moveReason"
            class="mt-1 w-full rounded-xl border px-3 py-3 text-sm"
            placeholder="例如：出发上班时装入" /></label
        ><button class="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white" @click="moveItem">
          确认移动</button
        ><button class="mt-2 w-full py-2 text-sm text-gray-400" @click="showMove = false">取消</button>
      </section>
    </div>

    <ItemEditSheet :show="showEdit" :item="item" @close="showEdit = false" @created="onEdited" />
  </div>
</template>
