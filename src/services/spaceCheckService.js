import * as db from "./db.js"
import { generateId } from "../utils/id.js"

const S = "checkSessions"

export async function startOrResumeSpaceCheck(spaceNodeId, items) {
  const sessions = (await db.getAll(S))
    .filter(
      (session) => session.scopeType === "space" && session.scopeId === spaceNodeId && session.status === "active",
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  if (sessions[0]) return sessions[0]
  const now = new Date().toISOString()
  const session = {
    id: generateId(),
    planId: "",
    kind: "inventory",
    scopeType: "space",
    scopeId: spaceNodeId,
    status: "active",
    entries: items.map((item) => ({ itemId: item.id, name: item.name, checked: false })),
    startedAt: now,
    updatedAt: now,
  }
  await db.add(S, session)
  return session
}

export async function toggleSpaceCheck(sessionId, itemId) {
  const session = await db.get(S, sessionId)
  if (!session) throw new Error("核对记录不存在")
  const updated = {
    ...session,
    entries: session.entries.map((entry) =>
      entry.itemId === itemId ? { ...entry, checked: !entry.checked, checkedAt: new Date().toISOString() } : entry,
    ),
    updatedAt: new Date().toISOString(),
  }
  await db.put(S, updated)
  return updated
}

export async function completeSpaceCheck(sessionId) {
  const session = await db.get(S, sessionId)
  if (!session) throw new Error("核对记录不存在")
  const now = new Date().toISOString()
  const updated = { ...session, status: "completed", completedAt: now, updatedAt: now }
  await db.put(S, updated)
  return updated
}
