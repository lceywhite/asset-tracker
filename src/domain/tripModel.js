export const TRIP_MODEL_VERSION = 2
export const CHECK_SESSION_MODEL_VERSION = 2

export const TRIP_STATUSES = Object.freeze({
  DRAFT: "draft",
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
})

export const CHECK_KINDS = Object.freeze({
  DEPARTURE: "departure",
  ANYTIME: "anytime",
  END: "end",
})

export const CHECK_STATES = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  MISSING: "missing",
  SKIPPED: "skipped",
})

const CHECK_STATE_VALUES = new Set(Object.values(CHECK_STATES))
const CHECK_KIND_VALUES = new Set(Object.values(CHECK_KINDS))
const TRIP_STATUS_VALUES = new Set(Object.values(TRIP_STATUSES))

const cleanText = (value) => (typeof value === "string" ? value.trim() : "")

function normalizeDateTime(value) {
  const normalized = cleanText(value)
  if (!normalized) return ""
  return normalized
}

function legacyDateTime(date, time) {
  const normalizedDate = cleanText(date)
  const normalizedTime = cleanText(time)
  if (!normalizedDate) return ""
  return normalizedTime ? `${normalizedDate}T${normalizedTime}` : normalizedDate
}

function datePart(value) {
  return cleanText(value).slice(0, 10)
}

function timePart(value) {
  const normalized = cleanText(value)
  return normalized.includes("T") ? normalized.slice(11, 16) : ""
}

function normalizeTripStatus(status) {
  const normalized = cleanText(status)
  if (TRIP_STATUS_VALUES.has(normalized)) return normalized
  if (["active", "upcoming"].includes(normalized)) return TRIP_STATUSES.PLANNED
  return TRIP_STATUSES.PLANNED
}

function normalizeTripMode(mode, data, departureAt, returnAt) {
  if (["one_way", "round_trip"].includes(mode)) return mode
  const hasDistinctReturnDate = datePart(returnAt) && datePart(returnAt) !== datePart(departureAt)
  const hasReturnTime = Boolean(cleanText(data.returnAt) || cleanText(data.endTime))
  return hasDistinctReturnDate || hasReturnTime ? "round_trip" : "one_way"
}

function legacyContainerId(planId) {
  return `legacy-unassigned-${planId}`
}

function normalizeContainerRef(reference, index) {
  if (!reference || typeof reference !== "object") return null
  const containerId = cleanText(reference.containerId || reference.id)
  if (!containerId) return null
  return {
    containerId,
    nameSnapshot: cleanText(reference.nameSnapshot || reference.name) || "未命名容器",
    iconSnapshot: cleanText(reference.iconSnapshot || reference.icon) || "🎒",
    sortOrder: Number.isFinite(Number(reference.sortOrder)) ? Number(reference.sortOrder) : index,
    migrationPending: Boolean(reference.migrationPending || containerId.startsWith("legacy-unassigned-")),
  }
}

function normalizePackingEntry(entry, planId, index, createdAt, createId) {
  if (!entry || typeof entry !== "object") return null
  const id = cleanText(entry.id) || createId(`packing-${index + 1}`)
  const itemId = cleanText(entry.itemId)
  const containerId = cleanText(entry.containerId || entry.sourceBagId) || legacyContainerId(planId)
  const nameSnapshot = cleanText(entry.nameSnapshot || entry.name) || "未命名物品"
  const categorySnapshot = cleanText(entry.categorySnapshot || entry.category)
  const starred =
    entry.starred === undefined ? ["return", "daily"].includes(cleanText(entry.reminderType)) : Boolean(entry.starred)
  const migrationPending = Boolean(entry.migrationPending || !itemId || containerId.startsWith("legacy-unassigned-"))
  return {
    id,
    itemId,
    containerId,
    nameSnapshot,
    categorySnapshot,
    imageSnapshot: cleanText(entry.imageSnapshot || entry.photo),
    starred,
    quantity: Math.max(1, Number(entry.quantity) || 1),
    addedAt: entry.addedAt || createdAt,
    migrationPending,
    // Compatibility fields remain readable until every old Trip view is removed.
    name: nameSnapshot,
    category: categorySnapshot,
    sourceBagId: containerId.startsWith("legacy-unassigned-") ? "" : containerId,
    reminderType: starred ? "return" : "selfcheck",
  }
}

