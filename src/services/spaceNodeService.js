import * as db from "./db.js"
import { getEffectiveValuation } from "../domain/itemModel.js"
import { generateId } from "../utils/id.js"

const S = "spaceNodes"
const KINDS = new Set(["space", "area", "container"])
const MOBILITY = new Set(["fixed", "mobile", "none"])

const cleanText = (value) => (typeof value === "string" ? value.trim() : "")
const normalizeAmount = (value) => {
  if (value === "" || value === null || value === undefined) return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function normalizeImages(images) {
  return (Array.isArray(images) ? images : [])
    .map((image) => (typeof image === "string" ? { url: image, caption: "" } : image))
    .filter((image) => image && cleanText(image.url))
    .map((image) => ({ id: image.id || generateId(), url: image.url, caption: cleanText(image.caption) }))
}

function normalizeNode(data, { id = data.id, now = new Date().toISOString(), existing } = {}) {
  const name = cleanText(data.name)
  if (!name) throw new Error("空间名称不能为空")
  const kind = KINDS.has(data.kind) ? data.kind : existing?.kind || "container"
  const defaultMobility = kind === "container" ? "fixed" : "none"
  return {
    ...existing,
    ...data,
    id,
    sectionId: cleanText(data.sectionId),
    parentId: cleanText(data.parentId),
    kind,
    mobility: MOBILITY.has(data.mobility) ? data.mobility : existing?.mobility || defaultMobility,
    name,
    description: cleanText(data.description),
    icon: data.icon || existing?.icon || (kind === "space" ? "🏠" : kind === "area" ? "🚪" : "📦"),
    images: normalizeImages(data.images ?? existing?.images),
    spaceValue: normalizeAmount(data.spaceValue),
    currency: cleanText(data.currency) || existing?.currency || "CNY",
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : existing?.sortOrder || 0,
    createdAt: existing?.createdAt || data.createdAt || now,
    updatedAt: now,
  }
}

function descendantIds(nodes, rootId) {
  const result = []
  const queue = [rootId]
  while (queue.length) {
    const parentId = queue.shift()
    for (const node of nodes.filter((candidate) => candidate.parentId === parentId)) {
      if (result.includes(node.id)) continue
      result.push(node.id)
      queue.push(node.id)
    }
  }
  return result
}

export async function getAllNodes() {
  await db.ensureV3Defaults()
  return db.getAll(S)
}

export const getNode = (id) => db.get(S, id)
export const getNodesBySection = (sectionId) => db.getAllByIndex(S, "sectionId", sectionId)
export const getChildren = (parentId) => db.getAllByIndex(S, "parentId", parentId || "")

export async function getRootNodes(sectionId) {
  return (await getNodesBySection(sectionId)).filter((node) => !node.parentId).sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function createNode(data) {
  const section = await db.get("homeSections", data.sectionId)
  if (!section) throw new Error("所属分区不存在")
  let parent = null
  if (data.parentId) {
    parent = await db.get(S, data.parentId)
    if (!parent) throw new Error("上级空间不存在")
    if (parent.sectionId !== data.sectionId) throw new Error("下级空间必须与上级位于同一分区")
  }
  const siblings = await getChildren(data.parentId || "")
  const id = generateId()
  const node = normalizeNode({ ...data, sortOrder: data.sortOrder ?? siblings.length }, { id })
  await db.add(S, node)
  return node
}

export async function updateNode(id, data) {
  const existing = await db.get(S, id)
  if (!existing) throw new Error("空间不存在")
  const allNodes = await db.getAll(S)
  const sectionId = data.sectionId === undefined ? existing.sectionId : data.sectionId
  const parentId = data.parentId === undefined ? existing.parentId : data.parentId || ""
  if (parentId === id || descendantIds(allNodes, id).includes(parentId))
    throw new Error("空间不能移动到自身或自己的下级")
  if (!(await db.get("homeSections", sectionId))) throw new Error("所属分区不存在")
  if (parentId) {
    const parent = allNodes.find((node) => node.id === parentId)
    if (!parent) throw new Error("上级空间不存在")
    if (parent.sectionId !== sectionId) throw new Error("下级空间必须与上级位于同一分区")
  }
  const updated = normalizeNode({ ...existing, ...data, sectionId, parentId }, { id, existing })
  await db.runTransaction([S, "spaceLayouts"], "readwrite", async (transaction) => {
    const nodeStore = transaction.objectStore(S)
    await nodeStore.put(updated)
    if (sectionId !== existing.sectionId) {
      const descendants = new Set(descendantIds(allNodes, id))
      for (const node of allNodes.filter((candidate) => descendants.has(candidate.id))) {
        await nodeStore.put({ ...node, sectionId, updatedAt: updated.updatedAt })
      }
    }
    if (parentId !== existing.parentId && existing.parentId) {
      const layoutStore = transaction.objectStore("spaceLayouts")
      for (const layout of await layoutStore.index("nodeId").getAll(existing.parentId)) {
        const placements = layout.placements.filter((placement) => placement.nodeId !== id)
        if (placements.length !== layout.placements.length) {
          await layoutStore.put({ ...layout, placements, updatedAt: updated.updatedAt })
        }
      }
    }
  })
  return updated
}

export async function getBreadcrumbs(id) {
  const nodes = await db.getAll(S)
  const result = []
  let current = nodes.find((node) => node.id === id)
  const visited = new Set()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    result.unshift(current)
    current = nodes.find((node) => node.id === current.parentId)
  }
  return result
}

export async function getNodeSummary(id) {
  const [node, nodes, items] = await Promise.all([db.get(S, id), db.getAll(S), db.getAll("items")])
  if (!node) throw new Error("空间不存在")
  const descendants = descendantIds(nodes, id)
  const recursiveNodeIds = new Set([id, ...descendants])
  const directItems = items.filter((item) => item.locationNodeId === id)
  const recursiveItems = items.filter((item) => recursiveNodeIds.has(item.locationNodeId))
  return {
    node,
    directChildren: nodes.filter((candidate) => candidate.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder),
    descendantCount: descendants.length,
    directItemCount: directItems.length,
    recursiveItemCount: recursiveItems.length,
    collectionValue: recursiveItems.reduce((sum, item) => sum + (getEffectiveValuation(item) || 0), 0),
    currency: node.currency || "CNY",
  }
}

export function getSuggestedChildKind(node) {
  if (!node || node.kind === "space") return { kind: "area", label: "区域" }
  return { kind: "container", label: node.kind === "area" ? "容器" : "子容器" }
}

export async function deleteNode(id, { cascade = false } = {}) {
  return db.runTransaction([S, "spaceLayouts", "items"], "readwrite", async (transaction) => {
    const nodeStore = transaction.objectStore(S)
    const root = await nodeStore.get(id)
    if (!root) throw new Error("空间不存在")
    const nodes = await nodeStore.getAll()
    const descendants = descendantIds(nodes, id)
    const targetIds = new Set([id, ...descendants])
    const items = await transaction.objectStore("items").getAll()
    const linkedItems = items.filter(
      (item) => targetIds.has(item.locationNodeId) || targetIds.has(item.homeLocationNodeId),
    )
    if (!cascade && (descendants.length || linkedItems.length)) throw new Error("空间仍包含下级空间或物品")

    const itemStore = transaction.objectStore("items")
    for (const item of linkedItems) {
      await itemStore.put({
        ...item,
        locationNodeId: targetIds.has(item.locationNodeId) ? "" : item.locationNodeId,
        homeLocationNodeId: targetIds.has(item.homeLocationNodeId) ? "" : item.homeLocationNodeId,
        roomId: targetIds.has(item.roomId) ? "" : item.roomId,
        bagId: targetIds.has(item.bagId) ? "" : item.bagId,
        updatedAt: new Date().toISOString(),
      })
    }

    const layoutStore = transaction.objectStore("spaceLayouts")
    for (const layout of await layoutStore.getAll()) {
      if (targetIds.has(layout.nodeId)) {
        await layoutStore.delete(layout.id)
        continue
      }
      const placements = layout.placements.filter((placement) => !targetIds.has(placement.nodeId))
      if (placements.length !== layout.placements.length) {
        await layoutStore.put({ ...layout, placements, updatedAt: new Date().toISOString() })
      }
    }
    for (const nodeId of targetIds) {
      await nodeStore.delete(nodeId)
    }
  })
}
