<script setup>
import { useRoute } from "vue-router"
const route = useRoute()
const nav = [
  { path: "/items", label: "所有物品", icon: "📦" },
  { path: "/checklists", label: "场景清单", icon: "✅" },
  { path: "/qr", label: "防丢标签", icon: "🏷️" },
  { path: "/settings", label: "设置", icon: "⚙️" },
]
</script>
<template>
  <aside class="w-56 bg-white border-r border-gray-200 flex flex-col h-full">
    <div class="p-4 border-b">
      <h1 class="text-lg font-bold">资产清单</h1>
      <p class="text-xs text-gray-400 mt-0.5">个人物品管理</p>
    </div>
    <nav class="flex-1 p-2 space-y-1">
      <router-link
        v-for="item in nav"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
        :class="
          route.path.startsWith(item.path) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
        "
      >
        <span class="text-lg">{{ item.icon }}</span
        >{{ item.label }}
      </router-link>
    </nav>
    <div class="p-3 border-t text-xs text-gray-400 text-center">v0.1.0 Demo</div>
  </aside>
</template>
