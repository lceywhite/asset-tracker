import { Capacitor } from "@capacitor/core"
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"

export async function exportToJSON(data, filename = "asset-backup.json") {
  const contents = JSON.stringify(data, null, 2)
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: filename,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({
      title: "物品守护数据备份",
      text: "请将备份文件保存到安全的位置。",
      url: file.uri,
      dialogTitle: "导出备份",
    })
    return file.uri
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return filename
}
export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result))
      } catch {
        reject(new Error("JSON格式错误"))
      }
    }
    r.onerror = () => reject(new Error("文件读取失败"))
    r.readAsText(file)
  })
}
