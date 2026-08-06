<script setup>
import { reactive, ref, watch } from "vue"
import * as nodeService from "@/services/spaceNodeService"

const props = defineProps({
  show: Boolean,
  node: { type: Object, default: null },
  sectionId: { type: String, default: "" },
  parent: { type: Object, default: null },
  suggestedKind: { type: String, default: "" },
})
const emit = defineEmits(["close", "saved", "deleted"])
const form = reactive({})
const saving = ref(false)
const errorMessage = ref("")
const imageInput = ref(null)
const icons = ["🏠", "🏡", "🚙", "🚪", "🛏️", "📚", "🛋️", "🎒", "🧳", "👜", "🗄️", "📦", "🧰", "🛒"]

watch(
  () => props.show,
  (show) => {
    if (!show) return
    const node = props.node
    Object.keys(form).forEach((key) => delete form[key])
    Object.assign(form, {
      name: node?.name || "",
      description: node?.description || "",
      icon: node?.icon || (props.suggestedKind === "space" ? "🏠" : props.suggestedKind === "area" ? "🚪" : "📦"),
      kind: node?.kind || props.suggestedKind || "container",
      mobility: node?.mobility || (props.suggestedKind === "container" ? "fixed" : "none"),
      spaceValue: node?.spaceValue ?? "",
      currency: node?.currency || "CNY",
      images: JSON.parse(JSON.stringify(node?.images || [])),
    })
    errorMessage.value = ""
    saving.value = false
  },
  { immediate: true },
)

async function handleImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  form.images = [{ id: crypto.randomUUID(), url, caption: "" }]
  event.target.value = ""
}

async function submit() {
  if (!form.name.trim()) {
    errorMessage.value = "请填写名称"
    return
  }
  saving.value = true
  errorMessage.value = ""
  try {
    const data = {
      name: form.name.trim(),
      description: form.description,
      icon: form.icon,
      kind: form.kind,
      mobility: form.kind === "container" ? form.mobility : form.kind === "space" ? "fixed" : "none",
      spaceValue: form.spaceValue,
      currency: form.currency,
      images: form.images,
    }
    const saved = props.node
      ? await nodeService.updateNode(props.node.id, data)
      : await nodeService.createNode({
          ...data,
          sectionId: props.sectionId,
          parentId: props.parent?.id || "",
        })
    emit("saved", saved)
  } catch (error) {
    errorMessage.value = error.message || "保存失败"
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.node) return
  if (!window.confirm("仅空空间可以直接删除。确定删除吗？")) return
  try {
    await nodeService.deleteNode(props.node.id)
    emit("deleted", props.node.id)
  } catch (error) {
    errorMessage.value = error.message
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[60] flex items-end bg-black/35" @click.self="$emit('close')">
    <section
      class="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
    >
      <div class="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200"></div>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-400">{{ parent ? `位于 ${parent.name}` : "首页分区直属空间" }}</p>
          <h2 class="mt-1 text-lg font-bold">{{ node ? "编辑空间" : "新增空间" }}</h2>
        </div>
        <button class="text-sm text-gray-400" @click="$emit('close')">关闭</button>
      </div>
      <p v-if="errorMessage" class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{{ errorMessage }}</p>

      <div class="mt-5 grid grid-cols-[88px_1fr] gap-4">
        <button
          class="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-2xl border bg-gray-50 text-3xl"
          @click="imageInput?.click()"
        >
          <img v-if="form.images?.[0]" :src="form.images[0].url" class="h-full w-full object-cover" /><span v-else>{{
            form.icon
          }}</span>
        </button>
        <div class="space-y-3">
          <label class="v3-field"
            ><span>名称 *</span><input v-model="form.name" placeholder="空间、区域或容器名称" /></label
          ><label class="v3-field"
            ><span>说明</span><input v-model="form.description" placeholder="用途或收纳说明"
          /></label>
        </div>
      </div>
      <input ref="imageInput" class="hidden" type="file" accept="image/*" @change="handleImage" />

      <div class="mt-4">
        <span class="mb-2 block text-xs font-medium text-gray-500">头像图标</span>
        <div class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="icon in icons"
            :key="icon"
            class="h-10 w-10 shrink-0 rounded-xl text-xl"
            :class="form.icon === icon ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-gray-50'"
            @click="form.icon = icon"
          >
            {{ icon }}
          </button>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <label class="v3-field"
          ><span>空间类型</span
          ><select v-model="form.kind">
            <option value="space">空间（房屋/车辆）</option>
            <option value="area">区域</option>
            <option value="container">容器</option>
          </select></label
        >
        <label class="v3-field"
          ><span>容器属性</span
          ><select v-model="form.mobility" :disabled="form.kind !== 'container'">
            <option value="fixed">固定容器</option>
            <option value="mobile">移动容器</option>
          </select></label
        >
      </div>
      <div class="mt-3 grid grid-cols-[1fr_96px] gap-3">
        <label class="v3-field"
          ><span>空间价值（用户录入）</span
          ><input v-model="form.spaceValue" type="number" min="0" placeholder="例如房屋或车辆价值" /></label
        ><label class="v3-field"
          ><span>币种</span
          ><select v-model="form.currency">
            <option value="CNY">CNY</option>
            <option value="USD">USD</option>
          </select></label
        >
      </div>

      <button
        class="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:bg-gray-300"
        :disabled="saving"
        @click="submit"
      >
        {{ saving ? "保存中…" : "保存" }}
      </button>
      <button v-if="node" class="mt-2 w-full py-3 text-sm text-red-500" @click="remove">删除空空间</button>
    </section>
  </div>
</template>

<style scoped>
.v3-field {
  @apply block;
}
.v3-field > span {
  @apply mb-1.5 block text-[11px] font-medium text-gray-500;
}
.v3-field input,
.v3-field select {
  @apply w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400;
  border-color: var(--color-border);
}
</style>
