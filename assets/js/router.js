// Minimal hash router used by every section page. A bare hash like
// "#4895755" is treated as a record id (detail view); "#tab-name" is
// treated as a tab switch. Pages decide what to do with each — this
// just normalizes reading/writing the hash and re-render-on-change.
export function currentHash() {
  return decodeURIComponent((location.hash || "").replace(/^#/, ""));
}
export function goTo(hash) {
  location.hash = hash;
}
export function onHashChange(cb) {
  window.addEventListener("hashchange", cb);
  cb(); // run once immediately for the initial URL
}
// A hash is treated as a record id if it's purely numeric (matches the
// case-id scheme used for calls/reports/citations/bolos/records).
export function isRecordId(hash) {
  return /^\d{5,}$/.test(hash);
}

// ---- Cross-page prefill handoff ----------------------------------------
// Lookup sets one of these before navigating to Reports/Citations/BOLO/Records
// so the destination page can offer "attach this person/vehicle?" instead of
// re-typing everything that's already on file. One-shot: read once, gone.
// Shape: { type: "person"|"vehicle", id, label, suggestedVehicle?: {id,label} }
// suggestedVehicle is only present when prefilling a person who already has
// a linked vehicle on file — the destination page then offers to attach both.
export function setPrefill(payload) {
  sessionStorage.setItem("lein_prefill", JSON.stringify(payload));
}
export function takePrefill() {
  const raw = sessionStorage.getItem("lein_prefill");
  if (!raw) return null;
  sessionStorage.removeItem("lein_prefill");
  try { return JSON.parse(raw); } catch { return null; }
}