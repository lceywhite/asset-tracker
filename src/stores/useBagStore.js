import { defineStore } from "pinia"
import { ref } from "vue"
import * as svc from "@/services/bagService"
export const useBagStore = defineStore("bags", () => {
  const bags = ref([]),
    loading = ref(false)
  const loadAll = async () => {
    loading.value = true
    bags.value = await svc.getAll()
    loading.value = false
  }
  const create = async (data) => {
    const b = await svc.create(data)
    bags.value.push(b)
    return b
  }
  const remove = async (id) => {
    await svc.del(id)
    bags.value = bags.value.filter((b) => b.id !== id)
  }
  return { bags, loading, loadAll, create, remove }
})
