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

test("upgrades v4 plans, separates check sessions and completes a backup round-trip", async () => {
  const legacy = await rawOpen("asset-tracker-db", 4, (database) => {
    for (const name of [
      "items",
      "checklists",
      "templates",
      "rooms",
      "bags",
      "locationRecords",
      "activities",
      "activityItems",
    ]) {
      database.createObjectStore(name, { keyPath: "id" })
    }
  })
  const legacyTransaction = legacy.transaction(["items", "rooms", "bags", "activities"], "readwrite")
  legacyTransaction.objectStore("rooms").put({ id: "room-1", name: "书房" })
  legacyTransaction.objectStore("bags").put({ id: "bag-1", name: "通勤包" })
  legacyTransaction.objectStore("items").put({ id: "item-1", name: "护照", roomId: "room-1", bagId: "bag-1", tags: [] })
  legacyTransaction.objectStore("activities").put({
    id: "trip-1",
    title: "出差",
    startDate: "2026-07-14",
    packingItems: [{ name: "护照", checked: true }],
  })
  await new Promise((resolve, reject) => {
    legacyTransaction.oncomplete = resolve
    legacyTransaction.onerror = () => reject(legacyTransaction.error)
  })
  legacy.close()

  const databaseModule = await import("../src/services/db.js")
  const backupModule = await import("../src/services/backupService.js")
  const database = await databaseModule.getDb()
  assert.equal(database.version, 6)
  assert.ok(database.transaction("activities").objectStore("activities").indexNames.contains("startDate"))
  assert.ok(database.transaction("activityItems").objectStore("activityItems").indexNames.contains("activityId"))
  assert.ok(database.transaction("checkSessions").objectStore("checkSessions").indexNames.contains("planId"))
  assert.ok(database.transaction("spaceNodes").objectStore("spaceNodes").indexNames.contains("parentId"))
  assert.ok(database.transaction("homeSections").objectStore("homeSections").indexNames.contains("sortOrder"))
  assert.equal((await databaseModule.getAll("items")).length, 1)
  const migratedItem = (await databaseModule.getAll("items"))[0]
  assert.equal(migratedItem.modelVersion, 3)
  assert.equal(migratedItem.locationNodeId, "bag-1")
  assert.equal(migratedItem.homeLocationNodeId, "room-1")
  assert.match(migratedItem.itemCode, /^AT-/)
  assert.equal((await databaseModule.getAll("homeSections")).length, 3)
  assert.ok((await databaseModule.getAll("spaceNodes")).some((node) => node.id === "room-1" && node.kind === "area"))
  assert.ok(
    (await databaseModule.getAll("spaceNodes")).some(
      (node) => node.id === "bag-1" && node.kind === "container" && node.mobility === "mobile",
    ),
  )
  const migratedPlan = (await databaseModule.getAll("activities"))[0]
  assert.equal(migratedPlan.kind, "plan")
  assert.ok(migratedPlan.packingItems[0].id)
  assert.equal("checked" in migratedPlan.packingItems[0], false)

  await databaseModule.put("checkSessions", {
    id: "session-1",
    planId: "trip-1",
    kind: "departure",
    status: "completed",
    results: {},
    startedAt: "2026-07-14T08:00:00.000Z",
  })

  localStorage.setItem("asset-guard-custom-types", JSON.stringify([{ key: "conference", name: "会议" }]))
  const backup = await backupModule.createBackup()
  assert.equal(backup.manifest.counts.items, 1)
  assert.equal(backup.manifest.counts.activities, 1)
  assert.equal(backup.manifest.counts.checkSessions, 1)
  assert.equal(backup.manifest.counts.homeSections, 3)
  assert.ok("asset-guard-custom-types" in backup.data.localStorage)

  await backupModule.clearBusinessData()
  assert.equal((await databaseModule.getAll("items")).length, 0)
  await backupModule.restoreBackup(backup, { mode: "replace" })
  assert.equal((await databaseModule.getAll("items"))[0].name, "护照")
  assert.equal((await databaseModule.getAll("items"))[0].modelVersion, 3)
  assert.equal((await databaseModule.getAll("checkSessions"))[0].planId, "trip-1")
  assert.equal(JSON.parse(localStorage.getItem("asset-guard-custom-types"))[0].name, "会议")
  await databaseModule.closeDb()
})
