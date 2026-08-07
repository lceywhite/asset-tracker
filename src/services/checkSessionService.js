import { CHECK_STATES, getCheckSummary, normalizeCheckSession } from "../domain/tripModel.js"
import { generateId } from "../utils/id.js"
import * as db from "./db.js"

const STORE = "checkSessions"

export async function getByPlan(planId) {
  await db.ensureTripData()
  return db.getAllByIndex(STORE, "planId", planId)
}

export async function getLatest(planId, kind) {
  const sessions = await getByPlan(planId)
  return (
    sessions
      .filter((session) => !kind || session.kind === kind)
      .sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""))[0] || null
  )
}

export async function create(planId, kind, entries) {
  const now = new Date().toISOString()
  const session = normalizeCheckSession(
    {
      id: generateId(),
      planId,
      kind,
      status: "in_progress",
      results: {},
      startedAt: now,
      completedAt: "",
      updatedAt: now,
    },
    { entries, now },
  )
  await db.add(STORE, session)
  return session
}

export async function record(sessionId, entryId, nextState) {
  const session = await db.get(STORE, sessionId)
  if (!session) throw new Error("核对记录不存在")
  const state = typeof nextState === "boolean" ? (nextState ? CHECK_STATES.CONFIRMED : CHECK_STATES.MISSING) : nextState
  if (!Object.values(CHECK_STATES).includes(state)) throw new Error("无法识别的核对结果")
  const now = new Date().toISOString()
  const updated = normalizeCheckSession(
    {
      ...session,
      results: {
        ...session.results,
        [entryId]: {
          state,
          checked: state === CHECK_STATES.CONFIRMED,
          checkedAt: state === CHECK_STATES.PENDING ? "" : now,
        },
      },
      updatedAt: now,
    },
    { now },
  )
  await db.put(STORE, updated)
  return updated
}

export async function complete(sessionId) {
  const session = await db.get(STORE, sessionId)
  if (!session) throw new Error("核对记录不存在")
  const now = new Date().toISOString()
  const updated = normalizeCheckSession({ ...session, status: "completed", completedAt: now, updatedAt: now }, { now })
  await db.put(STORE, updated)
  return updated
}

export async function reopenUnresolved(sessionId) {
  const session = await db.get(STORE, sessionId)
  if (!session) throw new Error("核对记录不存在")
  const now = new Date().toISOString()
  const results = Object.fromEntries(
    Object.entries(session.results || {}).map(([entryId, result]) => [
      entryId,
      result.state === CHECK_STATES.CONFIRMED ? result : { state: CHECK_STATES.PENDING, checked: false, checkedAt: "" },
    ]),
  )
  const updated = normalizeCheckSession(
    { ...session, results, status: "in_progress", completedAt: "", updatedAt: now },
    { now },
  )
  await db.put(STORE, updated)
  return updated
}

export { getCheckSummary }
