const KEY = "asset-guard-sections"
const BUILTIN = [
  { id: "_bags", name: "我的包包", icon: "🎒", builtin: true, type: "bag" },
  { id: "_rooms", name: "我的房间", icon: "🚪", builtin: true, type: "room" },
]
export function getAll() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "[]")
    return [...BUILTIN, ...c]
  } catch {
    return BUILTIN
  }
}
export function create(data) {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]")
  const s = {
    id: "sec-" + Date.now(),
    name: data.name,
    icon: data.icon || "📦",
    type: data.type || "bag",
    builtin: false,
    sortOrder: list.length,
    bagIds: [],
    roomIds: [],
  }
  list.push(s)
  localStorage.setItem(KEY, JSON.stringify(list))
  return s
}
export function update(id, data) {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]")
  const idx = list.findIndex((s) => s.id === id)
  if (idx < 0) return
  list[idx] = { ...list[idx], ...data }
  localStorage.setItem(KEY, JSON.stringify(list))
}
export function remove(id) {
  const list = JSON.parse(localStorage.getItem(KEY) || "[]").filter((s) => s.id !== id)
  localStorage.setItem(KEY, JSON.stringify(list))
}
