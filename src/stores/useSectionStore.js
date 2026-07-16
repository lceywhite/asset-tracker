import { defineStore } from "pinia"
import { ref } from "vue"
import * as svc from "@/services/sectionService"
export const useSectionStore = defineStore("sections", () => {
  const sections = ref([])
  const loadAll = () => {
    sections.value = svc.getAll()
  }
  const create = (data) => {
    const s = svc.create(data)
    sections.value = svc.getAll()
    return s
  }
  const remove = (id) => {
    svc.remove(id)
    sections.value = svc.getAll()
  }
  return { sections, loadAll, create, remove }
})
