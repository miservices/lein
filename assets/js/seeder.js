// =========================================================
// LEIN — one-time mock data seeder.
// Runs on every page load but only actually writes once: it checks a
// `_meta/seed` doc first. If you want to add MORE mock data, easiest
// is to just add documents straight into Firestore (tag them isMock:true)
// — you don't need to touch this file or re-run it.
// =========================================================
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { generateCaseId } from "./util.js";
import {
  seedUnits, seedGroups, seedPeople, seedVehicles, seedCalls,
  seedReports, seedCitations, seedBolos, seedRecords,
  seedChargeCodes, seedCitationCodes
} from "./seed-data.js";

const usedIds = new Set();
function caseId() {
  let id;
  do { id = generateCaseId(); } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

async function put(collectionName, id, data) {
  await setDoc(doc(db, collectionName, id), {
    ...data, isMock: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return id;
}

export async function bootstrapMockData() {
  const metaRef = doc(db, "_meta", "seed");
  let alreadySeeded = false;
  try {
    const metaSnap = await getDoc(metaRef);
    alreadySeeded = metaSnap.exists();
  } catch (err) {
    console.warn("[LEIN] Could not check seed status — skipping auto-seed this load.", err.message);
    return;
  }
  if (alreadySeeded) return;

  try {
    // Units + groups (no cross-links needed)
    for (const u of seedUnits) await put("units", caseId(), u);
    for (const g of seedGroups) await put("groups", caseId(), g);

    // People first, so we know their real Firestore ids before writing
    // anything that links to them.
    const personIdMap = {};
    for (const p of seedPeople) {
      const { _id, ...data } = p;
      personIdMap[_id] = await put("people", caseId(), { ...data, linkedVehicleIds: [] });
    }

    // Vehicles, resolving registeredOwnerPersonId + linkedPersonIds
    const vehicleIdMap = {};
    for (const v of seedVehicles) {
      const { _id, registeredOwnerPersonId, ...data } = v;
      const ownerId = registeredOwnerPersonId ? personIdMap[registeredOwnerPersonId] : null;
      vehicleIdMap[_id] = await put("vehicles", caseId(), {
        ...data, registeredOwnerPersonId: ownerId, linkedPersonIds: ownerId ? [ownerId] : []
      });
    }
    // Now backfill each owner's linkedVehicleIds.
    for (const v of seedVehicles) {
      if (!v.registeredOwnerPersonId) continue;
      const personRealId = personIdMap[v.registeredOwnerPersonId];
      const vehicleRealId = vehicleIdMap[v._id];
      const pRef = doc(db, "people", personRealId);
      const pSnap = await getDoc(pRef);
      const existing = pSnap.exists() ? (pSnap.data().linkedVehicleIds || []) : [];
      await setDoc(pRef, { linkedVehicleIds: Array.from(new Set([...existing, vehicleRealId])), updatedAt: serverTimestamp() }, { merge: true });
    }

    // Calls — use a real case id as the doc id itself so /calls/#<id> works directly.
    for (const c of seedCalls) {
      const { _id, ...data } = c;
      await put("calls", caseId(), data);
    }

    // Reports
    for (const r of seedReports) {
      const { _id, linkedPersonIds = [], linkedVehicleIds = [], ...data } = r;
      await put("reports", caseId(), {
        ...data,
        linkedPersonIds: linkedPersonIds.map(pid => personIdMap[pid]).filter(Boolean),
        linkedVehicleIds: linkedVehicleIds.map(vid => vehicleIdMap[vid]).filter(Boolean),
        linkedReportIds: [], linkedCitationIds: []
      });
    }

    // Citations
    for (const c of seedCitations) {
      const { _id, personId, vehicleId, ...data } = c;
      await put("citations", caseId(), {
        ...data,
        personId: personId ? personIdMap[personId] : null,
        vehicleId: vehicleId ? vehicleIdMap[vehicleId] : null
      });
    }

    // BOLOs
    for (const b of seedBolos) {
      const { _id, personId, vehicleId, ...data } = b;
      await put("bolos", caseId(), {
        ...data,
        personId: personId ? personIdMap[personId] : null,
        vehicleId: vehicleId ? vehicleIdMap[vehicleId] : null
      });
    }

    // Records (warrants, court orders, probation, parole, licenses, stolen vehicles)
    for (const r of seedRecords) {
      const { _id, personId, vehicleId, ...data } = r;
      await put("records", caseId(), {
        ...data,
        personId: personId ? personIdMap[personId] : null,
        vehicleId: vehicleId ? vehicleIdMap[vehicleId] : null,
        nextSimAt: Date.now() + Math.round(1000 * 60 * (10 + Math.random() * 60))
      });
    }

    await setDoc(metaRef, { seededAt: serverTimestamp(), version: 1 });

    // Reference data (charge codes, citation codes) isn't roleplay filler —
    // it's real statute data the forms depend on — so it's written as
    // isMock:false directly, without going through put()'s isMock:true tag.
    for (const c of seedChargeCodes) {
      await setDoc(doc(db, "chargeCodes", caseId()), { ...c, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    for (const c of seedCitationCodes) {
      await setDoc(doc(db, "citationCodes", caseId()), { ...c, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }

    console.info("[LEIN] Mock dataset seeded into Firestore.");
  } catch (err) {
    console.warn("[LEIN] Seeding failed partway through — will retry next load.", err);
  }
}