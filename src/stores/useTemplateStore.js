import { defineStore } from "pinia"
import { ref } from "vue"
import * as svc from "@/services/templateService"
export const useTemplateStore = defineStore("templates", () => {
  const templates = ref([])
  const loadAll = async () => {
    templates.value = await svc.getAll()
  }
  const byType = (type) => templates.value.filter((t) => t.type === type)
  return { templates, loadAll, byType }
})
