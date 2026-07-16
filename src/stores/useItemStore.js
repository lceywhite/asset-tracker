import { defineStore } from "pinia"
import { ref, computed } from "vue"
import * as svc from "@/services/itemService"
export const useItemStore = defineStore("items", () => {
  const items = ref([]),
    loading = ref(false)
  const loadItems = async () => {
    loading.value = true
    items.value = await svc.getAllItems()
    loading.value = false
  }
  const addItem = async (data) => {
    const item = await svc.createItem(data)
    items.value.push(item)
    return item
  }
  const editItem = async (id, data) => {
    const u = await svc.updateItem(id, data)
    const i = items.value.findIndex((x) => x.id === id)
    if (i >= 0) items.value[i] = u
    return u
  }
  const removeItem = async (id) => {
    await svc.deleteItem(id)
    items.value = items.value.filter((i) => i.id !== id)
  }
  const itemsByLocation = (nodeId) => items.value.filter((i) => i.locationNodeId === nodeId)
  const moveItem = async (id, nodeId, metadata) => {
    const updated = await svc.moveItem(id, nodeId, metadata)
    const index = items.value.findIndex((item) => item.id === id)
    if (index >= 0) items.value[index] = updated
    return updated
  }
  const search = (query) => {
    const q = query.toLowerCase()
    return items.value.filter(
      (i) =>
        (i.name || "").toLowerCase().includes(q) ||
        (i.category || "").toLowerCase().includes(q) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(q)),
    )
  }
  return { items, loading, loadItems, addItem, editItem, removeItem, moveItem, itemsByLocation, search }
})
