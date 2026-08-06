<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useItemStore } from "@/stores/useItemStore"
import * as nodeService from "@/services/spaceNodeService"
import * as layoutService from "@/services/spaceLayoutService"
import * as sectionService from "@/services/homeSectionService"
import * as itemService from "@/services/itemService"
import * as checkService from "@/services/spaceCheckService"
import { getEffectiveValuation } from "@/domain/itemModel"
import SpaceNodeEditorSheet from "@/components/space/SpaceNodeEditorSheet.vue"
import ItemEditSheet from "@/components/item/ItemEditSheet.vue"

const route = useRoute()
const router = useRouter()
const itemStore = useItemStore()
const node = ref(null)
const allNodes = ref([])
const sections = ref([])
const layouts = ref([])
const activeLayoutIndex = ref(0)
const layoutEditing = ref(false)
const showNodeEditor = ref(false)
const showChildEditor = ref(false)
const showAddChoice = ref(false)
const showItemEditor = ref(false)
const selectedExisting = ref([])
const draggedId = ref("")
const checkSession = ref(null)

async function load() {
  ;[allNodes.value, layouts.value, sections.value] = await Promise.all([
    nodeService.getAllNodes(),
    layoutService.getLayoutsByNode(route.params.id),
    sectionService.getAllSections(),
  ])
  node.value = allNodes.value.find((candidate) => candidate.id === route.params.id) || null
  await itemStore.loadItems()
  if (activeLayoutIndex.value >= layouts.value.length) activeLayoutIndex.value = Math.max(layouts.value.length - 1, 0)
}

onMounted(load)
watch(() => route.params.id, load)

const children = computed(() =>
  allNodes.value.filter((candidate) => candidate.parentId === node.value?.id).sort((a, b) => a.sortOrder - b.sortOrder),
)
const directItems = computed(() => itemStore.items.filter((item) => item.locationNodeId === node.value?.id))

function descendantIds(rootId) {
  const result = []
  const queue = [rootId]
  while (queue.length) {
    const parentId = queue.shift()
    for (const child of allNodes.value.filter((candidate) => candidate.parentId === parentId)) {
      result.push(child.id)
      queue.push(child.id)
    }
  }
  return result
}

const recursiveItems = computed(() => {
  const ids = new Set([node.value?.id, ...descendantIds(node.value?.id)])
  return itemStore.items.filter((item) => ids.has(item.locationNodeId))
})
const collectionValue = computed(() =>
  recursiveItems.value.reduce((sum, item) => sum + (getEffectiveValuation(item) || 0), 0),
)
const suggestedChild = computed(() => nodeService.getSuggestedChildKind(node.value))
const activeLayout = computed(() => layouts.value[activeLayoutIndex.value] || null)
const orderedChildren = computed(() => {
  const order = activeLayout.value?.placements?.map((placement) => placement.nodeId) || []
  return [...children.value].sort((a, b) => {
    const ai = order.indexOf(a.id)
    const bi = order.indexOf(b.id)
    if (ai < 0 && bi < 0) return a.sortOrder - b.sortOrder
    if (ai < 0) return 1
    if (bi < 0) return -1
    return ai - bi
  })
})
const availableItems = computed(() => itemStore.items.filter((item) => item.locationNodeId !== node.value?.id))
const checkProgress = computed(() => {
  const entries = checkSession.value?.entries || []
  return { checked: entries.filter((entry) => entry.checked).length, total: entries.length }
})
const currentPath = computed(() => {
  if (!node.value) return ""
  const names = []
  const visited = new Set()
  let current = node.value
  while (current && !visited.has(current.id)) {
    names.unshift(current.name)
    visited.add(current.id)
    current = allNodes.value.find((candidate) => candidate.id === current.parentId)
  }
  const section = sections.value.find((candidate) => candidate.id === node.value.sectionId)
  if (section && names[0] !== section.name) names.unshift(section.name)
  return names.join(" / ")
})

