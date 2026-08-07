import { applyTripPatch, normalizeTrip } from "../domain/tripModel.js"
import { generateId } from "../utils/id.js"
import * as db from "./db.js"

const STORE = "activities"
const LEGACY_ITEMS_STORE = "activityItems"

async function enrichTripData(data) {
  if (!Array.isArray(data.packingItems)) return data
  const [items, nodes] = await Promise.all([db.getAll("items"), db.getAll("spaceNodes")])
  const itemById = new Map(items.map((item) => [item.id, item]))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const itemsByName = new Map()
  for (const item of items) {
    const key = item.name?.trim()
    if (!key) continue
    if (!itemsByName.has(key)) itemsByName.set(key, [])
    itemsByName.get(key).push(item)
  }

  const packingItems = data.packingItems.map((entry) => {
    const name = entry.nameSnapshot || entry.name || ""
    const matchingItems = itemsByName.get(name.trim()) || []
    const item = itemById.get(entry.itemId) || (matchingItems.length === 1 ? matchingItems[0] : null)
    const requestedContainerId = entry.containerId || entry.sourceBagId || item?.locationNodeId || ""
    const requestedContainer = nodeById.get(requestedContainerId)
    const containerId =
      requestedContainer?.kind === "container" && requestedContainer?.mobility === "mobile" ? requestedContainerId : ""
    return {
      ...entry,
      id: entry.id || generateId(),
      itemId: entry.itemId || item?.id || "",
      containerId,
      nameSnapshot: entry.nameSnapshot || item?.name || entry.name || "",
      categorySnapshot: entry.categorySnapshot || item?.category || entry.category || "",
      imageSnapshot: entry.imageSnapshot || item?.photo || "",
      migrationPending: Boolean(entry.migrationPending || !item || !containerId),
    }
  })

  const requestedReferences = Array.isArray(data.containerRefs) ? data.containerRefs : []
  const referenceMap = new Map()
  for (const reference of requestedReferences) {
    const containerId = reference.containerId || reference.id || ""
    if (!containerId) continue
    const node = nodeById.get(containerId)
    referenceMap.set(containerId, {
      ...reference,
      containerId,
      nameSnapshot: reference.nameSnapshot || node?.name || reference.name || "",
      iconSnapshot: reference.iconSnapshot || node?.icon || reference.icon || "🎒",
    })
  }
  for (const entry of packingItems) {
    if (!entry.containerId || referenceMap.has(entry.containerId)) continue
    const node = nodeById.get(entry.containerId)
    referenceMap.set(entry.containerId, {
      containerId: entry.containerId,
      nameSnapshot: node?.name || "未命名容器",
      iconSnapshot: node?.icon || "🎒",
      sortOrder: referenceMap.size,
    })
  }
  return { ...data, packingItems, containerRefs: [...referenceMap.values()] }
}

export async function getAll() {
  await db.ensureTripData()
  return db.getAll(STORE)
}

export async function get(id) {
  await db.ensureTripData()
  return db.get(STORE, id)
}

export async function getByDateRange(lower, upper) {
  await db.ensureTripData()
  return db.getAllByIndexRange(STORE, "startsAt", lower, `${upper}\uffff`)
}

export function getByMonth(year, month) {
  const monthText = String(month).padStart(2, "0")
  return getByDateRange(`${year}-${monthText}-01`, `${year}-${monthText}-31`)
}

export async function create(data) {
  const now = new Date().toISOString()
  const id = generateId()
  const enriched = await enrichTripData(data)
  const trip = normalizeTrip(enriched, { id, now, createId: () => generateId() })
  await db.add(STORE, trip)
  return trip
}

export async function update(id, data) {
  const existing = await get(id)
  if (!existing) throw new Error("行程不存在")
  const enriched = await enrichTripData(data)
  const updated = applyTripPatch(existing, enriched, new Date().toISOString(), () => generateId())
  await db.put(STORE, updated)
  return updated
}

export const del = (id) =>
  db.runTransaction([STORE, LEGACY_ITEMS_STORE, "checkSessions"], "readwrite", async (transaction) => {
    const childStore = transaction.objectStore(LEGACY_ITEMS_STORE)
    const childIds = await childStore.index("activityId").getAllKeys(id)
    childIds.forEach((childId) => childStore.delete(childId))
    const sessionStore = transaction.objectStore("checkSessions")
    const sessionIds = await sessionStore.index("planId").getAllKeys(id)
    sessionIds.forEach((sessionId) => sessionStore.delete(sessionId))
    transaction.objectStore(STORE).delete(id)
  })

export async function addPackingItem(activityId, item) {
  const activity = await get(activityId)
  if (!activity) throw new Error("行程不存在")
  const updated = await update(activityId, {
    packingItems: [...activity.packingItems, { ...item, id: item.id || generateId() }],
  })
  return updated.packingItems.at(-1)
}

export async function getPackingItems(activityId) {
  const activity = await get(activityId)
  if (activity?.packingItems?.length) return activity.packingItems
  return db.getAllByIndex(LEGACY_ITEMS_STORE, "activityId", activityId)
}
