export const TRIP_MODEL_VERSION = 3
export const CHECK_SESSION_MODEL_VERSION = 2

export const TRIP_STATUSES = Object.freeze({
  DRAFT: "draft",
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
})

export const JOURNEY_TYPES = Object.freeze({
  ONE_WAY: "one_way",
  ROUND_TRIP: "round_trip",
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

export const INFO_CARD_TYPES = Object.freeze({
  TIMELINE: "timeline",
  PAGED_SCHEDULE: "paged_schedule",
  CHECKLIST: "checklist",
  KEY_VALUE: "key_value",
  AMOUNT: "amount",
})

const CHECK_STATE_VALUES = new Set(Object.values(CHECK_STATES))
const CHECK_KIND_VALUES = new Set(Object.values(CHECK_KINDS))
const TRIP_STATUS_VALUES = new Set(Object.values(TRIP_STATUSES))
const JOURNEY_TYPE_VALUES = new Set(Object.values(JOURNEY_TYPES))
const INFO_CARD_TYPE_VALUES = new Set(Object.values(INFO_CARD_TYPES))

const cleanText = (value) => (typeof value === "string" ? value.trim() : "")

function normalizeDateTime(value) {
  return cleanText(value)
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

function normalizeJourneyType(data) {
  const requested = cleanText(data.journeyType || data.tripMode)
  if (JOURNEY_TYPE_VALUES.has(requested)) return requested
  const legacyEnd = cleanText(data.returnAt) || cleanText(data.endTime) || cleanText(data.endDate)
  return legacyEnd ? JOURNEY_TYPES.ROUND_TRIP : JOURNEY_TYPES.ONE_WAY
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
    importedAll: Boolean(reference.importedAll),
    importedAt: cleanText(reference.importedAt),
    importedItemIds: Array.isArray(reference.importedItemIds)
      ? [...new Set(reference.importedItemIds.map(cleanText).filter(Boolean))]
      : [],
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
    name: nameSnapshot,
    category: categorySnapshot,
    sourceBagId: containerId.startsWith("legacy-unassigned-") ? "" : containerId,
    reminderType: starred ? "return" : "selfcheck",
  }
}

function normalizeStop(stop, index, createId, legId) {
  if (!stop || typeof stop !== "object") return null
  const name = cleanText(stop.name || stop.location || stop.label)
  if (!name) return null
  return {
    id: cleanText(stop.id) || createId(`${legId}-stop-${index + 1}`),
    name,
    arrivalAt: normalizeDateTime(stop.arrivalAt),
    departureAt: normalizeDateTime(stop.departureAt),
    notes: cleanText(stop.notes),
    sortOrder: Number.isFinite(Number(stop.sortOrder)) ? Number(stop.sortOrder) : index,
  }
}

function normalizeLeg(leg, index, createId, fallback = {}) {
  const source = leg && typeof leg === "object" ? leg : {}
  const id = cleanText(source.id) || createId(`leg-${index + 1}`)
  const direction = cleanText(source.direction || fallback.direction) || (index ? "return" : "outbound")
  const stops = (Array.isArray(source.stops) ? source.stops : Array.isArray(fallback.stops) ? fallback.stops : [])
    .map((stop, stopIndex) => normalizeStop(stop, stopIndex, createId, id))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stop, stopIndex) => ({ ...stop, sortOrder: stopIndex }))
  return {
    id,
    direction,
    origin: cleanText(source.origin || fallback.origin),
    destination: cleanText(source.destination || fallback.destination),
    stops,
    transportMode: cleanText(source.transportMode || fallback.transportMode),
    departureAt: normalizeDateTime(source.departureAt || fallback.departureAt),
    arrivalAt: normalizeDateTime(source.arrivalAt || fallback.arrivalAt),
    sortOrder: Number.isFinite(Number(source.sortOrder)) ? Number(source.sortOrder) : index,
  }
}

function normalizeInfoCard(card, index, createId) {
  if (!card || typeof card !== "object") return null
  const title = cleanText(card.title)
  if (!title) return null
  const requestedType = cleanText(card.type)
  return {
    id: cleanText(card.id) || createId(`info-${index + 1}`),
    type: INFO_CARD_TYPE_VALUES.has(requestedType) ? requestedType : INFO_CARD_TYPES.KEY_VALUE,
    title,
    data: card.data && typeof card.data === "object" ? card.data : {},
    sortOrder: Number.isFinite(Number(card.sortOrder)) ? Number(card.sortOrder) : index,
  }
}

function getLegacyStart(data) {
  return normalizeDateTime(data.startsAt || data.departureAt) || legacyDateTime(data.startDate, data.startTime)
}

function getLegacyEnd(data, startsAt) {
  const explicit = normalizeDateTime(data.endsAt)
  if (explicit) return { endsAt: explicit, endTimePending: Boolean(data.endTimePending) }
  const legacy = normalizeDateTime(data.returnAt) || legacyDateTime(data.endDate, data.endTime)
  if (legacy) return { endsAt: legacy, endTimePending: Boolean(data.endTimePending) }
  return { endsAt: startsAt, endTimePending: Boolean(startsAt) }
}

