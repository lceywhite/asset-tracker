import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { APP_VERSION, IOS_BUILD_NUMBER, IOS_MARKETING_VERSION } from "../src/config/appVersion.js"

test("keeps package, in-app and Xcode versions aligned", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  const xcodeProject = await readFile(new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8")

  assert.equal(APP_VERSION, packageJson.version)
  assert.match(xcodeProject, new RegExp(`MARKETING_VERSION = ${IOS_MARKETING_VERSION.replaceAll(".", "\\.")};`))
  assert.match(xcodeProject, new RegExp(`CURRENT_PROJECT_VERSION = ${IOS_BUILD_NUMBER};`))
})
