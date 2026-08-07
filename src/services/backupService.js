import * as db from "./db.js"

export const BACKUP_FORMAT = "asset-tracker-backup"
export const BACKUP_VERSION = 3
const SUPPORTED_BACKUP_VERSIONS = [1, 2, BACKUP_VERSION]
const V3_STORES = new Set(["homeSections", "spaceNodes", "spaceLayouts"])
export const BUSINESS_STORAGE_KEYS = [
  "asset-guard-user",
  "asset-guard-spaces",
  "asset-guard-sections",
  "asset-guard-builtin-names",
  "asset-tracker-categories",
  "asset-guard-custom-types",
  "asset-tracker-item-view",
  "asset-tracker-item-preferences",
  "asset-tracker-trip-preferences",
]

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function validateBackup(payload) {
  const errors = []
  if (!isRecord(payload)) return { valid: false, errors: ["备份内容不是对象"] }
  if (payload.format !== BACKUP_FORMAT) errors.push("无法识别的备份格式")
  if (!SUPPORTED_BACKUP_VERSIONS.includes(payload.version))
    errors.push(`不支持的备份版本：${payload.version ?? "未知"}`)
  if (!isRecord(payload.manifest)) errors.push("缺少备份清单")
  if (!isRecord(payload.data)) errors.push("缺少备份数据")
  if (!isRecord(payload.data?.stores)) errors.push("缺少 IndexedDB 数据")
  if (!isRecord(payload.data?.localStorage)) errors.push("缺少本地配置数据")

  const requiredStores = db.STORE_NAMES.filter((name) => {
    if (payload.version === 1) return name !== "checkSessions" && !V3_STORES.has(name)
    if (payload.version === 2) return !V3_STORES.has(name)
    return true
  })
  for (const name of requiredStores) {
    if (!Array.isArray(payload.data?.stores?.[name])) errors.push(`数据表 ${name} 缺失或格式错误`)
  }

  return { valid: errors.length === 0, errors }
}

export function summarizeBackup(payload) {
  const stores = payload?.data?.stores || {}
  return Object.fromEntries(db.STORE_NAMES.map((name) => [name, Array.isArray(stores[name]) ? stores[name].length : 0]))
}

export async function createBackup() {
  const stores = {}
  await Promise.all(
    db.STORE_NAMES.map(async (name) => {
      stores[name] = await db.getAll(name)
    }),
  )

  const localData = {}
  for (const key of BUSINESS_STORAGE_KEYS) {
    const value = localStorage.getItem(key)
    if (value !== null) localData[key] = value
  }

  const createdAt = new Date().toISOString()
  const counts = Object.fromEntries(db.STORE_NAMES.map((name) => [name, stores[name].length]))
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt,
    appVersion: "1.0.0-beta.1",
    database: { name: db.DB_NAME, version: db.DB_VERSION },
    manifest: { stores: [...db.STORE_NAMES], counts, localStorageKeys: Object.keys(localData) },
    data: { stores, localStorage: localData },
  }
}

export async function restoreBackup(payload, { mode = "replace" } = {}) {
  const validation = validateBackup(payload)
  if (!validation.valid) throw new Error(validation.errors.join("；"))
  if (!["replace", "merge"].includes(mode)) throw new Error("不支持的恢复模式")

  const localSnapshot = Object.fromEntries(BUSINESS_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)]))
  try {
    await db.runTransaction(db.STORE_NAMES, "readwrite", (transaction) => {
      for (const name of db.STORE_NAMES) {
        const store = transaction.objectStore(name)
        if (mode === "replace") store.clear()
        for (const value of payload.data.stores[name] || []) store.put(value)
      }
    })
    await db.ensureV3Defaults()
    await db.ensureTripV2Data()

    if (mode === "replace") BUSINESS_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    Object.entries(payload.data.localStorage).forEach(([key, value]) => {
      if (BUSINESS_STORAGE_KEYS.includes(key) && typeof value === "string") localStorage.setItem(key, value)
    })
  } catch (error) {
    Object.entries(localSnapshot).forEach(([key, value]) => {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    })
    throw error
  }

  return { mode, counts: summarizeBackup(payload) }
}

export async function clearBusinessData() {
  await db.clearAll()
  BUSINESS_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
}
