const BUILTIN = ["日用", "电子设备", "衣物", "证件", "家具", "书籍", "厨具", "其他"]
const KEY = "asset-tracker-categories"
export function getAll() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "[]")
    return [...BUILTIN, ...c.filter((x) => !BUILTIN.includes(x))]
  } catch {
    return BUILTIN
  }
}
export function add(name) {
  const t = name.trim()
  if (!t || BUILTIN.includes(t)) return
  const c = JSON.parse(localStorage.getItem(KEY) || "[]")
  if (!c.includes(t)) {
    c.push(t)
    localStorage.setItem(KEY, JSON.stringify(c))
  }
}
