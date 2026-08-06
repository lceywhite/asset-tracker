<script setup>
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useActivityStore } from "@/stores/useActivityStore"
import * as nodeService from "@/services/spaceNodeService"
import * as sectionService from "@/services/homeSectionService"
import { getTripReminderSummary } from "@/services/tripPreferencesService"

const route = useRoute()
const router = useRouter()
const store = useActivityStore()
const trip = ref(null)
const mobileContainers = ref([])
const sections = ref([])
const selectedIds = ref(new Set())
const openSwipeId = ref("")
const showContainerSheet = ref(false)
const showMoveSheet = ref(false)
const selectedExistingId = ref("")
const newContainerName = ref("")
const newContainerSectionId = ref("section-bags")
const draggedEntryId = ref("")
const saving = ref(false)
const message = ref("")
let touchStartX = 0

const reminderSummary = getTripReminderSummary()
const groups = computed(() =>
  (trip.value?.containerRefs || []).map((container) => ({
    ...container,
    items: (trip.value?.packingItems || []).filter((entry) => entry.containerId === container.containerId),
  })),
)
const allItems = computed(() => trip.value?.packingItems || [])
const availableContainers = computed(() =>
  mobileContainers.value.filter(
    (node) => !(trip.value?.containerRefs || []).some((reference) => reference.containerId === node.id),
  ),
)
const selectedEntries = computed(() => allItems.value.filter((entry) => selectedIds.value.has(entry.id)))
const selectedAreStarred = computed(
  () => selectedEntries.value.length > 0 && selectedEntries.value.every((entry) => entry.starred),
)

onMounted(async () => {
  const [loadedTrip, nodes, loadedSections] = await Promise.all([
    store.loadById(route.params.id),
    nodeService.getAllNodes(),
    sectionService.getAllSections(),
  ])
  trip.value = loadedTrip
  mobileContainers.value = nodes.filter((node) => node.kind === "container" && node.mobility === "mobile")
  sections.value = loadedSections
  if (!sections.value.some((section) => section.id === newContainerSectionId.value)) {
    newContainerSectionId.value = sections.value[0]?.id || ""
  }
})

function flash(text) {
  message.value = text
  window.setTimeout(() => (message.value = ""), 2200)
}

async function persist(packingItems, containerRefs = trip.value.containerRefs) {
  saving.value = true
  try {
    trip.value = await store.update(trip.value.id, { packingItems, containerRefs })
    selectedIds.value = new Set(
      [...selectedIds.value].filter((id) => trip.value.packingItems.some((item) => item.id === id)),
    )
  } finally {
    saving.value = false
  }
}

