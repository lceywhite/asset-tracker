<script setup>
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"
import * as itemService from "@/services/itemService"
import * as nodeService from "@/services/spaceNodeService"
import * as sectionService from "@/services/homeSectionService"

const route = useRoute()
const router = useRouter()
const store = useActivityStore()
const trip = ref(null)
const items = ref([])
const nodes = ref([])
const sections = ref([])
const query = ref("")
const tab = ref("search")
const cart = ref([])
const sectionId = ref("")
const nodeId = ref("")
const saving = ref(false)

const targetContainer = computed(() =>
  trip.value?.containerRefs?.find((reference) => reference.containerId === route.params.containerId),
)
const alreadyAddedIds = computed(
  () => new Set((trip.value?.packingItems || []).map((entry) => entry.itemId).filter(Boolean)),
)
const cartIds = computed(() => new Set(cart.value.map((entry) => entry.item.id)))
const searchResults = computed(() => {
  const text = query.value.trim().toLowerCase()
  const source = text
    ? items.value.filter((item) =>
        [item.name, item.itemCode, item.category, ...(item.tags || [])].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(text),
        ),
      )
    : items.value
  return [...source].sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh-CN"))
})
const currentNode = computed(() => nodes.value.find((node) => node.id === nodeId.value) || null)
const currentSection = computed(() => sections.value.find((section) => section.id === sectionId.value) || null)
const layoutNodes = computed(() => {
  if (!sectionId.value) return []
  return nodes.value
    .filter((node) => node.sectionId === sectionId.value && node.parentId === (nodeId.value || ""))
    .sort((a, b) => a.sortOrder - b.sortOrder)
})
const layoutItems = computed(() => {
  if (!nodeId.value) return []
  return items.value.filter((item) => item.locationNodeId === nodeId.value)
})

onMounted(async () => {
  ;[trip.value, items.value, nodes.value, sections.value] = await Promise.all([
    store.loadById(route.params.id),
    itemService.getAllItems(),
    nodeService.getAllNodes(),
    sectionService.getAllSections(),
  ])
  if (!targetContainer.value) router.replace(`/plans/${route.params.id}/carry`)
})

function itemImage(item) {
  return item.photo || item.images?.find((image) => image.isCover)?.url || item.images?.[0]?.url || ""
}

function addToCart(item) {
  if (alreadyAddedIds.value.has(item.id) || cartIds.value.has(item.id)) return
  cart.value = [...cart.value, { item, starred: false }]
}

function removeFromCart(itemId) {
  cart.value = cart.value.filter((entry) => entry.item.id !== itemId)
}

function toggleCartStar(itemId) {
  cart.value = cart.value.map((entry) => (entry.item.id === itemId ? { ...entry, starred: !entry.starred } : entry))
}

function enterSection(id) {
  sectionId.value = id
  nodeId.value = ""
}

function enterNode(id) {
  nodeId.value = id
}

function drillBack() {
  if (nodeId.value) {
    const parentId = currentNode.value?.parentId || ""
    nodeId.value = parentId
    return
  }
  sectionId.value = ""
}

async function addItems() {
  if (!cart.value.length || !trip.value) return
  saving.value = true
  try {
    const createdAt = new Date().toISOString()
    const additions = cart.value.map(({ item, starred }) => ({
      itemId: item.id,
      containerId: route.params.containerId,
      nameSnapshot: item.name,
      categorySnapshot: item.category,
      imageSnapshot: itemImage(item),
      starred,
      addedAt: createdAt,
    }))
    trip.value = await store.update(trip.value.id, {
      containerRefs: trip.value.containerRefs,
      packingItems: [...trip.value.packingItems, ...additions],
    })
    router.push(typeof route.query.return === "string" ? route.query.return : `/plans/${trip.value.id}/carry`)
  } finally {
    saving.value = false
  }
}

function availabilityLabel(item) {
  if (alreadyAddedIds.value.has(item.id)) return "已在清单"
  if (cartIds.value.has(item.id)) return "已添加"
  return "＋"
}
</script>

