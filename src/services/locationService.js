import * as db from "./db"
import { generateId } from "@/utils/id"
const S = "locationRecords"
export const getByItem = (itemId) => db.getAllByIndex(S, "itemId", itemId)
export async function record(itemId, fromType, fromId, toType, toId) {
  const rec = { id: generateId(), itemId, fromType, fromId, toType, toId, timestamp: new Date().toISOString() }
  await db.add(S, rec)
  return rec
}
