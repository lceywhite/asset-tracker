<script setup>
import { ref } from "vue"
import { useItemStore } from "@/stores/useItemStore"
import { useChecklistStore } from "@/stores/useChecklistStore"
import { exportToJSON, importJSON } from "@/utils/export"
import {
  createBackup,
  restoreBackup,
  clearBusinessData,
  summarizeBackup,
  validateBackup,
} from "@/services/backupService"
import ConfirmDialog from "@/components/common/ConfirmDialog.vue"

const itemStore = useItemStore()
const checklistStore = useChecklistStore()
const importFile = ref(null)
const importPreview = ref(null)
const showClear = ref(false)
const msg = ref("")
const busy = ref(false)

function showMsg(message) {
  msg.value = message
  setTimeout(() => {
    msg.value = ""
  }, 4000)
}

async function refreshStores() {
  await Promise.all([itemStore.loadItems(), checklistStore.loadAll()])
}

async function handleExport() {
  busy.value = true
  try {
    const backup = await createBackup()
    const day = new Date().toISOString().slice(0, 10)
    exportToJSON(backup, `asset-tracker-backup-${day}.json`)
    showMsg("完整备份已导出")
  } catch (error) {
    showMsg(`导出失败：${error.message}`)
  } finally {
    busy.value = false
  }
}

async function selectImport(event) {
  const file = event.target.files?.[0]
  importFile.value = file || null
  importPreview.value = null
  if (!file) return
  try {
    const payload = await importJSON(file)
    const validation = validateBackup(payload)
    if (!validation.valid) throw new Error(validation.errors.join("；"))
    importPreview.value = { payload, counts: summarizeBackup(payload) }
  } catch (error) {
    importFile.value = null
    showMsg(`预检失败：${error.message}`)
  }
}

async function handleImport(mode) {
  if (!importPreview.value) return
  busy.value = true
  try {
    const result = await restoreBackup(importPreview.value.payload, { mode })
    await refreshStores()
    importFile.value = null
    importPreview.value = null
    showMsg(`恢复完成，共 ${result.counts.items} 件物品、${result.counts.activities} 个行程`)
  } catch (error) {
    showMsg(`恢复失败：${error.message}`)
  } finally {
    busy.value = false
  }
}

async function handleClear() {
  busy.value = true
  try {
    await clearBusinessData()
    await refreshStores()
    showClear.value = false
    showMsg("本地业务数据已清空")
  } catch (error) {
    showMsg(`清空失败：${error.message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <h2 class="text-xl font-bold mb-6">设置</h2>
    <div v-if="msg" class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 text-center">
      {{ msg }}
    </div>
    <section class="bg-white rounded-xl border p-6 mb-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-4">数据管理</h3>
      <div class="space-y-3">
        <button
          :disabled="busy"
          @click="handleExport"
          class="w-full text-left px-4 py-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <div class="text-sm font-medium">导出完整备份（JSON）</div>
          <div class="text-xs text-gray-500">包含全部数据表、行程、位置记录和本地业务配置</div>
        </button>
        <div class="px-4 py-3 border rounded-lg">
          <div class="text-sm font-medium mb-2">恢复备份</div>
          <input type="file" accept=".json,application/json" class="text-sm" @change="selectImport" />
          <div v-if="importPreview" class="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <div>预检通过：{{ importPreview.counts.items }} 件物品，{{ importPreview.counts.activities }} 个行程</div>
            <div class="flex gap-2 mt-3">
              <button
                :disabled="busy"
                @click="handleImport('replace')"
                class="px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                替换恢复
              </button>
              <button
                :disabled="busy"
                @click="handleImport('merge')"
                class="px-3 py-1.5 border rounded-lg disabled:opacity-50"
              >
                按 ID 合并
              </button>
            </div>
          </div>
        </div>
        <button
          :disabled="busy"
          @click="showClear = true"
          class="w-full text-left px-4 py-3 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          <div class="text-sm font-medium text-red-600">清空所有本地数据</div>
          <div class="text-xs text-red-400">覆盖全部业务数据表与本地业务配置，建议先导出备份</div>
        </button>
      </div>
    </section>
    <section class="bg-white rounded-xl border p-6">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">关于</h3>
      <div class="text-xs text-gray-500 space-y-1">
        <div>Asset Tracker v0.2.0-alpha.0 · Release 0</div>
        <div>数据仅存储在当前浏览器，不提供跨设备共享</div>
      </div>
    </section>
    <ConfirmDialog
      :show="showClear"
      title="清空所有本地数据"
      message="全部物品、位置、行程、清单与本地配置都会删除，且不可恢复。"
      @confirm="handleClear"
      @cancel="showClear = false"
    />
  </div>
</template>
