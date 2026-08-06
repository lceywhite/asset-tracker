<script setup>
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { useItemStore } from "@/stores/useItemStore"
import * as sectionService from "@/services/homeSectionService"
import * as nodeService from "@/services/spaceNodeService"
import { getEffectiveValuation } from "@/domain/itemModel"
import { getPreferences, updatePreferences } from "@/services/itemPreferencesService"
import SpaceNodeEditorSheet from "@/components/space/SpaceNodeEditorSheet.vue"
import SectionManagerSheet from "@/components/space/SectionManagerSheet.vue"

const router = useRouter()
const itemStore = useItemStore()
const sections = ref([])
const nodes = ref([])
const searchQuery = ref("")
const viewMode = ref(getPreferences().homeView)
const itemSort = ref(getPreferences().itemSort)
const showManager = ref(false)
const createTarget = ref(null)
const loading = ref(true)

async function load() {
  loading.value = true
  await sectionService.importLegacySections()
  ;[sections.value, nodes.value] = await Promise.all([sectionService.getAllSections(), nodeService.getAllNodes()])
  await itemStore.loadItems()
  loading.value = false
}

onMounted(load)

function setView(mode) {
  viewMode.value = mode
  updatePreferences({ homeView: mode })
}

function setItemSort(event) {
  itemSort.value = event.target.value
  updatePreferences({ itemSort: itemSort.value })
}

function roots(sectionId) {
  return nodes.value
    .filter((node) => node.sectionId === sectionId && !node.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function children(nodeId) {
  return nodes.value.filter((node) => node.parentId === nodeId).sort((a, b) => a.sortOrder - b.sortOrder)
}

function descendantIds(nodeId) {
  const result = []
  const queue = [nodeId]
  while (queue.length) {
    const parentId = queue.shift()
    for (const child of children(parentId)) {
      result.push(child.id)
      queue.push(child.id)
    }
  }
  return result
}

function nodeItems(nodeId, recursive = false) {
  const ids = new Set(recursive ? [nodeId, ...descendantIds(nodeId)] : [nodeId])
  return itemStore.items.filter((item) => ids.has(item.locationNodeId))
}

function nodeStats(node) {
  const directChildren = children(node.id)
  const items = nodeItems(node.id, true)
  return {
    childCount: directChildren.length,
    childLabel: node.kind === "space" ? "区域" : node.kind === "area" ? "容器" : "子空间",
    itemCount: items.length,
    collectionValue: items.reduce((sum, item) => sum + (getEffectiveValuation(item) || 0), 0),
  }
}

function formatMoney(value, currency = "CNY") {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return "—"
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: amount >= 100000 ? "compact" : "standard",
  }).format(amount)
}

function cover(item) {
  return item.images?.find((image) => image.isCover)?.url || item.photo || ""
}

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())
const searchedNodes = computed(() => {
  if (!normalizedQuery.value) return []
  return nodes.value.filter((node) => `${node.name} ${node.description}`.toLowerCase().includes(normalizedQuery.value))
})
const searchedItems = computed(() => {
  if (!normalizedQuery.value) return viewMode.value === "items" ? itemStore.items : []
  return itemStore.search(normalizedQuery.value)
})
const sortedItems = computed(() =>
  [...searchedItems.value].sort((a, b) => {
    if (itemSort.value === "itemCode") return String(a.itemCode || a.id).localeCompare(String(b.itemCode || b.id))
    if (itemSort.value === "value") {
      const valueOf = (item) => getEffectiveValuation(item) ?? Number(item.purchasePrice || 0)
      return valueOf(b) - valueOf(a)
    }
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  }),
)

function defaultRootKind(section) {
  return section.key === "bags" ? "container" : "space"
}

function openCreate(section) {
  createTarget.value = { section, kind: defaultRootKind(section) }
}

async function onRootSaved() {
  createTarget.value = null
  await load()
}
</script>