<template>
  <div class="library-page">
    <header class="library-topbar">
      <button aria-label="返回" @click="router.back()">‹</button>
      <h1>选择物品</h1>
      <button @click="cart = []">清除</button>
    </header>

    <main v-if="trip" class="library-scroll">
      <section class="target-card">
        <span>{{ targetContainer?.iconSnapshot || "🎒" }}</span>
        <span
          ><b>添加到 {{ targetContainer?.nameSnapshot }}</b
          ><small>物品必须归入一个移动容器，实际存放位置不会改变</small></span
        >
      </section>

      <div class="library-tabs">
        <button :class="{ active: tab === 'search' }" @click="tab = 'search'">搜索物品</button>
        <button :class="{ active: tab === 'layout' }" @click="tab = 'layout'">按空间查找</button>
      </div>

      <template v-if="tab === 'search'">
        <label class="library-search"
          ><span>⌕</span><input v-model="query" type="search" placeholder="搜索物品名称、ID 或标签"
        /></label>
        <section class="result-card">
          <div v-if="!searchResults.length" class="empty-results">没有找到匹配的物品</div>
          <div v-for="item in searchResults" :key="item.id" class="result-row">
            <span class="result-image"
              ><img v-if="itemImage(item)" :src="itemImage(item)" alt="" /><template v-else>▣</template></span
            >
            <span
              ><b>{{ item.name }}</b
              ><small>{{ item.category || "未分类" }} · {{ item.itemCode }}</small></span
            >
            <button
              :aria-label="`${availabilityLabel(item)}${item.name}`"
              :disabled="alreadyAddedIds.has(item.id) || cartIds.has(item.id)"
              @click="addToCart(item)"
            >
              {{ availabilityLabel(item) }}
            </button>
          </div>
        </section>
      </template>

      <template v-else>
        <div class="drill-heading">
          <button v-if="sectionId || nodeId" @click="drillBack">‹ 返回上一级</button>
          <span>{{ currentNode?.name || currentSection?.name || "选择物品分区" }}</span>
        </div>
        <section class="result-card">
          <button
            v-for="section in !sectionId ? sections : []"
            :key="section.id"
            class="space-row"
            @click="enterSection(section.id)"
          >
            <span>{{ section.icon || "▣" }}</span
            ><span
              ><b>{{ section.name }}</b
              ><small>{{ nodes.filter((node) => node.sectionId === section.id).length }} 个空间</small></span
            ><i>›</i>
          </button>
          <button v-for="node in layoutNodes" :key="node.id" class="space-row" @click="enterNode(node.id)">
            <span>{{ node.icon || "▣" }}</span
            ><span
              ><b>{{ node.name }}</b
              ><small
                >{{ nodes.filter((child) => child.parentId === node.id).length }} 个下级 ·
                {{ items.filter((item) => item.locationNodeId === node.id).length }} 件直属物品</small
              ></span
            ><i>›</i>
          </button>
          <div v-for="item in layoutItems" :key="item.id" class="result-row">
            <span class="result-image"
              ><img v-if="itemImage(item)" :src="itemImage(item)" alt="" /><template v-else>▣</template></span
            >
            <span
              ><b>{{ item.name }}</b
              ><small>{{ item.category || "未分类" }} · {{ item.itemCode }}</small></span
            >
            <button
              :aria-label="`${availabilityLabel(item)}${item.name}`"
              :disabled="alreadyAddedIds.has(item.id) || cartIds.has(item.id)"
              @click="addToCart(item)"
            >
              {{ availabilityLabel(item) }}
            </button>
          </div>
          <div v-if="sectionId && !layoutNodes.length && !layoutItems.length" class="empty-results">
            这个位置还没有下级空间或直属物品
          </div>
        </section>
      </template>

      <div class="cart-heading">
        <h2>本次添加</h2>
        <span>{{ cart.length }} 项</span>
      </div>
      <section class="cart-card">
        <div v-if="!cart.length" class="empty-results">点击物品右侧的“＋”加入<br />本次选择会集中显示在这里</div>
        <div v-for="entry in cart" :key="entry.item.id" class="cart-row">
          <span class="result-image"
            ><img v-if="itemImage(entry.item)" :src="itemImage(entry.item)" alt="" /><template v-else>▣</template></span
          >
          <span
            ><b>{{ entry.item.name }}</b
            ><small>{{ entry.starred ? "已设为星标物品" : "普通物品" }}</small></span
          >
          <button
            class="cart-star"
            :class="{ starred: entry.starred }"
            :aria-label="entry.starred ? `取消${entry.item.name}的星标` : `给${entry.item.name}加星标`"
            @click="toggleCartStar(entry.item.id)"
          >
            ★
          </button>
          <button
            class="cart-remove"
            :aria-label="`从本次添加移除${entry.item.name}`"
            @click="removeFromCart(entry.item.id)"
          >
            ×
          </button>
        </div>
      </section>
    </main>

    <footer class="library-footer">
      <button :disabled="!cart.length || saving" @click="addItems">
        {{ saving ? "正在添加…" : `添加 ${cart.length} 项到${targetContainer?.nameSnapshot || "容器"}` }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.library-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7f5ef;
  color: #28251f;
}
.library-topbar {
  flex: none;
  min-height: 58px;
  padding: max(10px, env(safe-area-inset-top)) 16px 10px;
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: end;
  background: #fff;
  border-bottom: 1px solid #e8e4db;
}
.library-topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 17px;
}
.library-topbar button {
  border: 0;
  background: transparent;
  color: #197b72;
  font-weight: 700;
}
.library-topbar button:first-child {
  text-align: left;
  font-size: 30px;
  line-height: 28px;
}
.library-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 110px;
}
.target-card {
  display: grid;
  grid-template-columns: 42px 1fr;
  align-items: center;
  gap: 11px;
  padding: 13px;
  border: 1px solid #e5e1d8;
  border-radius: 18px;
  background: #fff;
}
.target-card > span:first-child {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: #eee8df;
  font-size: 20px;
}
.target-card b,
.target-card small {
  display: block;
}
.target-card b {
  font-size: 13px;
}
.target-card small {
  margin-top: 3px;
  color: #99958d;
  font-size: 10px;
}
.library-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 14px 0 10px;
  padding: 3px;
  border-radius: 13px;
  background: #eae7df;
}
.library-tabs button {
  border: 0;
  border-radius: 10px;
  padding: 9px;
  background: transparent;
  color: #77736b;
  font-size: 12px;
}
.library-tabs button.active {
  background: #fff;
  color: #176f67;
  font-weight: 750;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.library-search {
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  min-height: 46px;
  padding: 0 12px;
  border: 1px solid #dfdbd2;
  border-radius: 15px;
  background: #fff;
  color: #99958d;
}
.library-search input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
}
.result-card,
.cart-card {
  margin-top: 10px;
  overflow: hidden;
  border: 1px solid #e5e1d8;
  border-radius: 19px;
  background: #fff;
}
.result-row {
  min-height: 58px;
  display: grid;
  grid-template-columns: 42px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-top: 1px solid #eeeae2;
}
.result-row:first-child {
  border-top: 0;
}
.result-image {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 13px;
  background: #e7f3f1;
  color: #307c75;
}
.result-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.result-row b,
.result-row small,
.cart-row b,
.cart-row small {
  display: block;
}
.result-row b,
.cart-row b {
  font-size: 13px;
}
.result-row small,
.cart-row small {
  margin-top: 3px;
  color: #99958d;
  font-size: 10px;
}
.result-row > button {
  min-width: 34px;
  height: 34px;
  border: 0;
  border-radius: 11px;
  background: #e7f3f1;
  color: #287f77;
  font-size: 18px;
}
.result-row > button:disabled {
  background: transparent;
  color: #aaa69e;
  font-size: 10px;
}
.empty-results {
  padding: 24px 14px;
  text-align: center;
  color: #aaa69e;
  font-size: 11px;
  line-height: 1.7;
}
.drill-heading {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.drill-heading button {
  border: 0;
  background: transparent;
  color: #197b72;
  font-size: 12px;
  font-weight: 700;
}
.drill-heading span {
  color: #77736b;
  font-size: 11px;
}
.space-row {
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 10px;
  border: 0;
  border-top: 1px solid #eeeae2;
  padding: 9px 12px;
  background: #fff;
  text-align: left;
}
.space-row:first-child {
  border-top: 0;
}
.space-row > span:first-child {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f0ece4;
}
.space-row b,
.space-row small {
  display: block;
}
.space-row b {
  font-size: 13px;
}
.space-row small {
  margin-top: 3px;
  color: #99958d;
  font-size: 10px;
}
.space-row i {
  color: #b0aca4;
  font-style: normal;
}
.cart-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 2px 8px;
}
.cart-heading h2 {
  margin: 0;
  font-size: 15px;
}
.cart-heading span {
  color: #99958d;
  font-size: 11px;
}
.cart-row {
  min-height: 58px;
  display: grid;
  grid-template-columns: 42px 1fr 34px 30px;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-top: 1px solid #eeeae2;
}
.cart-row:first-child {
  border-top: 0;
}
.cart-star,
.cart-remove {
  border: 0;
  background: transparent;
}
.cart-star {
  color: #d4d0c8;
  font-size: 21px;
}
.cart-star.starred {
  color: #bd7a28;
}
.cart-remove {
  color: #a7a39b;
  font-size: 20px;
}
.library-footer {
  position: absolute;
  z-index: 10;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 14px max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid #e5e1d8;
  background: rgba(255, 255, 255, 0.97);
}
.library-footer button {
  width: 100%;
  min-height: 50px;
  border: 0;
  border-radius: 16px;
  background: #1b8b80;
  color: #fff;
  font-size: 13px;
  font-weight: 750;
}
.library-footer button:disabled {
  background: #c9c6be;
}
</style>
