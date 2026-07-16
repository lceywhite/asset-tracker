<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useItemStore } from "@/stores/useItemStore"
import { useBagStore } from "@/stores/useBagStore"
import { useRoomStore } from "@/stores/useRoomStore"
import * as locSvc from "@/services/locationService"
import ItemEditSheet from "@/components/item/ItemEditSheet.vue"
const route = useRoute()
const router = useRouter()
const itemStore = useItemStore()
const bagStore = useBagStore()
const roomStore = useRoomStore()
const item = ref(null)
const locs = ref([])
const showPicker = ref(false)
const showAdvanced = ref(false)
const showEdit = ref(false)

const bag = computed(() => {
  const i = item.value
  return i?.bagId ? bagStore.bags.find((b) => b.id === i.bagId) : null
})
const room = computed(() => {
  const i = item.value
  return i?.roomId ? roomStore.rooms.find((r) => r.id === i.roomId) : null
})
const statusInfo = computed(() => {
  const m = {
    in_stock: { label: "在库", bg: "#e6f7ee", color: "#1a9d5e" },
    lent: { label: "借出", bg: "#fef4e6", color: "#d4880f" },
    lost: { label: "丢失", bg: "#fef0f0", color: "#e55" },
    discarded: { label: "已丢弃", bg: "#f0f1f5", color: "#8e94a5" },
  }
  return m[item.value?.status] || m.in_stock
})

