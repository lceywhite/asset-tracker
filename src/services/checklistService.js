import * as db from "./db"
import { generateId } from "@/utils/id"
const S = "checklists"
export const getAll = () => db.getAll(S)
export const get = (id) => db.get(S, id)
export async function create(data) {
  const now = new Date().toISOString()
  const cl = {
    id: generateId(),
    name: data.name,
    type: data.type || "custom",
    spaceId: "default",
    items: data.items || [],
    status: "draft",
    templateId: data.templateId || "",
    departureTime: "",
    returnTime: "",
    createdAt: now,
    updatedAt: now,
  }
  await db.add(S, cl)
  return cl
}
export async function update(id, data) {
  const e = await db.get(S, id)
  const u = { ...e, ...data, id, updatedAt: new Date().toISOString() }
  await db.put(S, u)
  return u
}
export async function updateItem(id, itemId, data) {
  const cl = await db.get(S, id)
  const idx = cl.items.findIndex((i) => i.itemId === itemId)
  cl.items[idx] = { ...cl.items[idx], ...data }
  cl.updatedAt = new Date().toISOString()
  await db.put(S, cl)
  return cl
}
export const del = (id) => db.del(S, id)
