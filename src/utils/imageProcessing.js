export const IMAGE_MAX_COUNT = 8
export const IMAGE_MAX_INPUT_BYTES = 25 * 1024 * 1024
export const IMAGE_MAX_OUTPUT_BYTES = 1024 * 1024
export const IMAGE_MAX_DIMENSION = 1600

const SUPPORTED_PASSTHROUGH_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function containImageSize(width, height, maxDimension = IMAGE_MAX_DIMENSION) {
  if (!width || !height || Math.max(width, height) <= maxDimension) return { width, height }
  const ratio = maxDimension / Math.max(width, height)
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

export function estimateDataUrlBytes(dataUrl) {
  if (typeof dataUrl !== "string") return 0
  const commaIndex = dataUrl.indexOf(",")
  if (commaIndex < 0) return 0
  const header = dataUrl.slice(0, commaIndex)
  const body = dataUrl.slice(commaIndex + 1)
  if (!header.includes(";base64")) return new TextEncoder().encode(decodeURIComponent(body)).length
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding)
}

export function formatImageBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB"
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function isStorageQuotaError(error) {
  return error?.name === "QuotaExceededError" || /quota|storage space|存储空间/i.test(error?.message || "")
}

export function storageWriteErrorMessage(error, fallback = "保存失败") {
  return isStorageQuotaError(error)
    ? "本机存储空间不足，请减少图片后重试；已有数据不会被清空"
    : error?.message || fallback
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"))
    reader.readAsDataURL(blob)
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("图片压缩失败"))), type, quality)
  })
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch {
      // Safari 对部分照片格式会走下方的 HTMLImageElement 兼容路径。
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = objectUrl
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function optimizeImageFile(
  file,
  {
    maxInputBytes = IMAGE_MAX_INPUT_BYTES,
    maxOutputBytes = IMAGE_MAX_OUTPUT_BYTES,
    maxDimension = IMAGE_MAX_DIMENSION,
  } = {},
) {
  if (!file?.type?.startsWith("image/")) throw new Error("请选择照片文件")
  if (file.size > maxInputBytes) throw new Error(`单张原图不能超过 ${formatImageBytes(maxInputBytes)}`)

  const source = await decodeImage(file)
  const sourceWidth = source.width || source.naturalWidth
  const sourceHeight = source.height || source.naturalHeight
  if (!sourceWidth || !sourceHeight) throw new Error("无法识别图片尺寸")

  try {
    if (
      file.size <= maxOutputBytes &&
      Math.max(sourceWidth, sourceHeight) <= maxDimension &&
      SUPPORTED_PASSTHROUGH_TYPES.has(file.type)
    ) {
      return {
        dataUrl: await readAsDataUrl(file),
        originalBytes: file.size,
        outputBytes: file.size,
        width: sourceWidth,
        height: sourceHeight,
        compressed: false,
      }
    }

    let dimensions = containImageSize(sourceWidth, sourceHeight, maxDimension)
    let bestBlob = null
    const canvas = document.createElement("canvas")
    const qualities = [0.84, 0.74, 0.64, 0.54]

    for (let sizeAttempt = 0; sizeAttempt < 6; sizeAttempt += 1) {
      canvas.width = Math.max(1, dimensions.width)
      canvas.height = Math.max(1, dimensions.height)
      const context = canvas.getContext("2d", { alpha: false })
      if (!context) throw new Error("当前浏览器无法处理图片")
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(source, 0, 0, canvas.width, canvas.height)

      for (const quality of qualities) {
        const candidate = await canvasToBlob(canvas, "image/jpeg", quality)
        if (!bestBlob || candidate.size < bestBlob.size) bestBlob = candidate
        if (candidate.size <= maxOutputBytes) {
          return {
            dataUrl: await readAsDataUrl(candidate),
            originalBytes: file.size,
            outputBytes: candidate.size,
            width: canvas.width,
            height: canvas.height,
            compressed: candidate.size < file.size,
          }
        }
      }

      dimensions = {
        width: Math.max(1, Math.round(dimensions.width * 0.8)),
        height: Math.max(1, Math.round(dimensions.height * 0.8)),
      }
    }

    if (!bestBlob) throw new Error("图片压缩失败")
    throw new Error(`图片处理后仍超过 ${formatImageBytes(maxOutputBytes)}，请换一张图片`)
  } finally {
    source.close?.()
  }
}
