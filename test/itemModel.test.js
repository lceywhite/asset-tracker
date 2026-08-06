import test from "node:test"
import assert from "node:assert/strict"
import {
  applyItemPatch,
  getEffectiveValuation,
  getFilledPropertyGroups,
  normalizeItem,
} from "../src/domain/itemModel.js"

const NOW = "2026-07-16T08:00:00.000Z"

test("normalizes a legacy item into a v3 archive without losing compatibility fields", () => {
  const item = normalizeItem(
    {
      name: " 通勤背包 ",
      category: "箱包",
      roomId: "room-1",
      bagId: "bag-1",
      photo: "data:image/png;base64,one",
      value: 899,
      purchaseDate: "2025-03-18",
      tags: ["重要", "重要", " 通勤 "],
      notes: " 旧备注 ",
    },
    { id: "12345678-abcd", now: NOW },
  )

  assert.equal(item.modelVersion, 3)
  assert.equal(item.itemCode, "AT-12345678")
  assert.equal(item.name, "通勤背包")
  assert.deepEqual(item.tags, ["重要", "通勤"])
  assert.equal(item.locationNodeId, "bag-1")
  assert.equal(item.homeLocationNodeId, "room-1")
  assert.equal(item.purchasePrice, 899)
  assert.equal(item.value, 899)
  assert.equal(item.images[0].isCover, true)
  assert.equal(item.propertyGroups.filter((group) => group.kind === "standard").length, 3)
})

test("keeps the immutable id and supports removable fields and custom groups", () => {
  const original = normalizeItem({ name: "相机", propertyGroups: [] }, { id: "camera-1", now: NOW })
  const groups = original.propertyGroups.map((group) =>
    group.key === "product" ? { ...group, fields: group.fields.filter((field) => field.key !== "material") } : group,
  )
  groups.push({
    id: "travel",
    title: "旅行属性",
    kind: "custom",
    fields: [{ id: "priority", label: "旅行优先级", value: "S" }],
  })

  const updated = applyItemPatch(original, { id: "changed", propertyGroups: groups, notes: "随身携带" }, NOW)
  assert.equal(updated.id, "camera-1")
  assert.equal(
    updated.propertyGroups.find((group) => group.key === "product").fields.some((f) => f.key === "material"),
    false,
  )
  assert.equal(updated.propertyGroups.find((group) => group.title === "旅行属性").fields[0].value, "S")
  assert.equal(
    getFilledPropertyGroups(updated).some((group) => group.title === "旅行属性"),
    true,
  )
})

test("only exposes a manual valuation while linear depreciation remains deferred", () => {
  const manual = normalizeItem(
    { name: "背包", valuation: { mode: "manual", manualAmount: 699 } },
    { id: "bag", now: NOW },
  )
  const linear = normalizeItem(
    { name: "背包", valuation: { mode: "linear", currentAmount: 500 } },
    { id: "bag-2", now: NOW },
  )
  assert.equal(getEffectiveValuation(manual), 699)
  assert.equal(getEffectiveValuation(linear), null)
})

test("keeps typed purchase fields and editable finance properties in sync", () => {
  const original = normalizeItem({ name: "背包", purchasePrice: 899 }, { id: "bag-sync", now: NOW })
  const priceField = original.propertyGroups
    .find((group) => group.key === "finance")
    .fields.find((field) => field.key === "purchasePrice")
  assert.equal(priceField.value, "899")

  const quickUpdated = applyItemPatch(original, { purchasePrice: 999 }, NOW)
  assert.equal(
    quickUpdated.propertyGroups
      .find((group) => group.key === "finance")
      .fields.find((field) => field.key === "purchasePrice").value,
    "999",
  )

  const editedGroups = quickUpdated.propertyGroups.map((group) =>
    group.key === "finance"
      ? {
          ...group,
          fields: group.fields.map((field) => (field.key === "purchasePrice" ? { ...field, value: "¥1,299" } : field)),
        }
      : group,
  )
  const fullUpdated = applyItemPatch(quickUpdated, { propertyGroups: editedGroups }, NOW)
  assert.equal(fullUpdated.purchasePrice, 1299)
  assert.equal(fullUpdated.value, 1299)
})
