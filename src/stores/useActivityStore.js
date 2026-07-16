import { defineStore } from "pinia"
import { ref } from "vue"
import * as svc from "@/services/activityService"
export const useActivityStore = defineStore("activities", () => {
  const activities = ref([])
  const current = ref(null)
  const loading = ref(false)
  const loadAll = async () => {
    loading.value = true
    activities.value = await svc.getAll()
    loading.value = false
  }
  const loadById = async (id) => {
    current.value = await svc.get(id)
    return current.value
  }
  const create = async (d) => {
    const a = await svc.create(d)
    activities.value.push(a)
    return a
  }
  const update = async (id, d) => {
    const u = await svc.update(id, d)
    const i = activities.value.findIndex((x) => x.id === id)
    if (i >= 0) activities.value[i] = u
    if (current.value?.id === id) current.value = u
    return u
  }
  const del = async (id) => {
    await svc.del(id)
    activities.value = activities.value.filter((x) => x.id !== id)
    if (current.value?.id === id) current.value = null
  }
  return { activities, current, loading, loadAll, loadById, create, update, del }
})