function normalizeInfoCard(card, index, createId) {
  if (!card || typeof card !== "object") return null
  const title = cleanText(card.title)
  if (!title) return null
  return {
    id: cleanText(card.id) || createId(`info-${index + 1}`),
    type: cleanText(card.type) || "key_value",
    title,
    data: card.data && typeof card.data === "object" ? card.data : {},
    sortOrder: Number.isFinite(Number(card.sortOrder)) ? Number(card.sortOrder) : index,
  }
}

export function normalizeTrip(
  data,
  { id = data?.id, now = new Date().toISOString(), createId = (suffix) => `${id}-${suffix}` } = {},
) {
  if (!data || typeof data !== "object") throw new TypeError("行程数据格式错误")
  if (!id) throw new Error("行程 ID 不能为空")
  const title = cleanText(data.title)
  if (!title) throw new Error("行程名称不能为空")

  const createdAt = data.createdAt || now
  const departureAt = normalizeDateTime(data.departureAt) || legacyDateTime(data.startDate, data.startTime)
  const returnAt = normalizeDateTime(data.returnAt) || legacyDateTime(data.endDate, data.endTime)
  const tripMode = normalizeTripMode(data.tripMode, data, departureAt, returnAt)
  const packingItems = (Array.isArray(data.packingItems) ? data.packingItems : [])
    .map((entry, index) => normalizePackingEntry(entry, id, index, createdAt, createId))
    .filter(Boolean)

  const references = (Array.isArray(data.containerRefs) ? data.containerRefs : [])
    .map(normalizeContainerRef)
    .filter(Boolean)
  for (const [index, entry] of packingItems.entries()) {
    if (references.some((reference) => reference.containerId === entry.containerId)) continue
    references.push({
      containerId: entry.containerId,
      nameSnapshot: entry.containerId.startsWith("legacy-unassigned-") ? "待整理物品" : "未命名容器",
      iconSnapshot: "🎒",
      sortOrder: references.length + index,
      migrationPending: entry.migrationPending,
    })
  }

  const notes = typeof data.notes === "string" ? data.notes.trim() : cleanText(data.description)
  const infoCards = (Array.isArray(data.infoCards) ? data.infoCards : [])
    .map((card, index) => normalizeInfoCard(card, index, createId))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return {
    ...data,
    id,
    kind: "plan",
    modelVersion: TRIP_MODEL_VERSION,
    title,
    type: cleanText(data.type) || "custom",
    status: normalizeTripStatus(data.status),
    tripMode,
    departureAt,
    returnAt: tripMode === "round_trip" ? returnAt : "",
    origin: cleanText(data.origin),
    destination: cleanText(data.destination),
    transportMode: cleanText(data.transportMode),
    containerRefs: references.map((reference, index) => ({ ...reference, sortOrder: index })),
    packingItems,
    notes,
    infoCards,
    // Compatibility fields remain until old UI removal is complete.
    startDate: datePart(departureAt) || cleanText(data.startDate),
    endDate: tripMode === "round_trip" ? datePart(returnAt) || cleanText(data.endDate) : datePart(departureAt) || "",
    startTime: timePart(departureAt) || cleanText(data.startTime),
    endTime: tripMode === "round_trip" ? timePart(returnAt) || cleanText(data.endTime) : "",
    description: notes,
    bagIds: references
      .filter((reference) => !reference.containerId.startsWith("legacy-unassigned-"))
      .map((reference) => reference.containerId),
    createdAt,
    updatedAt: data.updatedAt || now,
  }
}

