<script setup>
import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useSpaceStore } from "@/stores/useSpaceStore"
import { useUserStore } from "@/stores/useUserStore"
import * as bagSvc from "@/services/bagService"
import * as roomSvc from "@/services/roomService"
import * as itemSvc from "@/services/itemService"
const route = useRoute()
const router = useRouter()
const spaceStore = useSpaceStore()
const userStore = useUserStore()
const showConfirm = ref(false)
const showMembers = ref(false)
const copied = ref(false)
const spaceBags = ref([])
const spaceRooms = ref([])
const spaceDirectItems = ref([])
const allItems = ref([])
const loadingAssets = ref(true)

onMounted(async () => {
  try {
    const [allBags, allRooms, items] = await Promise.all([bagSvc.getAll(), roomSvc.getAll(), itemSvc.getAllItems()])
    allItems.value = items
    spaceBags.value = allBags.filter((b) => b.spaceId === route.params.id)
    spaceRooms.value = allRooms.filter((r) => r.spaceId === route.params.id)
    spaceDirectItems.value = items.filter((i) => i.spaceId === route.params.id && !i.bagId && !i.roomId)
  } catch (e) {
    console.error(e)
  }
  loadingAssets.value = false
})

function bagItemCount(bagId) {
  return allItems.value.filter((i) => i.bagId === bagId).length
}
function roomItemCount(roomId) {
  return allItems.value.filter((i) => i.roomId === roomId).length
}
const space = computed(() => spaceStore.get(route.params.id))
const isOwner = computed(() => space.value?.members.some((m) => m.userId === userStore.user.id && m.role === "owner"))
const myRole = computed(() => space.value?.members.find((m) => m.userId === userStore.user.id)?.role || "")

