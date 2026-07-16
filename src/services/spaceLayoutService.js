import * as db from "./db.js"
import { generateId } from "../utils/id.js"

const S = "spaceLayouts"

const cleanText = (value) => (typeof value === "string" ? value.trim() : "")
const toNumber = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback)

function normalizePlacements(placements) {
  const seen = new Set()
  return (Array.isArray(placements) ? placements : [])
    .filter((placement) => {
      const nodeId = cleanText(placement?.nodeId)
      if (!nodeId || seen.has(nodeId)) return false
      seen.add(nodeId)
      return true
    })
    .map((placement, index) => ({
      nodeId: cleanText(placement.nodeId),
      x: toNumber(placement.x, 0),
      y: toNumber(placement.y, 0),
      width: Math.max(1, toNumber(placement.width, 1)),
      height: Math.max(1, toNumber(placement.height, 1)),
      sortOrder: index,
    }))
}

export async function getLayoutsByNode(nodeId) {
  return (await db.getAllByIndex(S, "nodeId", nodeId)).sort((a, b) => a.sortOrder - b.sortOrder)
}

export const getLayout = (id) => db.get(S, id)

export async function createLayout(nodeId, data = {}) {
  if (!(await db.get("spaceNodes", nodeId))) throw new Error("空间不存在")
  const layouts = await getLayoutsByNode(nodeId)
  const now = new Date().toISOString()
  const layout = {
    id: generateId(),
    nodeId,
    name: cleanText(data.name) || (layouts.length ? `布局 ${layouts.length + 1}` : "默认布局"),
    sortOrder: layouts.length,
    placements: normalizePlacements(data.placements),
    createdAt: now,
    updatedAt: now,
  }
  await validatePlacements(nodeId, layout.placements)
  await db.add(S, layout)
  return layout
}

export async function updateLayout(id, data) {
  const existing = await db.get(S, id)
  if (!existing) throw new Error("布局不存在")
  const placements = data.placements === undefined ? existing.placements : normalizePlacements(data.placements)
  await validatePlacements(existing.nodeId, placements)
  const name = data.name === undefined ? existing.name : cleanText(data.name)
  if (!name) throw new Error("布局名称不能为空")
  const updated = {
    ...existing,
    name,
    placements,
    sortOrder: data.sortOrder === undefined ? existing.sortOrder : toNumber(data.sortOrder, existing.sortOrder),
    id: existing.id,
    nodeId: existing.nodeId,
    updatedAt: new Date().toISOString(),
  }
  await db.put(S, updated)
  return updated
}

async function validatePlacements(nodeId, placements) {
  const children = await db.getAllByIndex("spaceNodes", "parentId", nodeId)
  const childIds = new Set(children.map((child) => child.id))
  if (placements.some((placement) => !childIds.has(placement.nodeId))) {
    throw new Error("布局只能排列当前空间的直接下级空间")
  }
}

export async function reorderLayouts(nodeId, orderedIds) {
  const layouts = await getLayoutsByNode(nodeId)
  if (
    !Array.isArray(orderedIds) ||
    layouts.length !== orderedIds.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    layouts.some((layout) => !orderedIds.includes(layout.id))
  ) {
    throw new Error("布局顺序必须包含当前空间的全部布局")
  }
  const now = new Date().toISOString()
  await db.runTransaction([S], "readwrite", async (transaction) => {
    const store = transaction.objectStore(S)
    for (const [sortOrder, id] of orderedIds.entries()) {
      const layout = layouts.find((candidate) => candidate.id === id)
      await store.put({ ...layout, sortOrder, updatedAt: now })
    }
  })
  return getLayoutsByNode(nodeId)
}

export const deleteLayout = (id) => db.del(S, id)