onMounted(async () => {
  await Promise.all([itemStore.loadItems(), bagStore.loadAll(), roomStore.loadAll()])
  item.value = itemStore.items.find((i) => i.id === route.params.id) || null
  if (item.value) locs.value = await locSvc.getByItem(item.value.id)
})
async function changeLocation(type, id) {
  if (!item.value) return
  const oldBag = item.value.bagId
  const oldRoom = item.value.roomId
  const u = {}
  if (type === "bag") u.bagId = id
  if (type === "room") u.roomId = id
  await itemStore.editItem(item.value.id, u)
  await locSvc.record(item.value.id, type, type === "bag" ? oldBag : oldRoom, type, id)
  item.value = itemStore.items.find((i) => i.id === route.params.id)
  locs.value = await locSvc.getByItem(item.value.id)
  showPicker.value = false
}
async function onEdited() {
  showEdit.value = false
  await itemStore.loadItems()
  item.value = itemStore.items.find((i) => i.id === route.params.id)
  if (item.value) locs.value = await locSvc.getByItem(item.value.id)
}
function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch {
    return ts
  }
}
</script>
<template>
  <div class="flex flex-col h-full bg-gray-50">
    <div class="flex items-center gap-2 px-4 py-3 bg-white border-b">
      <button
        aria-label="返回"
        @click="router.back()"
        class="text-lg w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
      >
        &larr;
      </button>
      <div class="flex-1 text-base font-bold">物品详情</div>
      <button @click="showEdit = true" class="text-sm text-blue-600 font-medium">编辑</button>
    </div>
    <div class="flex-1 overflow-y-auto px-4 pb-4" v-if="item">
      <div class="flex gap-4 py-4 border-b bg-white -mx-4 px-4">
        <div class="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-3xl flex-shrink-0">📦</div>
        <div class="flex-1">
          <div class="text-base font-bold text-gray-800">{{ item.name }}</div>
          <div class="text-xs text-gray-400 mt-0.5">{{ item.category }}</div>
          <div
            class="mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
            :style="{ background: statusInfo.bg, color: statusInfo.color }"
          >
            ● {{ statusInfo.label }}
          </div>
        </div>
      </div>
      <div class="py-3 border-b bg-white -mx-4 px-4">
        <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">📍 当前位置</div>
        <div class="flex gap-6">
          <div>
            <div class="text-[10px] text-gray-400">常驻房间</div>
            <div class="text-sm font-semibold mt-0.5">{{ room?.icon || "🚪" }} {{ room?.name || "未设置" }}</div>
          </div>
          <div>
            <div class="text-[10px] text-gray-400">所属包包</div>
            <div class="text-sm font-semibold mt-0.5">{{ bag?.icon || "🎒" }} {{ bag?.name || "未分配" }}</div>
          </div>
        </div>
      </div>
      <div class="py-3 border-b bg-white -mx-4 px-4">
        <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">📋 位置变动记录</div>
        <div v-if="locs.length === 0" class="text-xs text-gray-400 py-2">暂无记录</div>
        <div v-else class="relative ml-1" style="border-left: 2px solid #e8ecf1">
          <div v-for="rec in [...locs].reverse()" :key="rec.id" class="relative pb-3 pl-4" style="margin-left: -2px">
            <div class="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white"></div>
            <div class="text-[10px] text-gray-400">{{ fmtTime(rec.timestamp) }}</div>
            <div class="text-xs mt-0.5 text-gray-600">
              {{ rec.fromId?.substring(0, 6) || "新物品" }} → {{ rec.toId?.substring(0, 6) || "未知" }}
            </div>
          </div>
        </div>
      </div>
      <div class="py-3 border-b bg-white -mx-4 px-4">
        <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">🏷️ 标签</div>
        <div class="flex gap-1.5 flex-wrap">
          <span
            v-for="t in item.tags"
            :key="t"
            class="px-2.5 py-1 rounded-lg text-xs font-medium"
            :class="
              t === '重要'
                ? 'bg-red-50 text-red-500'
                : t === '必带'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-gray-100 text-gray-600'
            "
            >{{ t }}</span
          >
          <span class="px-2.5 py-1 rounded-lg text-xs text-gray-400 bg-gray-50 cursor-pointer">+ 添加</span>
        </div>
      </div>
      <div class="py-3 border-b bg-white -mx-4 px-4">
        <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">📄 基本信息</div>
        <div class="space-y-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">分类</span><span class="font-medium">{{ item.category || "—" }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">价值</span
            ><span class="font-medium">{{ item.value ? "¥" + item.value : "—" }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">购买日期</span><span class="font-medium">{{ item.purchaseDate || "—" }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400">备注</span
            ><span class="font-medium text-right max-w-[200px] truncate">{{ item.notes || "—" }}</span>
          </div>
        </div>
      </div>
      <div class="py-3 bg-white -mx-4 px-4">
        <div @click="showAdvanced = !showAdvanced" class="flex items-center justify-between cursor-pointer">
          <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">⚙️ 高级属性</span>
          <span class="text-sm text-gray-300" :class="showAdvanced ? 'rotate-180' : ''">▼</span>
        </div>
        <div v-if="showAdvanced" class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400">物品编号</span
            ><span class="font-mono text-xs">{{ item.id?.substring(0, 12) || "—" }}</span>
          </div>
          <div class="mt-3 p-3 bg-gray-50 rounded-xl text-center">
            <div
              class="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-2 text-[10px] text-gray-400"
            >
              QR
            </div>
            <div class="text-xs text-gray-400">扫码查看 · 打印标签</div>
            <div class="flex justify-center gap-4 mt-2">
              <span class="text-xs text-blue-600 font-medium cursor-pointer">🖨️ 打印</span
              ><span class="text-xs text-blue-600 font-medium cursor-pointer">📤 导出</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="flex-1 flex items-center justify-center text-sm text-gray-400">物品不存在</div>
    <div class="px-4 py-3 bg-white border-t">
      <div class="flex gap-2">
        <button
          @click="showPicker = true"
          class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold"
        >
          📍 更改位置
        </button>
      </div>
    </div>
    <div
      v-if="showPicker"
      class="fixed inset-0 z-50 flex flex-col justify-end bg-black/30"
      @click.self="showPicker = false"
    >
      <div class="bg-gray-50 rounded-t-2xl max-h-[70vh] flex flex-col overflow-hidden">
        <div class="w-8 h-1 bg-gray-300 rounded-full mx-auto mt-3"></div>
        <div class="text-center text-base font-bold py-3 text-gray-800">移动到</div>
        <div class="flex-1 overflow-y-auto px-4 pb-4">
          <div class="text-[10px] font-semibold text-gray-400 uppercase mb-1 mt-2">🎒 包包</div>
          <div class="bg-white rounded-xl overflow-hidden mb-2">
            <div
              v-for="b in bagStore.bags"
              :key="b.id"
              @click="changeLocation('bag', b.id)"
              class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
            >
              <span class="text-xl">{{ b.icon || "🎒" }}</span>
              <div class="flex-1">
                <div class="text-sm font-semibold">{{ b.name }}</div>
              </div>
              <div
                class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                :class="item?.bagId === b.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'"
              >
                <span v-if="item?.bagId === b.id" class="text-white text-xs">✓</span>
              </div>
            </div>
          </div>
          <div class="text-[10px] font-semibold text-gray-400 uppercase mb-1 mt-3">🚪 房间</div>
          <div class="bg-white rounded-xl overflow-hidden">
            <div
              v-for="r in roomStore.rooms"
              :key="r.id"
              @click="changeLocation('room', r.id)"
              class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
            >
              <span class="text-xl">{{ r.icon || "🚪" }}</span>
              <div class="flex-1">
                <div class="text-sm font-semibold">{{ r.name }}</div>
              </div>
              <div
                class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                :class="item?.roomId === r.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'"
              >
                <span v-if="item?.roomId === r.id" class="text-white text-xs">✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ItemEditSheet :show="showEdit" :item="item" @close="showEdit = false" @created="onEdited" />
  </div>
</template>
