import * as db from "./db.js"
import { applyItemPatch, getEffectiveValuation, normalizeItem } from "../domain/itemModel.js"
import { generateId } from "../utils/id.js"

const S = "items"

function compatibilityPatch(existing, data) {
  const patch = { ...data }
  if (Object.hasOwn(data, "value") && !Object.hasOwn(data, "purchasePrice")) patch.purchasePrice = data.value
  if (Object.hasOwn(data, "photo") && !Object.hasOwn(data, "images")) {
    patch.images = data.photo ? [{ url: data.photo, isCover: true }] : []
  }
  if (Object.hasOwn(data, "roomId") && !Object.hasOwn(data, "homeLocationNodeId")) {
    patch.homeLocationNodeId = data.roomId || ""
    const effectiveBagId = Object.hasOwn(data, "bagId") ? data.bagId : existing.bagId
    if (!effectiveBagId && !Object.hasOwn(data, "locationNodeId")) patch.locationNodeId = data.roomId || ""
  }
  if (Object.hasOwn(data, "bagId") && !Object.hasOwn(data, "locationNodeId")) {
    patch.locationNodeId = data.bagId || data.roomId || existing.roomId || ""
  }
  return patch
}

export const getAllItems = () => db.getAll(S)
export const getItem = (id) => db.get(S, id)
export const getItemsByRoom = (roomId) => db.getAllByIndex(S, "roomId", roomId)
export const getItemsByBag = (bagId) => db.getAllByIndex(S, "bagId", bagId)
export const getItemsByLocation = (nodeId) => db.getAllByIndex(S, "locationNodeId", nodeId)
export const getItemsByHomeLocation = (nodeId) => db.getAllByIndex(S, "homeLocationNodeId", nodeId)

export async function createItem(data) {
  const now = new Date().toISOString()
  const id = generateId()
  const item = normalizeItem(data, { id, now })
  await db.add(S, item)
  return item
}

export async function updateItem(id, data) {
  const existing = await db.get(S, id)
  if (!existing) throw new Error("物品不存在")
  const updated = applyItemPatch(existing, compatibilityPatch(existing, data))
  await db.put(S, updated)
  return updated
}

export async function moveItem(id, toNodeId, { reason = "", notes = "", homeLocationNodeId } = {}) {
  const now = new Date().toISOString()
  return db.runTransaction([S, "locationRecords"], "readwrite", async (transaction) => {
    const itemStore = transaction.objectStore(S)
    const existing = await itemStore.get(id)
    if (!existing) throw new Error("物品不存在")
    const fromNodeId = existing.locationNodeId || existing.bagId || existing.roomId || ""
    const patch = { locationNodeId: toNodeId || "" }
    if (homeLocationNodeId !== undefined) patch.homeLocationNodeId = homeLocationNodeId || ""
    const updated = applyItemPatch(existing, patch, now)
    await itemStore.put(updated)
    await transaction.objectStore("locationRecords").add({
      id: generateId(),
      itemId: id,
      fromNodeId,
      toNodeId: toNodeId || "",
      fromType: "spaceNode",
      fromId: fromNodeId,
      toType: "spaceNode",
      toId: toNodeId || "",
      reason: typeof reason === "string" ? reason.trim() : "",
      notes: typeof notes === "string" ? notes.trim() : "",
      timestamp: now,
    })
    return updated
  })
}

export async function deleteItem(id) {
  return db.runTransaction([S, "locationRecords"], "readwrite", async (transaction) => {
    const records = await transaction.objectStore("locationRecords").index("itemId").getAll(id)
    const recordStore = transaction.objectStore("locationRecords")
    records.forEach((record) => recordStore.delete(record.id))
    await transaction.objectStore(S).delete(id)
  })
}

export function summarizeItemValue(item) {
  return {
    effectiveValuation: getEffectiveValuation(item),
    purchasePrice: Number.isFinite(Number(item?.purchasePrice)) ? Number(item.purchasePrice) : null,
    currency: item?.currency || "CNY",
  }
}