<template>
  <div class="flex h-full flex-col bg-[#f6f5f1]">
    <header class="border-b bg-white px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
      <div class="flex items-center gap-2">
        <label class="flex h-10 flex-1 items-center gap-2 rounded-xl bg-gray-100 px-3">
          <span class="text-gray-400">⌕</span
          ><input
            v-model="searchQuery"
            class="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="搜索物品、空间或标签"
          />
        </label>
        <div class="flex rounded-xl bg-gray-100 p-1 text-xs">
          <button
            class="rounded-lg px-3 py-1.5"
            :class="viewMode === 'space' ? 'bg-white font-semibold text-blue-600 shadow-sm' : 'text-gray-400'"
            @click="setView('space')"
          >
            空间
          </button>
          <button
            class="rounded-lg px-3 py-1.5"
            :class="viewMode === 'items' ? 'bg-white font-semibold text-blue-600 shadow-sm' : 'text-gray-400'"
            @click="setView('items')"
          >
            物品
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto px-4 pb-6">
      <div v-if="loading" class="py-16 text-center text-sm text-gray-400">正在整理空间…</div>

      <template v-else-if="normalizedQuery">
        <section class="mt-4">
          <h2 class="text-xs font-semibold text-gray-400">空间 · {{ searchedNodes.length }}</h2>
          <div class="mt-2 space-y-2">
            <button
              v-for="node in searchedNodes"
              :key="node.id"
              class="flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left"
              @click="router.push(`/spaces/${node.id}`)"
            >
              <span class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gray-50 text-xl"
                ><img v-if="node.images?.[0]" :src="node.images[0].url" class="h-full w-full object-cover" /><template
                  v-else
                  >{{ node.icon }}</template
                ></span
              ><span class="min-w-0 flex-1"
                ><strong class="block truncate text-sm">{{ node.name }}</strong
                ><small class="text-[11px] text-gray-400">{{ nodeStats(node).itemCount }} 件物品</small></span
              ><span class="text-gray-300">›</span>
            </button>
            <p v-if="!searchedNodes.length" class="rounded-2xl bg-white p-4 text-center text-xs text-gray-400">
              没有匹配的空间
            </p>
          </div>
        </section>
        <section class="mt-5">
          <h2 class="text-xs font-semibold text-gray-400">物品 · {{ searchedItems.length }}</h2>
          <div class="mt-2 space-y-2">
            <button
              v-for="item in searchedItems"
              :key="item.id"
              class="flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left"
              @click="router.push(`/item/${item.id}`)"
            >
              <span class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gray-50 text-xl"
                ><img v-if="cover(item)" :src="cover(item)" class="h-full w-full object-cover" /><template v-else
                  >📦</template
                ></span
              ><span class="min-w-0 flex-1"
                ><strong class="block truncate text-sm">{{ item.name }}</strong
                ><small class="text-[11px] text-gray-400"
                  >{{ item.category }} · {{ item.tags?.join(" · ") || "暂无标签" }}</small
                ></span
              ><span class="text-gray-300">›</span>
            </button>
            <p v-if="!searchedItems.length" class="rounded-2xl bg-white p-4 text-center text-xs text-gray-400">
              没有匹配的物品
            </p>
          </div>
        </section>
      </template>

      <template v-else-if="viewMode === 'space'">
        <section v-for="section in sections" :key="section.id" class="mt-5">
          <div class="mb-2 flex items-end justify-between">
            <div @dblclick="showManager = true">
              <h2 class="text-base font-bold">{{ section.icon }} {{ section.name }}</h2>
              <p class="mt-0.5 text-[11px] text-gray-400">{{ section.description }}</p>
            </div>
            <span class="text-[11px] text-gray-400">{{ roots(section.id).length }} 个空间</span>
          </div>
          <div class="space-y-3">
            <article
              v-for="node in roots(section.id)"
              :key="node.id"
              class="overflow-hidden rounded-2xl border bg-white shadow-sm"
            >
              <button
                class="grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 p-4 text-left"
                @click="router.push(`/spaces/${node.id}`)"
              >
                <span class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gray-50 text-2xl"
                  ><img v-if="node.images?.[0]" :src="node.images[0].url" class="h-full w-full object-cover" /><template
                    v-else
                    >{{ node.icon }}</template
                  ></span
                >
                <span class="min-w-0"
                  ><strong class="block truncate text-base">{{ node.name }}</strong
                  ><small class="mt-1 block text-[11px] text-gray-400"
                    ><template v-if="nodeStats(node).childCount"
                      >{{ nodeStats(node).childCount }} 个{{ nodeStats(node).childLabel }} · </template
                    >{{ nodeStats(node).itemCount }} 件物品</small
                  ></span
                >
                <span class="text-right text-[10px] text-gray-400"
                  ><span v-if="node.spaceValue" class="block"
                    >空间 {{ formatMoney(node.spaceValue, node.currency) }}</span
                  ><strong v-if="nodeStats(node).collectionValue" class="mt-1 block text-xs text-gray-600"
                    >藏品 {{ formatMoney(nodeStats(node).collectionValue, node.currency) }}</strong
                  ></span
                >
              </button>
              <div v-if="children(node.id).length" class="grid grid-cols-3 gap-2 border-t bg-gray-50/70 p-3">
                <button
                  v-for="child in children(node.id).slice(0, 3)"
                  :key="child.id"
                  class="rounded-xl bg-white p-2 text-left"
                  @click="router.push(`/spaces/${child.id}`)"
                >
                  <span class="text-lg">{{ child.icon }}</span
                  ><strong class="mt-1 block truncate text-[11px]">{{ child.name }}</strong
                  ><small class="text-[10px] text-gray-400">{{ nodeStats(child).itemCount }} 件</small>
                </button>
              </div>
              <div v-else-if="nodeItems(node.id).length" class="flex gap-2 overflow-x-auto border-t bg-gray-50/70 p-3">
                <button
                  v-for="item in nodeItems(node.id).slice(0, 4)"
                  :key="item.id"
                  class="flex min-w-[120px] items-center gap-2 rounded-xl bg-white p-2 text-left"
                  @click="router.push(`/item/${item.id}`)"
                >
                  <span class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gray-50"
                    ><img v-if="cover(item)" :src="cover(item)" class="h-full w-full object-cover" /><template v-else
                      >📦</template
                    ></span
                  ><span class="min-w-0"
                    ><strong class="block truncate text-[11px]">{{ item.name }}</strong
                    ><small class="text-[9px] text-gray-400">{{ item.category }}</small></span
                  >
                </button>
              </div>
            </article>
            <button
              class="w-full rounded-2xl border-2 border-dashed border-gray-200 py-3 text-xs font-semibold text-blue-600"
              @click="openCreate(section)"
            >
              ＋ 新增{{ section.key === "bags" ? "移动容器" : "空间" }}
            </button>
          </div>
        </section>
        <button
          class="mt-5 w-full rounded-2xl border-2 border-dashed border-blue-200 py-3 text-sm font-semibold text-blue-600"
          @click="showManager = true"
        >
          ＋ 新增分区
        </button>
      </template>

      <template v-else>
        <div class="flex items-center justify-between gap-3 border-b py-3">
          <p class="text-sm font-semibold">
            全部物品 <span class="font-normal text-gray-400">{{ itemStore.items.length }}</span>
          </p>
          <label class="flex items-center gap-2 text-xs text-gray-400">
            排序
            <select
              :value="itemSort"
              aria-label="物品排序方式"
              class="rounded-xl border bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none"
              @change="setItemSort"
            >
              <option value="itemCode">物品 ID</option>
              <option value="value">价值（高到低）</option>
              <option value="createdAt">加入时间（新到旧）</option>
            </select>
          </label>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            v-for="item in sortedItems"
            :key="item.id"
            class="relative min-h-[132px] overflow-hidden rounded-2xl border bg-white p-3 text-left"
            @click="router.push(`/item/${item.id}`)"
          >
            <span
              class="absolute right-3 top-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-gray-50 text-2xl"
              ><img v-if="cover(item)" :src="cover(item)" class="h-full w-full object-cover" /><template v-else
                >📦</template
              ></span
            ><span class="block pr-14"
              ><strong class="block line-clamp-2 text-sm">{{ item.name }}</strong
              ><small class="mt-1 block truncate text-[10px] text-gray-400">{{ item.itemCode }}</small
              ><small class="mt-2 block text-[10px] text-blue-600">{{ item.category }}</small></span
            ><span class="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1"
              ><i
                v-for="tag in item.tags?.slice(0, 2)"
                :key="tag"
                class="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] not-italic text-gray-500"
                >{{ tag }}</i
              ></span
            >
          </button>
        </div>
        <p v-if="!itemStore.items.length" class="py-16 text-center text-sm text-gray-400">
          还没有物品，点击底部中央“＋”开始添加
        </p>
      </template>
    </main>

    <SpaceNodeEditorSheet
      :show="Boolean(createTarget)"
      :section-id="createTarget?.section.id || ''"
      :suggested-kind="createTarget?.kind || ''"
      @close="createTarget = null"
      @saved="onRootSaved"
    />
    <SectionManagerSheet :show="showManager" :sections="sections" @close="showManager = false" @changed="load" />
  </div>
</template>