export function applyTripPatch(existing, patch, now = new Date().toISOString(), createId) {
  if (!existing) throw new Error("行程不存在")
  return normalizeTrip(
    {
      ...existing,
      ...patch,
      id: existing.id,
      packingItems: patch.packingItems === undefined ? existing.packingItems : patch.packingItems,
      containerRefs: patch.containerRefs === undefined ? existing.containerRefs : patch.containerRefs,
      infoCards: patch.infoCards === undefined ? existing.infoCards : patch.infoCards,
      createdAt: existing.createdAt,
      updatedAt: now,
    },
    { id: existing.id, now, createId },
  )
}

function comparableDate(value, endOfDay = false) {
  const normalized = normalizeDateTime(value)
  if (!normalized) return null
  const candidate = normalized.length === 10 ? `${normalized}T${endOfDay ? "23:59:59" : "00:00:00"}` : normalized
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getTripPhase(trip, at = new Date()) {
  if (!trip) return "before"
  if ([TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED].includes(trip.status)) return "after"
  const now = at instanceof Date ? at : new Date(at)
  const departure = comparableDate(trip.departureAt || trip.startDate)
  const end = comparableDate(trip.returnAt || trip.endDate, true)
  if (departure && now < departure) return "before"
  if (trip.tripMode === "round_trip" && end && now > end) return "after"
  return departure ? "during" : "before"
}

export function getCheckKindForTrip(trip, at = new Date()) {
  const phase = getTripPhase(trip, at)
  if (phase === "after") return CHECK_KINDS.END
  if (phase === "during") return CHECK_KINDS.ANYTIME
  return CHECK_KINDS.DEPARTURE
}

export function tripOccursOnDate(trip, date) {
  const target = datePart(date)
  if (!target) return false
  const start = datePart(trip?.departureAt || trip?.startDate)
  const end = datePart(trip?.returnAt || trip?.endDate) || start
  return Boolean(start && target >= start && target <= end)
}

export function normalizeCheckState(result) {
  if (typeof result === "string" && CHECK_STATE_VALUES.has(result)) return result
  if (result && CHECK_STATE_VALUES.has(result.state)) return result.state
  if (result?.checked === true) return CHECK_STATES.CONFIRMED
  if (result?.checkedAt) return CHECK_STATES.MISSING
  return CHECK_STATES.PENDING
}

export function normalizeCheckSession(
  data,
  { id = data?.id, planId = data?.planId, entries = [], now = new Date().toISOString() } = {},
) {
  if (!data || typeof data !== "object") throw new TypeError("核对记录格式错误")
  if (!id || !planId) throw new Error("核对记录缺少 ID 或行程 ID")
  const rawKind = cleanText(data.kind)
  const kind = rawKind === "return" ? CHECK_KINDS.END : CHECK_KIND_VALUES.has(rawKind) ? rawKind : CHECK_KINDS.DEPARTURE
  const results = {}
  for (const [entryId, result] of Object.entries(data.results || {})) {
    const state = normalizeCheckState(result)
    results[entryId] = {
      state,
      checked: state === CHECK_STATES.CONFIRMED,
      checkedAt: result?.checkedAt || (state === CHECK_STATES.PENDING ? "" : data.updatedAt || now),
    }
  }
  for (const entry of entries) {
    if (!entry?.id || results[entry.id]) continue
    results[entry.id] = { state: CHECK_STATES.PENDING, checked: false, checkedAt: "" }
  }
  return {
    ...data,
    id,
    planId,
    kind,
    status: data.status === "completed" ? "completed" : "in_progress",
    results,
    startedAt: data.startedAt || now,
    completedAt: data.completedAt || "",
    updatedAt: data.updatedAt || now,
    modelVersion: CHECK_SESSION_MODEL_VERSION,
  }
}

export function getCheckSummary(session) {
  const counts = { pending: 0, confirmed: 0, missing: 0, skipped: 0, total: 0, completed: 0 }
  for (const result of Object.values(session?.results || {})) {
    const state = normalizeCheckState(result)
    counts[state]++
    counts.total++
    if (state !== CHECK_STATES.PENDING) counts.completed++
  }
  return counts
}
