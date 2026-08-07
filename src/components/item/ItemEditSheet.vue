<script setup>
import { computed, reactive, ref, watch } from "vue"
import { useItemStore } from "@/stores/useItemStore"
import * as categoryService from "@/services/categoryService"
import * as nodeService from "@/services/spaceNodeService"
import { getPreferences } from "@/services/itemPreferencesService"
import { normalizePropertyGroups } from "@/domain/itemModel"
import {
  estimateDataUrlBytes,
  formatImageBytes,
  IMAGE_MAX_COUNT,
  optimizeImageFile,
  storageWriteErrorMessage,
} from "@/utils/imageProcessing"

const props = defineProps({
  show: Boolean,
  item: { type: Object, default: null },
  presetLocationNodeId: { type: String, default: "" },
  presetBagId: { type: String, default: "" },
  presetRoomId: { type: String, default: "" },
})
const emit = defineEmits(["close", "created"])
const itemStore = useItemStore()
const form = reactive({})
const nodes = ref([])
const categories = ref([])
const tagInput = ref("")
const step = ref(0)
const mode = ref("quick")
const saving = ref(false)
const errorMessage = ref("")
const photoInput = ref(null)
const processingImages = ref(false)
const imageMessage = ref("")

const isEdit = computed(() => Boolean(props.item))
const title = computed(() => (isEdit.value ? "完整档案编辑" : mode.value === "quick" ? "快速添加物品" : "逐步添加物品"))
const stepLabels = ["基本", "位置", "属性", "确认"]
const imageUsageLabel = computed(() =>
  formatImageBytes((form.images || []).reduce((sum, image) => sum + estimateDataUrlBytes(image.url), 0)),
)
const completeness = computed(() => {
  const checks = [
    form.name,
    form.category,
    form.images?.length,
    form.locationNodeId,
    form.tags?.length,
    form.purchasePrice,
    form.purchaseDate,
    form.notes,
    ...(form.propertyGroups || []).flatMap((group) => group.fields.map((field) => field.value)),
  ]
  return Math.round((checks.filter((value) => String(value || "").trim()).length / checks.length) * 100)
})

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function resetForm() {
  const item = props.item
  const defaultLocation = props.presetLocationNodeId || props.presetBagId || props.presetRoomId || ""
  Object.keys(form).forEach((key) => delete form[key])
  Object.assign(form, {
    id: item?.id || "",
    itemCode: item?.itemCode || "保存后自动生成",
    name: item?.name || "",
    category: item?.category || "日用",
    subCategory: item?.subCategory || "",
    tags: copy(item?.tags || []),
    images: copy(item?.images || (item?.photo ? [{ id: "legacy-cover", url: item.photo, isCover: true }] : [])),
    locationNodeId: item?.locationNodeId || defaultLocation,
    homeLocationNodeId: item?.homeLocationNodeId || props.presetRoomId || defaultLocation,
    purchasePrice: item?.purchasePrice ?? item?.value ?? "",
    currency: item?.currency || "CNY",
    purchaseDate: item?.purchaseDate || "",
    purchaseChannel: item?.purchaseChannel || "",
    valuation: copy(item?.valuation || { mode: getPreferences().valuationMode, manualAmount: null }),
    propertyGroups: copy(normalizePropertyGroups(item?.propertyGroups || [], item || {})),
    notes: item?.notes || "",
  })
  mode.value = item ? "full" : getPreferences().addMode
  step.value = 0
  tagInput.value = ""
  errorMessage.value = ""
  imageMessage.value = ""
  processingImages.value = false
  saving.value = false
}

watch(
  () => props.show,
  async (show) => {
    if (!show) return
    resetForm()
    categories.value = categoryService.getAll()
    nodes.value = await nodeService.getAllNodes()
  },
  { immediate: true },
)

function nodePath(node) {
  const names = []
  const seen = new Set()
  let current = node
  while (current && !seen.has(current.id)) {
    names.unshift(current.name)
    seen.add(current.id)
    current = nodes.value.find((candidate) => candidate.id === current.parentId)
  }
  return `${node.icon || "📦"} ${names.join(" / ")}`
}

function addTag() {
  const value = tagInput.value.trim()
  if (value && !form.tags.includes(value)) form.tags.push(value)
  tagInput.value = ""
}

