import { defineStore } from "pinia"
import { ref } from "vue"
import * as svc from "@/services/spaceService"
export const useSpaceStore = defineStore("spaces", () => {
  const spaces = ref([])
  const loadAll = () => {
    spaces.value = svc.getAll()
  }
  const get = (id) => svc.get(id)
  const create = (data) => {
    const s = svc.create(data)
    loadAll()
    return s
  }
  const update = (id, data) => {
    svc.update(id, data)
    loadAll()
  }
  const remove = (id) => {
    svc.remove(id)
    loadAll()
  }
  const join = (code, userId, name, icon) => {
    const s = svc.joinByCode(code, userId, name, icon)
    if (s) loadAll()
    return s
  }
  const removeMember = (spaceId, userId) => {
    svc.removeMember(spaceId, userId)
    loadAll()
  }
  return { spaces, loadAll, get, create, update, remove, join, removeMember }
})
