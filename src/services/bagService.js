import * as db from "./db"
import { generateId } from "@/utils/id"
const S = "bags"
export const getAll = () => db.getAll(S)
export const get = (id) => db.get(S, id)
export async function create(data) {
  const now = new Date().toISOString()
  const item = {
    id: generateId(),
    name: data.name,
    icon: data.icon || "🎒",
    spaceId: data.spaceId || "private",
    sortOrder: data.sortOrder || 0,
    createdAt: now,
    updatedAt: now,
  }
  await db.add(S, item)
  return item
}
export async function update(id, data) {
  const e = await db.get(S, id)
  const u = { ...e, ...data, id, updatedAt: new Date().toISOString() }
  await db.put(S, u)
  return u
}
export const del = (id) =>
  db.runTransaction([S, "items"], "readwrite", async (transaction) => {
    const itemStore = transaction.objectStore("items")
    const linkedItems = await itemStore.index("bagId").getAll(id)
    linkedItems.forEach((item) => itemStore.put({ ...item, bagId: "", updatedAt: new Date().toISOString() }))
    transaction.objectStore(S).delete(id)
  })
