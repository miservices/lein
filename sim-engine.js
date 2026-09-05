// =========================================================
// LEIN — mock data simulation engine.
// Started once (from nav.js, so it's alive on every page). It only ever
// touches documents with isMock:true — anything a real unit created is
// never mutated by this engine. Writes go through Firestore so every
// open tab/page sees the same change via onSnapshot, instead of each
// page silently drifting out of sync with its own local timers.
// =========================================================
import { db } from "./firebase-config.js";
import {
  collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { pick, pickWeighted, chance, triangularMinutes, minutesFromNow, generateCaseId } from "./util.js";

let started = false;
let mockUnits = [];
let mockCalls = [];
let mockRecords = [];

const UNIT_STATUS_CYCLE = ["active", "pending", "info", "offduty"];

const CFS_SPAWN_POOL = [
  { code: "10-56", type: "CIVIL", title: "Suspicious person", descriptions: [
    "Caller reports someone looking into parked cars.", "Unknown subject checking door handles on the block." ] },
  { code: "10-91", type: "EMERGENCY", title: "Open line, disconnected", descriptions: [
    "911 hang-up, callback unsuccessful.", "Open line with background noise, no response to callback." ] },
  { code: "10-16", type: "CIVIL", title: "Noise complaint", descriptions: [
    "Loud music reported, ongoing for over an hour.", "Neighbor dispute over noise, requesting officer presence." ] },
  { code: "10-31", type: "EMERGENCY", title: "Alarm - commercial", descriptions: [
    "Burglar alarm activation, cause unknown.", "Panic alarm triggered, no verbal contact with keyholder." ] },
  { code: "10-50", type: "EMERGENCY", title: "Traffic collision, property damage", descriptions: [
    "Two-vehicle collision, no injuries reported.", "Single vehicle struck a fixed object." ] }
];
const CFS_LOCATIONS = ["Saginaw St / Court St", "Miller Rd / Linden Rd", "Corunna Rd / Ballenger Hwy", "Dort Hwy / Averill Ave", "Fenton Rd", "Robert T. Longway Blvd", "I-475 near Robert T. Longway", "Hurley Medical Center"];

const FIELD_SPAWN_POOL = [
  { code: "10-50", title: "Traffic stop", descriptions: ["Speed enforcement stop.", "Equipment violation stop.", "Stop sign violation."] },
  { code: "10-90b", title: "Foot patrol", descriptions: ["Directed foot patrol.", "Business-check foot patrol."] },
  { code: "10-38", title: "Traffic stop - registration", descriptions: ["Plate return shows expired registration."] }
];

function collRef(name) { return collection(db, name); }

function listenMock(name, target) {
  const q = query(collRef(name), where("isMock", "==", true));
  return onSnapshot(q, snap => {
    target.length = 0;
    snap.docs.forEach(d => target.push({ id: d.id, ...d.data() }));
  }, () => {});
}

async function tickUnits() {
  if (!mockUnits.length || !chance(0.35)) return;
  const u = pick(mockUnits);
  const next = pick(UNIT_STATUS_CYCLE.filter(s => s !== u.status));
  try { await updateDoc(doc(db, "units", u.id), { status: next, updatedAt: serverTimestamp() }); } catch {}
}

async function tickCalls() {
  // Resolve one aging mock call occasionally.
  const open = mockCalls.filter(c => c.status !== "closed");
  if (open.length && chance(0.2)) {
    const c = pick(open);
    try { await updateDoc(doc(db, "calls", c.id), { status: "closed", updatedAt: serverTimestamp() }); } catch {}
  }
  // Spawn a new one occasionally, keeping total mock call volume reasonable.
  if (open.length < 10 && chance(0.25)) {
    const kind = pickWeighted([["cfs", 3], ["field", 2]]);
    const tpl = kind === "cfs" ? pick(CFS_SPAWN_POOL) : pick(FIELD_SPAWN_POOL);
    const data = {
      kind, code: tpl.code, title: tpl.title,
      type: kind === "cfs" ? tpl.type : undefined,
      caller: kind === "cfs" ? pick(["Anonymous caller", "Concerned resident", "Business owner", "Passerby"]) : undefined,
      address: kind === "cfs" ? pick(CFS_LOCATIONS) : pick(CFS_LOCATIONS),
      postal: String(Math.floor(100 + Math.random() * 800)),
      description: pick(tpl.descriptions),
      units: [], status: "pending", priority: pickWeighted([["low", 3], ["medium", 4], ["high", 2]]),
      isMock: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    try { await addDoc(collRef("calls"), data); } catch {}
  }
}

async function tickRecords() {
  const now = Date.now();
  const due = mockRecords.filter(r => (r.nextSimAt || 0) <= now);
  for (const r of due.slice(0, 2)) {
    // Warrants/orders/licenses re-verify on a long, weighted-random cadence —
    // usually ~45min, sometimes much sooner, occasionally much later.
    const nextMinutes = triangularMinutes(5, 45, 150);
    const patch = { updatedAt: serverTimestamp(), nextSimAt: minutesFromNow(nextMinutes) };
    // Very rarely, an active record resolves (warrant served, vehicle recovered, etc).
    if (r.status === "active" && chance(0.04)) {
      patch.status = "cleared";
    }
    try { await updateDoc(doc(db, "records", r.id), patch); } catch {}
  }
}

export function startSimEngine() {
  if (started) return;
  started = true;
  listenMock("units", mockUnits);
  listenMock("calls", mockCalls);
  listenMock("records", mockRecords);

  // Staggered intervals so every tick doesn't fire in lockstep.
  setInterval(tickUnits, 25000);
  setInterval(tickCalls, 40000);
  setInterval(tickRecords, 60000);
}
