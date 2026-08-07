import test from "node:test"
import assert from "node:assert/strict"
import {
  containImageSize,
  estimateDataUrlBytes,
  formatImageBytes,
  isStorageQuotaError,
} from "../src/utils/imageProcessing.js"

test("fits a phone photo within the configured long edge", () => {
  assert.deepEqual(containImageSize(4032, 3024, 1600), { width: 1600, height: 1200 })
  assert.deepEqual(containImageSize(800, 600, 1600), { width: 800, height: 600 })
})

test("estimates stored Data URL size and formats it for users", () => {
  assert.equal(estimateDataUrlBytes("data:image/png;base64,MTIzNA=="), 4)
  assert.equal(formatImageBytes(512 * 1024), "512 KB")
  assert.equal(formatImageBytes(1.25 * 1024 * 1024), "1.3 MB")
})

test("recognizes browser storage capacity errors", () => {
  assert.equal(isStorageQuotaError({ name: "QuotaExceededError" }), true)
  assert.equal(isStorageQuotaError(new Error("database unavailable")), false)
})
