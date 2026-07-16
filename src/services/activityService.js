import * as db from "./db"
import { generateId } from "@/utils/id"
const S = "activities"
const SI = "activityItems"
export const getAll = () => db.getAll(S)
export const get = (id) => db.get(S, id)
export const getByMonth = (year, month) => {
  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const end = `${year}-${String(month).padStart(2, "0")}-31`
  return db.getAllByIndexRange(S, "startDate", start, end)
}
export async function create(data) {
  const now = new Date().toISOString()
  const act = {
    id: generateId(),
    title: data.title,
    type: data.type || "custom",
    startDate: data.startDate,
    endDate: data.endDate || data.startDate,
    startTime: data.startTime || "",
    endTime: data.endTime || "",
    destination: data.destination || "",
    description: data.description || "",
    isRecurring: data.isRecurring || false,
    recurringType: data.recurringType || "",
    status: data.status || "active",
    kind: "plan",
    modelVersion: 1,
    bagIds: data.bagIds || [],
    packingItems: data.packingItems || [],
    createdAt: now,
    updatedAt: now,
  }
  // Release 0 freezes the embedded array as the single source of truth.
  // activityItems remains readable only as a migration source for older data.
  act.packingItems = (data.packingItems || []).map((pi) => {
    const { checked: _legacyChecked, ...entry } = pi
    return { ...entry, id: pi.id || generateId() }
  })
  await db.add(S, act)
  return act
}
export async function update(id, data) {
  const e = await db.get(S, id)
  const normalized = data.packingItems
    ? data.packingItems.map((pi) => {
        const { checked: _legacyChecked, ...entry } = pi
        return { ...entry, id: pi.id || generateId() }
      })
    : e.packingItems
  const u = {
    ...e,
    ...data,
    packingItems: normalized,
    kind: "plan",
    modelVersion: 1,
    id,
    updatedAt: new Date().toISOString(),
  }
  await db.put(S, u)
  return u
}
export const del = (id) =>
  db.runTransaction([S, SI, "checkSessions"], "readwrite", async (transaction) => {
    const childStore = transaction.objectStore(SI)
    const childIds = await childStore.index("activityId").getAllKeys(id)
    childIds.forEach((childId) => childStore.delete(childId))
    const sessionStore = transaction.objectStore("checkSessions")
    const sessionIds = await sessionStore.index("planId").getAllKeys(id)
    sessionIds.forEach((sessionId) => sessionStore.delete(sessionId))
    transaction.objectStore(S).delete(id)
  })
export async function addPackingItem(activityId, item) {
  const pi = {
    id: generateId(),
    activityId,
    name: item.name,
    category: item.category || "",
    quantity: item.quantity || 1,
    checked: false,
    reminderType: item.reminderType || "none",
  }
  await db.add(SI, pi)
  return pi
}
export async function togglePackingItem(id) {
  const pi = await db.get(SI, id)
  pi.checked = !pi.checked
  await db.put(SI, pi)
  return pi
}
export async function getPackingItems(activityId) {
  const activity = await db.get(S, activityId)
  if (activity?.packingItems?.length) return activity.packingItems
  return db.getAllByIndex(SI, "activityId", activityId)
}
