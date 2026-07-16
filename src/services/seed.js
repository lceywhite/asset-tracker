import { generateId } from "@/utils/id"
export async function seedAll(db) {
  // Seed rooms
  const rooms = [
    { id: generateId(), name: "卧室", icon: "🛏️", sortOrder: 0 },
    { id: generateId(), name: "书房", icon: "📖", sortOrder: 1 },
    { id: generateId(), name: "厨房", icon: "🍳", sortOrder: 2 },
    { id: generateId(), name: "玄关", icon: "🚪", sortOrder: 3 },
  ]
  for (const r of rooms) {
    db.add("rooms", { ...r, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  }
  // Seed bags
  const bags = [
    { id: generateId(), name: "日常通勤", icon: "🎒", sortOrder: 0 },
    { id: generateId(), name: "出差旅行", icon: "🧳", sortOrder: 1 },
  ]
  for (const b of bags) {
    db.add("bags", { ...b, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  }
}
