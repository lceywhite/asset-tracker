<script setup>
import { ref, watch } from "vue"
import * as sectionService from "@/services/homeSectionService"

const props = defineProps({ show: Boolean, sections: { type: Array, default: () => [] } })
const emit = defineEmits(["close", "changed"])
const localSections = ref([])
const editing = ref(null)
const errorMessage = ref("")
const draggingId = ref("")

watch(
  () => [props.show, props.sections],
  () => {
    if (props.show) localSections.value = props.sections.map((section) => ({ ...section }))
  },
  { deep: true, immediate: true },
)

function move(index, delta) {
  const target = index + delta
  if (target < 0 || target >= localSections.value.length) return
  const next = [...localSections.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  localSections.value = next
}

function dropOn(targetId) {
  const from = localSections.value.findIndex((section) => section.id === draggingId.value)
  const to = localSections.value.findIndex((section) => section.id === targetId)
  if (from < 0 || to < 0 || from === to) return
  const next = [...localSections.value]
  const [entry] = next.splice(from, 1)
  next.splice(to, 0, entry)
  localSections.value = next
  draggingId.value = ""
}

async function saveOrder() {
  await sectionService.reorderSections(localSections.value.map((section) => section.id))
  emit("changed")
}

async function saveEdit() {
  if (!editing.value?.name.trim()) return
  try {
    await sectionService.updateSection(editing.value.id, editing.value)
    editing.value = null
    emit("changed")
  } catch (error) {
    errorMessage.value = error.message
  }
}

async function createSection() {
  const name = window.prompt("新分区名称")?.trim()
  if (!name) return
  await sectionService.createSection({ name, icon: "📦", description: "自定义分区" })
  emit("changed")
}

async function removeSection(section) {
  if (!window.confirm(`删除分区“${section.name}”？`)) return
  try {
    await sectionService.deleteSection(section.id)
    editing.value = null
    emit("changed")
  } catch (error) {
    errorMessage.value = error.message
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-end justify-center bg-black/35" @click.self="$emit('close')">
    <section
      class="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-[#f6f5f1] pb-[max(20px,env(safe-area-inset-bottom))]"
    >
      <header class="flex items-center border-b bg-white px-4 py-3">
        <button class="text-sm text-gray-500" @click="$emit('close')">关闭</button>
        <div class="flex-1 text-center">
          <p class="text-[10px] text-gray-400">主页设置</p>
          <h2 class="font-bold">分区管理</h2>
        </div>
        <button class="text-sm font-semibold text-blue-600" @click="saveOrder">完成</button>
      </header>
      <p class="px-4 pt-4 text-xs leading-5 text-gray-400">
        拖动或使用箭头调整主页顺序；默认分区可以改名，自定义分区可以删除。
      </p>
      <p v-if="errorMessage" class="mx-4 mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
        {{ errorMessage }}
      </p>
      <div class="flex-1 space-y-2 overflow-y-auto p-4">
        <article
          v-for="(section, index) in localSections"
          :key="section.id"
          draggable="true"
          class="flex items-center gap-3 rounded-2xl border bg-white p-3"
          @dragstart="draggingId = section.id"
          @dragover.prevent
          @drop="dropOn(section.id)"
        >
          <span class="cursor-grab text-gray-300">☰</span><span class="text-2xl">{{ section.icon }}</span
          ><button class="min-w-0 flex-1 text-left" @click="editing = { ...section }">
            <strong class="block truncate text-sm">{{ section.name }}</strong
            ><small class="block truncate text-[11px] text-gray-400">{{ section.description }}</small>
          </button>
          <div class="flex">
            <button class="p-1 text-gray-300" @click="move(index, -1)">↑</button
            ><button class="p-1 text-gray-300" @click="move(index, 1)">↓</button>
          </div>
          <span class="text-gray-300">›</span>
        </article>
        <button
          class="w-full rounded-2xl border-2 border-dashed border-blue-200 py-3 text-sm font-semibold text-blue-600"
          @click="createSection"
        >
          ＋ 新增分区
        </button>
      </div>

      <div
        v-if="editing"
        class="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200"></div>
        <h3 class="font-bold">编辑分区</h3>
        <label class="mt-4 block text-xs text-gray-500"
          >分区名称<input v-model="editing.name" class="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
        /></label>
        <label class="mt-3 block text-xs text-gray-500"
          >说明<textarea
            v-model="editing.description"
            class="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
            rows="2"
          ></textarea>
        </label>
        <button class="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white" @click="saveEdit">
          保存
        </button>
        <button v-if="!editing.builtIn" class="mt-2 w-full py-2 text-sm text-red-500" @click="removeSection(editing)">
          删除分区
        </button>
        <p v-else class="mt-3 text-center text-xs text-gray-400">默认分区不可删除</p>
      </div>
    </section>
  </div>
</template>