async function copyCode() {
  try {
    await navigator.clipboard.writeText(space.value?.inviteCode || "")
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    alert(space.value?.inviteCode)
  }
}
function leaveSpace() {
  spaceStore.removeMember(space.value.id, userStore.user.id)
  router.push("/user")
}
function deleteSpace() {
  spaceStore.remove(space.value.id)
  router.push("/user")
}
</script>
<template>
  <div class="flex flex-col h-full" style="background: var(--color-bg)">
    <div class="flex items-center gap-2 px-4 py-3 bg-white border-b" style="border-color: var(--color-border)">
      <button
        @click="router.back()"
        class="text-lg w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
      >
        &larr;
      </button>
      <div class="flex-1 text-base font-bold truncate" style="color: var(--color-text-primary)">
        {{ space?.icon || "🏠" }} {{ space?.name || "空间" }}
      </div>
    </div>
    <div class="flex-1 overflow-y-auto px-4 pb-4" v-if="space">
      <!-- Invite Code -->
      <div class="mt-4 bg-white rounded-xl p-4" style="border: 1px solid var(--color-border-light)">
        <div class="text-xs font-medium mb-2" style="color: var(--color-text-secondary)">邀请码</div>
        <div class="flex items-center gap-3">
          <div
            class="flex-1 bg-gray-50 rounded-lg px-4 py-3 text-center text-lg font-bold tracking-[0.3em]"
            style="color: var(--brand-primary); font-family: monospace"
          >
            {{ space.inviteCode }}
          </div>
          <button
            @click="copyCode"
            class="px-4 py-3 rounded-lg text-sm font-medium text-white whitespace-nowrap"
            :style="copied ? 'background:var(--state-success)' : 'background:var(--brand-primary)'"
          >
            {{ copied ? "已复制" : "复制" }}
          </button>
        </div>
      </div>

      <!-- Shared Assets -->
      <div class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold" style="color: var(--color-text-primary)">共享资产</h3>
        </div>
        <div v-if="loadingAssets" class="text-center py-4 text-xs" style="color: var(--color-text-tertiary)">
          加载中...
        </div>
        <div v-else class="space-y-3">
          <!-- Shared Bags -->
          <div
            v-if="spaceBags.length"
            class="bg-white rounded-xl overflow-hidden"
            style="border: 1px solid var(--color-border-light)"
          >
            <div
              class="px-3 py-2 text-xs font-semibold"
              style="color: var(--color-text-secondary); border-bottom: 1px solid var(--color-divider)"
            >
              共用的包包 ({{ spaceBags.length }})
            </div>
            <div
              v-for="bag in spaceBags"
              :key="bag.id"
              @click="router.push('/bag/' + bag.id)"
              class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
              style="border-bottom: 1px solid var(--color-divider)"
            >
              <span class="text-lg">{{ bag.icon || "🎒" }}</span>
              <span class="flex-1 text-sm font-medium truncate" style="color: var(--color-text-primary)">{{
                bag.name
              }}</span>
              <span class="text-xs" style="color: var(--color-text-tertiary)">{{ bagItemCount(bag.id) }} 件</span>
              <span class="text-xs" style="color: var(--color-text-tertiary)">&gt;</span>
            </div>
          </div>
          <!-- Shared Rooms -->
          <div
            v-if="spaceRooms.length"
            class="bg-white rounded-xl overflow-hidden"
            style="border: 1px solid var(--color-border-light)"
          >
            <div
              class="px-3 py-2 text-xs font-semibold"
              style="color: var(--color-text-secondary); border-bottom: 1px solid var(--color-divider)"
            >
              共用的房间 ({{ spaceRooms.length }})
            </div>
            <div
              v-for="room in spaceRooms"
              :key="room.id"
              @click="router.push('/room/' + room.id)"
              class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
              style="border-bottom: 1px solid var(--color-divider)"
            >
              <span class="text-lg">{{ room.icon || "🚪" }}</span>
              <span class="flex-1 text-sm font-medium truncate" style="color: var(--color-text-primary)">{{
                room.name
              }}</span>
              <span class="text-xs" style="color: var(--color-text-tertiary)">{{ roomItemCount(room.id) }} 件</span>
              <span class="text-xs" style="color: var(--color-text-tertiary)">&gt;</span>
            </div>
          </div>
          <!-- Direct Items -->
          <div
            v-if="spaceDirectItems.length"
            class="bg-white rounded-xl overflow-hidden"
            style="border: 1px solid var(--color-border-light)"
          >
            <div
              class="px-3 py-2 text-xs font-semibold"
              style="color: var(--color-text-secondary); border-bottom: 1px solid var(--color-divider)"
            >
              独立物品 ({{ spaceDirectItems.length }})
            </div>
            <div
              v-for="item in spaceDirectItems"
              :key="item.id"
              @click="router.push('/item/' + item.id)"
              class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
              style="border-bottom: 1px solid var(--color-divider)"
            >
              <span class="text-base">📦</span>
              <span class="flex-1 text-sm font-medium truncate" style="color: var(--color-text-primary)">{{
                item.name
              }}</span>
              <span class="text-xs" style="color: var(--color-text-tertiary)">{{ item.category || "" }}</span>
              <span class="text-xs" style="color: var(--color-text-tertiary)">&gt;</span>
            </div>
          </div>
        </div>
      </div>
      <!-- Members -->
      <div class="mt-4 bg-white rounded-xl" style="border: 1px solid var(--color-border-light)">
        <div class="flex items-center justify-between px-4 py-3 border-b" style="border-color: var(--color-divider)">
          <span class="text-sm font-semibold" style="color: var(--color-text-primary)"
            >成员（{{ space.members.length }}）</span
          >
        </div>
        <div
          v-for="m in space.members"
          :key="m.userId"
          class="flex items-center gap-3 px-4 py-3"
          style="border-bottom: 1px solid var(--color-divider)"
        >
          <span class="text-xl">{{ m.icon || "😊" }}</span>
          <div class="flex-1">
            <div class="text-sm font-medium" style="color: var(--color-text-primary)">
              {{ m.name
              }}<span
                v-if="m.userId === userStore.user.id"
                class="text-xs ml-1"
                style="color: var(--color-text-tertiary)"
                >（我）</span
              >
            </div>
          </div>
          <span
            class="text-xs px-2 py-0.5 rounded-full"
            :style="
              m.role === 'owner'
                ? 'background:var(--brand-primary-light);color:var(--brand-primary)'
                : 'background:var(--color-bg);color:var(--color-text-secondary)'
            "
            >{{ m.role === "owner" ? "所有者" : "编辑者" }}</span
          >
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-6 space-y-2">
        <button
          v-if="isOwner"
          @click="showConfirm = 'delete'"
          class="w-full py-3 rounded-xl text-sm font-medium"
          style="background: var(--state-error-bg); color: var(--state-error)"
        >
          删除空间
        </button>
        <button
          v-else
          @click="showConfirm = 'leave'"
          class="w-full py-3 rounded-xl text-sm font-medium"
          style="border: 1px solid var(--color-border); color: var(--color-text-secondary)"
        >
          退出空间
        </button>
      </div>
    </div>
    <div v-else class="flex-1 flex items-center justify-center text-sm" style="color: var(--color-text-tertiary)">
      空间不存在
    </div>

    <!-- Confirm Dialog -->
    <div
      v-if="showConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      @click.self="showConfirm = ''"
    >
      <div class="bg-white rounded-xl p-5 mx-4 max-w-xs w-full">
        <h3 class="text-sm font-bold mb-2" style="color: var(--color-text-primary)">
          {{ showConfirm === "delete" ? "删除空间" : "退出空间" }}
        </h3>
        <p class="text-xs mb-4" style="color: var(--color-text-secondary)">
          {{ showConfirm === "delete" ? "删除后不可恢复。" : "确定要退出此空间吗？" }}
        </p>
        <div class="flex gap-3">
          <button
            @click="showConfirm = ''"
            class="flex-1 py-2 border rounded-lg text-xs font-medium"
            style="border-color: var(--color-border); color: var(--color-text-secondary)"
          >
            取消
          </button>
          <button
            @click="showConfirm === 'delete' ? deleteSpace() : leaveSpace()"
            class="flex-1 py-2 rounded-lg text-xs font-medium text-white"
            :style="showConfirm === 'delete' ? 'background:var(--state-error)' : 'background:var(--brand-primary)'"
          >
            {{ showConfirm === "delete" ? "删除" : "退出" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
