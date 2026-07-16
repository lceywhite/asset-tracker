import test from "node:test"
import assert from "node:assert/strict"
import { BACKUP_FORMAT, BACKUP_VERSION, summarizeBackup, validateBackup } from "../src/services/backupService.js"
import { STORE_NAMES } from "../src/services/db.js"

function validPayload() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    manifest: { stores: STORE_NAMES, counts: {} },
    data: {
      stores: Object.fromEntries(STORE_NAMES.map((name) => [name, []])),
      localStorage: {},
    },
  }
}

test("accepts a complete Release 0 backup", () => {
  assert.deepEqual(validateBackup(validPayload()), { valid: true, errors: [] })
})

test("accepts a legacy v1 backup without check sessions", () => {
  const payload = validPayload()
  payload.version = 1
  delete payload.data.stores.checkSessions
  assert.deepEqual(validateBackup(payload), { valid: true, errors: [] })
})

test("rejects partial and unknown backups", () => {
  const result = validateBackup({ format: "legacy", version: 0, data: { stores: {}, localStorage: {} } })
  assert.equal(result.valid, false)
  assert.match(result.errors.join(" "), /无法识别|不支持|缺少/)
})

test("summarizes every known store", () => {
  const payload = validPayload()
  payload.data.stores.items.push({ id: "one" })
  const summary = summarizeBackup(payload)
  assert.equal(summary.items, 1)
  assert.equal(Object.keys(summary).length, STORE_NAMES.length)
})
