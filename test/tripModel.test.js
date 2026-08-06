import test from "node:test"
import assert from "node:assert/strict"
import {
  applyTripPatch,
  CHECK_STATES,
  getCheckKindForTrip,
  getCheckSummary,
  normalizeCheckSession,
  normalizeTrip,
  tripOccursOnDate,
} from "../src/domain/tripModel.js"

const NOW = "2026-08-06T08:00:00.000Z"

test("normalizes a legacy trip into Plan v2 without losing readable snapshots", () => {
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

  assert.equal(trip.modelVersion, 2)
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
