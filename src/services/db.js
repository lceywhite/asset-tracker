import { openDB, unwrap } from "idb"
import { normalizeItem } from "../domain/itemModel.js"

export const DB_NAME = "asset-tracker-db"
export const DB_VERSION = 6
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
  "homeSections",
  "spaceNodes",
  "spaceLayouts",
]

export const DEFAULT_HOME_SECTIONS = Object.freeze([
  {
    id: "section-bags",
    key: "bags",
    name: "我的包包",
    description: "随身、旅行与搬家使用的移动容器",
    icon: "🎒",
    builtIn: true,
    sortOrder: 0,
  },
  {
    id: "section-home",
    key: "home",
    name: "我的家",
    description: "房屋、区域与固定收纳",
    icon: "🏠",
    builtIn: true,
    sortOrder: 1,
  },
  {
    id: "section-garage",
    key: "garage",
    name: "我的车库",
    description: "车辆与车内收纳空间",
    icon: "🚙",
    builtIn: true,
    sortOrder: 2,
  },
])

const LEGACY_HOME_ROOT_ID = "space-legacy-home"

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

function seedV3Sections(transaction, now) {
  const store = transaction.objectStore("homeSections")
  DEFAULT_HOME_SECTIONS.forEach((section) => store.put({ ...section, createdAt: now, updatedAt: now }))
}

function legacyHomeRoot(now) {
  return {
    id: LEGACY_HOME_ROOT_ID,
    sectionId: "section-home",
    parentId: "",
    kind: "space",
    mobility: "fixed",
    name: "默认住所",
    description: "由旧版房间自动迁移，可在空间管理中修改",
    icon: "🏠",
    images: [],
    spaceValue: null,
    currency: "CNY",
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function migrateLegacyItemData(transaction, now) {
  const itemStore = transaction.objectStore("items")
  const request = unwrap(itemStore).openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    cursor.update(normalizeItem(cursor.value, { id: cursor.value.id, now }))
    cursor.continue()
  }
}

function migrateLegacySpaceData(transaction, now) {
  const nodeStore = transaction.objectStore("spaceNodes")
  nodeStore.put(legacyHomeRoot(now))

  const roomRequest = unwrap(transaction.objectStore("rooms")).openCursor()
  roomRequest.onsuccess = () => {
    const cursor = roomRequest.result
    if (!cursor) return
    const room = cursor.value
    nodeStore.put({
      id: room.id,
      sectionId: "section-home",
      parentId: LEGACY_HOME_ROOT_ID,
      kind: "area",
      mobility: "fixed",
      name: room.name,
      description: "",
      icon: room.icon || "🚪",
      images: [],
      spaceValue: null,
      currency: "CNY",
      sortOrder: room.sortOrder || 0,
      legacyType: "room",
      createdAt: room.createdAt || now,
      updatedAt: now,
    })
    cursor.continue()
  }

  const bagRequest = unwrap(transaction.objectStore("bags")).openCursor()
  bagRequest.onsuccess = () => {
    const cursor = bagRequest.result
    if (!cursor) return
    const bag = cursor.value
    nodeStore.put({
      id: bag.id,
      sectionId: "section-bags",
      parentId: "",
      kind: "container",
      mobility: "mobile",
      name: bag.name,
      description: "",
      icon: bag.icon || "🎒",
      images: [],
      spaceValue: null,
      currency: "CNY",
      sortOrder: bag.sortOrder || 0,
      legacyType: "bag",
      createdAt: bag.createdAt || now,
      updatedAt: now,
    })
    cursor.continue()
  }
}

function migrateLegacyLocationRecords(transaction) {
  const store = transaction.objectStore("locationRecords")
  const request = unwrap(store).openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    const record = cursor.value
    cursor.update({
      ...record,
      fromNodeId: record.fromNodeId || record.fromId || "",
      toNodeId: record.toNodeId || record.toId || "",
      reason: record.reason || "",
      notes: record.notes || "",
    })
    cursor.continue()
  }
}

