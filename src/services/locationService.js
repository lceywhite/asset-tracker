import * as db from "./db.js"
import { generateId } from "../utils/id.js"
const S = "locationRecords"
export const getByItem = (itemId) => db.getAllByIndex(S, "itemId", itemId)
export async function record(itemId, fromType, fromId, toType, toId, metadata = {}) {
  const rec = {
    id: generateId(),
    itemId,
    fromType,
    fromId: fromId || "",
    toType,
    toId: toId || "",
    fromNodeId: metadata.fromNodeId || fromId || "",
    toNodeId: metadata.toNodeId || toId || "",
    reason: typeof metadata.reason === "string" ? metadata.reason.trim() : "",
    notes: typeof metadata.notes === "string" ? metadata.notes.trim() : "",
    timestamp: new Date().toISOString(),
  }
  await db.add(S, rec)
  return rec
}
