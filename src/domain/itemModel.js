export const ITEM_MODEL_VERSION = 3

export const VALUATION_MODES = Object.freeze({
  NONE: "none",
  MANUAL: "manual",
  LINEAR: "linear",
})

export const STANDARD_PROPERTY_GROUPS = Object.freeze([
  {
    id: "standard-product",
    key: "product",
    title: "产品属性",
    fields: [
      ["brand", "品牌", "text"],
      ["model", "型号", "text"],
      ["color", "颜色", "text"],
      ["material", "材质", "text"],
      ["capacity", "容量", "text"],
      ["condition", "成色", "text"],
    ],
  },
  {
    id: "standard-finance",
    key: "finance",
    title: "财务信息",
    fields: [
      ["purchasePrice", "购入价", "money"],
      ["purchaseDate", "购入时间", "date"],
      ["purchaseChannel", "购买渠道", "text"],
      ["warrantyUntil", "保修至", "date"],
      ["receipt", "购买凭证", "attachment"],
    ],
  },
  {
    id: "standard-maintenance",
    key: "maintenance",
    title: "维护属性",
    fields: [
      ["usageFrequency", "使用频率", "text"],
      ["lastInventoryAt", "最近盘点", "datetime"],
      ["lastCleanedAt", "最近清洁", "date"],
      ["nextMaintenanceAt", "下次维护", "date"],
    ],
  },
])

const cleanText = (value) => (typeof value === "string" ? value.trim() : "")

function normalizeAmount(value) {
  if (value === "" || value === null || value === undefined) return null
  const normalized = typeof value === "string" ? value.replaceAll(",", "").replace(/[^\d.-]/g, "") : value
  if (normalized === "" || normalized === "-" || normalized === ".") return null
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  return [...new Set(tags.map(cleanText).filter(Boolean))]
}

function normalizeImages(images, photo, itemId, createdAt) {
  const source = Array.isArray(images) ? images : []
  const normalized = source
    .map((image, index) => {
      if (typeof image === "string") {
        return {
          id: `image-${itemId}-${index + 1}`,
          url: image,
          caption: "",
          isCover: index === 0,
          createdAt,
        }
      }
      if (!image || typeof image !== "object" || !cleanText(image.url)) return null
      return {
        id: cleanText(image.id) || `image-${itemId}-${index + 1}`,
        url: image.url,
        caption: cleanText(image.caption),
        isCover: Boolean(image.isCover),
        createdAt: image.createdAt || createdAt,
      }
    })
    .filter(Boolean)

  if (!normalized.length && cleanText(photo)) {
    normalized.push({
      id: `image-${itemId}-cover`,
      url: photo,
      caption: "",
      isCover: true,
      createdAt,
    })
  }

  if (normalized.length && !normalized.some((image) => image.isCover)) normalized[0].isCover = true
  let coverFound = false
  return normalized.map((image) => {
    if (!image.isCover) return image
    if (coverFound) return { ...image, isCover: false }
    coverFound = true
    return image
  })
}

function defaultFieldValue(key, data) {
  const values = {
    brand: data.brand,
    model: data.model,
    purchasePrice: data.purchasePrice ?? data.value,
    purchaseDate: data.purchaseDate,
    purchaseChannel: data.purchaseChannel,
    warrantyUntil: data.warrantyUntil,
    usageFrequency: data.usageFrequency,
    lastInventoryAt: data.lastInventoryAt,
    lastCleanedAt: data.lastCleanedAt,
    nextMaintenanceAt: data.nextMaintenanceAt,
  }
  const value = values[key]
  return value === null || value === undefined ? "" : String(value)
}

function defaultGroup(template, data) {
  return {
    id: template.id,
    key: template.key,
    title: template.title,
    kind: "standard",
    sortOrder: STANDARD_PROPERTY_GROUPS.findIndex((group) => group.key === template.key),
    fields: template.fields.map(([key, label, type], index) => ({
      id: `${template.id}-${key}`,
      key,
      label,
      value: defaultFieldValue(key, data),
      type,
      unit: "",
      sortOrder: index,
    })),
  }
}

function normalizeField(field, groupId, index) {
  if (!field || typeof field !== "object") return null
  const label = cleanText(field.label || field.name)
  if (!label) return null
  return {
    id: cleanText(field.id) || `${groupId}-field-${index + 1}`,
    key: cleanText(field.key),
    label,
    value: field.value === null || field.value === undefined ? "" : String(field.value),
    type: cleanText(field.type) || "text",
    unit: cleanText(field.unit),
    sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : index,
  }
}

function normalizeGroup(group, index) {
  if (!group || typeof group !== "object") return null
  const key = cleanText(group.key)
  const template = STANDARD_PROPERTY_GROUPS.find((candidate) => candidate.key === key)
  const kind = template ? "standard" : "custom"
  const id = template?.id || cleanText(group.id) || `custom-group-${index + 1}`
  const title = template?.title || cleanText(group.title) || `自定义属性组 ${index + 1}`
  return {
    id,
    key: template?.key || key,
    title,
    kind,
    sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index,
    fields: (Array.isArray(group.fields) ? group.fields : [])
      .map((field, fieldIndex) => normalizeField(field, id, fieldIndex))
      .filter(Boolean),
  }
}

export function normalizePropertyGroups(groups, data = {}) {
  const normalized = (Array.isArray(groups) ? groups : []).map(normalizeGroup).filter(Boolean)
  for (const template of STANDARD_PROPERTY_GROUPS) {
    if (!normalized.some((group) => group.key === template.key)) normalized.push(defaultGroup(template, data))
  }
  return normalized.map((group, index) => ({ ...group, sortOrder: index })).sort((a, b) => a.sortOrder - b.sortOrder)
}

