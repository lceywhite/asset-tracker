import { openDB, unwrap } from "idb"

export const DB_NAME = "asset-tracker-db"
export const DB_VERSION = 5
export const STORE_NAMES = [
  "items",
  "checklists",
  "templates",
  "rooms",
  "bags",
  "locationRecords",
  "activities",
  "activityItems",
  "checkSessions",
]

let dbPromise = null

function ensureIndex(store, name, keyPath, options) {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options)
}

function createStore(db, transaction, name, options = { keyPath: "id" }) {
  return db.objectStoreNames.contains(name) ? transaction.objectStore(name) : db.createObjectStore(name, options)
}

function seedNewDatabase(transaction) {
  const now = new Date().toISOString()
  const rooms = [
    ["卧室", "🛏️"],
    ["书房", "📖"],
    ["厨房", "🍳"],
    ["玄关", "🚪"],
  ]
  const bags = [
    ["日常通勤", "🎒"],
    ["出差旅行", "🧳"],
  ]

  rooms.forEach(([name, icon], sortOrder) => {
    transaction.objectStore("rooms").add({
      id: crypto.randomUUID(),
      name,
      icon,
      sortOrder,
      spaceId: "private",
      createdAt: now,
      updatedAt: now,
    })
  })
  bags.forEach(([name, icon], sortOrder) => {
    transaction.objectStore("bags").add({
      id: crypto.randomUUID(),
      name,
      icon,
      sortOrder,
      spaceId: "private",
      createdAt: now,
      updatedAt: now,
    })
  })
}

function upgrade(db, oldVersion, _newVersion, transaction) {
  const items = createStore(db, transaction, "items")
  ensureIndex(items, "name", "name")
  ensureIndex(items, "category", "category")
  ensureIndex(items, "status", "status")
  ensureIndex(items, "tags", "tags", { multiEntry: true })
  ensureIndex(items, "roomId", "roomId")
  ensureIndex(items, "bagId", "bagId")

  const checklists = createStore(db, transaction, "checklists")
  ensureIndex(checklists, "type", "type")
  ensureIndex(checklists, "status", "status")

  createStore(db, transaction, "templates")

  const rooms = createStore(db, transaction, "rooms")
  ensureIndex(rooms, "name", "name", { unique: true })

  const bags = createStore(db, transaction, "bags")
  ensureIndex(bags, "name", "name", { unique: true })

  const movements = createStore(db, transaction, "locationRecords")
  ensureIndex(movements, "itemId", "itemId")
  ensureIndex(movements, "timestamp", "timestamp")

  const activities = createStore(db, transaction, "activities")
  ensureIndex(activities, "startDate", "startDate")
  ensureIndex(activities, "status", "status")

  const activityItems = createStore(db, transaction, "activityItems")
  ensureIndex(activityItems, "activityId", "activityId")

  const checkSessions = createStore(db, transaction, "checkSessions")
  ensureIndex(checkSessions, "planId", "planId")
  ensureIndex(checkSessions, "startedAt", "startedAt")
  ensureIndex(checkSessions, "status", "status")

  if (oldVersion < 5 && oldVersion > 0) {
    const request = unwrap(activities).openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      const activity = cursor.value
      const packingItems = (activity.packingItems || []).map((entry) => {
        const { checked: _legacyChecked, ...rest } = entry
        return { ...rest, id: entry.id || crypto.randomUUID() }
      })
      cursor.update({ ...activity, kind: "plan", modelVersion: 1, packingItems })
      cursor.continue()
    }
  }

  // Seed only a genuinely new database. Upgrade callbacks must not start detached async work.
  if (oldVersion === 0) seedNewDatabase(transaction)
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade,
      blocked() {
        console.warn("数据库升级被其他标签页阻塞，请关闭旧标签页后重试。")
      },
      terminated() {
        dbPromise = null
      },
    })
  }
  return dbPromise
}

export async function closeDb() {
  if (!dbPromise) return
  const database = await dbPromise
  database.close()
  dbPromise = null
}

export const getAll = (store) => getDb().then((db) => db.getAll(store))
export const get = (store, id) => getDb().then((db) => db.get(store, id))
export const add = (store, value) => getDb().then((db) => db.add(store, value))
export const put = (store, value) => getDb().then((db) => db.put(store, value))
export const del = (store, id) => getDb().then((db) => db.delete(store, id))
export const clear = (store) => getDb().then((db) => db.clear(store))
export const getAllByIndex = (store, index, value) => getDb().then((db) => db.getAllFromIndex(store, index, value))
export const getAllByIndexRange = (store, index, lower, upper) =>
  getDb().then((db) => db.getAllFromIndex(store, index, IDBKeyRange.bound(lower, upper)))

export async function runTransaction(stores, mode, operation) {
  const database = await getDb()
  const transaction = database.transaction(stores, mode)
  const result = await operation(transaction)
  await transaction.done
  return result
}

export async function clearAll() {
  return runTransaction(STORE_NAMES, "readwrite", (transaction) => {
    STORE_NAMES.forEach((name) => transaction.objectStore(name).clear())
  })
}
