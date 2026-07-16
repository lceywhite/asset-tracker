const KEY = "asset-guard-spaces"
function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let r = ""
  for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]
  return r
}
export function getAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]")
  } catch {
    return []
  }
}
export function get(id) {
  return getAll().find((s) => s.id === id) || null
}
export function create(data) {
  const list = getAll()
  const s = {
    id: "SPACE-" + Date.now().toString(36).toUpperCase(),
    name: data.name,
    icon: data.icon || "🏠",
    inviteCode: genCode(),
    ownerId: data.ownerId,
    members: [{ userId: data.ownerId, role: "owner", name: data.ownerName || "我", icon: data.ownerIcon || "😊" }],
    spaceIds: data.spaceIds || [],
    createdAt: new Date().toISOString(),
  }
  list.push(s)
  localStorage.setItem(KEY, JSON.stringify(list))
  return s
}
export function update(id, data) {
  const list = getAll()
  const idx = list.findIndex((s) => s.id === id)
  if (idx < 0) return
  list[idx] = { ...list[idx], ...data }
  localStorage.setItem(KEY, JSON.stringify(list))
}
export function remove(id) {
  const list = getAll().filter((s) => s.id !== id)
  localStorage.setItem(KEY, JSON.stringify(list))
}
export function joinByCode(code, userId, userName, userIcon) {
  const list = getAll()
  const idx = list.findIndex((s) => s.inviteCode === code)
  if (idx < 0) return null
  if (list[idx].members.find((m) => m.userId === userId)) return list[idx]
  list[idx].members.push({ userId, role: "editor", name: userName || "新成员", icon: userIcon || "😊" })
  localStorage.setItem(KEY, JSON.stringify(list))
  return list[idx]
}
export function removeMember(spaceId, userId) {
  const list = getAll()
  const idx = list.findIndex((s) => s.id === spaceId)
  if (idx < 0) return
  list[idx].members = list[idx].members.filter((m) => m.userId !== userId)
  localStorage.setItem(KEY, JSON.stringify(list))
}
