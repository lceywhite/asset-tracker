<script setup>
import { onErrorCaptured, onMounted, onUnmounted, ref } from "vue"

const error = ref(null)

function capture(reason) {
  error.value = reason instanceof Error ? reason : new Error(String(reason || "未知错误"))
}

function onUnhandledRejection(event) {
  capture(event.reason)
}

function reload() {
  window.location.reload()
}

onErrorCaptured((captured) => {
  capture(captured)
  return false
})
onMounted(() => window.addEventListener("unhandledrejection", onUnhandledRejection))
onUnmounted(() => window.removeEventListener("unhandledrejection", onUnhandledRejection))
</script>

<template>
  <slot v-if="!error" />
  <main v-else class="min-h-screen flex items-center justify-center bg-gray-50 p-6">
    <section class="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm" role="alert">
      <div class="text-3xl mb-3">⚠️</div>
      <h1 class="text-lg font-bold text-gray-900">应用暂时无法启动</h1>
      <p class="mt-2 text-sm text-gray-500">本地数据没有被自动清除。请先关闭其他 Asset Tracker 标签页，再重新加载。</p>
      <details class="mt-4 text-left text-xs text-gray-500">
        <summary class="cursor-pointer">查看错误信息</summary>
        <pre class="mt-2 overflow-auto rounded-lg bg-gray-50 p-3 whitespace-pre-wrap">{{ error.message }}</pre>
      </details>
      <button class="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white" @click="reload">
        重新加载
      </button>
    </section>
  </main>
</template>
