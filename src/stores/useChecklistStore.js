import { defineStore } from "pinia"
import { ref } from "vue"
import * as svc from "@/services/checklistService"
export const useChecklistStore = defineStore("checklists", () => {
  const checklists = ref([]),
    loading = ref(false),
    currentChecklist = ref(null)
  const loadAll = async () => {
    loading.value = true
    checklists.value = await svc.getAll()
    loading.value = false
  }
  const loadById = async (id) => {
    currentChecklist.value = await svc.get(id)
    return currentChecklist.value
  }
  const create = async (data) => {
    const cl = await svc.create(data)
    checklists.value.push(cl)
    return cl
  }
  const update = async (id, data) => {
    const u = await svc.update(id, data)
    const i = checklists.value.findIndex((c) => c.id === id)
    if (i >= 0) checklists.value[i] = u
    if (currentChecklist.value?.id === id) currentChecklist.value = u
    return u
  }
  const del = async (id) => {
    await svc.del(id)
    checklists.value = checklists.value.filter((c) => c.id !== id)
    if (currentChecklist.value?.id === id) currentChecklist.value = null
  }
  const toggleItem = async (id, itemId) => {
    const cl = currentChecklist.value || (await svc.get(id))
    const item = cl.items.find((i) => i.itemId === itemId)
    if (!item) return
    const u = await svc.updateItem(id, itemId, { checked: !item.checked })
    currentChecklist.value = u
    const i = checklists.value.findIndex((c) => c.id === id)
    if (i >= 0) checklists.value[i] = u
  }
  const markReturned = async (id, itemId, returned) => {
    const u = await svc.updateItem(id, itemId, { returned })
    currentChecklist.value = u
    const i = checklists.value.findIndex((c) => c.id === id)
    if (i >= 0) checklists.value[i] = u
  }
  return { checklists, loading, currentChecklist, loadAll, loadById, create, update, del, toggleItem, markReturned }
})
