// One place that knows how to read each Firestore collection and merge it
// with the mock/filler data. Real records always sort above mock records.
// Every subscribe* function returns an unsubscribe function.
import { db } from "./firebase-config.js";
import {
  collection, onSnapshot, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  mockUnits, mockCalls, mockEmergencyCalls, mockRecordFlags, mockGroups
} from "./mock-data.js";

// Merge helper: real records (isMock:false) first, then mock records.
// Within each group, keep whatever order the source gave us.
function mergeRealAboveMock(realDocs, mockRows) {
  const real = realDocs.map(r => ({ ...r, isMock: false }));
  const mock = mockRows.map(m => ({ ...m, isMock: true }));
  return [...real, ...mock];
}

function safeSubscribe(collectionName, mockRows, cb, orderField = "createdAt") {
  try {
    const q = query(collection(db, collectionName), orderBy(orderField, "desc"), limit(50));
    return onSnapshot(
      q,
      snap => {
        const real = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cb(mergeRealAboveMock(real, mockRows), true);
      },
      err => {
        console.warn(`[LEIN] Could not read "${collectionName}" from Firestore — showing mock data only.`, err.message);
        cb(mergeRealAboveMock([], mockRows), false);
      }
    );
  } catch (err) {
    console.warn(`[LEIN] Firestore subscribe failed for "${collectionName}".`, err);
    cb(mergeRealAboveMock([], mockRows), false);
    return () => {};
  }
}

export function subscribeUnits(cb) {
  return safeSubscribe("units", mockUnits, cb);
}
export function subscribeCalls(cb) {
  return safeSubscribe("calls", mockCalls, cb);
}
export function subscribeEmergencyCalls(cb) {
  return safeSubscribe("emergencyCalls", mockEmergencyCalls, cb);
}
export function subscribeRecordFlags(cb) {
  return safeSubscribe("recordFlags", mockRecordFlags, cb);
}
export function subscribeGroups(cb) {
  return safeSubscribe("groups", mockGroups, cb);
}