<script setup>
import { ref, computed, onMounted } from "vue"
import { useItemStore } from "@/stores/useItemStore"
import { useTemplateStore } from "@/stores/useTemplateStore"
const emit = defineEmits(["create"])
const itemStore = useItemStore()
const templateStore = useTemplateStore()
const step = ref("select-type")
const selectedType = ref("travel")
const selectedTemplate = ref(null)
const selectedItems = ref([])
onMounted(async () => {
  await itemStore.loadItems()
  await templateStore.loadAll()
})
const templatesForType = computed(() => templateStore.byType(selectedType.value))
function chooseTemplate(t) {
  selectedTemplate.value = t
  selectedItems.value = t.items.map((i) => ({
    name: i.name,
    category: i.category,
    required: i.required,
    checked: false,
    itemId: itemStore.items.find((x) => x.name === i.name)?.id || "",
  }))
  step.value = "review"
}
function pickFromLibrary() {
  selectedTemplate.value = null
  selectedItems.value = []
  step.value = "from-library"
}
function selectType(type, nextStep = "from-template") {
  selectedType.value = type
  if (nextStep === "library") pickFromLibrary()
  else step.value = nextStep
}
function toggleItem(item) {
  const e = selectedItems.value.find((s) => s.itemId === item.id)
  if (e) {
    selectedItems.value = selectedItems.value.filter((s) => s.itemId !== item.id)
  } else {
    selectedItems.value.push({
      name: item.name,
      category: item.category,
      required: false,
      checked: false,
      itemId: item.id,
    })
  }
}
function isSelected(item) {
  return selectedItems.value.some((s) => s.itemId === item.id)
}
function createChecklist() {
  const t = selectedTemplate.value?.type || selectedType.value
  const n = selectedTemplate.value
    ? selectedTemplate.value.name + "清单"
    : { daily_carry: "日常外出", travel: "旅行", move: "搬家" }[t] + "清单"
  emit("create", {
    name: n,
    type: t,
    templateId: selectedTemplate.value?.id || "",
    items: selectedItems.value.map((si, i) => ({
      itemId: si.itemId || "temp-" + i,
      name: si.name,
      category: si.category,
      required: si.required,
      checked: false,
      returned: false,
    })),
  })
}
</script>
<template>
  <div class="max-w-lg mx-auto">
    <div v-if="step === 'select-type'">
      <h3 class="text-lg font-semibold mb-4">新建清单</h3>
      <div class="space-y-2">
        <button @click="selectType('daily_carry')" class="w-full text-left p-4 border rounded-xl hover:bg-gray-50">
          <div class="font-medium">日常外出携带</div>
          <div class="text-sm text-gray-500">上班、出门办事</div>
        </button>
        <button @click="selectType('travel')" class="w-full text-left p-4 border rounded-xl hover:bg-gray-50">
          <div class="font-medium">旅行</div>
          <div class="text-sm text-gray-500">短途、长途出行</div>
        </button>
        <button @click="selectType('move')" class="w-full text-left p-4 border rounded-xl hover:bg-gray-50">
          <div class="font-medium">搬家</div>
          <div class="text-sm text-gray-500">全屋或局部搬迁</div>
        </button>
        <button
          @click="selectType('custom', 'library')"
          class="w-full text-left p-4 border rounded-xl hover:bg-gray-50"
        >
          <div class="font-medium">从物品库选择</div>
          <div class="text-sm text-gray-500">直接勾选已有物品</div>
        </button>
      </div>
    </div>
    <div v-if="step === 'from-template'">
      <button @click="step = 'select-type'" class="text-sm text-gray-500 mb-4">&larr; 返回</button>
      <h3 class="text-lg font-semibold mb-4">选择模板</h3>
      <div class="space-y-2">
        <button
          v-for="t in templatesForType"
          :key="t.id"
          @click="chooseTemplate(t)"
          class="w-full text-left p-4 border rounded-xl hover:bg-gray-50"
        >
          <div class="font-medium">{{ t.name }}</div>
          <div class="text-xs text-gray-400 mt-1">{{ t.items.length }} 件</div>
        </button>
        <button
          @click="pickFromLibrary()"
          class="w-full text-left p-4 border border-dashed rounded-xl text-gray-500 hover:bg-gray-50 text-sm"
        >
          或直接从物品库选择
        </button>
      </div>
    </div>
    <div v-if="step === 'from-library'">
      <button @click="step = 'select-type'" class="text-sm text-gray-500 mb-4">&larr; 返回</button>
      <h3 class="text-lg font-semibold mb-4">勾选物品</h3>
      <div v-if="itemStore.items.length === 0" class="text-center py-8 text-sm text-gray-400">暂无物品</div>
      <div v-else class="space-y-1 max-h-96 overflow-y-auto">
        <div
          v-for="item in itemStore.items"
          :key="item.id"
          @click="toggleItem(item)"
          class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
          :class="isSelected(item) ? 'bg-blue-50' : ''"
        >
          <div
            class="w-5 h-5 rounded border flex items-center justify-center"
            :class="isSelected(item) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'"
          >
            <span v-if="isSelected(item)" class="text-white text-xs">&#10003;</span>
          </div>
          <div class="flex-1 text-sm">{{ item.name }}</div>
          <div class="text-xs text-gray-400">{{ item.category }}</div>
        </div>
      </div>
      <button
        v-if="selectedItems.length > 0"
        @click="step = 'review'"
        class="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm"
      >
        已选 {{ selectedItems.length }} 件 &rarr; 预览
      </button>
    </div>
    <div v-if="step === 'review'">
      <button @click="step = 'from-template'" class="text-sm text-gray-500 mb-4">&larr; 返回</button>
      <h3 class="text-lg font-semibold mb-2">{{ selectedTemplate?.name || "自定义" }}清单</h3>
      <p class="text-xs text-gray-400 mb-4">共 {{ selectedItems.length }} 件</p>
      <div class="space-y-1">
        <div v-for="(si, i) in selectedItems" :key="i" class="flex items-center gap-2 p-2 text-sm">
          <span :class="si.required ? 'text-red-500' : 'text-gray-300'">*</span><span>{{ si.name }}</span
          ><span class="text-xs text-gray-400 ml-auto">{{ si.category }}</span>
        </div>
      </div>
      <button @click="createChecklist" class="mt-6 w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm">
        创建清单
      </button>
    </div>
  </div>
</template>
