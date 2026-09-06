// =========================================================
// LEIN — central data layer.
// Every page reads/writes through this file. There is exactly one
// way to subscribe to a collection and one way to write to it, so
// "real" and "mock" documents are never handled differently by
// accident — a mock doc is just a normal doc with isMock:true.
// =========================================================
import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  onSnapshot, query, orderBy, limit, where, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { generateCaseId } from "./util.js";

// Human-friendly numeric ids (like a real CAD call number) for anything a
// unit would reference by number: calls, reports, citations, bolos, records.
// People/vehicles use normal Firestore ids since they're found by search,
// not by memorized number. Collision odds are tiny (7 digits) but we check
// Firestore directly rather than trust an in-memory set, since this runs
// across every open browser independently.
export async function uniqueCaseId(collectionName) {
  for (let i = 0; i < 5; i++) {
    const id = generateCaseId();
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) return id;
  }
  return generateCaseId() + Math.floor(Math.random() * 9);
}

// ---------------------------------------------------------
// Generic primitives
// ---------------------------------------------------------
export function subscribeCollection(name, cb, { orderField = "updatedAt", dir = "desc", limitN = 200 } = {}) {
  try {
    const q = query(collection(db, name), orderBy(orderField, dir), limit(limitN));
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })), true);
    }, err => {
      console.warn(`[LEIN] live read failed for "${name}":`, err.message);
      cb([], false);
    });
  } catch (err) {
    console.warn(`[LEIN] subscribe failed for "${name}":`, err);
    cb([], false);
    return () => {};
  }
}

export async function fetchAllOnce(name) {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`[LEIN] fetchAllOnce failed for "${name}":`, err.message);
    return [];
  }
}

