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
  "Genesee County 67th District Court", "Genesee County 7th Circuit Court"
];

// ---------------------------------------------------------
// Reference data for Reports / Records / Lookup forms.
// ---------------------------------------------------------
export const US_STATES = [
  "MI","AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];
// Flint, MI zip range — used as the auto-fill default/options everywhere an
// address is captured in this app, since almost everything happens locally.
export const FLINT_ZIPS = ["48501", "48502", "48503", "48504", "48505", "48506", "48507"];
export const DEFAULT_CITY = "Flint";
export const DEFAULT_STATE = "MI";
export const DEFAULT_ZIP = "48503";

export const LOCATION_TYPES = ["", "Residence", "Business", "Roadway", "Park", "School", "Other"];
export const INCIDENT_TYPES = [
  "Suspicious Activity", "Domestic Disturbance", "Theft", "Assault", "Burglary",
  "Vandalism", "Trespassing", "Disorderly Conduct", "Noise Complaint", "Welfare Check",
  "Traffic Collision", "Fraud", "Missing Person", "Other"
];
export const PERSON_ROLES = ["Victim", "Witness", "Complainant", "Suspect", "Reporting Party", "Arrestee", "Other"];
export const DISPOSITIONS = ["Report Only", "No Action", "Arrest", "Citation", "Referred", "Unfounded"];
export const ARREST_TYPES = ["Warrant", "Probable Cause"];
export const EVIDENCE_DISPOSITIONS = ["Seized", "Booked into Evidence", "Returned to Owner", "Destroyed", "Released"];
export const VERDICTS = ["Pending", "Guilty", "Not Guilty", "Dismissed", "Diverted"];

// Rough juvenile check for the arrest form's auto-suggestion — an officer
// can always override it, this is just a starting point from DOB.
export function isJuvenile(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const ageMs = Date.now() - birth.getTime();
  const age = ageMs / (1000 * 60 * 60 * 24 * 365.25);
  return age < 18;
}
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function nowTimeHHMM() { return new Date().toTimeString().slice(0, 5); }
export function uid() { return Math.random().toString(36).slice(2, 10); }