<script setup>
import { computed, ref } from "vue"
import { generateId } from "@/utils/id"

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(["update:modelValue"])

const typeOptions = [
  { value: "timeline", label: "时间线" },
  { value: "paged_schedule", label: "分页日程" },
  { value: "checklist", label: "清单" },
  { value: "key_value", label: "键值信息" },
  { value: "amount", label: "金额统计" },
]

const showSheet = ref(false)
const editingId = ref("")
const draft = ref({ type: "timeline", title: "", content: "" })
const cards = computed(() => [...props.modelValue].sort((a, b) => a.sortOrder - b.sortOrder))

function typeLabel(type) {
  return typeOptions.find((option) => option.value === type)?.label || "信息卡片"
}

function defaultTitle(type) {
  return {
    timeline: "行程安排",
    paged_schedule: "每日安排",
    checklist: "待办清单",
    key_value: "补充信息",
    amount: "花销记录",
  }[type]
}

function placeholder(type) {
  return {
    timeline: "09:00 | 到达车站 | 提前取票\n12:30 | 办理入住 | 寄存行李",
    paged_schedule: "第1天 | 09:00 | 到达北京 | 办理入住\n第2天 | 10:00 | 客户会议 | 带齐材料",
    checklist: "确认酒店\n下载离线地图\n准备会议材料",
    key_value: "酒店 | 北京国贸酒店\n联系人 | 张先生",
    amount: "交通 | 560\n住宿 | 1280",
  }[type]
}

function parseLines(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function buildData(type, content) {
  const lines = parseLines(content)
  if (type === "timeline") {
    return {
      events: lines.map((line, index) => {
        const [time = "", title = "", notes = ""] = line.split("|").map((part) => part.trim())
        return { id: `event-${index + 1}`, time, title: title || time, notes }
      }),
    }
  }
  if (type === "paged_schedule") {
    const pageMap = new Map()
    for (const [index, line] of lines.entries()) {
      const [pageTitle = "第1天", time = "", title = "", notes = ""] = line.split("|").map((part) => part.trim())
      if (!pageMap.has(pageTitle)) pageMap.set(pageTitle, [])
      pageMap.get(pageTitle).push({ id: `event-${index + 1}`, time, title: title || time, notes })
    }
    return { pages: [...pageMap].map(([title, events], index) => ({ id: `page-${index + 1}`, title, events })) }
  }
  if (type === "checklist") {
    return { items: lines.map((label, index) => ({ id: `item-${index + 1}`, label, done: false })) }
  }
  const rows = lines.map((line, index) => {
    const [label = "", value = ""] = line.split("|").map((part) => part.trim())
    return { id: `row-${index + 1}`, label, value }
  })
  return { rows }
}

function serialize(card) {
  if (card.type === "timeline") {
    return (card.data?.events || [])
      .map((event) => [event.time, event.title, event.notes].filter(Boolean).join(" | "))
      .join("\n")
  }
  if (card.type === "paged_schedule") {
    return (card.data?.pages || [])
      .flatMap((page) =>
        (page.events || []).map((event) =>
          [page.title, event.time, event.title, event.notes].filter(Boolean).join(" | "),
        ),
      )
      .join("\n")
  }
  if (card.type === "checklist") return (card.data?.items || []).map((item) => item.label || item.text).join("\n")
  return (card.data?.rows || []).map((row) => `${row.label || ""} | ${row.value || ""}`).join("\n")
}

function openNew() {
  editingId.value = ""
  draft.value = { type: "timeline", title: defaultTitle("timeline"), content: "" }
  showSheet.value = true
}

function openEdit(card) {
  editingId.value = card.id
  draft.value = { type: card.type, title: card.title, content: serialize(card) }
  showSheet.value = true
}

function selectType(type) {
  draft.value.type = type
  if (!editingId.value || !draft.value.title.trim()) draft.value.title = defaultTitle(type)
}

function saveCard() {
  const title = draft.value.title.trim()
  if (!title) return
  const nextCard = {
    id: editingId.value || generateId(),
    type: draft.value.type,
    title,
    data: buildData(draft.value.type, draft.value.content),
    sortOrder: editingId.value
      ? props.modelValue.find((card) => card.id === editingId.value)?.sortOrder || 0
      : props.modelValue.length,
  }
  const next = editingId.value
    ? props.modelValue.map((card) => (card.id === editingId.value ? nextCard : card))
    : [...props.modelValue, nextCard]
  emit(
    "update:modelValue",
    next.sort((a, b) => a.sortOrder - b.sortOrder).map((card, index) => ({ ...card, sortOrder: index })),
  )
  showSheet.value = false
}

function removeCard(id) {
  if (!window.confirm("删除这张信息卡片？")) return
  emit(
    "update:modelValue",
    props.modelValue.filter((card) => card.id !== id).map((card, index) => ({ ...card, sortOrder: index })),
  )
}

function moveCard(id, offset) {
  const next = [...cards.value]
  const index = next.findIndex((card) => card.id === id)
  const target = index + offset
  if (index < 0 || target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target], next[index]]
  emit(
    "update:modelValue",
    next.map((card, sortOrder) => ({ ...card, sortOrder })),
  )
}
</script>

