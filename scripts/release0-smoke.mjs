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
  runtimeErrors.length = 0
  await page.screenshot({ path: resolve(outputDirectory, "item-home-v3-iphone.png"), fullPage: true })

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
  assert.equal(schema.version, 7)
  assert.ok(schema.sessionIndexes.includes("planId"))
  assert.ok(schema.sessionIndexes.includes("kind"))
  assert.equal(schema.migrated.kind, "plan")
  assert.equal(schema.migrated.modelVersion, 2)
  assert.equal("checked" in schema.migrated.packingItems[0], false)
  const v3Model = await page.evaluate(async () => {
    const request = indexedDB.open("asset-tracker-db")
    const database = await new Promise((resolveOpen) => (request.onsuccess = () => resolveOpen(request.result)))
    const transaction = database.transaction(["homeSections", "spaceNodes"])
    const readAll = (store) =>
      new Promise((resolveRead) => {
        const get = transaction.objectStore(store).getAll()
        get.onsuccess = () => resolveRead(get.result)
      })
    const [sections, nodes] = await Promise.all([readAll("homeSections"), readAll("spaceNodes")])
    database.close()
    return { sections, nodes }
  })
  assert.equal(v3Model.sections.length, 3)
  assert.ok(v3Model.nodes.some((node) => node.id === "room-fixture" && node.kind === "area"))
  assert.ok(v3Model.nodes.some((node) => node.id === "bag-fixture" && node.mobility === "mobile"))

  await page.getByRole("button", { name: "＋ 新增分区", exact: true }).click()
  await page.getByText("分区管理", { exact: true }).waitFor()
  await page.getByText("我的包包", { exact: true }).last().click()
  await page.getByText("默认分区不可删除", { exact: true }).first().waitFor()
  await page.getByRole("button", { name: "关闭", exact: true }).click()

  await page.getByRole("button", { name: "物品", exact: true }).first().click()
  await page.getByLabel("物品排序方式").selectOption("value")
  assert.equal(await page.getByLabel("物品排序方式").inputValue(), "value")
  await page.screenshot({ path: resolve(outputDirectory, "item-list-sorted-v3-iphone.png"), fullPage: true })
  await page.getByRole("button", { name: "空间", exact: true }).click()

  await page.getByRole("button", { name: "快捷添加" }).click()
  await page.getByRole("button", { name: /添加物品/ }).click()
  await page.getByRole("button", { name: "切换为逐步添加" }).click()
  await page.getByText("逐步添加物品", { exact: true }).waitFor()
  await page.getByRole("button", { name: "1 基本", exact: true }).waitFor()
  await page.getByRole("button", { name: "取消", exact: true }).click()

  await page.getByRole("button", { name: "快捷添加" }).click()
  await page.getByRole("button", { name: /添加物品/ }).click()
  await page.getByText("快速添加物品", { exact: true }).waitFor()
  const currencyBox = await page.getByLabel("币种").boundingBox()
  const priceBox = await page.getByLabel("购入价金额").boundingBox()
  assert.ok(currencyBox && priceBox)
  assert.ok(priceBox.width > 150)
  assert.ok(currencyBox.x + currencyBox.width < priceBox.x)
  await page.getByLabel("购入价金额").scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(outputDirectory, "item-add-v3-iphone.png"), fullPage: true })
  await page.getByPlaceholder("例如：通勤背包").fill("MVP 测试护照")
  await page.getByRole("button", { name: "证件", exact: true }).click()
  await page.getByLabel("当前空间 / 容器").selectOption("bag-fixture")
  await page.getByLabel("常驻 / 归位位置").selectOption("room-fixture")
  await page.getByRole("button", { name: "保存", exact: true }).click()
  await page.waitForURL("**/#/item/**")
  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("MVP 测试护照", { exact: true }).waitFor()
  await page.getByText(/ID · AT-/).waitFor()
  await page.screenshot({ path: resolve(outputDirectory, "item-profile-v3-iphone.png"), fullPage: true })

  await page.getByRole("button", { name: "编辑", exact: true }).click()
  await page.getByText("完整档案编辑", { exact: true }).waitFor()
  await page.getByText("估值规则", { exact: true }).waitFor({ state: "attached" })
  await page.waitForFunction(() => {
    const values = [...document.querySelectorAll("input")].map((input) => input.value)
    return ["产品属性", "财务信息", "维护属性"].every((value) => values.includes(value))
  })
  await page.getByRole("button", { name: "＋ 新增自定义属性组", exact: true }).click()
  await page.waitForFunction(() =>
    [...document.querySelectorAll("input")].some((input) => input.value === "自定义属性组 1"),
  )
  await page.getByRole("button", { name: "取消", exact: true }).click()

  await page.getByRole("button").filter({ hasText: "当前所在" }).click()
  await page.waitForURL("**/#/spaces/bag-fixture")
  await page.getByText("我的包包 / 测试背包", { exact: true }).waitFor()
  await page.getByText("测试背包", { exact: true }).first().waitFor()
  await page.screenshot({ path: resolve(outputDirectory, "space-detail-v3-iphone.png"), fullPage: true })
  await page.getByRole("button", { name: "核对", exact: true }).click()
  await page.getByTestId("space-check").getByRole("button", { name: "核对 MVP 测试护照" }).click()
  await page.getByRole("button", { name: "完成本次核对" }).click()
  await page.getByRole("button", { name: "物品", exact: true }).click()

  await page.getByRole("button", { name: "快捷添加" }).click()
  await page.getByRole("button", { name: /新建行程/ }).click()
  await page.getByLabel("行程名称").fill("MVP 测试行程")
  await page.getByLabel("出发地点").fill("测试房间")
  await page.getByLabel("到达地点").fill("测试终点")
  await page.getByRole("button", { name: /添加物品添加移动容器/ }).click()
  await page.waitForURL("**/#/plans/*/carry**")
  await page.getByRole("button", { name: /添加移动容器/ }).click()
  await page.getByLabel("选择现有移动容器").selectOption("bag-fixture")
  await page.getByRole("button", { name: "创建并加入", exact: true }).click()
  await page.getByRole("button", { name: "＋ 从物品库添加", exact: true }).click()
  await page.waitForURL("**/#/plans/*/carry/*/items**")
  await page.getByRole("button", { name: "＋MVP 测试护照", exact: true }).click()
  await page.getByRole("button", { name: "给MVP 测试护照加星标", exact: true }).click()
  await page.getByRole("button", { name: "添加 1 项到测试背包", exact: true }).click()
  await page.waitForURL("**/#/plans/*/carry**")
  await page.getByRole("button", { name: "完成", exact: true }).click()
  await page.waitForURL("**/#/plans/*/edit")
  await page.getByRole("button", { name: "保存行程档案", exact: true }).click()
  await page.waitForURL(/#\/plans\/[^/]+$/)
  await page.getByRole("button", { name: "出发核对", exact: true }).click()
  await page.getByRole("button", { name: "已确认" }).click()
  await page.getByRole("button", { name: "返回行程档案", exact: true }).click()
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
  assert.equal(persisted.plan.modelVersion, 2)
  assert.equal(persisted.plan.packingItems[0].containerId, "bag-fixture")
  assert.equal(persisted.plan.packingItems[0].starred, true)
  assert.equal("checked" in persisted.plan.packingItems[0], false)
  assert.equal(persisted.sessions.filter((session) => session.planId === persisted.plan.id).length, 1)
  assert.equal(
    persisted.sessions.find((session) => session.planId === persisted.plan.id).results[
      persisted.plan.packingItems[0].id
    ].state,
    "confirmed",
  )

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
  assert.equal(backup.version, 3)
  assert.equal(backup.manifest.stores.length, 12)
  assert.ok(backup.manifest.counts.checkSessions >= 1)
  assert.equal(backup.manifest.counts.homeSections, 3)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  assert.equal(overflow, false)
  await page.screenshot({ path: resolve(outputDirectory, "my-page-iphone.png"), fullPage: true })
  assert.deepEqual(
    runtimeErrors.filter((message) => !message.includes("net::ERR_FAILED")),
    [],
  )
  console.log("Single-user MVP smoke passed: DB v4→v7, item v3, trip v2, four tabs, backup v3")
} finally {
  await browser.close()
}
