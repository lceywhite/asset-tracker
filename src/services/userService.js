const KEY = "asset-guard-user"
const DEFAULT_ICONS = ["😊", "😎", "🤗", "😺", "🦊", "🐼", "🐨", "🦄"]
export function get() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null")
  } catch {
    return null
  }
}
export function init() {
  let u = get()
  if (!u) {
    u = {
      id: "U-" + Date.now().toString(36).toUpperCase(),
      name: "用户",
      icon: DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)],
      createdAt: new Date().toISOString(),
    }
    save(u)
  }
  return u
}
export function save(u) {
  localStorage.setItem(KEY, JSON.stringify(u))
}