function formatMoney(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "—"
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: node.value?.currency || "CNY",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function cover(item) {
  return item.images?.find((image) => image.isCover)?.url || item.photo || ""
}

async function ensureLayout() {
  if (activeLayout.value) return activeLayout.value
  const created = await layoutService.createLayout(node.value.id, {
    name: "默认布局",
    placements: children.value.map((child, index) => ({ nodeId: child.id, x: index % 2, y: Math.floor(index / 2) })),
  })
  await load()
  activeLayoutIndex.value = layouts.value.findIndex((layout) => layout.id === created.id)
  return created
}

async function toggleLayoutEdit() {
  if (!layoutEditing.value) await ensureLayout()
  layoutEditing.value = !layoutEditing.value
}

async function addLayout() {
  const layout = await layoutService.createLayout(node.value.id, { name: `布局 ${layouts.value.length + 1}` })
  await load()
  activeLayoutIndex.value = layouts.value.findIndex((candidate) => candidate.id === layout.id)
  layoutEditing.value = true
}

function nextLayout() {
  if (layouts.value.length < 2) return
  activeLayoutIndex.value = (activeLayoutIndex.value + 1) % layouts.value.length
}

async function reorderChild(targetId) {
  if (!layoutEditing.value || !draggedId.value || draggedId.value === targetId) return
  const list = orderedChildren.value.map((child) => child.id)
  const from = list.indexOf(draggedId.value)
  const to = list.indexOf(targetId)
  const [entry] = list.splice(from, 1)
  list.splice(to, 0, entry)
  await saveOrder(list)
  draggedId.value = ""
}

async function shiftChild(id, delta) {
  const list = orderedChildren.value.map((child) => child.id)
  const index = list.indexOf(id)
  const target = index + delta
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target], list[index]]
  await saveOrder(list)
}

async function saveOrder(ids) {
  const layout = await ensureLayout()
  await layoutService.updateLayout(layout.id, {
    placements: ids.map((nodeId, index) => ({ nodeId, x: index % 2, y: Math.floor(index / 2), width: 1, height: 1 })),
  })
  await load()
}

function toggleExisting(id) {
  selectedExisting.value = selectedExisting.value.includes(id)
    ? selectedExisting.value.filter((candidate) => candidate !== id)
    : [...selectedExisting.value, id]
}

async function moveExisting() {
  for (const id of selectedExisting.value)
    await itemService.moveItem(id, node.value.id, { reason: `移入${node.value.name}` })
  selectedExisting.value = []
  showAddChoice.value = false
  await load()
}

async function startCheck() {
  checkSession.value = await checkService.startOrResumeSpaceCheck(node.value.id, recursiveItems.value)
}

async function toggleCheck(itemId) {
  checkSession.value = await checkService.toggleSpaceCheck(checkSession.value.id, itemId)
}

async function completeCheck() {
  await checkService.completeSpaceCheck(checkSession.value.id)
  checkSession.value = null
}

async function onNodeSaved() {
  showNodeEditor.value = false
  await load()
}

async function onChildSaved() {
  showChildEditor.value = false
  await load()
}

async function onItemCreated() {
  showItemEditor.value = false
  await load()
}

function openNewItem() {
  showAddChoice.value = false
  showItemEditor.value = true
}
</script>