function addCategory() {
  const name = window.prompt("新分类名称")?.trim()
  if (!name) return
  categoryService.add(name)
  categories.value = categoryService.getAll()
  form.category = name
}

function field(groupKey, fieldKey) {
  return form.propertyGroups
    .find((group) => group.key === groupKey)
    ?.fields.find((candidate) => candidate.key === fieldKey)
}

function setField(groupKey, fieldKey, value) {
  const target = field(groupKey, fieldKey)
  if (target) target.value = value
}

function addField(group) {
  group.fields.push({
    id: crypto.randomUUID(),
    key: "",
    label: "新信息项",
    value: "",
    type: "text",
    unit: "",
    sortOrder: group.fields.length,
  })
}

function removeField(group, fieldId) {
  group.fields = group.fields.filter((candidate) => candidate.id !== fieldId)
}

function addCustomGroup() {
  form.propertyGroups.push({
    id: crypto.randomUUID(),
    key: "",
    title: `自定义属性组 ${form.propertyGroups.filter((group) => group.kind === "custom").length + 1}`,
    kind: "custom",
    sortOrder: form.propertyGroups.length,
    fields: [{ id: crypto.randomUUID(), key: "", label: "信息项名称", value: "", type: "text", unit: "" }],
  })
}

function removeGroup(groupId) {
  form.propertyGroups = form.propertyGroups.filter((group) => group.id !== groupId)
}

async function handleFiles(event) {
  const files = [...(event.target.files || [])]
  const available = Math.max(0, IMAGE_MAX_COUNT - form.images.length)
  if (!available) {
    errorMessage.value = `一个物品最多保存 ${IMAGE_MAX_COUNT} 张图片`
    event.target.value = ""
    return
  }
  processingImages.value = true
  errorMessage.value = ""
  imageMessage.value = "正在优化图片…"
  let added = 0
  let originalBytes = 0
  let outputBytes = 0
  try {
    for (const file of files.slice(0, available)) {
      try {
        const result = await optimizeImageFile(file)
        form.images.push({
          id: crypto.randomUUID(),
          url: result.dataUrl,
          caption: "",
          isCover: form.images.length === 0,
        })
        added += 1
        originalBytes += result.originalBytes
        outputBytes += result.outputBytes
      } catch (error) {
        errorMessage.value = `${file.name || "所选图片"}：${error.message || "处理失败"}`
      }
    }
    if (files.length > available) errorMessage.value = `已达到每件物品最多 ${IMAGE_MAX_COUNT} 张图片的限制`
    if (added)
      imageMessage.value = `已加入 ${added} 张 · ${formatImageBytes(originalBytes)} → ${formatImageBytes(outputBytes)}`
    else imageMessage.value = ""
  } finally {
    processingImages.value = false
    event.target.value = ""
  }
}

function makeCover(id) {
  form.images = form.images.map((image) => ({ ...image, isCover: image.id === id }))
}

function removeImage(id) {
  const wasCover = form.images.find((image) => image.id === id)?.isCover
  form.images = form.images.filter((image) => image.id !== id)
  if (wasCover && form.images.length) form.images[0].isCover = true
}

function validateCurrentStep() {
  if (step.value === 0 && !form.name.trim()) return "请填写物品名称"
  return ""
}

function nextStep() {
  const message = validateCurrentStep()
  if (message) {
    errorMessage.value = message
    return
  }
  errorMessage.value = ""
  step.value = Math.min(step.value + 1, stepLabels.length - 1)
}

function toggleAddMode() {
  mode.value = mode.value === "quick" ? "guided" : "quick"
  step.value = 0
}