function normalizeLegs(data, journeyType, startsAt, endsAt, createId) {
  const sourceLegs = Array.isArray(data.legs) ? data.legs : []
  const legacyStops = Array.isArray(data.stops) ? data.stops : []
  const outbound = normalizeLeg(sourceLegs.find((leg) => leg?.direction === "outbound") || sourceLegs[0], 0, createId, {
    direction: "outbound",
    origin: data.origin,
    destination: data.destination,
    stops: legacyStops,
    transportMode: data.transportMode,
    departureAt: startsAt,
    arrivalAt: journeyType === JOURNEY_TYPES.ONE_WAY ? endsAt : "",
  })
  outbound.departureAt = startsAt || outbound.departureAt
  if (journeyType === JOURNEY_TYPES.ONE_WAY) outbound.arrivalAt = endsAt || outbound.arrivalAt

  if (journeyType === JOURNEY_TYPES.ONE_WAY) return [{ ...outbound, direction: "outbound", sortOrder: 0 }]

  const requestedReturn = sourceLegs.find((leg) => leg?.direction === "return") || sourceLegs[1]
  const returnDepartureAt =
    normalizeDateTime(requestedReturn?.departureAt || data.returnDepartureAt) ||
    normalizeDateTime(data.returnAt) ||
    (!sourceLegs.length ? endsAt : "")
  const returnLeg = normalizeLeg(requestedReturn, 1, createId, {
    direction: "return",
    origin: outbound.destination,
    destination: outbound.origin,
    stops: Array.isArray(data.returnStops) ? data.returnStops : [],
    transportMode: requestedReturn?.transportMode || data.transportMode,
    departureAt: returnDepartureAt,
    arrivalAt: endsAt,
  })
  returnLeg.arrivalAt = endsAt || returnLeg.arrivalAt
  return [
    { ...outbound, direction: "outbound", sortOrder: 0 },
    { ...returnLeg, direction: "return", sortOrder: 1 },
  ]
}

export function normalizeTrip(
  data,
  { id = data?.id, now = new Date().toISOString(), createId = (suffix) => `${id}-${suffix}` } = {},
) {
  if (!data || typeof data !== "object") throw new TypeError("行程数据格式错误")
  if (!id) throw new Error("行程 ID 不能为空")

  const status = normalizeTripStatus(data.status)
  const requestedTitle = cleanText(data.title)
  if (!requestedTitle && status !== TRIP_STATUSES.DRAFT) throw new Error("行程名称不能为空")
  const isUntitled = !requestedTitle || Boolean(data.isUntitled && requestedTitle === "未命名行程")
  const title = requestedTitle || "未命名行程"
  const createdAt = data.createdAt || now
  const journeyType = normalizeJourneyType(data)
  const startsAt = getLegacyStart(data)
  const endState = getLegacyEnd(data, startsAt)
  const endsAt = endState.endsAt
  const endTimePending = Boolean(data.endTimePending ?? endState.endTimePending)
  const legs = normalizeLegs(data, journeyType, startsAt, endsAt, createId)
  const outboundLeg = legs[0]
  const returnLeg = legs.find((leg) => leg.direction === "return")

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
      importedAll: false,
      importedAt: "",
      importedItemIds: [],
    })
  }

  const notes = typeof data.notes === "string" ? data.notes.trim() : cleanText(data.description)
  const infoCards = (Array.isArray(data.infoCards) ? data.infoCards : [])
    .map((card, index) => normalizeInfoCard(card, index, createId))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((card, index) => ({ ...card, sortOrder: index }))

  return {
    ...data,
    id,
    kind: "plan",
    modelVersion: TRIP_MODEL_VERSION,
    title,
    isUntitled,
    type: cleanText(data.type) || "custom",
    status,
    journeyType,
    startsAt,
    endsAt,
    endTimePending,
    legs,
    containerRefs: references.map((reference, index) => ({ ...reference, sortOrder: index })),
    packingItems,
    notes,
    infoCards,
    // Compatibility aliases remain readable after the Trip v3 baseline is established.
    tripMode: journeyType,
    departureAt: startsAt,
    returnAt: journeyType === JOURNEY_TYPES.ROUND_TRIP ? returnLeg?.departureAt || "" : "",
    returnDepartureAt: journeyType === JOURNEY_TYPES.ROUND_TRIP ? returnLeg?.departureAt || "" : "",
    origin: outboundLeg?.origin || "",
    destination: outboundLeg?.destination || "",
    transportMode: outboundLeg?.transportMode || "",
    startDate: datePart(startsAt) || cleanText(data.startDate),
    endDate: datePart(endsAt) || cleanText(data.endDate),
    startTime: timePart(startsAt) || cleanText(data.startTime),
    endTime: timePart(endsAt) || cleanText(data.endTime),
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
      legs: patch.legs === undefined ? existing.legs : patch.legs,
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

export function getTripStartAt(trip) {
  return normalizeDateTime(trip?.startsAt || trip?.departureAt) || legacyDateTime(trip?.startDate, trip?.startTime)
}

export function getTripEndAt(trip) {
  return normalizeDateTime(trip?.endsAt) || legacyDateTime(trip?.endDate, trip?.endTime) || getTripStartAt(trip)
}

export function getTripLegs(trip) {
  if (Array.isArray(trip?.legs) && trip.legs.length) return trip.legs
  if (!trip) return []
  return normalizeTrip({ ...trip, status: trip.status || TRIP_STATUSES.DRAFT }, { id: trip.id || "preview" }).legs
}

export function getTripPhase(trip, at = new Date()) {
  if (!trip) return "before"
  if ([TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED].includes(trip.status)) return "after"
  const now = at instanceof Date ? at : new Date(at)
  const start = comparableDate(getTripStartAt(trip))
  const end = comparableDate(getTripEndAt(trip), true)
  if (start && now < start) return "before"
  if (!trip.endTimePending && end && now > end) return "after"
  return start ? "during" : "before"
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
  const start = datePart(getTripStartAt(trip))
  const end = datePart(getTripEndAt(trip)) || start
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