<template>
  <div class="info-cards-editor">
    <article v-for="(card, index) in cards" :key="card.id" class="info-card-row">
      <button class="info-card-main" type="button" @click="openEdit(card)">
        <span
          ><b>{{ card.title }}</b
          ><small>{{ typeLabel(card.type) }}</small></span
        ><i>›</i>
      </button>
      <div class="info-card-tools">
        <button type="button" :disabled="index === 0" aria-label="上移卡片" @click="moveCard(card.id, -1)">↑</button>
        <button
          type="button"
          :disabled="index === cards.length - 1"
          aria-label="下移卡片"
          @click="moveCard(card.id, 1)"
        >
          ↓
        </button>
        <button type="button" class="danger" @click="removeCard(card.id)">删除</button>
      </div>
    </article>
    <button class="add-info-card" type="button" @click="openNew">＋ 添加信息卡片</button>

    <div v-if="showSheet" class="info-sheet-layer" @click.self="showSheet = false">
      <section class="info-sheet">
        <div class="info-sheet-handle"></div>
        <header>
          <h2>{{ editingId ? "编辑信息卡片" : "添加信息卡片" }}</h2>
          <button @click="showSheet = false">取消</button>
        </header>
        <div class="info-type-options">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            type="button"
            :class="{ active: draft.type === option.value }"
            @click="selectType(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <label>卡片标题<input v-model="draft.title" /></label>
        <label
          >信息内容<textarea v-model="draft.content" rows="7" :placeholder="placeholder(draft.type)"></textarea>
        </label>
        <button class="info-sheet-primary" :disabled="!draft.title.trim()" @click="saveCard">保存卡片</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.info-cards-editor {
  margin-top: 10px;
}
.info-card-row {
  margin-top: 9px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
}
.info-card-main {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  padding: 12px;
  background: #fff;
  text-align: left;
}
.info-card-main b,
.info-card-main small {
  display: block;
}
.info-card-main b {
  color: #111827;
  font-size: 12px;
}
.info-card-main small {
  margin-top: 3px;
  color: #9ca3af;
  font-size: 10px;
}
.info-card-main i {
  color: #9ca3af;
  font-style: normal;
}
.info-card-tools {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  border-top: 1px solid #f0f1f3;
  padding: 7px 10px;
  background: #f9fafb;
}
.info-card-tools button {
  border: 0;
  border-radius: 8px;
  padding: 5px 8px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 10px;
}
.info-card-tools button:disabled {
  opacity: 0.35;
}
.info-card-tools button.danger {
  background: #fef2f2;
  color: #dc2626;
}
.add-info-card {
  width: 100%;
  margin-top: 9px;
  border: 1.5px dashed #bfdbfe;
  border-radius: 12px;
  padding: 11px;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 650;
}
.info-sheet-layer {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(17, 24, 39, 0.35);
}
.info-sheet {
  width: 100%;
  max-height: 88vh;
  overflow-y: auto;
  border-radius: 24px 24px 0 0;
  padding: 10px 18px max(24px, env(safe-area-inset-bottom));
  background: #fff;
}
.info-sheet-handle {
  width: 38px;
  height: 4px;
  margin: 0 auto 14px;
  border-radius: 999px;
  background: #e5e7eb;
}
.info-sheet header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.info-sheet h2 {
  margin: 0;
  font-size: 17px;
}
.info-sheet header button {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
}
.info-type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 16px;
}
.info-type-options button {
  border: 0;
  border-radius: 999px;
  padding: 7px 10px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
}
.info-type-options button.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 650;
}
.info-sheet label {
  display: block;
  margin-top: 14px;
  color: #6b7280;
  font-size: 11px;
  font-weight: 650;
}
.info-sheet input,
.info-sheet textarea {
  width: 100%;
  margin-top: 6px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
  font-size: 13px;
  outline: none;
}
.info-sheet textarea {
  resize: vertical;
}
.info-sheet input:focus,
.info-sheet textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
.info-sheet-primary {
  width: 100%;
  min-height: 46px;
  margin-top: 16px;
  border: 0;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  font-weight: 700;
}
.info-sheet-primary:disabled {
  opacity: 0.45;
}
</style>
