const KEY = "asset-tracker-item-preferences"
const DEFAULTS = Object.freeze({
  homeView: "space",
  itemSort: "createdAt",
  addMode: "quick",
  valuationMode: "none",
})

export function getPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}")
    const legacyView = localStorage.getItem("asset-tracker-item-view")
    return {
      homeView: ["space", "items"].includes(saved.homeView)
        ? saved.homeView
        : legacyView === "table"
          ? "items"
          : DEFAULTS.homeView,
      itemSort: ["itemCode", "value", "createdAt"].includes(saved.itemSort) ? saved.itemSort : DEFAULTS.itemSort,
      addMode: ["quick", "guided"].includes(saved.addMode) ? saved.addMode : DEFAULTS.addMode,
      valuationMode: ["none", "manual", "linear"].includes(saved.valuationMode)
        ? saved.valuationMode
        : DEFAULTS.valuationMode,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function updatePreferences(patch) {
  const next = { ...getPreferences(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return getPreferences()
}