async function submit() {
  if (processingImages.value) {
    errorMessage.value = "请等待图片处理完成"
    return
  }
  if (!form.name.trim()) {
    errorMessage.value = "请填写物品名称"
    return
  }
  saving.value = true
  errorMessage.value = ""
  try {
    if (!isEdit.value) {
      setField("finance", "purchasePrice", form.purchasePrice)
      setField("finance", "purchaseDate", form.purchaseDate)
      setField("finance", "purchaseChannel", form.purchaseChannel)
    }
    const data = {
      name: form.name.trim(),
      category: form.category,
      subCategory: form.subCategory,
      tags: [...form.tags],
      images: copy(form.images),
      locationNodeId: form.locationNodeId,
      homeLocationNodeId: form.homeLocationNodeId,
      purchasePrice: form.purchasePrice,
      currency: form.currency,
      purchaseDate: form.purchaseDate,
      purchaseChannel: form.purchaseChannel,
      valuation: copy(form.valuation),
      propertyGroups: copy(form.propertyGroups),
      notes: form.notes,
    }
    const saved = isEdit.value ? await itemStore.editItem(props.item.id, data) : await itemStore.addItem(data)
    emit("created", saved)
  } catch (error) {
    errorMessage.value = storageWriteErrorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-end justify-center bg-black/35" @click.self="$emit('close')">
    <section class="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-[#f6f5f1]">
      <header class="flex items-center gap-3 border-b bg-white px-4 py-3">
        <button class="text-sm text-gray-500" @click="$emit('close')">取消</button>
        <div class="min-w-0 flex-1 text-center">
          <h2 class="truncate text-base font-bold">{{ title }}</h2>
          <p v-if="isEdit" class="text-[10px] text-gray-400">档案完整度 {{ completeness }}%</p>
        </div>
        <button class="text-sm font-semibold text-blue-600 disabled:text-gray-300" :disabled="saving" @click="submit">
          {{ saving ? "保存中" : "保存" }}
        </button>
      </header>

      <div v-if="!isEdit" class="flex items-center justify-between border-b bg-white px-4 py-2">
        <span class="text-xs text-gray-400">{{ mode === "quick" ? "熟练用户一页完成" : "按步骤完善档案" }}</span>
        <button class="text-xs font-semibold text-blue-600" @click="toggleAddMode">
          {{ mode === "quick" ? "切换为逐步添加" : "切换为快速添加" }}
        </button>
      </div>

      <div v-if="mode === 'guided'" class="grid grid-cols-4 gap-1 border-b bg-white px-4 py-3">
        <button
          v-for="(label, index) in stepLabels"
          :key="label"
          class="rounded-lg py-1.5 text-[11px]"
          :class="
            index === step
              ? 'bg-blue-600 font-semibold text-white'
              : index < step
                ? 'bg-blue-50 text-blue-600'
                : 'bg-gray-50 text-gray-400'
          "
          @click="index <= step && (step = index)"
        >
          {{ index + 1 }} {{ label }}
        </button>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <p v-if="errorMessage" class="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{{ errorMessage }}</p>

        <section v-if="mode !== 'guided' || step === 0" class="v3-card">
          <div class="grid grid-cols-[1fr_104px] gap-4">
            <div class="space-y-3">
              <label class="v3-field"
                ><span>物品名称 *</span><input v-model="form.name" placeholder="例如：通勤背包"
              /></label>
              <label class="v3-field"
                ><span>物品 ID · 自动生成且不可修改</span><input :value="form.itemCode" disabled
              /></label>
            </div>
            <button class="v3-cover" type="button" :disabled="processingImages" @click="photoInput?.click()">
              <img
                v-if="form.images?.length"
                :src="form.images.find((image) => image.isCover)?.url || form.images[0].url"
              />
              <template v-else><span class="text-3xl">📷</span><small>添加图片</small></template>
            </button>
          </div>
          <input ref="photoInput" class="hidden" type="file" accept="image/*" multiple @change="handleFiles" />
          <p class="mt-2 text-[11px] text-gray-400">
            {{ processingImages ? "正在优化图片…" : `最多 ${IMAGE_MAX_COUNT} 张，自动压缩后约占 ${imageUsageLabel}` }}
          </p>
          <p v-if="imageMessage && !processingImages" class="mt-1 text-[11px] text-blue-600">{{ imageMessage }}</p>
          <div v-if="form.images?.length" class="mt-3 flex gap-2 overflow-x-auto">
            <div v-for="image in form.images" :key="image.id" class="relative shrink-0">
              <button
                class="h-16 w-16 overflow-hidden rounded-xl border-2"
                :class="image.isCover ? 'border-blue-500' : 'border-transparent'"
                @click="makeCover(image.id)"
              >
                <img :src="image.url" class="h-full w-full object-cover" />
              </button>
              <button
                class="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-gray-900 text-[10px] text-white"
                @click="removeImage(image.id)"
              >
                ×
              </button>
            </div>
          </div>
        </section>

        <section v-if="mode !== 'guided' || step === 0" class="v3-card">
          <div class="v3-section-head">
            <h3>分类</h3>
            <span>按物品属性选择</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="category in categories"
              :key="category"
              class="v3-chip"
              :class="form.category === category && 'active'"
              @click="form.category = category"
            >
              {{ category }}
            </button>
            <button class="v3-chip" @click="addCategory">＋ 更多</button>
          </div>
          <div class="v3-section-head mt-5">
            <h3>标签</h3>
            <span>自定义气泡</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <span v-for="tag in form.tags" :key="tag" class="v3-tag"
              >{{ tag }}<button @click="form.tags = form.tags.filter((value) => value !== tag)">×</button></span
            >
          </div>
          <div class="mt-2 flex gap-2">
            <input v-model="tagInput" class="v3-input flex-1" placeholder="输入标签" @keydown.enter.prevent="addTag" />
            <button class="v3-secondary-button" @click="addTag">添加</button>
          </div>
        </section>

        <section v-if="mode !== 'guided' || step === 1 || isEdit" class="v3-card">
          <div class="v3-section-head">
            <h3>当前位置</h3>
            <span>当前所在与归位位置可分别记录</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="v3-field"
              ><span>当前空间 / 容器</span
              ><select v-model="form.locationNodeId">
                <option value="">未设置</option>
                <option v-for="node in nodes" :key="node.id" :value="node.id">{{ nodePath(node) }}</option>
              </select></label
            >
            <label class="v3-field"
              ><span>常驻 / 归位位置</span
              ><select v-model="form.homeLocationNodeId">
                <option value="">未设置</option>
                <option v-for="node in nodes" :key="node.id" :value="node.id">{{ nodePath(node) }}</option>
              </select></label
            >
          </div>
        </section>

        <section v-if="!isEdit && (mode !== 'guided' || step === 2)" class="v3-card">
          <div class="v3-section-head">
            <h3>常用属性</h3>
            <span>快速添加只保留高频信息</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="v3-field"
              ><span>品牌</span
              ><input
                :value="field('product', 'brand')?.value"
                @input="setField('product', 'brand', $event.target.value)"
            /></label>
            <label class="v3-field"
              ><span>型号</span
              ><input
                :value="field('product', 'model')?.value"
                @input="setField('product', 'model', $event.target.value)"
            /></label>
            <label class="v3-field"
              ><span>购入价</span>
              <div class="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                <select v-model="form.currency" aria-label="币种">
                  <option value="CNY">¥ CNY</option>
                  <option value="USD">$ USD</option></select
                ><input
                  v-model="form.purchasePrice"
                  inputmode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  aria-label="购入价金额"
                /></div
            ></label>
            <label class="v3-field"><span>购入时间</span><input v-model="form.purchaseDate" type="date" /></label>
            <label v-if="form.valuation.mode === 'manual'" class="v3-field"
              ><span>当前手动估值</span
              ><input v-model="form.valuation.manualAmount" type="number" min="0" placeholder="不填写则不显示估值"
            /></label>
            <label class="v3-field sm:col-span-2"
              ><span>备注</span
              ><textarea v-model="form.notes" rows="3" placeholder="记录使用、收纳或核对提示"></textarea>
            </label>
          </div>
        </section>

        <template v-if="isEdit">
          <section v-for="group in form.propertyGroups" :key="group.id" class="v3-card">
            <div class="flex items-center gap-2">
              <input
                v-model="group.title"
                class="min-w-0 flex-1 bg-transparent text-base font-bold outline-none"
                :disabled="group.kind === 'standard'"
              />
              <button v-if="group.kind === 'custom'" class="text-xs text-red-500" @click="removeGroup(group.id)">
                删除属性组
              </button>
              <button class="text-xs font-semibold text-blue-600" @click="addField(group)">＋ 信息项</button>
            </div>
            <div v-if="group.key === 'finance'" class="mt-3 grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2">
              <label class="v3-field"
                ><span>估值规则</span
                ><select v-model="form.valuation.mode">
                  <option value="none">不计算</option>
                  <option value="manual">手动估值</option>
                  <option value="linear">按使用年限直线折旧（暂缓）</option>
                </select></label
              >
              <label v-if="form.valuation.mode === 'manual'" class="v3-field"
                ><span>当前估值</span
                ><input v-model="form.valuation.manualAmount" inputmode="decimal" type="number" min="0" step="0.01"
              /></label>
              <p class="text-[10px] leading-4 text-gray-400 sm:col-span-2">直线折旧将在财务统计功能中完善。</p>
            </div>
            <div class="mt-3 space-y-2">
              <div
                v-for="property in group.fields"
                :key="property.id"
                class="grid grid-cols-[minmax(90px,.8fr)_1.2fr_auto] gap-2"
              >
                <input v-model="property.label" class="v3-input" placeholder="信息项名称" />
                <input v-model="property.value" class="v3-input" placeholder="未填写" />
                <button class="px-1 text-xs text-red-400" @click="removeField(group, property.id)">删除</button>
              </div>
              <p v-if="!group.fields.length" class="py-3 text-center text-xs text-gray-400">
                暂无信息项，可点击右上角添加
              </p>
            </div>
          </section>
          <button
            class="w-full rounded-2xl border-2 border-dashed border-blue-200 py-3 text-sm font-semibold text-blue-600"
            @click="addCustomGroup"
          >
            ＋ 新增自定义属性组
          </button>
          <section class="v3-card">
            <label class="v3-field"
              ><span>备注</span><textarea v-model="form.notes" rows="4" placeholder="自由文本"></textarea>
            </label>
          </section>
        </template>

        <section v-if="mode === 'guided' && step === 3" class="v3-card space-y-3">
          <div class="v3-section-head">
            <h3>确认档案</h3>
            <span>保存后仍可完整编辑</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-4xl">{{ form.images?.length ? "🖼️" : "📦" }}</span>
            <div>
              <strong class="block">{{ form.name || "未命名物品" }}</strong
              ><small class="text-gray-400">{{ form.category }} · {{ form.tags.join(" · ") || "暂无标签" }}</small>
            </div>
          </div>
          <dl class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt class="text-gray-400">当前位置</dt>
              <dd class="mt-1 font-medium">
                {{ nodes.find((node) => node.id === form.locationNodeId)?.name || "未设置" }}
              </dd>
            </div>
            <div>
              <dt class="text-gray-400">购入价</dt>
              <dd class="mt-1 font-medium">
                {{ form.purchasePrice ? `${form.currency} ${form.purchasePrice}` : "未填写" }}
              </dd>
            </div>
          </dl>
        </section>

        <div v-if="mode === 'guided'" class="flex gap-3">
          <button v-if="step > 0" class="v3-secondary-button flex-1" @click="step--">上一步</button>
          <button v-if="step < 3" class="v3-primary-button flex-1" @click="nextStep">
            下一步：{{ stepLabels[step + 1] }}
          </button>
          <button v-else class="v3-primary-button flex-1" :disabled="saving" @click="submit">保存物品</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.v3-card {
  @apply rounded-2xl border bg-white p-4 shadow-sm;
  border-color: var(--color-border-light);
}
.v3-section-head {
  @apply mb-3 flex items-center justify-between gap-3;
}
.v3-section-head h3 {
  @apply text-base font-bold;
}
.v3-section-head span {
  @apply text-[11px] text-gray-400;
}
.v3-field {
  @apply block;
}
.v3-field > span {
  @apply mb-1.5 block text-[11px] font-medium text-gray-500;
}
.v3-field input,
.v3-field select,
.v3-field textarea,
.v3-input {
  @apply w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400;
  border-color: var(--color-border);
}
.v3-field input:disabled {
  @apply bg-gray-50 text-gray-400;
}
.v3-cover {
  @apply flex h-[104px] w-[104px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-gray-50 text-gray-400;
  border-color: var(--color-border);
}
.v3-cover img {
  @apply h-full w-full object-cover;
}
.v3-cover small {
  @apply mt-1 text-[10px];
}
.v3-chip {
  @apply rounded-full border px-3 py-1.5 text-xs text-gray-600;
  border-color: var(--color-border);
}
.v3-chip.active {
  @apply border-blue-600 bg-blue-50 font-semibold text-blue-700;
}
.v3-tag {
  @apply inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs text-blue-700;
}
.v3-tag button {
  @apply text-blue-400;
}
.v3-primary-button {
  @apply rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-300;
}
.v3-secondary-button {
  @apply rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-gray-600;
  border-color: var(--color-border);
}
</style>
