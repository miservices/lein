// =========================================================
// LEIN — shared utilities (departments, ranks, formatting,
// id generation, weighted-random helpers used by the mock
// simulation engine). Nothing in here touches Firestore.
// =========================================================

// Full legal agency names, keyed by a short internal id.
// `short` is what gets used in tight spaces (unit badges).
export const DEPARTMENTS = {
  fpd:      { key: "fpd",      name: "Flint Police Department",        short: "FPD",  cssClass: "dept-police" },
  gcso:     { key: "gcso",     name: "Genesee County Sheriff's Office", short: "GCSO", cssClass: "dept-sheriff" },
  msp:      { key: "msp",      name: "Michigan State Police",          short: "MSP",  cssClass: "dept-msp" },
  ffd:      { key: "ffd",      name: "Flint Fire Department",          short: "FFD",  cssClass: "dept-fire" },
  fems:     { key: "fems",     name: "Flint EMS",                      short: "EMS",  cssClass: "dept-ems" },
  dispatch: { key: "dispatch", name: "Dispatch",                       short: "DISP", cssClass: "dept-dispatch" }
};
export const DEPARTMENT_LIST = Object.values(DEPARTMENTS);

// Look up a department record by key OR by matching name (for custom/free-typed
// agency names that happen to match, or for old data saved before this rename).
export function resolveDepartment(value) {
  if (!value) return { key: null, name: "Unassigned", short: "—", cssClass: "dept-dispatch" };
  if (DEPARTMENTS[value]) return DEPARTMENTS[value];
  const byName = DEPARTMENT_LIST.find(d => d.name.toLowerCase() === String(value).toLowerCase());
  if (byName) return byName;
  // Custom agency the user typed in — no fixed color, keep the text as-is.
  return { key: null, name: value, short: value.slice(0, 4).toUpperCase(), cssClass: "dept-dispatch" };
}

export const RANKS = [
  "Cadet", "Officer", "Corporal", "Sergeant", "Lieutenant", "Captain", "Chief",
  "Deputy", "Sergeant Deputy", "Trooper", "Trooper Sergeant",
  "Dispatcher", "Lead Dispatcher", "Firefighter", "Engineer", "Fire Lieutenant", "Fire Captain",
  "Paramedic", "EMT", "Medic Supervisor"
];

// ---------------------------------------------------------
// IDs
// ---------------------------------------------------------
// 7-digit numeric ids, formatted like the CAD call numbers the user asked for
// (e.g. #4895755). Used for calls, reports, citations, bolos, records — anything
// that should feel like a real case/call number and be linkable via a URL hash.
export function generateCaseId() {
  return String(Math.floor(1000000 + Math.random() * 8999999));
}

// ---------------------------------------------------------
// Formatting
// ---------------------------------------------------------
export function fmtDateTime(ts) {
  const d = toDate(ts);
  if (!d) return "—";
  return d.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(ts) {
  const d = toDate(ts);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
export function fmtAge(ts) {
  const d = toDate(ts);
  if (!d) return "—";
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  return null;
}
export function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function initialsBadge(name) {
  if (!name) return "?";
  return name.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------
// Randomization — used by the mock simulation engine so that
// "how often does this change" feels like a real dispatch system
// instead of a fixed timer.
// ---------------------------------------------------------
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function pickWeighted(pairs) {
  // pairs: [[value, weight], ...]
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
}
export function chance(probability) { return Math.random() < probability; }
export function randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

// Triangular distribution: most values land near `mode`, but the tail toward
// `max` is real. This is what makes "a warrant check re-verifies every ~45min"
// mean *usually* around 45, occasionally 10, occasionally 90+ — not a fixed timer.
export function triangularMinutes(min, mode, max) {
  const u = Math.random();
  const c = (mode - min) / (max - min);
  let x;
  if (u < c) x = min + Math.sqrt(u * (max - min) * (mode - min));
  else x = max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  return Math.round(x);
}
export function minutesFromNow(mins) { return Date.now() + mins * 60000; }

export const COURT_JUDGES = [
  "Hon. R. Aldercroft", "Hon. P. Whitfield", "Hon. M. Osei", "Hon. D. Kowalski",
  "Hon. S. Ibarra", "Hon. C. Lindqvist", "Hon. J. Marsh", "Hon. T. Okafor"
];
export const COURTS = [
  "Genesee County 67th District Court", "Genesee County Circuit Court", "Flint Municipal Court"
];
