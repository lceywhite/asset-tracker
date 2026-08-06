import "fake-indexeddb/auto"
import test from "node:test"
import assert from "node:assert/strict"

class MemoryStorage {
  #values = new Map()
  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null
  }
  setItem(key, value) {
    this.#values.set(key, String(value))
  }
  removeItem(key) {
    this.#values.delete(key)
  }
}

globalThis.localStorage = new MemoryStorage()

const rawOpen = (name, version, upgrade) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onupgradeneeded = () => upgrade(request.result)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

test("upgrades v6 trips and check sessions to v2 and keeps backup preferences", async () => {
  const legacy = await rawOpen("asset-tracker-db", 6, (database) => {
    const activities = database.createObjectStore("activities", { keyPath: "id" })
    activities.createIndex("startDate", "startDate")
    activities.createIndex("status", "status")
    const sessions = database.createObjectStore("checkSessions", { keyPath: "id" })
    sessions.createIndex("planId", "planId")
    sessions.createIndex("startedAt", "startedAt")
    sessions.createIndex("status", "status")
    database.createObjectStore("items", { keyPath: "id" })
    database.createObjectStore("spaceNodes", { keyPath: "id" })
  })

  const transaction = legacy.transaction(["activities", "checkSessions", "items", "spaceNodes"], "readwrite")
  transaction.objectStore("items").put({ id: "item-1", name: "护照", category: "证件" })
  transaction.objectStore("spaceNodes").put({
    id: "bag-1",
    sectionId: "section-bags",
    kind: "container",
    mobility: "mobile",
    name: "通勤背包",
  })
  transaction.objectStore("activities").put({
    id: "trip-legacy",
    title: "出差",
    type: "travel",
    status: "active",
    startDate: "2026-08-08",
    startTime: "09:00",
    endDate: "2026-08-09",
    endTime: "18:00",
    packingItems: [{ id: "packing-1", itemId: "item-1", name: "护照", category: "证件", sourceBagId: "bag-1" }],
  })
  transaction.objectStore("checkSessions").put({
    id: "session-legacy",
    planId: "trip-legacy",
    kind: "return",
    status: "in_progress",
    results: { "packing-1": { checked: false, checkedAt: "2026-08-09T17:00:00.000Z" } },
    startedAt: "2026-08-09T17:00:00.000Z",
    updatedAt: "2026-08-09T17:00:00.000Z",
  })
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  legacy.close()

  const databaseModule = await import("../src/services/db.js")
  const activityService = await import("../src/services/activityService.js")
  const sessionService = await import("../src/services/checkSessionService.js")
  const backupService = await import("../src/services/backupService.js")
  const database = await databaseModule.getDb()

  assert.equal(database.version, 7)
  assert.ok(database.transaction("activities").objectStore("activities").indexNames.contains("departureAt"))
  assert.ok(database.transaction("checkSessions").objectStore("checkSessions").indexNames.contains("kind"))

  const migrated = await activityService.get("trip-legacy")
  assert.equal(migrated.modelVersion, 2)
  assert.equal(migrated.departureAt, "2026-08-08T09:00")
  assert.equal(migrated.returnAt, "2026-08-09T18:00")
  assert.equal(migrated.packingItems[0].itemId, "item-1")
  assert.equal(migrated.packingItems[0].containerId, "bag-1")

  const oldSession = (await sessionService.getByPlan("trip-legacy"))[0]
  assert.equal(oldSession.modelVersion, 2)
  assert.equal(oldSession.kind, "end")
  assert.equal(oldSession.results["packing-1"].state, "missing")

  const created = await activityService.create({
    title: "周末露营",
    type: "travel",
    tripMode: "round_trip",
    departureAt: "2026-08-15T08:00",
    returnAt: "2026-08-16T20:00",
    origin: "家",
    destination: "营地",
    packingItems: [{ itemId: "item-1", containerId: "bag-1", starred: true }],
  })
  assert.equal(created.modelVersion, 2)
  assert.equal(created.packingItems[0].nameSnapshot, "护照")
  assert.equal(created.containerRefs[0].nameSnapshot, "通勤背包")

  const session = await sessionService.create(created.id, "departure", created.packingItems)
  const missing = await sessionService.record(session.id, created.packingItems[0].id, "missing")
  assert.equal(missing.results[created.packingItems[0].id].state, "missing")
  const completed = await sessionService.complete(session.id)
  assert.equal(completed.status, "completed")

  localStorage.setItem(
    "asset-tracker-trip-preferences",
    JSON.stringify({ departureReminder: "previous_evening", endReminder: "off", reminderTime: "20:30" }),
  )
  const backup = await backupService.createBackup()
  assert.equal(backup.database.version, 7)
  assert.ok("asset-tracker-trip-preferences" in backup.data.localStorage)

  await databaseModule.closeDb()
})
