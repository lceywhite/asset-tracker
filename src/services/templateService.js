import * as db from "./db"
import { BUILTIN_TEMPLATES } from "@/data/templates"
export async function getAll() {
  const user = await db.getAll("templates")
  return [...BUILTIN_TEMPLATES.map((t) => ({ ...t, isBuiltIn: true })), ...user]
}
export async function get(id) {
  const t = BUILTIN_TEMPLATES.find((t) => t.id === id)
  if (t) return { ...t, isBuiltIn: true }
  return db.get("templates", id)
}