function upgrade(db, oldVersion, _newVersion, transaction) {
  const items = createStore(db, transaction, "items")
  ensureIndex(items, "name", "name")
  ensureIndex(items, "category", "category")
  ensureIndex(items, "status", "status")
  ensureIndex(items, "tags", "tags", { multiEntry: true })
  ensureIndex(items, "roomId", "roomId")
  ensureIndex(items, "bagId", "bagId")
  ensureIndex(items, "itemCode", "itemCode", { unique: true })
  ensureIndex(items, "locationNodeId", "locationNodeId")
  ensureIndex(items, "homeLocationNodeId", "homeLocationNodeId")

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
  ensureIndex(movements, "fromNodeId", "fromNodeId")
  ensureIndex(movements, "toNodeId", "toNodeId")

  const activities = createStore(db, transaction, "activities")
  ensureIndex(activities, "startDate", "startDate")
  ensureIndex(activities, "status", "status")

  const activityItems = createStore(db, transaction, "activityItems")
  ensureIndex(activityItems, "activityId", "activityId")

  const checkSessions = createStore(db, transaction, "checkSessions")
  ensureIndex(checkSessions, "planId", "planId")
  ensureIndex(checkSessions, "startedAt", "startedAt")
  ensureIndex(checkSessions, "status", "status")

  const homeSections = createStore(db, transaction, "homeSections")
  ensureIndex(homeSections, "sortOrder", "sortOrder")
  ensureIndex(homeSections, "key", "key", { unique: true })

  const spaceNodes = createStore(db, transaction, "spaceNodes")
  ensureIndex(spaceNodes, "sectionId", "sectionId")
  ensureIndex(spaceNodes, "parentId", "parentId")
  ensureIndex(spaceNodes, "kind", "kind")
  ensureIndex(spaceNodes, "mobility", "mobility")

  const spaceLayouts = createStore(db, transaction, "spaceLayouts")
  ensureIndex(spaceLayouts, "nodeId", "nodeId")
  ensureIndex(spaceLayouts, "sortOrder", "sortOrder")

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

  // Seed legacy stores before the v3 migration queues its cursors, so a new database
  // receives the same generic space nodes as an upgraded database.
  if (oldVersion === 0) seedNewDatabase(transaction)

  if (oldVersion < 6) {
    const now = new Date().toISOString()
    seedV3Sections(transaction, now)
    migrateLegacySpaceData(transaction, now)
    migrateLegacyItemData(transaction, now)
    migrateLegacyLocationRecords(transaction)
  }
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

export async function ensureV3Defaults() {
  const now = new Date().toISOString()
  return runTransaction(
    ["homeSections", "spaceNodes", "rooms", "bags", "items", "locationRecords"],
    "readwrite",
    async (transaction) => {
      const sectionStore = transaction.objectStore("homeSections")
      for (const section of DEFAULT_HOME_SECTIONS) {
        if (!(await sectionStore.get(section.id))) {
          await sectionStore.put({ ...section, createdAt: now, updatedAt: now })
        }
      }

      const nodeStore = transaction.objectStore("spaceNodes")
      const rooms = await transaction.objectStore("rooms").getAll()
      if (rooms.length && !(await nodeStore.get(LEGACY_HOME_ROOT_ID))) await nodeStore.put(legacyHomeRoot(now))
      for (const room of rooms) {
        if (await nodeStore.get(room.id)) continue
        await nodeStore.put({
          id: room.id,
          sectionId: "section-home",
          parentId: LEGACY_HOME_ROOT_ID,
          kind: "area",
          mobility: "fixed",
          name: room.name,
          description: "",
          icon: room.icon || "🚪",
          images: [],
          spaceValue: null,
          currency: "CNY",
          sortOrder: room.sortOrder || 0,
          legacyType: "room",
          createdAt: room.createdAt || now,
          updatedAt: now,
        })
      }

      const bags = await transaction.objectStore("bags").getAll()
      for (const bag of bags) {
        if (await nodeStore.get(bag.id)) continue
        await nodeStore.put({
          id: bag.id,
          sectionId: "section-bags",
          parentId: "",
          kind: "container",
          mobility: "mobile",
          name: bag.name,
          description: "",
          icon: bag.icon || "🎒",
          images: [],
          spaceValue: null,
          currency: "CNY",
          sortOrder: bag.sortOrder || 0,
          legacyType: "bag",
          createdAt: bag.createdAt || now,
          updatedAt: now,
        })
      }

      const itemStore = transaction.objectStore("items")
      for (const item of await itemStore.getAll()) {
        if (item.modelVersion === 3) continue
        await itemStore.put(normalizeItem(item, { id: item.id, now }))
      }
    },
  )
}

export async function clearAll() {
  return runTransaction(STORE_NAMES, "readwrite", (transaction) => {
    STORE_NAMES.forEach((name) => transaction.objectStore(name).clear())
  })
}
