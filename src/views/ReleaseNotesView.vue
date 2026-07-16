<script setup>
import { useRouter } from "vue-router"
import { RELEASE_NOTES } from "@/data/releaseNotes"
const router = useRouter()
</script>
<template>
  <div class="h-full overflow-y-auto bg-gray-50">
    <header
      class="sticky top-0 z-10 flex items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 bg-white/95 backdrop-blur border-b"
    >
      <button aria-label="返回" @click="router.back()" class="w-9 h-9 rounded-full bg-gray-100">←</button>
      <div>
        <h1 class="text-base font-bold">版本更新</h1>
        <p class="text-[11px] text-gray-400">每个版本改变了什么</p>
      </div>
    </header>
    <main class="p-4 pb-10 space-y-4">
      <article v-for="(release, index) in RELEASE_NOTES" :key="release.version" class="bg-white rounded-2xl border p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span
              v-if="index === 0"
              class="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold mb-2"
              >当前版本</span
            >
            <h2 class="text-lg font-bold">{{ release.title }}</h2>
            <p class="text-xs text-gray-400 mt-1">v{{ release.version }} · {{ release.date }}</p>
          </div>
        </div>
        <p class="text-sm text-gray-600 leading-6 mt-4">{{ release.summary }}</p>
        <div class="mt-4 space-y-3">
          <div v-for="change in release.changes" :key="change.area + change.text" class="flex gap-3">
            <span class="shrink-0 px-2 py-1 rounded-lg bg-gray-100 text-[10px] font-semibold h-fit">{{
              change.area
            }}</span>
            <p class="text-sm text-gray-600 leading-5">{{ change.text }}</p>
          </div>
        </div>
      </article>
    </main>
  </div>
</template>