function toggleSelection(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function selectAll() {
  selectedIds.value = new Set(allItems.value.map((entry) => entry.id))
}

function clearSelection() {
  selectedIds.value = new Set()
}

async function toggleStar(entry) {
  await persist(allItems.value.map((item) => (item.id === entry.id ? { ...item, starred: !item.starred } : item)))
}

async function toggleBatchStar() {
  if (!selectedEntries.value.length) return
  const nextValue = !selectedAreStarred.value
  await persist(
    allItems.value.map((entry) => (selectedIds.value.has(entry.id) ? { ...entry, starred: nextValue } : entry)),
  )
  flash(nextValue ? "已标记所选物品" : "已清除所选标记")
}

async function removeEntries(ids) {
  if (!ids.length) return
  const copy =
    ids.length === 1
      ? "物品只会从本次行程移出，不会删除物品库档案。"
      : `将 ${ids.length} 项物品从本次行程移出，不会删除物品库档案。`
  if (!window.confirm(`从本次行程移出物品？\n\n${copy}`)) return
  const targets = new Set(ids)
  await persist(allItems.value.filter((entry) => !targets.has(entry.id)))
  openSwipeId.value = ""
  flash("已从携带清单移出")
}

async function moveEntries(containerId, ids = [...selectedIds.value]) {
  if (!containerId || !ids.length) return
  const targets = new Set(ids)
  await persist(allItems.value.map((entry) => (targets.has(entry.id) ? { ...entry, containerId } : entry)))
  showMoveSheet.value = false
  clearSelection()
  flash("物品已移动到其他容器")
}

function startDrag(entryId) {
  draggedEntryId.value = entryId
}

async function dropOn(containerId) {
  if (!draggedEntryId.value) return
  await moveEntries(containerId, [draggedEntryId.value])
  draggedEntryId.value = ""
}

function onTouchStart(event) {
  touchStartX = event.changedTouches[0]?.clientX || 0
}

function onTouchEnd(event, id) {
  const delta = (event.changedTouches[0]?.clientX || 0) - touchStartX
  if (delta < -42) openSwipeId.value = id
  if (delta > 42 && openSwipeId.value === id) openSwipeId.value = ""
}

async function addContainer() {
  let node = null
  if (selectedExistingId.value) {
    node = mobileContainers.value.find((candidate) => candidate.id === selectedExistingId.value)
  } else if (newContainerName.value.trim()) {
    node = await nodeService.createNode({
      sectionId: newContainerSectionId.value,
      parentId: "",
      kind: "container",
      mobility: "mobile",
      name: newContainerName.value.trim(),
      icon: "🎒",
    })
    mobileContainers.value.push(node)
  }
  if (!node) return
  const refs = [
    ...(trip.value.containerRefs || []),
    {
      containerId: node.id,
      nameSnapshot: node.name,
      iconSnapshot: node.icon || "🎒",
      sortOrder: trip.value.containerRefs?.length || 0,
    },
  ]
  await persist(allItems.value, refs)
  showContainerSheet.value = false
  selectedExistingId.value = ""
  newContainerName.value = ""
  flash("移动容器已加入行程")
}

function openLibrary(containerId) {
  router.push({
    path: `/plans/${trip.value.id}/carry/${containerId}/items`,
    query: { return: route.fullPath },
  })
}

function finish() {
  router.push(typeof route.query.return === "string" ? route.query.return : `/plans/${route.params.id}`)
}
</script>

<template>
  <div class="carry-page">
    <header class="carry-topbar">
      <button aria-label="返回" @click="router.back()">‹</button>
      <h1>携带物品清单</h1>
      <button @click="finish">完成</button>
    </header>

    <main v-if="trip" class="carry-scroll">
      <section class="preference-card">
        <span class="preference-icon">★</span>
        <span
          ><b>星标物品提醒</b><small>当前规则：{{ reminderSummary }}</small></span
        >
        <button @click="router.push('/me?section=preferences')">设置 ›</button>
      </section>

      <div class="carry-heading">
        <h2>物品清单</h2>
        <span>{{ groups.length }} 个移动容器 · {{ allItems.length }} 项</span>
      </div>
      <div class="selection-tools">
        <button @click="selectAll">全选全部物品</button>
        <button @click="clearSelection">清除选择</button>
      </div>

      <section
        v-for="group in groups"
        :key="group.containerId"
        class="container-card"
        @dragover.prevent
        @drop.prevent="dropOn(group.containerId)"
      >
        <header>
          <span>{{ group.iconSnapshot || "🎒" }}</span>
          <span
            ><b>{{ group.nameSnapshot }}</b
            ><small
              >{{ group.items.length }} 项 · {{ group.items.filter((item) => item.starred).length }} 项星标</small
            ></span
          >
          <i>•••</i>
        </header>
        <div v-if="!group.items.length" class="empty-container">还没有物品，点击下方从物品库添加</div>
        <div
          v-for="entry in group.items"
          :key="entry.id"
          class="swipe-shell"
          :class="{ revealed: openSwipeId === entry.id }"
          draggable="true"
          @dragstart="startDrag(entry.id)"
          @touchstart="onTouchStart"
          @touchend="onTouchEnd($event, entry.id)"
        >
          <button class="swipe-delete" @click="removeEntries([entry.id])">移出</button>
          <div class="item-row">
            <button
              class="item-check"
              :class="{ selected: selectedIds.has(entry.id) }"
              :aria-label="selectedIds.has(entry.id) ? `取消选择${entry.nameSnapshot}` : `选择${entry.nameSnapshot}`"
              @click="toggleSelection(entry.id)"
            >
              {{ selectedIds.has(entry.id) ? "✓" : "" }}
            </button>
            <span class="item-image">
              <img v-if="entry.imageSnapshot" :src="entry.imageSnapshot" alt="" />
              <template v-else>▣</template>
            </span>
            <span
              ><b>{{ entry.nameSnapshot }}</b
              ><small>{{ entry.categorySnapshot || "未分类" }}</small></span
            >
            <button
              class="item-star"
              :class="{ starred: entry.starred }"
              :aria-label="entry.starred ? `取消${entry.nameSnapshot}的星标` : `给${entry.nameSnapshot}加星标`"
              @click="toggleStar(entry)"
            >
              ★
            </button>
          </div>
        </div>
        <button class="add-from-library" @click="openLibrary(group.containerId)">＋ 从物品库添加</button>
      </section>

      <button class="add-container" @click="showContainerSheet = true">
        <span>＋</span><span><b>添加移动容器</b><small>选择现有容器，或新建并同步到物品空间</small></span
        ><i>›</i>
      </button>
    </main>

    <footer v-if="selectedIds.size" class="batch-bar">
      <span>已选 {{ selectedIds.size }} 项</span>
      <button @click="toggleBatchStar">{{ selectedAreStarred ? "清除标记" : "标记" }}</button>
      <button @click="showMoveSheet = true">移动</button>
      <button class="danger" @click="removeEntries([...selectedIds])">删除</button>
    </footer>

    <div v-if="showContainerSheet" class="sheet-layer" @click.self="showContainerSheet = false">
      <section class="sheet-card">
        <div class="sheet-handle"></div>
        <h2>添加移动容器</h2>
        <label
          >选择现有移动容器<select v-model="selectedExistingId">
            <option value="">不选择</option>
            <option v-for="node in availableContainers" :key="node.id" :value="node.id">
              {{ node.icon || "🎒" }} {{ node.name }}
            </option>
          </select></label
        >
        <div class="sheet-divider"><span>或新建</span></div>
        <label
          >容器名称<input
            v-model="newContainerName"
            :disabled="Boolean(selectedExistingId)"
            placeholder="例如：周末背包"
        /></label>
        <label
          >保存到分区<select v-model="newContainerSectionId" :disabled="Boolean(selectedExistingId)">
            <option v-for="section in sections" :key="section.id" :value="section.id">{{ section.name }}</option>
          </select></label
        >
        <button class="sheet-primary" :disabled="!selectedExistingId && !newContainerName.trim()" @click="addContainer">
          创建并加入
        </button>
      </section>
    </div>

    <div v-if="showMoveSheet" class="sheet-layer" @click.self="showMoveSheet = false">
      <section class="sheet-card">
        <div class="sheet-handle"></div>
        <h2>移动到其他容器</h2>
        <button
          v-for="group in groups"
          :key="group.containerId"
          class="move-choice"
          @click="moveEntries(group.containerId)"
        >
          <span>{{ group.iconSnapshot || "🎒" }}</span
          ><b>{{ group.nameSnapshot }}</b
          ><i>›</i>
        </button>
      </section>
    </div>

    <div v-if="message" class="carry-toast">{{ message }}</div>
  </div>
</template>

<style scoped>
.carry-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7f5ef;
  color: #26241f;
}
.carry-topbar {
  flex: none;
  min-height: 58px;
  padding: max(10px, env(safe-area-inset-top)) 16px 10px;
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: end;
  background: #fff;
  border-bottom: 1px solid #e8e4db;
}
.carry-topbar h1 {
  margin: 0;
  text-align: center;
  font-size: 17px;
}
.carry-topbar button {
  border: 0;
  background: transparent;
  color: #197b72;
  font-weight: 700;
}
.carry-topbar button:first-child {
  text-align: left;
  font-size: 30px;
  line-height: 28px;
}
.carry-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px max(90px, env(safe-area-inset-bottom));
}
.preference-card,
.add-container {
  width: 100%;
  display: grid;
  grid-template-columns: 42px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 13px;
  border: 1px solid #e5e1d8;
  border-radius: 18px;
  background: #fff;
  text-align: left;
}
.preference-icon,
.add-container > span:first-child {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: #f4e8da;
  color: #97611f;
  font-size: 20px;
}
.preference-card b,
.preference-card small,
.add-container b,
.add-container small {
  display: block;
}
.preference-card b,
.add-container b {
  font-size: 13px;
}
.preference-card small,
.add-container small {
  margin-top: 3px;
  color: #98948c;
  font-size: 10px;
}
.preference-card button {
  border: 0;
  background: transparent;
  color: #197b72;
  font-size: 11px;
  font-weight: 700;
}
.carry-heading {
  margin: 18px 2px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.carry-heading h2 {
  margin: 0;
  font-size: 15px;
}
.carry-heading span {
  color: #99958d;
  font-size: 11px;
}
.selection-tools {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.selection-tools button {
  border: 0;
  border-radius: 10px;
  padding: 7px 10px;
  background: #e7f3f1;
  color: #1b756d;
  font-size: 11px;
  font-weight: 700;
}
.container-card {
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid #e5e1d8;
  border-radius: 20px;
  background: #fff;
}
.container-card > header {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  background: #fbfaf7;
}
.container-card > header > span:first-child {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: #eee8df;
  font-size: 20px;
}
.container-card header b,
.container-card header small {
  display: block;
}
.container-card header b {
  font-size: 13px;
}
.container-card header small {
  margin-top: 3px;
  color: #99958d;
  font-size: 10px;
}
.container-card header i {
  color: #b5b0a7;
  font-style: normal;
  letter-spacing: 1px;
}
.empty-container {
  padding: 20px 14px;
  text-align: center;
  color: #aaa69e;
  font-size: 11px;
}
.swipe-shell {
  position: relative;
  overflow: hidden;
  border-top: 1px solid #eeeae2;
}
.swipe-delete {
  position: absolute;
  inset: 0 0 0 auto;
  width: 68px;
  border: 0;
  background: #d9544d;
  color: #fff;
  font-weight: 700;
}
.item-row {
  position: relative;
  z-index: 1;
  min-height: 58px;
  display: grid;
  grid-template-columns: 27px 38px 1fr 34px;
  align-items: center;
  gap: 9px;
  padding: 9px 12px;
  background: #fff;
  transition: transform 0.18s ease;
}
.swipe-shell.revealed .item-row {
  transform: translateX(-68px);
}
.item-check {
  width: 23px;
  height: 23px;
  border: 1.5px solid #d7d3ca;
  border-radius: 8px;
  background: #fff;
  color: #fff;
  font-size: 12px;
}
.item-check.selected {
  border-color: #1b8b80;
  background: #1b8b80;
}
.item-image {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 12px;
  background: #e7f3f1;
  color: #337e78;
}
.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.item-row b,
.item-row small {
  display: block;
}
.item-row b {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-row small {
  margin-top: 3px;
  color: #a09c94;
  font-size: 10px;
}
.item-star {
  border: 0;
  background: transparent;
  color: #d4d0c8;
  font-size: 22px;
}
.item-star.starred {
  color: #bd7a28;
}
.add-from-library {
  width: 100%;
  border: 0;
  border-top: 1px solid #eeeae2;
  padding: 12px;
  background: #fff;
  color: #197b72;
  font-size: 12px;
  font-weight: 750;
}
.add-container {
  margin: 4px 0 10px;
}
.add-container i {
  color: #b4afa6;
  font-style: normal;
}
.batch-bar {
  position: absolute;
  z-index: 20;
  left: 12px;
  right: 12px;
  bottom: max(12px, env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: 1fr repeat(3, auto);
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  border: 1px solid #ded9cf;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 12px 32px rgba(39, 35, 27, 0.18);
}
.batch-bar span {
  font-size: 11px;
  color: #77736b;
}
.batch-bar button {
  border: 0;
  border-radius: 10px;
  padding: 8px 10px;
  background: #e7f3f1;
  color: #176f67;
  font-size: 11px;
  font-weight: 700;
}
.batch-bar button.danger {
  background: #fdeceb;
  color: #bd3d38;
}
.sheet-layer {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(20, 18, 14, 0.34);
}
.sheet-card {
  width: 100%;
  padding: 10px 18px max(24px, env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  background: #fff;
}
.sheet-handle {
  width: 38px;
  height: 4px;
  margin: 0 auto 16px;
  border-radius: 4px;
  background: #ddd8cf;
}
.sheet-card h2 {
  margin: 0 0 16px;
  font-size: 17px;
}
.sheet-card label {
  display: block;
  margin: 12px 0;
  color: #77736b;
  font-size: 11px;
  font-weight: 650;
}
.sheet-card input,
.sheet-card select {
  width: 100%;
  min-height: 44px;
  margin-top: 6px;
  border: 1px solid #dedad1;
  border-radius: 12px;
  padding: 9px 11px;
  background: #fbfaf7;
  font-size: 13px;
}
.sheet-divider {
  height: 1px;
  margin: 18px 0;
  background: #eeeae2;
  text-align: center;
}
.sheet-divider span {
  position: relative;
  top: -8px;
  padding: 0 8px;
  background: #fff;
  color: #aaa69e;
  font-size: 10px;
}
.sheet-primary {
  width: 100%;
  min-height: 48px;
  margin-top: 8px;
  border: 0;
  border-radius: 15px;
  background: #1b8b80;
  color: #fff;
  font-weight: 750;
}
.sheet-primary:disabled {
  opacity: 0.45;
}
.move-choice {
  width: 100%;
  display: grid;
  grid-template-columns: 38px 1fr auto;
  align-items: center;
  gap: 10px;
  border: 0;
  border-top: 1px solid #eeeae2;
  padding: 12px 2px;
  background: #fff;
  text-align: left;
}
.move-choice span {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: #f0ece4;
}
.move-choice i {
  color: #aaa69e;
  font-style: normal;
}
.carry-toast {
  position: fixed;
  z-index: 70;
  left: 50%;
  bottom: 90px;
  transform: translateX(-50%);
  padding: 9px 14px;
  border-radius: 12px;
  background: rgba(31, 29, 25, 0.9);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
}
</style>
