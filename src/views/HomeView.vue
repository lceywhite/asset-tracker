<script setup>
import { ref, computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { useBagStore } from "@/stores/useBagStore"
import { useRoomStore } from "@/stores/useRoomStore"
import { useItemStore } from "@/stores/useItemStore"
import { useSectionStore } from "@/stores/useSectionStore"
import * as bagSvc from "@/services/bagService"
import * as roomSvc from "@/services/roomService"
import * as secSvc from "@/services/sectionService"
const router = useRouter()
const bagStore = useBagStore()
const roomStore = useRoomStore()
const itemStore = useItemStore()
const sectionStore = useSectionStore()
const searchQuery = ref("")
const viewMode = ref(localStorage.getItem("asset-tracker-item-view") || "card")
function toggleViewMode() {
  viewMode.value = viewMode.value === "card" ? "table" : "card"
  localStorage.setItem("asset-tracker-item-view", viewMode.value)
}
const showCreateBag = ref(false)
const showCreateRoom = ref(false)
const showSectionPicker = ref(false)
const builtinNames = ref({})
function loadBuiltinNames() {
  try {
    return JSON.parse(localStorage.getItem("asset-guard-builtin-names") || "{}")
  } catch {
    return {}
  }
}
function saveBuiltinName(id, name) {
  var n = loadBuiltinNames()
  n[id] = name
  localStorage.setItem("asset-guard-builtin-names", JSON.stringify(n))
  builtinNames.value = n
}
const editTarget = ref(null)
const editType = ref("")
const editName = ref("")
const editIcon = ref("")
const popupShow = ref(false)
const popupTarget = ref(null)
const confirmDelete = ref(false)
const currentSection = ref(null)
const newName = ref("")
const newIcon = ref("🎒")
const newSecName = ref("")
const newSecIcon = ref("📦")
const newSecType = ref("bag")
const secIcons = ["📦", "🧰", "🛠️", "📚", "🎮", "👟", "🧥", "🎨", "🪴", "🧺"]

onMounted(async () => {
  await Promise.all([bagStore.loadAll(), roomStore.loadAll(), itemStore.loadItems()])
  sectionStore.loadAll()
  builtinNames.value = loadBuiltinNames()
})
const bagCounts = computed(() => {
  const m = {}
  for (const i of itemStore.items) if (i.bagId) m[i.bagId] = (m[i.bagId] || 0) + 1
  return m
})
const roomCounts = computed(() => {
  const m = {}
  for (const i of itemStore.items) if (i.roomId) m[i.roomId] = (m[i.roomId] || 0) + 1
  return m
})
const searchResults = computed(() => {
  if (!searchQuery.value) return []
  return itemStore.search(searchQuery.value)
})
const itemGroups = computed(() => {
  const g = {}
  const s = itemStore.items.filter((i) => i.category)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    s.forEach((i) => {
      if (i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)) {
        const c = i.category || "其他"
        if (!g[c]) g[c] = []
        g[c].push(i)
      }
    })
  } else {
    s.forEach((i) => {
      const c = i.category || "其他"
      if (!g[c]) g[c] = []
      g[c].push(i)
    })
  }
  return g
})

