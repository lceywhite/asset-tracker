import test from "node:test"
import assert from "node:assert/strict"
import {
  applyTripPatch,
  CHECK_STATES,
  getTripEndAt,
  getTripLegs,
  getTripStartAt,
  getCheckKindForTrip,
  getCheckSummary,
  normalizeCheckSession,
  normalizeTrip,
  tripOccursOnDate,
} from "../src/domain/tripModel.js"

const NOW = "2026-08-06T08:00:00.000Z"

test("normalizes a legacy trip into the Trip v3 baseline model revision without losing readable snapshots", () => {
  const trip = normalizeTrip(
    {
      title: " 通勤 ",
      type: "daily_carry",
      status: "active",
      startDate: "2026-08-07",
      startTime: "08:30",
      endDate: "2026-08-07",
      endTime: "19:00",
      destination: "公司",
      description: " 记得门禁卡 ",
      packingItems: [
        { id: "entry-1", itemId: "item-1", name: "门禁卡", category: "证件", sourceBagId: "bag-1" },
        { name: "临时文件", reminderType: "daily" },
      ],
    },
    { id: "trip-1", now: NOW },
  )

  assert.equal(trip.modelVersion, 3)
  assert.equal(getTripStartAt(trip), "2026-08-07T08:30")
  assert.equal(getTripEndAt(trip), "2026-08-07T19:00")
  assert.equal(getTripLegs(trip).length, 2)
  assert.equal(trip.title, "通勤")
  assert.equal(trip.status, "planned")
  assert.equal(trip.tripMode, "round_trip")
  assert.equal(trip.departureAt, "2026-08-07T08:30")
  assert.equal(trip.returnAt, "2026-08-07T19:00")
  assert.equal(trip.notes, "记得门禁卡")
  assert.equal(trip.packingItems[0].containerId, "bag-1")
  assert.equal(trip.packingItems[0].nameSnapshot, "门禁卡")
  assert.equal(trip.packingItems[1].starred, true)
  assert.equal(trip.packingItems[1].migrationPending, true)
  assert.equal(
    trip.containerRefs.some((entry) => entry.containerId === "bag-1"),
    true,
  )
})

test("keeps a trip id immutable and derives the single phase-specific check action", () => {
  const original = normalizeTrip(
    { title: "周末露营", departureAt: "2026-08-08T09:00", returnAt: "2026-08-09T18:00", tripMode: "round_trip" },
    { id: "trip-camp", now: NOW },
  )
  const updated = applyTripPatch(original, { id: "changed", origin: "家", destination: "营地" }, NOW)

  assert.equal(updated.id, "trip-camp")
  assert.equal(getCheckKindForTrip(updated, "2026-08-08T08:00:00"), "departure")
  assert.equal(getCheckKindForTrip(updated, "2026-08-08T12:00:00"), "anytime")
  assert.equal(getCheckKindForTrip(updated, "2026-08-10T08:00:00"), "end")
  assert.equal(tripOccursOnDate(updated, "2026-08-09"), true)
  assert.equal(tripOccursOnDate(updated, "2026-08-10"), false)
})

test("keeps a one-way trip end time and spans every covered calendar date", () => {
  const trip = normalizeTrip(
    {
      title: "Airport transfer",
      status: "planned",
      journeyType: "one_way",
      startsAt: "2026-08-08T22:30",
      endsAt: "2026-08-09T01:15",
      legs: [
        {
          direction: "outbound",
          origin: "Home",
          destination: "Airport",
          transportMode: "Car",
          stops: [{ name: "Fuel stop" }],
        },
      ],
    },
    { id: "trip-one-way", now: NOW },
  )

  assert.equal(trip.journeyType, "one_way")
  assert.equal(trip.startsAt, "2026-08-08T22:30")
  assert.equal(trip.endsAt, "2026-08-09T01:15")
  assert.equal(trip.returnAt, "")
  assert.equal(trip.legs.length, 1)
  assert.equal(trip.legs[0].arrivalAt, trip.endsAt)
  assert.equal(trip.legs[0].stops[0].name, "Fuel stop")
  assert.equal(tripOccursOnDate(trip, "2026-08-08"), true)
  assert.equal(tripOccursOnDate(trip, "2026-08-09"), true)
})

test("keeps separate outbound and return legs for a round trip", () => {
  const trip = normalizeTrip(
    {
      title: "Weekend trip",
      status: "planned",
      journeyType: "round_trip",
      startsAt: "2026-08-15T08:00",
      endsAt: "2026-08-16T20:00",
      legs: [
        { direction: "outbound", origin: "Home", destination: "Camp", transportMode: "Car" },
        {
          direction: "return",
          origin: "Camp",
          destination: "Home",
          departureAt: "2026-08-16T17:00",
          transportMode: "Car",
        },
      ],
    },
    { id: "trip-round", now: NOW },
  )

  assert.equal(trip.legs.length, 2)
  assert.equal(trip.returnAt, "2026-08-16T17:00")
  assert.equal(trip.legs[1].arrivalAt, "2026-08-16T20:00")
  assert.equal(trip.legs[1].origin, "Camp")
  assert.equal(trip.legs[1].destination, "Home")
})

test("allows an untitled draft but rejects an untitled planned trip", () => {
  const draft = normalizeTrip(
    {
      title: "",
      status: "draft",
      journeyType: "one_way",
      startsAt: "2026-08-08T08:00",
      endsAt: "2026-08-08T09:00",
    },
    { id: "trip-draft", now: NOW },
  )

  assert.equal(draft.isUntitled, true)
  assert.equal(draft.status, "draft")
  assert.throws(
    () =>
      normalizeTrip(
        { title: "", status: "planned", startsAt: "2026-08-08T08:00", endsAt: "2026-08-08T09:00" },
        { id: "trip-invalid", now: NOW },
      ),
    /./,
  )
})

test("normalizes embedded custom information cards in a stable order", () => {
  const trip = normalizeTrip(
    {
      title: "Trip with notes",
      status: "planned",
      infoCards: [
        { title: "Budget", type: "amount", sortOrder: 4, data: { rows: [{ label: "Hotel", value: 500 }] } },
        { title: "Schedule", type: "timeline", sortOrder: 1, data: { events: [{ time: "09:00", title: "Leave" }] } },
        { title: "", type: "checklist", data: {} },
      ],
    },
    { id: "trip-cards", now: NOW },
  )

  assert.deepEqual(
    trip.infoCards.map((card) => [card.type, card.title, card.sortOrder]),
    [
      ["timeline", "Schedule", 0],
      ["amount", "Budget", 1],
    ],
  )
})

test("migrates boolean check results and summarizes four check states", () => {
  const session = normalizeCheckSession(
    {
      id: "session-1",
      planId: "trip-1",
      kind: "return",
      status: "in_progress",
      results: {
        a: { checked: true, checkedAt: NOW },
        b: { checked: false, checkedAt: NOW },
        c: { state: "skipped", checkedAt: NOW },
      },
    },
    { entries: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], now: NOW },
  )

  assert.equal(session.modelVersion, 2)
  assert.equal(session.kind, "end")
  assert.equal(session.results.a.state, CHECK_STATES.CONFIRMED)
  assert.equal(session.results.b.state, CHECK_STATES.MISSING)
  assert.equal(session.results.c.state, CHECK_STATES.SKIPPED)
  assert.equal(session.results.d.state, CHECK_STATES.PENDING)
  assert.deepEqual(getCheckSummary(session), {
    pending: 1,
    confirmed: 1,
    missing: 1,
    skipped: 1,
    total: 4,
    completed: 3,
  })
})
