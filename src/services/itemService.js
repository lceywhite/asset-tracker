import * as db from "./db"
import { generateId } from "@/utils/id"
const S = "items"
export const getAllItems = () => db.getAll(S)
export const getItem = (id) => db.get(S, id)
export async function createItem(data) {
  const now = new Date().toISOString()
  const item = {
    id: generateId(),
    name: data.name,
    category: data.category || "",
    subCategory: data.subCategory || "",
    location: data.location || "",
    photo: data.photo || "",
    value: data.value || 0,
    purchaseDate: data.purchaseDate || "",
    expiryDate: data.expiryDate || "",
    tags: data.tags || [],
    status: data.status || "in_stock",
    notes: data.notes || "",
    roomId: data.roomId || "",
    bagId: data.bagId || "",
    spaceId: data.spaceId || "private",
    createdBy: "me",
    createdAt: now,
    updatedAt: now,
  }
  await db.add(S, item)
  return item
}
export async function updateItem(id, data) {
  const existing = await db.get(S, id)
  const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() }
  await db.put(S, updated)
  return updated
}
export const deleteItem = (id) => db.del(S, id)
export const getItemsByRoom = (roomId) => db.getAllByIndex(S, "roomId", roomId)
export const getItemsByBag = (bagId) => db.getAllByIndex(S, "bagId", bagId)