<template>
  <div class="flex h-full flex-col bg-[#f6f5f1]">
    <header class="flex items-center gap-3 border-b bg-white px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
      <button class="flex h-8 w-8 items-center justify-center text-xl text-gray-500" @click="router.back()">‹</button>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[10px] text-gray-400" :title="currentPath">{{ currentPath }}</p>
        <h1 class="truncate text-sm font-bold">{{ node?.name || "空间" }}</h1>
      </div>
      <button class="text-lg text-gray-400" @click="showNodeEditor = true">•••</button>
    </header>

    <main v-if="node" class="flex-1 overflow-y-auto pb-8">
      <section class="border-b bg-white p-4">
        <div class="flex items-center gap-3">
          <span class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gray-50 text-3xl"
            ><img v-if="node.images?.[0]" :src="node.images[0].url" class="h-full w-full object-cover" /><template
              v-else
              >{{ node.icon }}</template
            ></span
          >
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-xl font-bold">{{ node.name }}</h2>
            <p class="mt-1 text-xs text-gray-400">
              {{ children.length }} 个{{ suggestedChild.label }} · {{ recursiveItems.length }} 件物品
            </p>
          </div>
          <div v-if="collectionValue" class="text-right">
            <strong class="block text-sm">{{ formatMoney(collectionValue) }}</strong
            ><small class="text-[9px] text-gray-400">藏品价值</small>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white" @click="showChildEditor = true">
            ＋ 添加{{ suggestedChild.label }}</button
          ><button class="rounded-xl border py-3 text-sm font-semibold text-blue-600" @click="showAddChoice = true">
            ＋ 添加物品
          </button>
        </div>
      </section>

      <section class="m-4 rounded-2xl border bg-white p-4">
        <div class="flex items-center">
          <button class="flex min-w-0 flex-1 items-center gap-1 text-left" @click="nextLayout">
            <h2 class="font-bold">布局</h2>
            <span v-if="layouts.length > 1" class="text-gray-300">›</span
            ><small v-if="activeLayout" class="ml-2 truncate text-[10px] text-gray-400">{{
              activeLayout.name
            }}</small></button
          ><button v-if="layoutEditing" class="mr-3 text-xl text-blue-600" @click="addLayout">＋</button
          ><button class="text-xs font-semibold text-blue-600" @click="toggleLayoutEdit">
            {{ layoutEditing ? "完成" : "编辑" }}
          </button>
        </div>
        <div v-if="orderedChildren.length" class="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-2">
          <button
            v-for="child in orderedChildren"
            :key="child.id"
            :draggable="layoutEditing"
            class="relative min-h-[92px] rounded-xl border bg-white p-3 text-left"
            :class="layoutEditing && 'border-dashed border-blue-300'"
            @dragstart="draggedId = child.id"
            @dragover.prevent
            @drop="reorderChild(child.id)"
            @click="!layoutEditing && router.push(`/spaces/${child.id}`)"
          >
            <span class="text-2xl">{{ child.icon }}</span
            ><strong class="mt-2 block truncate text-xs">{{ child.name }}</strong
            ><small class="text-[9px] text-gray-400"
              >{{ allNodes.filter((candidate) => candidate.parentId === child.id).length }} 个下级 ·
              {{ itemStore.items.filter((item) => item.locationNodeId === child.id).length }} 件直属物品</small
            ><span v-if="layoutEditing" class="absolute right-2 top-2 flex gap-1"
              ><i class="cursor-grab text-gray-300 not-italic">☰</i
              ><i class="text-blue-400 not-italic" @click.stop="shiftChild(child.id, -1)">←</i
              ><i class="text-blue-400 not-italic" @click.stop="shiftChild(child.id, 1)">→</i></span
            >
          </button>
        </div>
        <p v-else class="mt-3 rounded-xl bg-gray-50 py-8 text-center text-xs text-gray-400">
          当前没有下级{{ suggestedChild.label }}
        </p>
      </section>

      <section class="mx-4 rounded-2xl border bg-white">
        <div class="flex items-center justify-between border-b p-4">
          <div>
            <h2 class="font-bold">物品清单</h2>
            <p class="mt-1 text-[10px] text-gray-400">直属于当前空间的物品</p>
          </div>
          <button class="rounded-lg border px-3 py-1.5 text-xs font-semibold text-blue-600" @click="startCheck">
            核对
          </button>
        </div>
        <button
          v-for="item in directItems"
          :key="item.id"
          class="flex w-full items-center gap-3 border-b p-3 text-left last:border-0"
          @click="router.push(`/item/${item.id}`)"
        >
          <span class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gray-50"
            ><img v-if="cover(item)" :src="cover(item)" class="h-full w-full object-cover" /><template v-else
              >📦</template
            ></span
          ><span class="min-w-0 flex-1"
            ><strong class="block truncate text-sm">{{ item.name }}</strong
            ><small class="text-[10px] text-gray-400">{{ item.category }} · 直属当前空间</small></span
          ><span class="text-right"
            ><strong v-if="getEffectiveValuation(item)" class="block text-xs">{{
              formatMoney(getEffectiveValuation(item))
            }}</strong
            ><small class="text-[9px] text-gray-400">估值</small></span
          >
        </button>
        <p v-if="!directItems.length" class="py-8 text-center text-xs text-gray-400">当前空间没有直属物品</p>
      </section>
    </main>
    <div v-else class="flex flex-1 items-center justify-center text-sm text-gray-400">空间不存在</div>

    <SpaceNodeEditorSheet
      :show="showNodeEditor"
      :node="node"
      :section-id="node?.sectionId || ''"
      @close="showNodeEditor = false"
      @saved="onNodeSaved"
      @deleted="router.replace('/items')"
    />
    <SpaceNodeEditorSheet
      :show="showChildEditor"
      :section-id="node?.sectionId || ''"
      :parent="node"
      :suggested-kind="suggestedChild.kind"
      @close="showChildEditor = false"
      @saved="onChildSaved"
    />
    <ItemEditSheet
      :show="showItemEditor"
      :preset-location-node-id="node?.id || ''"
      @close="showItemEditor = false"
      @created="onItemCreated"
    />

    <div v-if="showAddChoice" class="fixed inset-0 z-50 flex items-end bg-black/35" @click.self="showAddChoice = false">
      <section
        class="flex max-h-[82dvh] w-full flex-col rounded-t-3xl bg-white pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <div class="mx-auto my-3 h-1 w-10 rounded-full bg-gray-200"></div>
        <div class="flex items-center justify-between px-4 pb-3">
          <h2 class="font-bold">添加物品到 {{ node.name }}</h2>
          <button class="text-sm text-gray-400" @click="showAddChoice = false">关闭</button>
        </div>
        <div class="flex-1 overflow-y-auto border-y px-4">
          <button
            v-for="item in availableItems"
            :key="item.id"
            class="flex w-full items-center gap-3 border-b py-3 text-left"
            @click="toggleExisting(item.id)"
          >
            <span
              class="flex h-5 w-5 items-center justify-center rounded border text-xs"
              :class="selectedExisting.includes(item.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'"
              >{{ selectedExisting.includes(item.id) ? "✓" : "" }}</span
            ><span class="flex-1"
              ><strong class="block text-sm">{{ item.name }}</strong
              ><small class="text-[10px] text-gray-400">{{ item.category }}</small></span
            >
          </button>
          <p v-if="!availableItems.length" class="py-8 text-center text-xs text-gray-400">没有可移动的已有物品</p>
        </div>
        <div class="p-4">
          <button
            class="w-full rounded-xl border-2 border-dashed border-blue-200 py-3 text-sm font-semibold text-blue-600"
            @click="openNewItem"
          >
            ＋ 新建物品并加入</button
          ><button
            class="mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:bg-gray-200"
            :disabled="!selectedExisting.length"
            @click="moveExisting"
          >
            移入已选物品（{{ selectedExisting.length }}）
          </button>
        </div>
      </section>
    </div>

    <div v-if="checkSession" data-testid="space-check" class="fixed inset-0 z-[70] flex flex-col bg-[#f6f5f1]">
      <header class="border-b bg-white px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
        <div class="flex items-center">
          <button class="text-sm text-gray-500" @click="checkSession = null">关闭</button>
          <div class="flex-1 text-center">
            <p class="text-[10px] text-gray-400">{{ node.name }}</p>
            <h2 class="font-bold">空间核对</h2>
          </div>
          <span class="text-xs font-semibold text-blue-600">{{ checkProgress.checked }}/{{ checkProgress.total }}</span>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <i
            class="block h-full bg-blue-600"
            :style="{ width: checkProgress.total ? `${(checkProgress.checked / checkProgress.total) * 100}%` : '0%' }"
          ></i>
        </div>
      </header>
      <main class="flex-1 space-y-2 overflow-y-auto p-4">
        <button
          v-for="entry in checkSession.entries"
          :key="entry.itemId"
          :aria-label="`核对 ${entry.name}`"
          class="flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left"
          @click="toggleCheck(entry.itemId)"
        >
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full border-2"
            :class="entry.checked ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'"
            >{{ entry.checked ? "✓" : "" }}</span
          ><span class="flex-1 text-sm font-semibold" :class="entry.checked && 'text-gray-400 line-through'">{{
            entry.name
          }}</span>
        </button>
        <p v-if="!checkSession.entries.length" class="py-12 text-center text-sm text-gray-400">
          当前空间没有可核对的物品
        </p>
      </main>
      <footer class="border-t bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button class="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white" @click="completeCheck">
          完成本次核对
        </button>
      </footer>
    </div>
  </div>
</template>