function editBag(bag) {
  editType.value = "bag"
  editTarget.value = bag
  editName.value = bag.name
  editIcon.value = bag.icon || "🎒"
}
function editRoom(room) {
  editType.value = "room"
  editTarget.value = room
  editName.value = room.name
  editIcon.value = room.icon || "🚪"
}
async function saveEdit() {
  if (!editName.value.trim() || !editTarget.value) return
  if (editType.value === "bag") {
    await bagSvc.update(editTarget.value.id, { name: editName.value.trim(), icon: editIcon.value })
  } else if (editType.value === "room") {
    await roomSvc.update(editTarget.value.id, { name: editName.value.trim(), icon: editIcon.value })
  } else if (editType.value === "section") {
    if (editTarget.value.isBuiltin) {
      saveBuiltinName(editTarget.value.id, editName.value.trim())
    } else {
      secSvc.update(editTarget.value.id, { name: editName.value.trim(), icon: editIcon.value })
      sectionStore.loadAll()
    }
  }
  await bagStore.loadAll()
  await roomStore.loadAll()
  editTarget.value = null
}
async function createBag() {
  if (!newName.value.trim()) return
  var b = await bagStore.create({ name: newName.value.trim(), icon: newIcon.value, spaceId: "private" })
  if (currentSection.value) {
    currentSection.value.bagIds.push(b.id)
    secSvc.update(currentSection.value.id, { bagIds: currentSection.value.bagIds })
    sectionStore.loadAll()
    currentSection.value = null
  }
  showCreateBag.value = false
  newName.value = ""
}
async function createRoom() {
  if (!newName.value.trim()) return
  var r = await roomStore.create({ name: newName.value.trim(), icon: newIcon.value, spaceId: "private" })
  if (currentSection.value) {
    currentSection.value.roomIds.push(r.id)
    secSvc.update(currentSection.value.id, { roomIds: currentSection.value.roomIds })
    sectionStore.loadAll()
    currentSection.value = null
  }
  showCreateRoom.value = false
  newName.value = ""
}
function openCreateInSection(sec) {
  currentSection.value = sec
  if (sec.type === "bag") showCreateBag.value = true
  else showCreateRoom.value = true
}
function showPopup(type, item) {
  popupTarget.value = { type, item }
  popupShow.value = true
}
function closePopup() {
  popupShow.value = false
  setTimeout(() => {
    popupTarget.value = null
  }, 200)
}
function popupEdit() {
  if (!popupTarget.value) return
  if (popupTarget.value.type === "bag") editBag(popupTarget.value.item)
  else if (popupTarget.value.type === "room") editRoom(popupTarget.value.item)
  else if (popupTarget.value.type === "section") {
    editType.value = "section"
    editTarget.value = popupTarget.value.item
    editName.value = popupTarget.value.item.isBuiltin
      ? builtinNames.value[popupTarget.value.item.id] || popupTarget.value.item.name
      : popupTarget.value.item.name
    editIcon.value = popupTarget.value.item.icon || "📦"
  }
  closePopup()
}
async function popupDelete() {
  if (!popupTarget.value) return
  if (popupTarget.value.type === "bag") await bagSvc.del(popupTarget.value.item.id)
  else if (popupTarget.value.type === "room") await roomSvc.del(popupTarget.value.item.id)
  else if (popupTarget.value.type === "section" && !popupTarget.value.item.isBuiltin) {
    secSvc.remove(popupTarget.value.item.id)
    sectionStore.loadAll()
  }
  await bagStore.loadAll()
  await roomStore.loadAll()
  closePopup()
}
async function confirmPopupDelete() {
  await popupDelete()
  confirmDelete.value = false
}
function confirmSectionCreate() {
  if (!newSecName.value.trim()) return
  sectionStore.create({ name: newSecName.value.trim(), icon: newSecIcon.value, type: newSecType.value })
  showSectionPicker.value = false
  newSecName.value = ""
}
const bagIcons = ["🎒", "🧳", "👜", "👝", "💼", "🛄"]
const roomIcons = ["🛏️", "📖", "🍳", "🚪", "🛋️", "🚿", "🪴", "🧺"]
</script>
<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
      <div class="flex-1 flex items-center bg-gray-100 rounded-xl px-3 h-9 gap-2">
        <span class="text-sm text-gray-400">🔍</span
        ><input
          v-model="searchQuery"
          type="text"
          placeholder="搜索物品"
          class="flex-1 bg-transparent border-none outline-none text-sm"
        />
      </div>
      <div
        @click="toggleViewMode"
        class="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-sm text-gray-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        {{ viewMode === "card" ? "⊞" : "⊟" }}
      </div>
    </div>
    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <div v-if="searchQuery" class="mt-3">
        <div class="text-xs text-gray-400 mb-2">找到 {{ searchResults.length }} 件物品</div>
        <div v-if="searchResults.length === 0" class="text-center py-8 text-sm text-gray-400">没有匹配的物品</div>
        <div v-else class="bg-white rounded-xl border divide-y overflow-hidden">
          <div
            v-for="item in searchResults"
            :key="item.id"
            @click="router.push('/item/' + item.id)"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
          >
            <span class="text-xl">📦</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ item.name }}</div>
              <div class="text-xs text-gray-400">{{ item.category }}</div>
            </div>
          </div>
        </div>
      </div>
      <template v-if="!searchQuery && viewMode === 'card'">
        <!-- Bags -->
        <div class="mt-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-bold">
              🎒 {{ builtinNames._bags || "\u6211\u7684\u5305\u5305" }}
              <span class="text-xs text-gray-400 font-normal ml-1">{{ bagStore.bags.length }}</span>
            </h2>
            <div
              @click.stop="showPopup('section', { id: '_bags', name: '\u6211\u7684\u5305\u5305', isBuiltin: true })"
              class="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 cursor-pointer hover:bg-gray-200"
            >
              ⋯
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div
              v-for="bag in bagStore.bags"
              :key="bag.id"
              @click="router.push('/bag/' + bag.id)"
              class="bg-white rounded-xl border p-3 text-center relative cursor-pointer hover:shadow-sm transition-shadow group"
            >
              <div
                @click.stop="showPopup('bag', bag)"
                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ⋯
              </div>
              <span class="text-2xl block mb-1">{{ bag.icon || "🎒" }}</span>
              <div class="text-xs font-semibold text-gray-800 truncate">{{ bag.name }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">{{ bagCounts[bag.id] || 0 }} 件</div>
            </div>
            <div
              @click="showCreateBag = true"
              class="bg-transparent rounded-xl border-2 border-dashed border-gray-200 p-3 flex flex-col items-center justify-center min-h-[80px] cursor-pointer hover:border-blue-300 transition-colors"
            >
              <span class="text-lg text-gray-300">+</span><span class="text-[10px] text-gray-300">新建包</span>
            </div>
          </div>
        </div>
        <!-- Rooms -->
        <div class="mt-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-bold">
              🚪 {{ builtinNames._rooms || "\u6211\u7684\u623F\u95F4" }}
              <span class="text-xs text-gray-400 font-normal ml-1">{{ roomStore.rooms.length }}</span>
            </h2>
            <div
              @click.stop="showPopup('section', { id: '_rooms', name: '\u6211\u7684\u623F\u95F4', isBuiltin: true })"
              class="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 cursor-pointer hover:bg-gray-200"
            >
              ⋯
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div
              v-for="room in roomStore.rooms"
              :key="room.id"
              @click="router.push('/room/' + room.id)"
              class="bg-white rounded-xl border p-3 text-center relative cursor-pointer hover:shadow-sm transition-shadow group"
            >
              <div
                @click.stop="showPopup('room', room)"
                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ⋯
              </div>
              <span class="text-2xl block mb-1">{{ room.icon || "🚪" }}</span>
              <div class="text-xs font-semibold text-gray-800 truncate">{{ room.name }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">{{ roomCounts[room.id] || 0 }} 件</div>
            </div>
            <div
              @click="showCreateRoom = true"
              class="bg-transparent rounded-xl border-2 border-dashed border-gray-200 p-3 flex flex-col items-center justify-center min-h-[80px] cursor-pointer hover:border-blue-300 transition-colors"
            >
              <span class="text-lg text-gray-300">+</span><span class="text-[10px] text-gray-300">新建房间</span>
            </div>
          </div>
        </div>
        <!-- Custom Sections -->
        <div v-for="sec in sectionStore.sections.filter((s) => !s.builtin)" :key="sec.id" class="mt-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-bold" style="color: var(--color-text-primary)">
              {{ sec.icon || "📦" }} {{ sec.name }}
              <span class="text-xs text-gray-400 font-normal ml-1">{{
                sec.type === "bag" ? sec.bagIds?.length || 0 : sec.roomIds?.length || 0
              }}</span>
            </h2>
            <div
              @click.stop="showPopup('section', sec)"
              class="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 cursor-pointer hover:bg-gray-200"
            >
              ⋯
            </div>
          </div>
          <div v-if="sec.type === 'bag'" class="grid grid-cols-3 gap-3">
            <div
              v-for="bag in bagStore.bags.filter((b) => sec.bagIds?.includes(b.id))"
              :key="bag.id"
              @click="router.push('/bag/' + bag.id)"
              class="bg-white rounded-xl border p-3 text-center cursor-pointer hover:shadow-sm transition-shadow"
            >
              <span class="text-2xl block mb-1">{{ bag.icon || "🎒" }}</span>
              <div class="text-xs font-semibold truncate">{{ bag.name }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">{{ bagCounts[bag.id] || 0 }} 件</div>
            </div>
            <div
              @click="openCreateInSection(sec)"
              class="bg-transparent rounded-xl border-2 border-dashed border-gray-200 p-3 flex flex-col items-center justify-center min-h-[80px] cursor-pointer hover:border-blue-300 transition-colors"
            >
              <span class="text-lg text-gray-300">+</span><span class="text-[10px] text-gray-300">新建包</span>
            </div>
          </div>
          <div v-if="sec.type === 'room'" class="grid grid-cols-3 gap-3">
            <div
              v-for="room in roomStore.rooms.filter((r) => sec.roomIds?.includes(r.id))"
              :key="room.id"
              @click="router.push('/room/' + room.id)"
              class="bg-white rounded-xl border p-3 text-center cursor-pointer hover:shadow-sm transition-shadow"
            >
              <span class="text-2xl block mb-1">{{ room.icon || "🚪" }}</span>
              <div class="text-xs font-semibold truncate">{{ room.name }}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">{{ roomCounts[room.id] || 0 }} 件</div>
            </div>
            <div
              @click="openCreateInSection(sec)"
              class="bg-transparent rounded-xl border-2 border-dashed border-gray-200 p-3 flex flex-col items-center justify-center min-h-[80px] cursor-pointer hover:border-blue-300 transition-colors"
            >
              <span class="text-lg text-gray-300">+</span><span class="text-[10px] text-gray-300">新建房间</span>
            </div>
          </div>
        </div>
        <div
          @click="showSectionPicker = true"
          class="mt-5 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 text-gray-400 hover:text-blue-500 transition-all"
        >
          <span class="text-base font-bold">+</span><span class="text-xs font-medium">添加新分区（自定义分组）</span>
        </div>
      </template>
      <template v-if="!searchQuery && viewMode === 'table'">
        <div v-for="(items, cat) in itemGroups" :key="cat" class="mt-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm font-bold text-gray-700">{{ cat }}</span
            ><span class="text-xs text-gray-400">{{ items.length }} 件</span>
          </div>
          <div class="bg-white rounded-xl border divide-y overflow-hidden mb-4">
            <div
              v-for="item in items"
              :key="item.id"
              @click="router.push('/item/' + item.id)"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <span class="text-base w-6 text-center">📦</span
              ><span class="flex-1 font-medium truncate">{{ item.name }}</span
              ><span class="text-xs text-gray-400">{{ item.value ? "¥" + item.value : "—" }}</span
              ><span class="text-[10px] text-gray-400 min-w-[40px] text-right">{{
                item.bagId ? "🎒" : item.roomId ? "🚪" : ""
              }}</span>
            </div>
          </div>
        </div>
        <div v-if="Object.keys(itemGroups).length === 0" class="text-center py-12 text-sm text-gray-400">暂无物品</div>
      </template>
    </div>

    <!-- Popup Menu -->
    <div v-if="popupShow" class="fixed inset-0 z-50" @click="closePopup">
      <div class="absolute inset-0 bg-black/20"></div>
      <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl px-4 pb-6 pt-3" @click.stop>
        <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
        <div class="text-center text-sm text-gray-400 mb-4">
          {{ popupTarget?.type === "bag" ? "🎒" : popupTarget?.type === "room" ? "🚪" : "📦" }}
          {{ popupTarget?.item?.name }}
        </div>
        <button @click="popupEdit" class="w-full py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 rounded-xl">
          编辑</button
        ><button
          @click="confirmDelete = true"
          :class="
            popupTarget?.item?.isBuiltin
              ? 'w-full py-3 text-sm font-medium text-gray-300 rounded-xl'
              : 'w-full py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl'
          "
        >
          {{ popupTarget?.item?.isBuiltin ? "\u4E0D\u53EF\u5220\u9664" : "\u5220\u9664" }}
        </button>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div
      v-if="confirmDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      @click.self="confirmDelete = false"
    >
      <div class="bg-white rounded-xl p-5 mx-4 max-w-xs w-full">
        <h3 class="text-sm font-bold mb-2">确认删除</h3>
        <p class="text-xs text-gray-500 mb-4">删除后不可恢复</p>
        <div class="flex gap-3">
          <button
            @click="confirmDelete = false"
            class="flex-1 py-2 border rounded-lg text-xs font-medium text-gray-600"
          >
            取消</button
          ><button @click="confirmPopupDelete" class="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-medium">
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div
      v-if="editTarget"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      @click.self="editTarget = null"
    >
      <div class="bg-white rounded-t-2xl w-full max-w-lg px-5 pt-4 pb-6">
        <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
        <h3 class="text-base font-bold text-center mb-4">
          {{ editType === "bag" ? "🎒 编辑包包" : editType === "room" ? "🚪 编辑房间" : "📦 编辑分区" }}
        </h3>
        <div class="flex items-center gap-1 overflow-x-auto p-1 bg-gray-50 rounded-xl mb-3">
          <button
            v-for="c in editType === 'bag' ? bagIcons : editType === 'room' ? roomIcons : bagIcons.concat(roomIcons)"
            :key="c"
            @click="editIcon = c"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            :class="editIcon === c ? 'bg-white shadow-sm' : ''"
          >
            {{ c }}
          </button>
        </div>
        <input v-model="editName" class="w-full border rounded-xl px-3 py-2.5 text-sm" placeholder="名称" />
        <div class="flex gap-3 mt-6">
          <button @click="editTarget = null" class="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-600">
            取消</button
          ><button @click="saveEdit" class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- Create Bag Modal -->
    <div
      v-if="showCreateBag"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      @click.self="showCreateBag = false"
    >
      <div class="bg-white rounded-t-2xl w-full max-w-lg px-5 pt-4 pb-6">
        <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
        <h3 class="text-base font-bold text-center mb-4">🎒 新建包包</h3>
        <div class="flex items-center gap-1 overflow-x-auto p-1 bg-gray-50 rounded-xl mb-3">
          <button
            v-for="c in bagIcons"
            :key="c"
            @click="newIcon = c"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            :class="newIcon === c ? 'bg-white shadow-sm' : ''"
          >
            {{ c }}
          </button>
        </div>
        <input v-model="newName" class="w-full border rounded-xl px-3 py-2.5 text-sm" placeholder="包包名称" />
        <div class="flex gap-3 mt-6">
          <button
            @click="showCreateBag = false"
            class="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-600"
          >
            取消</button
          ><button @click="createBag" class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- Create Room Modal -->
    <div
      v-if="showCreateRoom"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      @click.self="showCreateRoom = false"
    >
      <div class="bg-white rounded-t-2xl w-full max-w-lg px-5 pt-4 pb-6">
        <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
        <h3 class="text-base font-bold text-center mb-4">🚪 新建房间</h3>
        <div class="flex items-center gap-1 overflow-x-auto p-1 bg-gray-50 rounded-xl mb-3">
          <button
            v-for="c in roomIcons"
            :key="c"
            @click="newIcon = c"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            :class="newIcon === c ? 'bg-white shadow-sm' : ''"
          >
            {{ c }}
          </button>
        </div>
        <input v-model="newName" class="w-full border rounded-xl px-3 py-2.5 text-sm" placeholder="房间名称" />
        <div class="flex gap-3 mt-6">
          <button
            @click="showCreateRoom = false"
            class="flex-1 py-2.5 border rounded-xl text-sm font-medium text-gray-600"
          >
            取消</button
          ><button @click="createRoom" class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- Section Picker -->
    <div
      v-if="showSectionPicker"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      @click.self="showSectionPicker = false"
    >
      <div class="bg-white rounded-t-2xl w-full max-w-lg px-5 pt-4 pb-6">
        <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
        <h3 class="text-base font-bold text-center mb-4" style="color: var(--color-text-primary)">新建分区</h3>
        <div class="flex gap-2 mb-3">
          <button
            @click="newSecType = 'bag'"
            class="flex-1 py-2 rounded-xl text-xs font-medium"
            :style="
              newSecType === 'bag'
                ? 'background:var(--brand-primary);color:white'
                : 'background:var(--color-bg);color:var(--color-text-secondary);border:1px solid var(--color-border)'
            "
          >
            🎒 包包分区</button
          ><button
            @click="newSecType = 'room'"
            class="flex-1 py-2 rounded-xl text-xs font-medium"
            :style="
              newSecType === 'room'
                ? 'background:var(--brand-primary);color:white'
                : 'background:var(--color-bg);color:var(--color-text-secondary);border:1px solid var(--color-border)'
            "
          >
            🚪 房间分区
          </button>
        </div>
        <div class="flex items-center gap-1 overflow-x-auto p-1 bg-gray-50 rounded-xl mb-3">
          <button
            v-for="c in newSecType === 'bag' ? bagIcons : roomIcons"
            :key="c"
            @click="newSecIcon = c"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            :class="newSecIcon === c ? 'bg-white shadow-sm' : ''"
          >
            {{ c }}
          </button>
        </div>
        <input
          v-model="newSecName"
          @keydown.enter="confirmSectionCreate"
          class="w-full border rounded-xl px-3 py-2.5 text-sm"
          placeholder="分区名称"
          style="border-color: var(--color-border)"
        />
        <div class="flex gap-3 mt-4">
          <button
            @click="showSectionPicker = false"
            class="flex-1 py-2.5 border rounded-xl text-sm font-medium"
            style="border-color: var(--color-border); color: var(--color-text-secondary)"
          >
            取消</button
          ><button
            @click="confirmSectionCreate"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
            :style="newSecName.trim() ? 'background:var(--brand-primary)' : 'background:var(--color-text-tertiary)'"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
