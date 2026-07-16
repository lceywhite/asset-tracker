import * as db from "./db.js"
import { generateId } from "../utils/id.js"

const S = "homeSections"

const sortSections = (sections) => [...sections].sort((a, b) => a.sortOrder - b.sortOrder)

export async function getAllSections() {
  await db.ensureV3Defaults()
  return sortSections(await db.getAll(S))
}

export const getSection = (id) => db.get(S, id)

export async function createSection(data) {
  const name = typeof data?.name === "string" ? data.name.trim() : ""
  if (!name) throw new Error("分区名称不能为空")
  const now = new Date().toISOString()
  const sections = await db.getAll(S)
  const section = {
    id: generateId(),
    key: `custom-${generateId()}`,
    name,
    description: typeof data.description === "string" ? data.description.trim() : "",
    icon: data.icon || "📦",
    builtIn: false,
    sortOrder: sections.length,
    createdAt: now,
    updatedAt: now,
  }
  await db.add(S, section)
  return section
}

export async function updateSection(id, data) {
  const existing = await db.get(S, id)
  if (!existing) throw new Error("分区不存在")
  const name = data.name === undefined ? existing.name : String(data.name).trim()
  if (!name) throw new Error("分区名称不能为空")
  const updated = {
    ...existing,
    name,
    description:
      data.description === undefined
        ? existing.description
        : typeof data.description === "string"
          ? data.description.trim()
          : "",
    icon: data.icon === undefined ? existing.icon : data.icon || "📦",
    id: existing.id,
    key: existing.key,
    builtIn: existing.builtIn,
    updatedAt: new Date().toISOString(),
  }
  await db.put(S, updated)
  return updated
}

export async function reorderSections(orderedIds) {
  if (!Array.isArray(orderedIds)) throw new TypeError("分区顺序格式错误")
  const sections = await db.getAll(S)
  if (sections.length !== orderedIds.length || sections.some((section) => !orderedIds.includes(section.id))) {
    throw new Error("分区顺序必须包含全部分区且不能重复")
  }
  if (new Set(orderedIds).size !== orderedIds.length) throw new Error("分区顺序包含重复项")
  const now = new Date().toISOString()
  await db.runTransaction([S], "readwrite", async (transaction) => {
    const store = transaction.objectStore(S)
    for (const [sortOrder, id] of orderedIds.entries()) {
      const section = sections.find((candidate) => candidate.id === id)
      await store.put({ ...section, sortOrder, updatedAt: now })
    }
  })
  return getAllSections()
}

export async function deleteSection(id) {
  return db.runTransaction([S, "spaceNodes"], "readwrite", async (transaction) => {
    const section = await transaction.objectStore(S).get(id)
    if (!section) throw new Error("分区不存在")
    if (section.builtIn) throw new Error("默认分区不可删除")
    const nodes = await transaction.objectStore("spaceNodes").index("sectionId").getAll(id)
    if (nodes.length) throw new Error("请先移动或删除分区内的空间")
    await transaction.objectStore(S).delete(id)
  })
}

export async function importLegacySections() {
  try {
    const builtinNames = JSON.parse(localStorage.getItem("asset-guard-builtin-names") || "{}")
    const mappings = [
      ["_bags", "section-bags"],
      ["_rooms", "section-home"],
    ]
    for (const [legacyKey, sectionId] of mappings) {
      const name = typeof builtinNames[legacyKey] === "string" ? builtinNames[legacyKey].trim() : ""
      if (name) await updateSection(sectionId, { name })
    }
    if (Object.keys(builtinNames).length) localStorage.removeItem("asset-guard-builtin-names")
  } catch {
    // Invalid legacy preferences are ignored; the database defaults remain available.
  }
  let legacy = []
  try {
    legacy = JSON.parse(localStorage.getItem("asset-guard-sections") || "[]")
  } catch {
    legacy = []
  }
  const existing = await getAllSections()
  const imported = []
  for (const section of legacy) {
    const name = typeof section?.name === "string" ? section.name.trim() : ""
    if (!name) continue
    let target = existing.find((candidate) => candidate.name === name)
    if (!target) {
      target = await createSection({ name, icon: section.icon, description: section.description })
      existing.push(target)
      imported.push(target)
    }
    const linkedIds = [...(section.bagIds || []), ...(section.roomIds || [])]
    for (const nodeId of linkedIds) {
      const node = await db.get("spaceNodes", nodeId)
      if (node && node.sectionId !== target.id) {
        await db.put("spaceNodes", {
          ...node,
          sectionId: target.id,
          parentId: "",
          updatedAt: new Date().toISOString(),
        })
      }
    }
  }
  return imported
}
