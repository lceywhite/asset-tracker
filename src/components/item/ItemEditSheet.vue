<script setup>
import { ref, reactive, watch } from "vue"
import { useItemStore } from "@/stores/useItemStore"
import { useBagStore } from "@/stores/useBagStore"
import { useRoomStore } from "@/stores/useRoomStore"
import * as catSvc from "@/services/categoryService"
const props = defineProps({
  show: Boolean,
  presetBagId: { type: String, default: "" },
  presetRoomId: { type: String, default: "" },
  item: { type: Object, default: null },
})
const emit = defineEmits(["close", "created"])
const itemStore = useItemStore()
const bagStore = useBagStore()
const roomStore = useRoomStore()
const tagInput = ref("")
const saving = ref(false)
const showAddCat = ref(false)
const newCat = ref("")
const allCats = ref([])
const form = reactive({
  name: "",
  category: "日用",
  subCategory: "",
  photo: "",
  roomId: "",
  bagId: "",
  tags: [],
  price: 0,
  purchaseDate: "",
  notes: "",
  status: "in_stock",
})
const isEdit = () => props.item !== null

watch(
  () => props.show,
  (v) => {
    if (v) resetForm()
  },
)
function resetForm() {
  allCats.value = catSvc.getAll()
  if (props.item) {
    form.name = props.item.name || ""
    form.category = props.item.category || "日用"
    form.subCategory = props.item.subCategory || ""
    form.photo = props.item.photo || ""
    form.roomId = props.item.roomId || ""
    form.bagId = props.item.bagId || ""
    form.tags = [...(props.item.tags || [])]
    form.price = props.item.value || 0
    form.purchaseDate = props.item.purchaseDate || ""
    form.notes = props.item.notes || ""
    form.status = props.item.status || "in_stock"
  } else {
    form.name = ""
    form.category = "日用"
    form.subCategory = ""
    form.photo = ""
    form.roomId = props.presetRoomId
    form.bagId = props.presetBagId
    form.tags = []
    form.price = 0
    form.purchaseDate = ""
    form.notes = ""
    form.status = "in_stock"
  }
  tagInput.value = ""
  saving.value = false
  showAddCat.value = false
  newCat.value = ""
}
function addCategory() {
  const t = newCat.value.trim()
  if (t) {
    catSvc.add(t)
    allCats.value = catSvc.getAll()
    form.category = t
    newCat.value = ""
    showAddCat.value = false
  }
}
function addTag() {
  const t = tagInput.value?.trim() || ""
  if (t && !form.tags.includes(t)) form.tags.push(t)
  tagInput.value = ""
}
function handleFile(e) {
  const f = e.target.files?.[0]
  if (!f) return
  const r = new FileReader()
  r.onload = () => (form.photo = r.result)
  r.readAsDataURL(f)
}
async function submit() {
  if (!form.name?.trim()) return
  saving.value = true
  try {
    const data = {
      name: form.name.trim(),
      category: form.category,
      subCategory: form.subCategory,
      photo: form.photo,
      roomId: form.roomId,
      bagId: form.bagId,
      tags: [...form.tags],
      value: Number(form.price) || 0,
      purchaseDate: form.purchaseDate,
      notes: form.notes,
      status: form.status,
    }
    const item = isEdit() ? await itemStore.editItem(props.item.id, data) : await itemStore.addItem(data)
    saving.value = false
    emit("created", item)
  } catch (e) {
    console.error("Item save failed:", e)
    saving.value = false
  }
}
</script>
<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-end justify-center bg-black/30" @click.self="$emit('close')">
    <div class="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto px-5 pt-3 pb-6">
      <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3"></div>
      <h3 class="text-base font-bold text-center mb-4" style="color: var(--color-text-primary)">
        {{ isEdit() ? "编辑物品" : "添加物品" }}
      </h3>
      <div class="flex justify-center mb-4">
        <div
          @click="$refs.photoInput.click()"
          class="w-20 h-20 rounded-xl bg-gray-100 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 overflow-hidden border-2 border-dashed"
          style="border-color: var(--color-border)"
        >
          <img v-if="form.photo" :src="form.photo" class="w-full h-full object-cover" />
          <template v-else
            ><span class="text-2xl">📷</span
            ><span class="text-[9px] mt-0.5" style="color: var(--color-text-tertiary)">添加照片</span></template
          >
        </div>
        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          capture="environment"
          @change="handleFile"
          class="hidden"
        />
      </div>

      <input
        v-model="form.name"
        class="w-full border rounded-xl px-3 py-2.5 text-base font-medium text-center mb-3"
        placeholder="物品名称"
        style="border-color: var(--color-border)"
      />

      <div class="mb-3">
        <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary)">分类</label>
        <div class="grid grid-cols-2 gap-2">
          <div class="relative">
            <select
              v-model="form.category"
              class="w-full border rounded-xl px-3 py-2 text-sm bg-white"
              style="border-color: var(--color-border)"
            >
              <option v-for="c in allCats" :key="c" :value="c">{{ c }}</option>
            </select>
            <button
              @click="showAddCat = !showAddCat"
              type="button"
              class="absolute right-1 top-1/2 -translate-y-1/2 text-xs bg-white pr-1"
              style="color: var(--brand-primary)"
            >
              +
            </button>
          </div>
          <input
            v-model="form.subCategory"
            class="border rounded-xl px-3 py-2 text-sm"
            placeholder="子分类"
            style="border-color: var(--color-border)"
          />
        </div>
        <div v-if="showAddCat" class="flex gap-2 mt-2">
          <input
            v-model="newCat"
            @keydown.enter="addCategory"
            class="flex-1 border rounded-xl px-3 py-2 text-sm"
            placeholder="新分类"
            style="border-color: var(--color-border)"
          /><button
            @click="addCategory"
            type="button"
            class="px-4 py-2 rounded-xl text-sm text-white"
            style="background: var(--brand-primary)"
          >
            添加
          </button>
        </div>
      </div>

      <div class="mb-3">
        <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary)">标签</label>
        <div class="flex gap-1.5 flex-wrap mb-2">
          <span
            v-for="t in form.tags"
            :key="t"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs"
            style="background: var(--brand-primary-light); color: var(--brand-primary)"
            >{{ t
            }}<button @click="form.tags = form.tags.filter((x) => x !== t)" class="hover:opacity-70">
              &times;
            </button></span
          >
        </div>
        <div class="flex gap-2">
          <input
            v-model="tagInput"
            @keydown.enter.prevent="addTag"
            class="flex-1 border rounded-xl px-3 py-2 text-sm"
            placeholder="添加标签"
            style="border-color: var(--color-border)"
          /><button
            @click="addTag"
            type="button"
            class="px-4 py-2 rounded-xl text-sm"
            style="background: var(--color-bg); color: var(--color-text-secondary)"
          >
            添加
          </button>
        </div>
      </div>

      <div class="mb-3">
        <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary)">📍 位置</label>
        <div class="grid grid-cols-2 gap-2">
          <select
            v-model="form.roomId"
            class="border rounded-xl px-3 py-2 text-sm"
            style="border-color: var(--color-border)"
          >
            <option value="">选择房间</option>
            <option v-for="r in roomStore.rooms" :key="r.id" :value="r.id">{{ r.icon }} {{ r.name }}</option>
          </select>
          <select
            v-model="form.bagId"
            class="border rounded-xl px-3 py-2 text-sm"
            style="border-color: var(--color-border)"
          >
            <option value="">不分配包</option>
            <option v-for="b in bagStore.bags" :key="b.id" :value="b.id">{{ b.icon }} {{ b.name }}</option>
          </select>
        </div>
      </div>

      <div class="mb-3">
        <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary)">💰 财务信息</label>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="form.price"
            type="number"
            class="border rounded-xl px-3 py-2 text-sm"
            placeholder="价值（元）"
            style="border-color: var(--color-border)"
          />
          <input
            v-model="form.purchaseDate"
            type="date"
            class="border rounded-xl px-3 py-2 text-sm"
            style="border-color: var(--color-border)"
          />
        </div>
      </div>

      <div class="mb-4">
        <label class="text-xs font-medium mb-1 block" style="color: var(--color-text-secondary)">📝 备注</label
        ><textarea
          v-model="form.notes"
          class="w-full border rounded-xl px-3 py-2 text-sm"
          rows="2"
          placeholder="备注"
          style="border-color: var(--color-border)"
        ></textarea>
      </div>

      <div class="flex gap-3">
        <button
          @click="$emit('close')"
          class="flex-1 py-2.5 border rounded-xl text-sm font-medium"
          style="border-color: var(--color-border); color: var(--color-text-secondary)"
        >
          取消
        </button>
        <button
          @click="submit"
          :disabled="!form.name?.trim() || saving"
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
          :style="
            form.name?.trim() && !saving ? 'background:var(--brand-primary)' : 'background:var(--color-text-tertiary)'
          "
        >
          {{ saving ? "保存中..." : isEdit() ? "保存" : "添加" }}
        </button>
      </div>
    </div>
  </div>
</template>
