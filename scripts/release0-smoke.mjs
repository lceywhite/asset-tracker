import assert from "node:assert/strict"
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const playwrightModule = process.env.PLAYWRIGHT_MODULE || "playwright"
const { chromium } = await import(playwrightModule)
const appUrl = process.env.APP_URL || "http://127.0.0.1:5173/"
const outputDirectory = resolve("test-results/single-user-mvp-smoke")
await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || undefined })
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const runtimeErrors = []
page.on("pageerror", (error) => runtimeErrors.push(error.message))
page.on("console", (message) => message.type() === "error" && runtimeErrors.push(message.text()))

async function installV4Fixture() {
  await page.route("**/src/main.js", (route) => route.abort())
  await page.goto(appUrl)
  const cdp = await context.newCDPSession(page)
  await cdp.send("Storage.clearDataForOrigin", { origin: new URL(appUrl).origin, storageTypes: "all" })
  await page.evaluate(async () => {
    await new Promise((resolveDelete, rejectDelete) => {
      const request = indexedDB.deleteDatabase("asset-tracker-db")
      request.onsuccess = resolveDelete
      request.onerror = () => rejectDelete(request.error)
    })
    await new Promise((resolveOpen, rejectOpen) => {
      const request = indexedDB.open("asset-tracker-db", 4)
      request.onupgradeneeded = () => {
        const database = request.result
        for (const name of [
          "items",
          "checklists",
          "templates",
          "rooms",
          "bags",
          "locationRecords",
          "activities",
          "activityItems",
        ]) {
          database.createObjectStore(name, { keyPath: "id" })
        }
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction(["rooms", "bags", "activities"], "readwrite")
        transaction.objectStore("rooms").put({ id: "room-fixture", name: "测试房间", icon: "🚪" })
        transaction.objectStore("bags").put({ id: "bag-fixture", name: "测试背包", icon: "🎒" })
        transaction.objectStore("activities").put({
          id: "activity-fixture",
          title: "旧行程",
          startDate: "2026-07-01",
          packingItems: [{ name: "旧物品", checked: true }],
        })
        transaction.oncomplete = () => {
          database.close()
          resolveOpen()
        }
        transaction.onerror = () => rejectOpen(transaction.error)
      }
      request.onerror = () => rejectOpen(request.error)
    })
  })
  await page.unroute("**/src/main.js")
}

try {
  await installV4Fixture()
  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("测试房间", { exact: true }).waitFor()

  const schema = await page.evaluate(async () => {
    const request = indexedDB.open("asset-tracker-db")
    const database = await new Promise((resolveOpen, rejectOpen) => {
      request.onsuccess = () => resolveOpen(request.result)
      request.onerror = () => rejectOpen(request.error)
    })
    const migrated = await new Promise((resolveGet) => {
      const get = database.transaction("activities").objectStore("activities").get("activity-fixture")
      get.onsuccess = () => resolveGet(get.result)
    })
    const result = {
      version: database.version,
      sessionIndexes: [...database.transaction("checkSessions").objectStore("checkSessions").indexNames],
      migrated,
    }
    database.close()
    return result
  })
  assert.equal(schema.version, 5)
  assert.ok(schema.sessionIndexes.includes("planId"))
  assert.equal(schema.migrated.kind, "plan")
  assert.equal("checked" in schema.migrated.packingItems[0], false)

  await page.getByRole("button", { name: "快捷添加" }).click()
  await page.getByRole("button", { name: /添加物品/ }).click()
  await page.getByPlaceholder("物品名称").fill("MVP 测试护照")
  await page.locator("select").nth(1).selectOption("room-fixture")
  await page.locator("select").nth(2).selectOption("bag-fixture")
  await page.getByRole("button", { name: "添加", exact: true }).last().click()
  await page.waitForURL("**/#/item/**")
  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("MVP 测试护照", { exact: true }).waitFor()

  await page.getByRole("button", { name: "快捷添加" }).click()
  await page.getByRole("button", { name: /新建行程/ }).click()
  await page.getByPlaceholder("标题 *").fill("MVP 测试行程")
  await page.getByText(/选择物品/).click()
  await page.getByRole("button", { name: "全选", exact: true }).click()
  await page.getByRole("button", { name: /加入清单（1）/ }).click()
  await page.getByRole("button", { name: "创建", exact: true }).click()
  await page.waitForURL("**/#/plans/**")
  await page.getByRole("button", { name: /出发核对/ }).click()
  await page.getByRole("button", { name: "已确认" }).click()
  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("MVP 测试行程", { exact: true }).first().waitFor()

  const persisted = await page.evaluate(async () => {
    const request = indexedDB.open("asset-tracker-db")
    const database = await new Promise((resolveOpen) => (request.onsuccess = () => resolveOpen(request.result)))
    const transaction = database.transaction(["activities", "checkSessions"])
    const readAll = (store) =>
      new Promise((resolveRead) => {
        const get = transaction.objectStore(store).getAll()
        get.onsuccess = () => resolveRead(get.result)
      })
    const [plans, sessions] = await Promise.all([readAll("activities"), readAll("checkSessions")])
    database.close()
    return { plan: plans.find((entry) => entry.title === "MVP 测试行程"), sessions }
  })
  assert.equal(persisted.plan.packingItems.length, 1)
  assert.equal("checked" in persisted.plan.packingItems[0], false)
  assert.equal(persisted.sessions.filter((session) => session.planId === persisted.plan.id).length, 1)

  await page.getByText("社区", { exact: true }).click()
  await page.getByText("社区入口已预留", { exact: true }).waitFor()
  await page.getByText("我的", { exact: true }).click()
  await page.getByText("单人本地账户 · 点此编辑资料", { exact: true }).waitFor()
  const downloadPromise = page.waitForEvent("download")
  await page.getByText("导出完整备份", { exact: true }).click()
  const download = await downloadPromise
  const backupPath = resolve(outputDirectory, "backup.json")
  await download.saveAs(backupPath)
  const backup = JSON.parse(await readFile(backupPath, "utf8"))
  assert.equal(backup.version, 2)
  assert.equal(backup.manifest.stores.length, 9)
  assert.ok(backup.manifest.counts.checkSessions >= 1)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  assert.equal(overflow, false)
  await page.screenshot({ path: resolve(outputDirectory, "my-page-iphone.png"), fullPage: true })
  assert.deepEqual(
    runtimeErrors.filter((message) => !message.includes("net::ERR_FAILED")),
    [],
  )
  console.log("Single-user MVP smoke passed: DB v4→v5, item, plan check session, four tabs, backup v2")
} finally {
  await browser.close()
}