export async function getOne(name, id) {
  try {
    const snap = await getDoc(doc(db, name, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn(`[LEIN] getOne failed for "${name}/${id}":`, err.message);
    return null;
  }
}

export async function addOne(name, data, customId = null) {
  const payload = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (customId) {
    await setDoc(doc(db, name, customId), payload);
    return customId;
  }
  const ref = await addDoc(collection(db, name), payload);
  return ref.id;
}

export async function updateOne(name, id, data) {
  await updateDoc(doc(db, name, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteOne(name, id) {
  await deleteDoc(doc(db, name, id));
}

export async function whereEquals(name, field, value) {
  try {
    const q = query(collection(db, name), where(field, "==", value));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`[LEIN] whereEquals failed for "${name}.${field}":`, err.message);
    return [];
  }
}

// For array fields (linkedPersonIds, linkedVehicleIds) — "==" only matches an
// exact array, never membership, so lookups against those fields need this instead.
export async function whereArrayContains(name, field, value) {
  try {
    const q = query(collection(db, name), where(field, "array-contains", value));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`[LEIN] whereArrayContains failed for "${name}.${field}":`, err.message);
    return [];
  }
}

export { serverTimestamp, writeBatch, doc, collection };

// ---------------------------------------------------------
// Units
// ---------------------------------------------------------
export const subscribeUnits = (cb) => subscribeCollection("units", cb, { orderField: "unitNumber", dir: "asc", limitN: 500 });
export const createUnit = (data) => addOne("units", { status: "active", isMock: false, ...data });
export const updateUnitStatus = (id, status) => updateOne("units", id, { status });

// ---------------------------------------------------------
// Calls — unified store. `kind` is "cfs" (call for service, dispatched
// from 911/radio) or "field" (self-initiated activity like a traffic stop).
// Both live in ONE collection and both get the same case-id-based routing
// (/calls/#<id>) so the home page and the Calls page render them identically.
// ---------------------------------------------------------
export const subscribeCalls = (cb) => subscribeCollection("calls", cb, { orderField: "updatedAt", dir: "desc", limitN: 300 });
export async function createCall(data) {
  const id = await uniqueCaseId("calls");
  await addOne("calls", { kind: "cfs", status: "pending", units: [], updates: [], isMock: false, ...data }, id);
  return id;
}
export async function updateCall(id, data) { return updateOne("calls", id, data); }
export async function addCallUpdate(callId, text, byUnit) {
  const c = await getOne("calls", callId);
  if (!c) return;
  const updates = [...(c.updates || []), { text, by: byUnit, at: Date.now() }];
  await updateOne("calls", callId, { updates });
}
export async function joinCall(callId, unitNumber) {
  const c = await getOne("calls", callId);
  if (!c) return;
  const units = Array.from(new Set([...(c.units || []), unitNumber]));
  const updates = [...(c.updates || []), { text: `${unitNumber} joined the call.`, by: unitNumber, at: Date.now() }];
  await updateOne("calls", callId, { units, updates, status: c.status === "pending" ? "active" : c.status });
}

// ---------------------------------------------------------
// Groups (fire/EMS companies, task forces, etc.)
// ---------------------------------------------------------
export const subscribeGroups = (cb) => subscribeCollection("groups", cb, { orderField: "name", dir: "asc", limitN: 100 });

// ---------------------------------------------------------
// People & vehicles — the Lookup / Records backbone
// ---------------------------------------------------------
export const subscribePeople = (cb) => subscribeCollection("people", cb, { orderField: "last", dir: "asc", limitN: 500 });
export const subscribeVehicles = (cb) => subscribeCollection("vehicles", cb, { orderField: "plate", dir: "asc", limitN: 500 });

export async function searchPeople(term) {
  const all = await fetchAllOnce("people");
  const t = term.trim().toLowerCase();
  if (!t) return all;
  return all.filter(p =>
    [p.first, p.middle, p.last, ...(p.akaNames || [])].join(" ").toLowerCase().includes(t) ||
    (p.driverLicenseNumber || "").toLowerCase().includes(t)
  );
}
export async function searchVehicles(term) {
  const all = await fetchAllOnce("vehicles");
  const t = term.trim().toLowerCase();
  if (!t) return all;
  return all.filter(v =>
    (v.plate || "").toLowerCase().includes(t) ||
    `${v.make} ${v.model}`.toLowerCase().includes(t) ||
    (v.color || "").toLowerCase().includes(t)
  );
}

export async function createPerson(data) {
  return addOne("people", {
    akaNames: [], linkedVehicleIds: [], timesStopped: 0,
    driverLicenseStatus: "valid", probation: false, parole: false,
    gunPermitStatus: "none", gunLicenseStatus: "none",
    phone: "", scarsMarksTattoos: "",
    isMock: false, ...data
  });
}
export async function updatePerson(id, data) { return updateOne("people", id, data); }

export async function createVehicle(data) {
  return addOne("vehicles", {
    linkedPersonIds: [], state: "MI", registrationStatus: "valid", insuranceStatus: "valid",
    stolen: false, isMock: false, ...data
  });
}
export async function updateVehicle(id, data) { return updateOne("vehicles", id, data); }

export async function linkPersonVehicle(personId, vehicleId) {
  const [p, v] = await Promise.all([getOne("people", personId), getOne("vehicles", vehicleId)]);
  if (p) await updateOne("people", personId, { linkedVehicleIds: Array.from(new Set([...(p.linkedVehicleIds || []), vehicleId])) });
  if (v) await updateOne("vehicles", vehicleId, { linkedPersonIds: Array.from(new Set([...(v.linkedPersonIds || []), personId])) });
}

// A person's "history" = every report/citation/record that references them,
// pulled together on demand rather than duplicated into the person doc.
export async function getPersonHistory(personId) {
  const [reports, citations, records] = await Promise.all([
    whereArrayContains("reports", "linkedPersonIds", personId),
    whereEquals("citations", "personId", personId),
    whereEquals("records", "personId", personId)
  ]);
  return { reports, citations, records };
}
export async function getVehicleHistory(vehicleId) {
  const [reports, citations, records] = await Promise.all([
    whereArrayContains("reports", "linkedVehicleIds", vehicleId),
    whereEquals("citations", "vehicleId", vehicleId),
    whereEquals("records", "vehicleId", vehicleId)
  ]);
  return { reports, citations, records };
}

// ---------------------------------------------------------
// Reports — incident / accident / arrest / written warning.
// Reports can link to people, vehicles, other reports, and citations.
// ---------------------------------------------------------
export const subscribeReports = (cb) => subscribeCollection("reports", cb, { orderField: "updatedAt", dir: "desc", limitN: 300 });
export async function createReport(data) {
  const id = await uniqueCaseId("reports");
  await addOne("reports", {
    linkedPersonIds: [], linkedVehicleIds: [], linkedReportIds: [], linkedCitationIds: [],
    linkedPersonNames: [], linkedVehicleLabels: [],
    status: "open", isMock: false, ...data
  }, id);
  return id;
}
export async function updateReport(id, data) { return updateOne("reports", id, data); }
export async function linkReports(reportId, otherReportId) {
  const r = await getOne("reports", reportId);
  if (!r) return;
  await updateOne("reports", reportId, { linkedReportIds: Array.from(new Set([...(r.linkedReportIds || []), otherReportId])) });
}

// ---------------------------------------------------------
// Citations — traffic/civil infractions with a court disposition.
// ---------------------------------------------------------
export const subscribeCitations = (cb) => subscribeCollection("citations", cb, { orderField: "updatedAt", dir: "desc", limitN: 300 });
export async function createCitation(data) {
  const id = await uniqueCaseId("citations");
  await addOne("citations", { disposition: "pending", isMock: false, ...data }, id);
  return id;
}
export async function updateCitation(id, data) { return updateOne("citations", id, data); }

// ---------------------------------------------------------
// BOLOs
// ---------------------------------------------------------
export const subscribeBolos = (cb) => subscribeCollection("bolos", cb, { orderField: "updatedAt", dir: "desc", limitN: 200 });
export async function createBolo(data) {
  const id = await uniqueCaseId("bolos");
  await addOne("bolos", { status: "active", isMock: false, ...data }, id);
  return id;
}
export async function updateBolo(id, data) { return updateOne("bolos", id, data); }

// ---------------------------------------------------------
// Records — warrants, court orders, probation, parole, licenses,
// suspensions/revocations, stolen vehicles. One collection, one
// `recordType` field, so Records/Lookup/dashboard all read it the same way.
// The dashboard's "Record flags" panel is just this collection filtered
// to attention-worthy statuses — no separate flags collection to keep in sync.
// ---------------------------------------------------------
export const subscribeRecords = (cb) => subscribeCollection("records", cb, { orderField: "updatedAt", dir: "desc", limitN: 400 });
export async function createRecordEntry(data) {
  const id = await uniqueCaseId("records");
  await addOne("records", {
    status: "active", isMock: false,
    nextSimAt: Date.now() + Math.round(1000 * 60 * (10 + Math.random() * 60)),
    ...data
  }, id);
  return id;
}
export async function updateRecordEntry(id, data) { return updateOne("records", id, data); }

export function isFlagWorthy(rec) {
  // Attention-worthy = the kind of thing a run should surface immediately.
  const alertTypes = ["warrant", "stolenVehicle", "courtOrder", "suspension", "revocation"];
  return alertTypes.includes(rec.recordType) && (rec.status === "active" || rec.status === "alert");
}

// ---------------------------------------------------------
// Reference data — charge codes (for arrest reports) and citation codes
// (for traffic/civil citations). Small, mostly-static lookup tables, seeded
// once like everything else and editable straight in Firestore if you want
// to add more charges/violations later.
// ---------------------------------------------------------
export const fetchChargeCodes = () => fetchAllOnce("chargeCodes");
export const fetchCitationCodes = () => fetchAllOnce("citationCodes");