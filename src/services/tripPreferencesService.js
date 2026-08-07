const KEY = "asset-tracker-trip-preferences"

export const DEFAULT_TRIP_PREFERENCES = Object.freeze({
  departureReminder: "previous_evening",
  endReminder: "previous_evening",
  reminderTime: "21:00",
})

function normalizeReminder(value) {
  return ["off", "previous_evening"].includes(value) ? value : "previous_evening"
}

function normalizeTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "") ? value : DEFAULT_TRIP_PREFERENCES.reminderTime
}

export function getTripPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}")
    return {
      departureReminder: normalizeReminder(saved.departureReminder),
      endReminder: normalizeReminder(saved.endReminder),
      reminderTime: normalizeTime(saved.reminderTime),
    }
  } catch {
    return { ...DEFAULT_TRIP_PREFERENCES }
  }
}

export function updateTripPreferences(patch) {
  localStorage.setItem(KEY, JSON.stringify({ ...getTripPreferences(), ...patch }))
  return getTripPreferences()
}

export function getTripReminderSummary(preferences = getTripPreferences()) {
  const departure = preferences.departureReminder === "off" ? "出发前不提醒" : `出发前一天 ${preferences.reminderTime}`
  const end = preferences.endReminder === "off" ? "返程/结束前不提醒" : `返程/结束前一天 ${preferences.reminderTime}`
  return `${departure}；${end}`
}
