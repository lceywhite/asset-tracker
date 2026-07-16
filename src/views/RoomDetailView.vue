<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useRoomStore } from "@/stores/useRoomStore"
import { useItemStore } from "@/stores/useItemStore"
import * as itemSvc from "@/services/itemService"
import ItemEditSheet from "@/components/item/ItemEditSheet.vue"
const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const itemStore = useItemStore()
const searchQ = ref("")
const activeFilter = ref("")
const showAdd = ref(false)
const addTab = ref("pick")
const picked = ref([])
function closeAddSheet() {
  showAdd.value = false
  addTab.value = "pick"
}
const room = computed(() => roomStore.rooms.find((r) => r.id === route.params.id))
const items = computed(() => {
  let list = itemStore.items.filter((i) => i.roomId === route.params.id)
  if (searchQ.value) {
    const q = searchQ.value.toLowerCase()
    list = list.filter((i) => i.name.toLowerCase().includes(q))
  }
  if (activeFilter.value) list = list.filter((i) => i.category === activeFilter.value)
  return list
})
const totalValue = computed(() => items.value.reduce((s, i) => s + (i.value || 0), 0))
const categories = computed(() => {
  const s = new Set(
    itemStore.items
      .filter((i) => i.roomId === route.params.id)
      .map((i) => i.category)
      .filter(Boolean),
  )
  return [...s]
})
const availableItems = computed(() => itemStore.items.filter((i) => i.roomId !== route.params.id))
onMounted(async () => {
  await Promise.all([roomStore.loadAll(), itemStore.loadItems()])
})
function togglePicked(id) {
  picked.value = picked.value.includes(id) ? picked.value.filter((x) => x !== id) : [...picked.value, id]
}
async function confirmPick() {
  for (const id of picked.value) {
    await itemSvc.updateItem(id, { roomId: room.value.id })
  }
  await itemStore.loadItems()
  picked.value = []
  showAdd.value = false
}
function onCreated(item) {
  showAdd.value = false
  router.push("/item/" + item.id)
}
</script>
<template>
  <div class="flex flex-col h-full bg-gray-50">
    <div class="flex items-center gap-2 px-4 py-3 bg-white border-b">
      <button
        @click="router.back()"
        class="text-lg w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
      >
        &larr;
      </button>
      <div class="flex-1 text-base font-bold">{{ room?.icon || "🚪" }} {{ room?.name || "房间" }}</div>
      <span></span>
    </div>
    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <div class="flex items-center justify-between mt-3 mb-3">
        <span class="text-xs text-gray-400">{{ items.length }} 件 · 总价值 ¥{{ totalValue }}</span>
      </div>
      <div class="flex gap-2 mb-3 overflow-x-auto" v-if="categories.length">
        <button
          @click="activeFilter = ''"
          :class="!activeFilter ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border'"
          class="px-3 py-1.5 rounded-full text-xs flex-shrink-0"
        >
          全部
        </button>
        <button
          v-for="c in categories"
          :key="c"
          @click="activeFilter = activeFilter === c ? '' : c"
          :class="activeFilter === c ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border'"
          class="px-3 py-1.5 rounded-full text-xs flex-shrink-0"
        >
          {{ c }}
        </button>
      </div>
      <div class="bg-gray-100 rounded-xl flex items-center gap-2 px-3 h-9 mb-3">
        <span class="text-xs text-gray-400">🔍</span
        ><input
          v-model="searchQ"
          class="flex-1 bg-transparent border-none outline-none text-sm"
          placeholder="搜索本房间物品..."
        />
      </div>
      <div v-if="items.length === 0" class="text-center py-12 text-sm text-gray-400">暂无物品</div>
      <div v-else class="bg-white rounded-xl border divide-y overflow-hidden">
        <div
          v-for="item in items"
          :key="item.id"
          @click="router.push('/item/' + item.id)"
          class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
        >
          <span class="text-lg w-7 text-center">📦</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ item.name }}</div>
            <div class="text-xs text-gray-400">
              {{ item.category }}<span v-if="item.value"> · ¥{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
      <div
        @click="showAdd = true"
        class="mt-4 flex items-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 text-blue-600 transition-all justify-center"
      >
        <span class="text-sm font-bold">+</span><span class="text-xs font-medium">添加物品到此房间</span>
      </div>
    </div>

    <div
      v-if="showAdd && addTab === 'pick'"
      class="fixed inset-0 z-50 flex flex-col justify-end bg-black/30"
      @click.self="showAdd = false"
    >
      <div class="bg-white rounded-t-2xl max-h-[75vh] flex flex-col overflow-hidden">
        <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3"></div>
        <div class="text-center text-base font-bold py-3 border-b">添加物品到 {{ room?.name }}</div>
        <div class="flex-1 overflow-y-auto px-4 py-3">
          <div v-if="availableItems.length === 0" class="text-center py-6 text-sm text-gray-400">
            所有物品已在此房间中
          </div>
          <div
            v-for="item in availableItems"
            :key="item.id"
            @click="togglePicked(item.id)"
            class="flex items-center gap-3 py-3 px-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 rounded-lg"
            :class="picked.includes(item.id) ? 'bg-blue-50' : ''"
          >
            <div
              class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
              :class="picked.includes(item.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'"
            >
              <span v-if="picked.includes(item.id)" class="text-white text-xs">&#10003;</span>
            </div>
            <span class="text-lg">📦</span>
            <div class="flex-1">
              <div class="text-sm font-medium">{{ item.name }}</div>
              <div class="text-xs text-gray-400">{{ item.category }}</div>
            </div>
          </div>
        </div>
        <div class="px-4 py-3 border-t space-y-2">
          <button
            @click="addTab = 'create'"
            class="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-green-600 hover:border-green-300"
          >
            ➕ 新建物品并加入
          </button>
          <button
            @click="confirmPick"
            :disabled="picked.length === 0"
            class="w-full py-2.5 rounded-xl text-sm font-semibold"
            :class="picked.length ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'"
          >
            确认添加（{{ picked.length }}）
          </button>
        </div>
      </div>
    </div>
    <ItemEditSheet
      v-if="showAdd && addTab === 'create'"
      :show="true"
      :preset-room-id="room?.id || ''"
      @close="closeAddSheet"
      @created="onCreated"
    />
  </div>
</template>
