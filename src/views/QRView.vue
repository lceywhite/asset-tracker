<script setup>
import { ref, computed, onMounted } from "vue"
import { useItemStore } from "@/stores/useItemStore"
import QRCodeDisplay from "@/components/common/QRCodeDisplay.vue"
const itemStore = useItemStore()
const selectedItem = ref(null)
const searchQ = ref("")
const showLost = ref(false)
onMounted(() => itemStore.loadItems())
const filteredItems = computed(() => {
  let l = itemStore.items
  if (searchQ.value) {
    const q = searchQ.value.toLowerCase()
    l = l.filter((i) => i.name.toLowerCase().includes(q))
  }
  return l
})
const qrContent = computed(() => (selectedItem.value ? "asset-tracker://item/" + selectedItem.value.id : ""))
</script>
<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h2 class="text-xl font-bold mb-4">防丢标签</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <input v-model="searchQ" class="w-full border rounded-lg px-3 py-2 text-sm mb-3" placeholder="搜索物品..." />
        <div v-if="filteredItems.length === 0" class="text-center py-8 text-sm text-gray-400">暂无物品</div>
        <div v-else class="max-h-96 overflow-y-auto space-y-1">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            @click="selectedItem = item"
            class="px-3 py-2 rounded-lg text-sm cursor-pointer"
            :class="selectedItem?.id === item.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50'"
          >
            {{ item.name }}<span class="text-xs text-gray-400 ml-2">{{ item.category }}</span>
          </div>
        </div>
      </div>
      <div v-if="selectedItem" class="bg-white rounded-xl border p-6 flex flex-col items-center">
        <QRCodeDisplay :content="qrContent" :size="200" />
        <div class="mt-4 text-center">
          <div class="font-medium text-sm">{{ selectedItem.name }}</div>
          <div class="text-xs text-gray-500">{{ selectedItem.category }}</div>
        </div>
        <button
          @click="showLost = !showLost"
          class="mt-4 w-full py-2 rounded-lg text-sm"
          :class="showLost ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'"
        >
          {{ showLost ? "标记为丢失..." : "开启丢失模式" }}
        </button>
        <div v-if="showLost" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg w-full text-center">
          <p class="text-xs text-red-700 font-medium">&#128308; 此物品已标记为丢失</p>
          <p class="text-xs text-red-500 mt-1">扫码页将突出显示丢失提示</p>
        </div>
      </div>
      <div v-else class="bg-white rounded-xl border p-6 flex items-center justify-center text-sm text-gray-400">
        选择物品生成标签
      </div>
    </div>
  </div>
</template>
