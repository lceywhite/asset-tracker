import { defineStore } from "pinia"
import { ref } from "vue"
import * as svc from "@/services/userService"
export const useUserStore = defineStore("user", () => {
  const user = ref(svc.init())
  const update = (data) => {
    svc.save({ ...user.value, ...data })
    user.value = svc.get()
  }
  return { user, update }
})
