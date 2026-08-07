<script setup>
import { computed, nextTick, onMounted, ref, shallowRef } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Capacitor } from "@capacitor/core"
import { useUserStore } from "@/stores/useUserStore"
import * as db from "@/services/db"
import {
  clearBusinessData,
  createBackup,
  restoreBackup,
  summarizeBackup,
  validateBackup,
} from "@/services/backupService"
import { exportToJSON, importJSON } from "@/utils/export"
import { getPreferences, updatePreferences } from "@/services/itemPreferencesService"
import { getTripPreferences, updateTripPreferences } from "@/services/tripPreferencesService"
import { APP_VERSION, IOS_VERSION_LABEL } from "@/config/appVersion"

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const editOpen = ref(false)
const editName = ref("")
const message = ref("")
const counts = ref({ items: 0, spaces: 0, containers: 0, activities: 0 })
const storageLabel = ref("正在计算")
const preferences = ref(getPreferences())
const tripPreferences = ref(getTripPreferences())
const importPreview = ref(null)
// 备份对象必须保持为普通可克隆数据；Vue 深层代理对象不能写入 IndexedDB。
const importPayload = shallowRef(null)
const fileInput = ref(null)
const userIcons = ["😊", "😎", "🤗", "😺", "🦊", "🐼", "🐨", "🧑", "👩", "👨"]

const platformLabel = computed(() =>
  Capacitor.isNativePlatform() ? `iPhone App · ${Capacitor.getPlatform()}` : "浏览器预览",
)

function flash(text) {
  message.value = text
  window.setTimeout(() => (message.value = ""), 2800)
}

async function refreshStats() {
  const [items, nodes, activities] = await Promise.all([
    db.getAll("items"),
    db.getAll("spaceNodes"),
    db.getAll("activities"),
  ])
  counts.value = {
    items: items.length,
    spaces: nodes.filter((node) => node.kind === "space").length,
    containers: nodes.filter((node) => node.kind === "container").length,
    activities: activities.length,
  }
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate()
    storageLabel.value = estimate.usage ? `${Math.max(0.1, estimate.usage / 1024 / 1024).toFixed(1)} MB` : "少于 0.1 MB"
  } else storageLabel.value = "仅存于本机"
}

onMounted(async () => {
  await refreshStats()
  if (route.query.section === "preferences") {
    await nextTick()
    document.querySelector("#preferences")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
})

function openEditor() {
  editName.value = userStore.user.name
  editOpen.value = true
}
function saveProfile() {
  if (!editName.value.trim()) return
  userStore.update({ name: editName.value.trim() })
  editOpen.value = false
  flash("个人资料已更新")
}
function setPreference(key, value) {
  preferences.value = updatePreferences({ [key]: value })
  flash("偏好设置已更新")
}
function setTripPreference(key, value) {
  tripPreferences.value = updateTripPreferences({ [key]: value })
  flash("行程提醒偏好已更新")
}
async function exportBackup() {
  const backup = await createBackup()
  const date = new Date().toISOString().slice(0, 10)
  await exportToJSON(backup, `物品守护备份-${date}.json`)
  flash("备份已生成，请妥善保存")
}
async function pickBackup(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const payload = await importJSON(file)
    const validation = validateBackup(payload)
    if (!validation.valid) throw new Error(validation.errors.join("；"))
    importPayload.value = payload
    importPreview.value = summarizeBackup(payload)
  } catch (error) {
    flash(error.message || "无法读取备份")
  } finally {
    event.target.value = ""
  }
}
async function applyRestore(mode) {
  if (!importPayload.value) return
  try {
    await restoreBackup(importPayload.value, { mode })
    importPayload.value = null
    importPreview.value = null
    await refreshStats()
    preferences.value = getPreferences()
    tripPreferences.value = getTripPreferences()
    flash(mode === "replace" ? "数据已从备份替换" : "备份数据已合并")
  } catch (error) {
    flash(`恢复失败：${error.message || "请检查备份文件和本机存储空间"}`)
  }
}
async function clearData() {
  if (!window.confirm("将删除本机所有物品、行程和核对记录。建议先导出备份。确定继续吗？")) return
  if (!window.confirm("此操作无法撤销。再次确认清空本机数据？")) return
  await clearBusinessData()
  await refreshStats()
  preferences.value = getPreferences()
  tripPreferences.value = getTripPreferences()
  flash("本机业务数据已清空")
}
</script>

