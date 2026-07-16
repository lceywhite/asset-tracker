import "fake-indexeddb/auto"
import test from "node:test"
import assert from "node:assert/strict"

class MemoryStorage {
  #values = new Map()
  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null
  }
  setItem(key, value) {
    this.#values.set(key, String(value))
  }
  removeItem(key) {
    this.#values.delete(key)
  }
}

globalThis.localStorage = new MemoryStorage()

test("supports v3 sections, nested spaces, layouts, item movement and recursive summaries", async () => {
  const db = await import("../src/services/db.js")
  const sectionService = await import("../src/services/homeSectionService.js")
  const nodeService = await import("../src/services/spaceNodeService.js")
  const layoutService = await import("../src/services/spaceLayoutService.js")
  const itemService = await import("../src/services/itemService.js")
  const locationService = await import("../src/services/locationService.js")
  const checkService = await import("../src/services/spaceCheckService.js")

  const defaults = await sectionService.getAllSections()
  assert.deepEqual(
    defaults.map((section) => section.name),
    ["我的包包", "我的家", "我的车库"],
  )
  await assert.rejects(() => sectionService.deleteSection("section-home"), /默认分区不可删除/)

  const house = await nodeService.createNode({
    sectionId: "section-home",
    name: "滨江花园 8 栋",
    kind: "space",
    mobility: "fixed",
    spaceValue: 6200000,
  })
  const study = await nodeService.createNode({
    sectionId: "section-home",
    parentId: house.id,
    name: "书房",
    kind: "area",
    mobility: "fixed",
  })
  const cabinet = await nodeService.createNode({
    sectionId: "section-home",
    parentId: study.id,
    name: "防潮柜",
    kind: "container",
    mobility: "fixed",
  })

  const layout = await layoutService.createLayout(house.id, {
    name: "一层",
    placements: [{ nodeId: study.id, x: 1, y: 2, width: 2, height: 1 }],
  })
  assert.equal(layout.placements[0].nodeId, study.id)
  await assert.rejects(
    () => layoutService.updateLayout(layout.id, { placements: [{ nodeId: cabinet.id }] }),
    /直接下级空间/,
  )

  const item = await itemService.createItem({
    name: "相机",
    category: "电子设备",
    locationNodeId: cabinet.id,
    homeLocationNodeId: cabinet.id,
    purchasePrice: 12000,
    valuation: { mode: "manual", manualAmount: 8600 },
    tags: ["旅行必带"],
  })
  const summary = await nodeService.getNodeSummary(house.id)
  assert.equal(summary.recursiveItemCount, 1)
  assert.equal(summary.directItemCount, 0)
  assert.equal(summary.collectionValue, 8600)

  const moved = await itemService.moveItem(item.id, study.id, { reason: "清洁防潮柜" })
  assert.equal(moved.locationNodeId, study.id)
  const history = await locationService.getByItem(item.id)
  assert.equal(history.length, 1)
  assert.equal(history[0].fromNodeId, cabinet.id)
  assert.equal(history[0].toNodeId, study.id)
  assert.equal(history[0].reason, "清洁防潮柜")

  let check = await checkService.startOrResumeSpaceCheck(house.id, [moved])
  assert.equal(check.entries[0].checked, false)
  check = await checkService.toggleSpaceCheck(check.id, moved.id)
  assert.equal(check.entries[0].checked, true)
  check = await checkService.completeSpaceCheck(check.id)
  assert.equal(check.status, "completed")

  await assert.rejects(() => nodeService.updateNode(house.id, { parentId: study.id }), /自己的下级/)
  await assert.rejects(() => nodeService.deleteNode(house.id), /下级空间或物品/)

  await db.closeDb()
})
