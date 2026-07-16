import * as db from "./db"
import { generateId } from "@/utils/id"

const STORE = "checkSessions"

export const getByPlan = (planId) => db.getAllByIndex(STORE, "planId", planId)

export async function getLatest(planId, kind) {
  const sessions = await getByPlan(planId)
  return (
    sessions
      .filter((session) => !kind || session.kind === kind)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null
  )
}

export async function create(planId, kind, entries) {
  const now = new Date().toISOString()
  const session = {
    id: generateId(),
    planId,
    kind,
    status: "in_progress",
    results: Object.fromEntries(entries.map((entry) => [entry.id, { checked: false, checkedAt: "" }])),
    startedAt: now,
    completedAt: "",
    updatedAt: now,
    modelVersion: 1,
  }
  await db.add(STORE, session)
  return session
}

export async function record(sessionId, entryId, checked) {
  const session = await db.get(STORE, sessionId)
  if (!session) throw new Error("核对记录不存在")
  const now = new Date().toISOString()
  const updated = {
    ...session,
    results: { ...session.results, [entryId]: { checked, checkedAt: now } },
    updatedAt: now,
  }
  await db.put(STORE, updated)
  return updated
}

export async function complete(sessionId) {
  const session = await db.get(STORE, sessionId)
  if (!session) throw new Error("核对记录不存在")
  const now = new Date().toISOString()
  const updated = { ...session, status: "completed", completedAt: now, updatedAt: now }
  await db.put(STORE, updated)
  return updated
}
