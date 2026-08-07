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
  assert.equal(schema.version, 8)
  assert.ok(schema.sessionIndexes.includes("planId"))
  assert.ok(schema.sessionIndexes.includes("kind"))
  assert.equal(schema.migrated.kind, "plan")
  assert.equal(schema.migrated.modelVersion, 3)
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
  const photoDataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 2400
    canvas.height = 1800
    const context = canvas.getContext("2d")
    const image = context.createImageData(canvas.width, canvas.height)
    for (let index = 0; index < image.data.length; index += 4) {
      const pixel = index / 4
      image.data[index] = (pixel * 13) % 255
      image.data[index + 1] = (pixel * 29) % 255
      image.data[index + 2] = (pixel * 47) % 255
      image.data[index + 3] = 255
    }
    context.putImageData(image, 0, 0)
    return canvas.toDataURL("image/jpeg", 0.96)
  })
  const photoBuffer = Buffer.from(photoDataUrl.split(",")[1], "base64")
  assert.ok(photoBuffer.length > 1024 * 1024)
  await page.locator('input[type="file"][accept="image/*"][multiple]').setInputFiles({
    name: "phone-photo.jpg",
    mimeType: "image/jpeg",
    buffer: photoBuffer,
  })
  await page.getByText(/已加入 1 张/).waitFor()
  await page.getByPlaceholder("例如：通勤背包").fill("MVP 测试护照")
  await page.getByRole("button", { name: "证件", exact: true }).click()
  await page.getByLabel("当前空间 / 容器").selectOption("bag-fixture")
  await page.getByLabel("常驻 / 归位位置").selectOption("room-fixture")
  await page.getByRole("button", { name: "保存", exact: true }).click()
  await page.waitForURL("**/#/item/**")
  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("MVP 测试护照", { exact: true }).waitFor()
  await page.getByText(/ID · AT-/).waitFor()
  const storedImage = await page.evaluate(async () => {
    const request = indexedDB.open("asset-tracker-db")
    const database = await new Promise((resolveOpen) => (request.onsuccess = () => resolveOpen(request.result)))
    const items = await new Promise((resolveRead) => {
      const get = database.transaction("items").objectStore("items").getAll()
      get.onsuccess = () => resolveRead(get.result)
    })
    database.close()
    const dataUrl = items.find((item) => item.name === "MVP 测试护照").images[0].url
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const body = dataUrl.split(",")[1]
    const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0
    return {
      bytes: Math.floor((body.length * 3) / 4) - padding,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
  })
  assert.ok(storedImage.bytes <= 1024 * 1024)
  assert.ok(Math.max(storedImage.width, storedImage.height) <= 1600)
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
  await page.getByRole("textbox", { name: "行程名称", exact: true }).fill("MVP 测试行程")
  const tripStartInput = page.getByRole("textbox", { name: "开始时间", exact: true })
  const tripStartDate = new Date()
  tripStartDate.setDate(tripStartDate.getDate() + 1)
  const tripStartValue = `${tripStartDate.getFullYear()}-${String(tripStartDate.getMonth() + 1).padStart(2, "0")}-${String(tripStartDate.getDate()).padStart(2, "0")}T08:00`
  await tripStartInput.fill(tripStartValue)
  const tripEndDate = new Date(`${tripStartValue.slice(0, 10)}T00:00:00Z`)
  tripEndDate.setUTCDate(tripEndDate.getUTCDate() + 1)
  await page
    .getByRole("textbox", { name: "结束时间", exact: true })
    .fill(`${tripEndDate.toISOString().slice(0, 10)}T${tripStartValue.slice(11, 16)}`)
  await page.getByRole("textbox", { name: "起点", exact: true }).fill("测试房间")
  await page.getByRole("textbox", { name: "终点", exact: true }).fill("测试终点")
  await page.getByRole("button", { name: "＋ 添加信息卡片", exact: true }).click()
  await page.getByRole("textbox", { name: "信息内容", exact: true }).fill("09:00 | 到达 | 开始核对")
  await page.getByRole("button", { name: "保存卡片", exact: true }).click()
  await page.getByRole("button", { name: "＋ 添加物品", exact: true }).click()
  await page.getByRole("heading", { name: "携带物品清单", exact: true, level: 1 }).waitFor()
  await page.getByRole("button", { name: /添加移动容器/ }).click()
  await page.getByRole("button", { name: /测试背包/ }).click()
  await page.getByRole("button", { name: "加入容器及全部物品", exact: true }).click()
  await page.getByRole("button", { name: /添加移动容器/ }).click()
  await page.getByRole("button", { name: /新建移动容器/ }).click()
  await page.getByRole("textbox", { name: "容器名称", exact: true }).fill("烟雾测试临时容器")
  await page.getByRole("button", { name: "创建并加入", exact: true }).click()
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "从行程移除烟雾测试临时容器", exact: true }).click()
  await page.getByRole("button", { name: "从行程移除烟雾测试临时容器", exact: true }).waitFor({ state: "hidden" })
  await page.getByRole("button", { name: "给MVP 测试护照加星标", exact: true }).click()
  await page.getByRole("button", { name: "完成", exact: true }).click()
  await page.waitForURL("**/#/plans/*/edit")
  await page.getByRole("button", { name: "保存行程档案", exact: true }).click()
  await page.waitForURL(/#\/plans\/[^/]+$/)
  await page.getByText("行程安排", { exact: true }).waitFor()
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
  assert.equal(persisted.plan.modelVersion, 3)
  assert.ok(persisted.plan.endsAt > persisted.plan.startsAt)
  assert.equal(persisted.plan.legs.length, 1)
  assert.equal(persisted.plan.infoCards.length, 1)
  assert.equal(persisted.plan.infoCards[0].type, "timeline")
  assert.equal(persisted.plan.containerRefs.length, 1)
  assert.equal(persisted.plan.containerRefs[0].importedAll, true)
  assert.equal(persisted.plan.containerRefs[0].importedItemIds.length, 1)
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

  await page.getByRole("button", { name: "返回", exact: true }).click()
  await page.waitForURL("**/#/plans")
  await page.getByText("MVP 测试行程", { exact: true }).first().waitFor()
  await page.locator(".week-strip .trip-dot").first().waitFor()
  assert.ok((await page.locator(".week-strip .trip-dot").count()) > 0)
  await page.getByRole("button", { name: /本周/ }).click()
  await page.locator(".calendar-grid > .calendar-range").first().waitFor()
  assert.ok((await page.locator(".calendar-grid > .calendar-range").count()) > 0)

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

  let clearConfirmations = 0
  const confirmClear = async (dialog) => {
    clearConfirmations += 1
    await dialog.accept()
  }
  page.on("dialog", confirmClear)
  await page.getByText("清空本机数据", { exact: true }).click()
  await page.getByText("本机业务数据已清空", { exact: true }).waitFor()
  page.off("dialog", confirmClear)
  assert.equal(clearConfirmations, 2)
  const clearedCounts = await page.evaluate(async () => {
    const request = indexedDB.open("asset-tracker-db")
    const database = await new Promise((resolveOpen) => (request.onsuccess = () => resolveOpen(request.result)))
    const transaction = database.transaction(["items", "activities", "checkSessions", "spaceNodes"])
    const count = (store) =>
      new Promise((resolveCount) => {
        const result = transaction.objectStore(store).count()
        result.onsuccess = () => resolveCount(result.result)
      })
    const values = await Promise.all([count("items"), count("activities"), count("checkSessions"), count("spaceNodes")])
    database.close()
    return values
  })
  assert.deepEqual(clearedCounts, [0, 0, 0, 0])

  const backupInput = page.locator('input[type="file"][accept*="application/json"]')
  await backupInput.setInputFiles(backupPath)
  await page.getByRole("heading", { name: "备份预检通过", exact: true }).waitFor()
  await page.getByRole("button", { name: "替换现有数据", exact: true }).click()
  await page.waitForFunction(
    () => document.body.innerText.includes("数据已从备份替换") || document.body.innerText.includes("恢复失败："),
  )
  const restoreStatus = await page.locator("body").innerText()
  if (restoreStatus.includes("恢复失败：")) {
    await page.screenshot({ path: resolve(outputDirectory, "backup-restore-failure.png"), fullPage: true })
  }
  assert.match(restoreStatus, /数据已从备份替换/)
  const restored = await page.evaluate(async () => {
    const request = indexedDB.open("asset-tracker-db")
    const database = await new Promise((resolveOpen) => (request.onsuccess = () => resolveOpen(request.result)))
    const transaction = database.transaction(["items", "activities", "checkSessions", "spaceNodes"])
    const readAll = (store) =>
      new Promise((resolveRead) => {
        const get = transaction.objectStore(store).getAll()
        get.onsuccess = () => resolveRead(get.result)
      })
    const [items, plans, sessions, nodes] = await Promise.all([
      readAll("items"),
      readAll("activities"),
      readAll("checkSessions"),
      readAll("spaceNodes"),
    ])
    database.close()
    const item = items.find((entry) => entry.name === "MVP 测试护照")
    const plan = plans.find((entry) => entry.title === "MVP 测试行程")
    return {
      counts: [items.length, plans.length, sessions.length, nodes.length],
      itemLocation: item.locationNodeId,
      planItemId: plan.packingItems[0].itemId,
      planContainerId: plan.packingItems[0].containerId,
      sessionPlanId: sessions.find((entry) => entry.planId === plan.id)?.planId,
      planId: plan.id,
      itemId: item.id,
    }
  })
  assert.deepEqual(restored.counts, [
    backup.manifest.counts.items,
    backup.manifest.counts.activities,
    backup.manifest.counts.checkSessions,
    backup.manifest.counts.spaceNodes,
  ])
  assert.equal(restored.itemLocation, "bag-fixture")
  assert.equal(restored.planItemId, restored.itemId)
  assert.equal(restored.planContainerId, "bag-fixture")
  assert.equal(restored.sessionPlanId, restored.planId)

  await backupInput.setInputFiles({
    name: "damaged.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ damaged"),
  })
  await page.getByText("JSON格式错误", { exact: true }).waitFor()
  const missingStoreBackup = structuredClone(backup)
  delete missingStoreBackup.data.stores.items
  await backupInput.setInputFiles({
    name: "missing-store.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(missingStoreBackup)),
  })
  await page.getByText(/数据表 items 缺失或格式错误/).waitFor()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  assert.equal(overflow, false)
  await page.screenshot({ path: resolve(outputDirectory, "my-page-iphone.png"), fullPage: true })
  assert.deepEqual(
    runtimeErrors.filter((message) => !message.includes("net::ERR_FAILED")),
    [],
  )
  console.log(
    "Single-user MVP smoke passed: DB v4→v8, image compression, item v3, trip v3/model v3, four tabs, backup v3 destructive restore",
  )
} finally {
  await browser.close()
}
