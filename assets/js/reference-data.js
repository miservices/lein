// =========================================================
// LEIN — charge & citation reference data, sourced straight from
// assets/data/Charges.xml and assets/data/Citations.xml.
//
// These XML files are the source of truth — edit them directly to add
// more charges/citations. This module parses them and syncs the result
// into Firestore's chargeCodes/citationCodes collections, which is what
// the Reports and Citations pages actually search against.
//
// IMPORTANT: this sync is gated by its OWN version doc (_meta/referenceData),
// completely separate from the mock-data seed gate in seeder.js. The mock
// data only ever seeds once ever — but this reference data needs to be able
// to re-sync whenever the XML changes, even on a project that was already
// seeded long ago. Bump DATA_VERSION below any time you edit the XML files
// and want the change picked up.
// =========================================================
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const DATA_VERSION = 1;

function attr(el, name) {
  const v = el.getAttribute(name);
  if (v === null) return null;
  if (v === "life") return "life";
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

// Splits "Reckless Driving (MCL 257.626)" into name + statute, correctly
// handling statutes that themselves contain parentheses, e.g.
// "Fleeing & Eluding... (MCL 257.602a(2))" -> statute "MCL 257.602a(2)".
export function splitNameStatute(full) {
  full = (full || "").trim();
  if (!full.endsWith(")")) return { shortName: full, statute: "" };
  let depth = 0;
  for (let i = full.length - 1; i >= 0; i--) {
    if (full[i] === ")") depth++;
    else if (full[i] === "(") {
      depth--;
      if (depth === 0) {
        return { shortName: full.slice(0, i).trim(), statute: full.slice(i + 1, full.length - 1).trim() };
      }
    }
  }
  return { shortName: full, statute: "" };
}

export function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "").slice(0, 140) || "item";
}

function fineDisplay(fine, fineK) {
  if (fineK !== null && fineK !== undefined) return `$${(fineK * 1000).toLocaleString()}`;
  if (fine !== null && fine !== undefined) return `$${Number(fine).toLocaleString()}`;
  return null;
}

// A short, human-readable exposure summary — used to prefill the
// "punishment" field on the arrest form so the officer isn't starting
// from a blank box, and to show useful context in the search dropdown.
export function summarizeExposure(c) {
  const parts = [];
  if (c.fineDisplay) parts.push(`up to ${c.fineDisplay} fine`);
  if (c.minYears !== null || c.maxYears !== null) {
    const lo = c.minYears ?? 0, hi = c.maxYears === "life" ? "life" : (c.maxYears ?? lo);
    parts.push(hi === "life" ? "up to life in prison" : `${lo}-${hi} yr${hi === 1 ? "" : "s"} prison`);
  } else if (c.minMonths !== null || c.maxMonths !== null) {
    const lo = c.minMonths ?? 0, hi = c.maxMonths ?? lo;
    parts.push(`${lo}-${hi} mo. jail`);
  }
  if (c.suspChance) parts.push(`license suspension possible (${c.suspChance}%)`);
  if (c.revokeChance) parts.push(`license revocation possible (${c.revokeChance}%)`);
  return parts.join(", ") || "No statutory penalty data on file.";
}

async function fetchXML(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch ${url}: ${res.status}`);
  const text = await res.text();
  return new DOMParser().parseFromString(text, "application/xml");
}

export async function loadChargesFromXML(url = "assets/data/Charges.xml") {
  const xml = await fetchXML(url);
  const out = [];
  for (const g of Array.from(xml.getElementsByTagName("ChargeGroup"))) {
    const category = g.getAttribute("name") || "";
    for (const c of Array.from(g.getElementsByTagName("Charge"))) {
      const full = c.getAttribute("name") || "";
      const { shortName, statute } = splitNameStatute(full);
      const fine = attr(c, "fine"), fineK = attr(c, "fine_k");
      const minYears = attr(c, "min_years"), maxYears = attr(c, "max_years");
      const minMonths = attr(c, "min_months"), maxMonths = attr(c, "max_months");
      const entry = {
        name: shortName, fullName: full, statute, category,
        traffic: c.getAttribute("traffic") === "true",
        canBeWarrant: c.getAttribute("can_be_warrant") !== "false",
        fine, fineK, fineDisplay: fineDisplay(fine, fineK),
        suspChance: attr(c, "susp_chance"), minSusp: attr(c, "min_susp"), maxSusp: attr(c, "max_susp"),
        revokeChance: attr(c, "revoke_chance"), probationChance: attr(c, "probation_chance"),
        minMonths, maxMonths, minYears, maxYears,
        classification: (minYears !== null || maxYears !== null) ? "Felony" : "Misdemeanor"
      };
      entry.exposure = summarizeExposure(entry);
      out.push(entry);
    }
  }
  return out;
}

export async function loadCitationsFromXML(url = "assets/data/Citations.xml") {
  const xml = await fetchXML(url);
  const out = [];
  for (const g of Array.from(xml.getElementsByTagName("CitationGroup"))) {
    const category = g.getAttribute("name") || "";
    for (const c of Array.from(g.getElementsByTagName("Citation"))) {
      const full = c.getAttribute("name") || "";
      const { shortName, statute } = splitNameStatute(full);
      const arrestable = c.getAttribute("arrestable") === "true";
      const fine = attr(c, "fine");
      out.push({
        violation: shortName, fullName: full, statute, category, arrestable,
        classification: arrestable ? "Misdemeanor" : "Civil Infraction",
        fine, fineDisplay: fineDisplay(fine, null)
      });
    }
  }
  return out;
}

export async function syncReferenceData() {
  const metaRef = doc(db, "_meta", "referenceData");
  try {
    const snap = await getDoc(metaRef);
    if (snap.exists() && snap.data().version === DATA_VERSION) return; // already current
  } catch (err) {
    console.warn("[LEIN] Could not check reference-data version — skipping sync this load.", err.message);
    return;
  }

  try {
    const [charges, citations] = await Promise.all([loadChargesFromXML(), loadCitationsFromXML()]);
    await Promise.all([
      ...charges.map(c => setDoc(doc(db, "chargeCodes", slugify(c.fullName)), { ...c, updatedAt: serverTimestamp() })),
      ...citations.map(c => setDoc(doc(db, "citationCodes", slugify(c.fullName)), { ...c, updatedAt: serverTimestamp() }))
    ]);
    await setDoc(metaRef, { version: DATA_VERSION, chargeCount: charges.length, citationCount: citations.length, syncedAt: serverTimestamp() });
    console.info(`[LEIN] Synced ${charges.length} charges and ${citations.length} citations from XML.`);
  } catch (err) {
    console.warn("[LEIN] Reference data sync failed — will retry next load.", err);
  }
}