function propertyValue(groups, groupKey, fieldKey) {
  return groups.find((group) => group.key === groupKey)?.fields.find((field) => field.key === fieldKey)?.value
}

function updatePropertyValue(groups, groupKey, fieldKey, value) {
  return groups.map((group) => {
    if (group.key !== groupKey) return group
    return {
      ...group,
      fields: group.fields.map((field) =>
        field.key === fieldKey
          ? { ...field, value: value === null || value === undefined ? "" : String(value) }
          : field,
      ),
    }
  })
}

export function createItemCode(id) {
  return `AT-${String(id)
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase()}`
}

export function normalizeItem(data, { id = data?.id, now = new Date().toISOString() } = {}) {
  if (!data || typeof data !== "object") throw new TypeError("物品数据格式错误")
  if (!id) throw new Error("物品 ID 不能为空")
  const name = cleanText(data.name)
  if (!name) throw new Error("物品名称不能为空")

  const createdAt = data.createdAt || now
  const images = normalizeImages(data.images, data.photo, id, createdAt)
  const propertyGroups = normalizePropertyGroups(data.propertyGroups, data)
  const purchasePrice = normalizeAmount(
    data.purchasePrice ?? data.value ?? propertyValue(propertyGroups, "finance", "purchasePrice"),
  )
  const purchaseDate =
    cleanText(data.purchaseDate) || cleanText(propertyValue(propertyGroups, "finance", "purchaseDate"))
  const purchaseChannel =
    cleanText(data.purchaseChannel) || cleanText(propertyValue(propertyGroups, "finance", "purchaseChannel"))
  const valuationMode = Object.values(VALUATION_MODES).includes(data.valuation?.mode)
    ? data.valuation.mode
    : VALUATION_MODES.NONE
  const roomId = cleanText(data.roomId)
  const bagId = cleanText(data.bagId)
  const locationNodeId = cleanText(data.locationNodeId) || bagId || roomId
  const homeLocationNodeId = cleanText(data.homeLocationNodeId) || roomId

  return {
    ...data,
    id,
    itemCode: cleanText(data.itemCode) || createItemCode(id),
    modelVersion: ITEM_MODEL_VERSION,
    name,
    category: cleanText(data.category),
    subCategory: cleanText(data.subCategory),
    tags: normalizeTags(data.tags),
    images,
    photo: images.find((image) => image.isCover)?.url || images[0]?.url || "",
    locationNodeId,
    homeLocationNodeId,
    roomId,
    bagId,
    purchasePrice,
    currency: cleanText(data.currency) || "CNY",
    purchaseDate,
    purchaseChannel,
    valuation: {
      mode: valuationMode,
      manualAmount: normalizeAmount(data.valuation?.manualAmount),
      currentAmount: normalizeAmount(data.valuation?.currentAmount),
      calculatedAt: data.valuation?.calculatedAt || "",
    },
    value: purchasePrice || 0,
    propertyGroups,
    notes: typeof data.notes === "string" ? data.notes.trim() : "",
    status: cleanText(data.status) || "in_stock",
    spaceId: cleanText(data.spaceId) || "private",
    createdBy: cleanText(data.createdBy) || "me",
    createdAt,
    updatedAt: now,
  }
}

export function applyItemPatch(existing, patch, now = new Date().toISOString()) {
  if (!existing) throw new Error("物品不存在")
  let propertyGroups =
    patch.propertyGroups === undefined ? existing.propertyGroups : normalizePropertyGroups(patch.propertyGroups)
  if (patch.propertyGroups !== undefined) {
    const finance = propertyGroups.find((group) => group.key === "finance")
    const purchasePriceField = finance?.fields.find((field) => field.key === "purchasePrice")
    const purchaseDateField = finance?.fields.find((field) => field.key === "purchaseDate")
    const purchaseChannelField = finance?.fields.find((field) => field.key === "purchaseChannel")
    patch = {
      ...patch,
      purchasePrice: purchasePriceField ? normalizeAmount(purchasePriceField.value) : null,
      purchaseDate: purchaseDateField ? cleanText(purchaseDateField.value) : "",
      purchaseChannel: purchaseChannelField ? cleanText(purchaseChannelField.value) : "",
    }
  } else {
    if (Object.hasOwn(patch, "purchasePrice")) {
      propertyGroups = updatePropertyValue(propertyGroups, "finance", "purchasePrice", patch.purchasePrice)
    }
    if (Object.hasOwn(patch, "purchaseDate")) {
      propertyGroups = updatePropertyValue(propertyGroups, "finance", "purchaseDate", patch.purchaseDate)
    }
    if (Object.hasOwn(patch, "purchaseChannel")) {
      propertyGroups = updatePropertyValue(propertyGroups, "finance", "purchaseChannel", patch.purchaseChannel)
    }
  }
  const input = {
    ...existing,
    ...patch,
    id: existing.id,
    valuation: { ...existing.valuation, ...patch.valuation },
    images: patch.images === undefined ? existing.images : patch.images,
    propertyGroups,
    createdAt: existing.createdAt,
  }
  return normalizeItem(input, { id: existing.id, now })
}

export function getEffectiveValuation(item) {
  if (item?.valuation?.mode !== VALUATION_MODES.MANUAL) return null
  const amount = normalizeAmount(item.valuation.manualAmount ?? item.valuation.currentAmount)
  return amount !== null && amount > 0 ? amount : null
}

export function getFilledPropertyGroups(item) {
  return (item?.propertyGroups || [])
    .map((group) => ({ ...group, fields: group.fields.filter((field) => String(field.value || "").trim()) }))
    .filter((group) => group.fields.length)
}