<template>
  <div class="h-full overflow-y-auto px-4 pb-8" style="background: var(--color-bg)">
    <header class="pt-[max(18px,env(safe-area-inset-top))] pb-3">
      <p class="text-xs font-semibold text-blue-600">个人中心</p>
      <h1 class="text-2xl font-bold mt-1">我的</h1>
    </header>

    <button
      class="w-full bg-white rounded-2xl p-4 flex items-center gap-4 text-left border"
      style="border-color: var(--color-border-light)"
      @click="openEditor"
    >
      <span class="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl">{{
        userStore.user.icon || "😊"
      }}</span>
      <span class="flex-1 min-w-0">
        <span class="block text-base font-bold truncate">{{ userStore.user.name }}</span>
        <span class="block text-xs text-gray-400 mt-1">单人本地账户 · 点此编辑资料</span>
      </span>
      <span class="text-gray-300">›</span>
    </button>

    <section class="grid grid-cols-4 gap-2 my-4">
      <div
        v-for="stat in [
          { label: '物品', value: counts.items },
          { label: '空间', value: counts.spaces },
          { label: '容器', value: counts.containers },
          { label: '行程', value: counts.activities },
        ]"
        :key="stat.label"
        class="bg-white rounded-xl py-3 text-center border"
        style="border-color: var(--color-border-light)"
      >
        <div class="text-lg font-bold">{{ stat.value }}</div>
        <div class="text-[10px] text-gray-400">{{ stat.label }}</div>
      </div>
    </section>

    <section id="preferences" class="mb-4 scroll-mt-4">
      <h2 class="text-xs font-semibold text-gray-400 px-1 mb-2">偏好设置</h2>
      <div class="bg-white rounded-2xl border divide-y overflow-hidden" style="border-color: var(--color-border-light)">
        <div class="p-4 flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-semibold">物品页默认视图</div>
            <div class="text-xs text-gray-400 mt-1">默认进入空间树或全部物品</div>
          </div>
          <div class="flex rounded-lg bg-gray-100 p-1 text-xs">
            <button
              class="px-3 py-1.5 rounded-md"
              :class="preferences.homeView === 'space' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'"
              @click="setPreference('homeView', 'space')"
            >
              空间
            </button>
            <button
              class="px-3 py-1.5 rounded-md"
              :class="preferences.homeView === 'items' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'"
              @click="setPreference('homeView', 'items')"
            >
              物品
            </button>
          </div>
        </div>
        <div class="p-4 flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-semibold">默认添加方式</div>
            <div class="text-xs text-gray-400 mt-1">添加页仍可随时切换</div>
          </div>
          <div class="flex rounded-lg bg-gray-100 p-1 text-xs">
            <button
              class="px-3 py-1.5 rounded-md"
              :class="preferences.addMode === 'quick' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'"
              @click="setPreference('addMode', 'quick')"
            >
              快速</button
            ><button
              class="px-3 py-1.5 rounded-md"
              :class="preferences.addMode === 'guided' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'"
              @click="setPreference('addMode', 'guided')"
            >
              逐步
            </button>
          </div>
        </div>
        <div class="p-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-semibold">默认估值规则</div>
              <div class="text-xs text-gray-400 mt-1">直线折旧当前只记录偏好，不执行计算</div>
            </div>
            <select
              class="rounded-lg border bg-white px-3 py-2 text-xs"
              :value="preferences.valuationMode"
              @change="setPreference('valuationMode', $event.target.value)"
            >
              <option value="none">不计算</option>
              <option value="manual">手动估值</option>
              <option value="linear">使用年限直线折旧</option>
            </select>
          </div>
        </div>
        <div class="p-4">
          <div class="text-sm font-semibold">星标物品提醒</div>
          <div class="text-xs text-gray-400 mt-1 mb-3">统一用于所有行程；当前保存规则，系统通知稍后接入</div>
          <div class="grid grid-cols-2 gap-2">
            <label class="text-[11px] text-gray-500">
              出发前
              <select
                class="w-full rounded-lg border bg-white px-2 py-2 text-xs mt-1"
                :value="tripPreferences.departureReminder"
                @change="setTripPreference('departureReminder', $event.target.value)"
              >
                <option value="previous_evening">前一天晚上</option>
                <option value="off">不提醒</option>
              </select>
            </label>
            <label class="text-[11px] text-gray-500">
              返程/结束前
              <select
                class="w-full rounded-lg border bg-white px-2 py-2 text-xs mt-1"
                :value="tripPreferences.endReminder"
                @change="setTripPreference('endReminder', $event.target.value)"
              >
                <option value="previous_evening">前一天晚上</option>
                <option value="off">不提醒</option>
              </select>
            </label>
          </div>
          <label class="block text-[11px] text-gray-500 mt-3">
            晚上提醒时间
            <input
              type="time"
              class="w-full rounded-lg border bg-white px-3 py-2 text-xs mt-1"
              :disabled="tripPreferences.departureReminder === 'off' && tripPreferences.endReminder === 'off'"
              :value="tripPreferences.reminderTime"
              @change="setTripPreference('reminderTime', $event.target.value)"
            />
          </label>
        </div>
      </div>
    </section>

    <section class="mb-4">
      <h2 class="text-xs font-semibold text-gray-400 px-1 mb-2">数据与隐私</h2>
      <div class="bg-white rounded-2xl border divide-y overflow-hidden" style="border-color: var(--color-border-light)">
        <button class="settings-row" @click="exportBackup">
          <span><b>导出完整备份</b><small>原生版将打开 iOS 分享与“文件”保存面板</small></span
          ><i>›</i>
        </button>
        <button class="settings-row" @click="fileInput?.click()">
          <span><b>从备份恢复</b><small>支持替换或按 ID 合并</small></span
          ><i>›</i>
        </button>
        <div class="settings-row">
          <span><b>本机占用</b><small>所有业务数据默认仅保存在此设备</small></span
          ><em>{{ storageLabel }}</em>
        </div>
        <button class="settings-row text-red-500" @click="clearData">
          <span><b>清空本机数据</b><small>双重确认后执行，不影响导出的备份</small></span
          ><i>›</i>
        </button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="pickBackup" />
    </section>

    <section class="mb-4">
      <h2 class="text-xs font-semibold text-gray-400 px-1 mb-2">关于产品</h2>
      <div class="bg-white rounded-2xl border divide-y overflow-hidden" style="border-color: var(--color-border-light)">
        <button class="settings-row" @click="router.push('/community')">
          <span><b>社区计划</b><small>入口已预留，当前不会上传本地数据</small></span
          ><i>›</i>
        </button>
        <button class="settings-row" @click="router.push('/me/updates')">
          <span><b>版本更新记录</b><small>用产品语言了解每次改动</small></span
          ><i>›</i>
        </button>
        <div class="settings-row">
          <span><b>运行方式</b><small>目标：通过 Xcode 直接安装到 iPhone</small></span
          ><em>{{ platformLabel }}</em>
        </div>
        <div class="settings-row">
          <span><b>当前版本</b><small>单人 MVP 测试版</small></span
          ><em>{{ APP_VERSION }}</em>
        </div>
        <div class="settings-row">
          <span><b>iOS 构建版本</b><small>Xcode 使用 Apple 要求的纯数字版本号</small></span
          ><em>{{ IOS_VERSION_LABEL }}</em>
        </div>
      </div>
    </section>

    <p class="px-4 text-center text-[11px] leading-5 text-gray-400">
      物品、位置、行程和核对记录均默认保存在本机。社区功能上线前不会自动同步或公开任何数据。
    </p>

    <div
      v-if="message"
      class="fixed left-1/2 -translate-x-1/2 bottom-[calc(78px+env(safe-area-inset-bottom))] z-50 rounded-full bg-gray-900 text-white text-xs px-4 py-2 shadow-lg"
    >
      {{ message }}
    </div>

    <div
      v-if="editOpen"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      @click.self="editOpen = false"
    >
      <div class="w-full max-w-2xl bg-white rounded-t-3xl px-5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div class="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5"></div>
        <h3 class="font-bold text-lg mb-4">编辑个人资料</h3>
        <div class="flex gap-2 overflow-x-auto pb-3">
          <button
            v-for="icon in userIcons"
            :key="icon"
            class="shrink-0 w-11 h-11 rounded-xl text-xl"
            :class="userStore.user.icon === icon ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-gray-50'"
            @click="userStore.update({ icon })"
          >
            {{ icon }}
          </button>
        </div>
        <input
          v-model="editName"
          class="w-full rounded-xl border px-4 py-3 text-sm"
          placeholder="昵称"
          @keydown.enter="saveProfile"
        />
        <button class="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 mt-4" @click="saveProfile">
          保存
        </button>
      </div>
    </div>

    <div
      v-if="importPreview"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      @click.self="importPreview = null"
    >
      <div class="w-full max-w-2xl bg-white rounded-t-3xl p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <h3 class="font-bold text-lg">备份预检通过</h3>
        <p class="text-sm text-gray-500 mt-2">
          包含 {{ importPreview.items }} 件物品、{{ importPreview.activities }} 个行程、{{
            importPreview.checkSessions
          }}
          次核对记录。
        </p>
        <button class="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 mt-5" @click="applyRestore('merge')">
          合并到现有数据
        </button>
        <button class="w-full rounded-xl border font-semibold py-3 mt-2" @click="applyRestore('replace')">
          替换现有数据
        </button>
        <button class="w-full py-3 mt-1 text-sm text-gray-400" @click="importPreview = null">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-row {
  @apply w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-4 text-left bg-white;
}
.settings-row span {
  @apply min-w-0 flex-1;
}
.settings-row b {
  @apply block text-sm font-semibold not-italic;
}
.settings-row small {
  @apply block text-[11px] leading-4 text-gray-400 mt-0.5;
}
.settings-row i {
  @apply text-xl text-gray-300 not-italic;
}
.settings-row em {
  @apply text-xs text-gray-400 not-italic text-right;
}
</style>
