<script setup>
import { computed, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import ItemEditSheet from "@/components/item/ItemEditSheet.vue"
import TripForm from "@/components/trip/TripForm.vue"

const route = useRoute()
const router = useRouter()
const showCreate = ref(false)
const showTripCreate = ref(false)
const showQuickMenu = ref(false)
const tabs = [
  { key: "items", path: "/items", label: "物品", icon: "◫" },
  { key: "plans", path: "/plans", label: "行程", icon: "▣" },
  { key: "community", path: "/community", label: "社区", icon: "◎" },
  { key: "me", path: "/me", label: "我的", icon: "○" },
]
const currentTab = computed(() => {
  if (route.path.startsWith("/plans") || route.path.startsWith("/trips")) return "plans"
  if (route.path.startsWith("/community")) return "community"
  if (route.path.startsWith("/me") || route.path.startsWith("/user") || route.path.startsWith("/settings")) return "me"
  return "items"
})
function onCreated(item) {
  showCreate.value = false
  router.push(`/item/${item.id}`)
}
function onTripCreated(trip) {
  showTripCreate.value = false
  router.push(`/plans/${trip.id}`)
}
function openItemCreate() {
  showQuickMenu.value = false
  showCreate.value = true
}
function openTripCreate() {
  showQuickMenu.value = false
  showTripCreate.value = true
}
</script>

<template>
  <div class="app-shell flex flex-col h-[100dvh]" style="background: var(--color-bg)">
    <main class="flex-1 min-h-0 overflow-hidden"><router-view /></main>
    <nav
      aria-label="主导航"
      class="grid grid-cols-5 bg-white/95 backdrop-blur border-t"
      style="border-color: var(--color-border); padding-bottom: env(safe-area-inset-bottom); min-height: 60px"
    >
      <button
        v-for="tab in tabs.slice(0, 2)"
        :key="tab.key"
        :aria-label="tab.label"
        :aria-current="currentTab === tab.key ? 'page' : undefined"
        class="nav-tab"
        :style="{ color: currentTab === tab.key ? 'var(--brand-primary)' : 'var(--color-text-tertiary)' }"
        @click="router.push(tab.path)"
      >
        <span class="text-[22px] leading-none font-light">{{ tab.icon }}</span>
        <span class="text-[10px]" :class="currentTab === tab.key ? 'font-semibold' : 'font-normal'">{{
          tab.label
        }}</span>
      </button>

      <button
        aria-label="快捷添加"
        class="relative min-h-[58px] flex flex-col items-center justify-end pb-1.5 text-blue-600"
        @click="showQuickMenu = true"
      >
        <span
          class="absolute -top-5 w-14 h-14 rounded-2xl text-white text-3xl flex items-center justify-center active:scale-95 transition-transform"
          style="background: linear-gradient(135deg, #2563eb, #4f46e5); box-shadow: 0 10px 24px rgba(37, 99, 235, 0.32)"
          >+</span
        >
        <span class="text-[10px] font-semibold">添加</span>
      </button>

      <button
        v-for="tab in tabs.slice(2)"
        :key="tab.key"
        :aria-label="tab.label"
        :aria-current="currentTab === tab.key ? 'page' : undefined"
        class="nav-tab"
        :style="{ color: currentTab === tab.key ? 'var(--brand-primary)' : 'var(--color-text-tertiary)' }"
        @click="router.push(tab.path)"
      >
        <span class="text-[22px] leading-none font-light">{{ tab.icon }}</span>
        <span class="text-[10px]" :class="currentTab === tab.key ? 'font-semibold' : 'font-normal'">{{
          tab.label
        }}</span>
      </button>
    </nav>

    <ItemEditSheet :show="showCreate" @close="showCreate = false" @created="onCreated" />
    <TripForm :show="showTripCreate" @close="showTripCreate = false" @created="onTripCreated" />

    <div v-if="showQuickMenu" class="fixed inset-0 z-40 flex items-end bg-black/30" @click.self="showQuickMenu = false">
      <section class="w-full bg-white rounded-t-3xl px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div class="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5"></div>
        <h2 class="text-lg font-bold">快捷添加</h2>
        <p class="text-xs text-gray-400 mt-1 mb-4">选择这次要记录的内容</p>
        <div class="grid grid-cols-2 gap-3">
          <button class="rounded-2xl border p-4 text-left bg-blue-50/50" @click="openItemCreate">
            <span class="text-2xl">📦</span><b class="block text-sm mt-3">添加物品</b
            ><small class="block text-[11px] text-gray-400 mt-1">记录位置、容器和分类</small>
          </button>
          <button class="rounded-2xl border p-4 text-left bg-indigo-50/50" @click="openTripCreate">
            <span class="text-2xl">🧳</span><b class="block text-sm mt-3">新建行程</b
            ><small class="block text-[11px] text-gray-400 mt-1">选择物品并开始核对</small>
          </button>
        </div>
        <button class="w-full py-3 mt-2 text-sm text-gray-400" @click="showQuickMenu = false">取消</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.nav-tab {
  @apply min-h-[58px] flex flex-col items-center justify-center gap-0.5 active:bg-gray-50;
}
</style>
