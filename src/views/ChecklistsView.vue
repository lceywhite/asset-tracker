<script setup>
import { ref, onMounted } from "vue"
import { useChecklistStore } from "@/stores/useChecklistStore"
import ChecklistForm from "@/components/checklist/ChecklistForm.vue"
import EmptyState from "@/components/common/EmptyState.vue"
const store = useChecklistStore()
const showForm = ref(false)
const typeLabels = { daily_carry: "日常", travel: "旅行", move: "搬家", custom: "自定义" }
onMounted(() => store.loadAll())
async function handleCreate(d) {
  await store.create(d)
  showForm.value = false
  await store.loadAll()
}
</script>
<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">场景清单</h2>
      <button @click="showForm = true" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">+ 新建</button>
    </div>
    <div
      v-if="showForm"
      class="fixed inset-0 z-40 bg-black/30 flex items-center justify-center"
      @click.self="showForm = false"
    >
      <div class="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <ChecklistForm @create="handleCreate" /><button
          @click="showForm = false"
          class="mt-4 w-full py-2 text-sm text-gray-500"
        >
          取消
        </button>
      </div>
    </div>
    <div v-if="store.checklists.length === 0" class="mt-8"><EmptyState icon="&#10004;" text="还没有清单" /></div>
    <div v-else class="space-y-3">
      <router-link
        v-for="cl in store.checklists"
        :key="cl.id"
        :to="'/checklists/' + cl.id"
        class="block bg-white rounded-xl border p-4 hover:shadow-sm"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium">{{ cl.name }}</div>
            <div class="text-xs text-gray-500 mt-1">
              {{ typeLabels[cl.type] || cl.type }} &middot; {{ cl.items?.length || 0 }}件
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400"
              >{{ cl.items?.filter((i) => i.checked).length || 0 }}/{{ cl.items?.length || 0 }}</span
            >
            <div class="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-green-500 rounded-full transition-all"
                :style="{
                  width: cl.items ? (cl.items.filter((i) => i.checked).length / cl.items.length) * 100 + '%' : '0%',
                }"
              ></div>
            </div>
            <span v-if="cl.status === 'active'" class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded"
              >进行中</span
            ><span v-else-if="cl.status === 'completed'" class="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded"
              >已完成</span
            >
          </div>
        </div></router-link
      >
    </div>
  </div>
</template>
