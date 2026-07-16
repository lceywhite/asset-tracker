import { defineStore } from "pinia"
import { ref } from "vue"
import * as svc from "@/services/roomService"
export const useRoomStore = defineStore("rooms", () => {
  const rooms = ref([]),
    loading = ref(false)
  const loadAll = async () => {
    loading.value = true
    rooms.value = await svc.getAll()
    loading.value = false
  }
  const create = async (data) => {
    const r = await svc.create(data)
    rooms.value.push(r)
    return r
  }
  const remove = async (id) => {
    await svc.del(id)
    rooms.value = rooms.value.filter((r) => r.id !== id)
  }
  return { rooms, loading, loadAll, create, remove }
})
