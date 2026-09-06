import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import {
  subscribeReports, createReport, updateReport, linkReports, subscribeCitations,
  fetchAllOnce, fetchChargeCodes, createPerson, createVehicle
} from "../data-service.js";
import { personLabel, vehicleLabel } from "../link-picker.js";
import {
  esc, fmtAge, fmtDateTime, fmtDate, pick, uid, todayISO, nowTimeHHMM, isJuvenile,
  resolveDepartment, US_STATES, FLINT_ZIPS, DEFAULT_CITY, DEFAULT_STATE, DEFAULT_ZIP,
  LOCATION_TYPES, INCIDENT_TYPES, PERSON_ROLES, DISPOSITIONS, ARREST_TYPES,
  EVIDENCE_DISPOSITIONS, VERDICTS, COURT_JUDGES, COURTS
} from "../util.js";
import { currentHash, onHashChange, goTo, takePrefill } from "../router.js";

injectNav("reports");
initAuth();

const root = document.getElementById("page-root");
let allReports = [];
let allCitations = [];
let peopleCache = [];
let vehicleCache = [];
let unitsCache = [];
let chargeCodesCache = [];

const TYPE_CONFIG = {
  incident: { label: "Incident report", dateLabel: "Date", timeLabel: "Time", officerLabel: "Reporting officer" },
  accident: { label: "Accident report", dateLabel: "Date", timeLabel: "Time", officerLabel: "Reporting officer" },
  writtenWarning: { label: "Written warning", dateLabel: "Date", timeLabel: "Time", officerLabel: "Issuing officer" },
  arrest: { label: "Arrest report", dateLabel: "Arrest date", timeLabel: "Arrest time", officerLabel: "Arresting officer" }
};
function myUnit() { return JSON.parse(localStorage.getItem("lein_active_unit") || "null"); }
function typeLabel(t) { return (TYPE_CONFIG[t] || {}).label || t; }
function statusPill(s) { return `<span class="status ${s === "closed" ? "offduty" : "info"}">${s}</span>`; }

function render() {
  const hash = currentHash();
  if (hash === "new") return renderForm(null);
  if (hash.startsWith("edit-")) {
    const id = hash.slice(5);
    const existing = allReports.find(r => r.id === id);
    if (existing) return renderForm(existing);
  }
  const found = allReports.find(r => r.id === hash);
  if (found) return renderDetail(found);
  renderList();
}

// ==================== LIST ====================
function renderList() {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Reports</h1><div class="sub">Incident, accident, arrest, and written-warning reports — link them to each other, to citations, and to people/vehicles.</div></div>
      <div class="spacer"></div>
      <button id="new-report-btn">+ New report</button>
    </div>
    <div class="panel"><table>
      <thead><tr><th>Case #</th><th>Type</th><th>Title</th><th>Linked to</th><th>Author</th><th>Status</th><th>Age</th></tr></thead>
      <tbody id="reports-body"></tbody>
    </table></div>`;
  document.getElementById("new-report-btn").addEventListener("click", () => goTo("new"));
  const body = document.getElementById("reports-body");
  if (!allReports.length) { body.innerHTML = `<tr class="empty-row"><td colspan="7">No reports yet.</td></tr>`; return; }
  const sorted = [...allReports].sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
  body.innerHTML = sorted.map(r => `
    <tr class="clickable" data-id="${r.id}">
      <td class="dim">${esc(r.id)}</td>
      <td class="dim">${esc(typeLabel(r.type))}</td>
      <td class="trunc strong">${esc(r.title)}</td>
      <td class="trunc dim">${esc([...(r.linkedPersonNames || []), ...(r.linkedVehicleLabels || [])].join(", ") || "—")}</td>
      <td class="dim">${esc(r.officer || r.authorUnit || "—")}</td>
      <td>${statusPill(r.status)}</td>
      <td class="dim">${fmtAge(r.updatedAt)}</td>
    </tr>`).join("");
  body.querySelectorAll("tr.clickable").forEach(tr => tr.addEventListener("click", () => goTo(tr.dataset.id)));
}

// ==================== REPEATABLE CARD BUILDERS ====================
function personCardHTML(entry = {}) {
  return `
    <div class="repeat-card" data-person-id="${entry.personId || ""}">
      <button type="button" class="repeat-remove" data-remove>&times;</button>
      <div class="repeat-title">Person involved</div>
      <div class="form-grid" style="padding:0;">
        <div class="field"><label>Role</label><select data-field="role">${PERSON_ROLES.map(r => `<option ${r === entry.role ? "selected" : ""}>${r}</option>`).join("")}</select></div>
        <div class="field suggest-wrap"><label>First name</label><input data-field="first" value="${esc(entry.first || "")}" autocomplete="off" /><div class="suggest-list" data-suggest style="display:none;"></div></div>
        <div class="field"><label>Middle name</label><input data-field="middle" value="${esc(entry.middle || "")}" /></div>
        <div class="field"><label>Last name</label><input data-field="last" value="${esc(entry.last || "")}" autocomplete="off" /></div>
        <div class="field"><label>Date of birth</label><input type="date" data-field="dob" value="${esc(entry.dob || "")}" /></div>
        <div class="field"><label>Sex</label><select data-field="sex"><option value="" ${!entry.sex ? "selected" : ""}>—</option><option ${entry.sex === "M" ? "selected" : ""}>M</option><option ${entry.sex === "F" ? "selected" : ""}>F</option></select></div>
        <div class="field"><label>Race</label><input data-field="race" value="${esc(entry.race || "")}" /></div>
        <div class="field"><label>Height</label><input data-field="height" value="${esc(entry.height || "")}" /></div>
        <div class="field"><label>Weight</label><input data-field="weight" value="${esc(entry.weight || "")}" /></div>
        <div class="field"><label>Hair</label><input data-field="hairColor" value="${esc(entry.hairColor || "")}" /></div>
        <div class="field"><label>Eyes</label><input data-field="eyeColor" value="${esc(entry.eyeColor || "")}" /></div>
        <div class="field full"><label>Address (optional)</label><input data-field="address" value="${esc(entry.address || "")}" /></div>
        <div class="field"><label>City</label><input data-field="city" value="${esc(entry.city || DEFAULT_CITY)}" /></div>
        <div class="field"><label>State</label><select data-field="state">${US_STATES.map(s => `<option ${s === (entry.state || DEFAULT_STATE) ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Zip</label><select data-field="zip">${FLINT_ZIPS.map(z => `<option ${z === (entry.zip || DEFAULT_ZIP) ? "selected" : ""}>${z}</option>`).join("")}</select></div>
        <div class="field"><label>Phone (optional)</label><input data-field="phone" value="${esc(entry.phone || "")}" /></div>
        <div class="field full"><label>Scars / marks / tattoos</label><input data-field="scarsMarksTattoos" value="${esc(entry.scarsMarksTattoos || "")}" /></div>
      </div>
      <div class="checkbox-group">
        <label class="checkbox-row"><input type="checkbox" data-field="injured" ${entry.injured ? "checked" : ""} /> Injured</label>
      </div>
      <div class="form-grid injury-fields" style="padding-top:0; display:${entry.injured ? "" : "none"};">
        <div class="field"><label>Medical treatment provided?</label><select data-field="medicalTreatment"><option value="false" ${!entry.medicalTreatment ? "selected" : ""}>No</option><option value="true" ${entry.medicalTreatment ? "selected" : ""}>Yes</option></select></div>
        <div class="field"><label>EMS responded?</label><select data-field="emsResponded"><option value="false" ${!entry.emsResponded ? "selected" : ""}>No</option><option value="true" ${entry.emsResponded ? "selected" : ""}>Yes</option></select></div>
        <div class="field"><label>Transported?</label><select data-field="transported"><option value="false" ${!entry.transported ? "selected" : ""}>No</option><option value="true" ${entry.transported ? "selected" : ""}>Yes</option></select></div>
      </div>
      ${entry.personId ? `<div class="matched-tag">Linked to record on file</div>` : ""}
    </div>`;
}
function fillPersonCard(card, p) {
  card.dataset.personId = p.id;
  const set = (f, v) => { const el = card.querySelector(`[data-field="${f}"]`); if (el) el.value = v || ""; };
  set("first", p.first); set("middle", p.middle); set("last", p.last); set("dob", p.dob);
  set("sex", p.sex); set("race", p.race); set("height", p.height); set("weight", p.weight);
  set("hairColor", p.hairColor); set("eyeColor", p.eyeColor); set("address", p.address);
  set("city", p.city || DEFAULT_CITY); set("state", p.state || DEFAULT_STATE); set("zip", p.zip || DEFAULT_ZIP);
  set("phone", p.phone); set("scarsMarksTattoos", p.scarsMarksTattoos);
  if (!card.querySelector(".matched-tag")) {
    const tag = document.createElement("div");
    tag.className = "matched-tag";
    tag.textContent = "Linked to record on file";
    card.appendChild(tag);
  }
}
function wirePersonCard(card) {
  const first = card.querySelector('[data-field="first"]');
  const last = card.querySelector('[data-field="last"]');
  const suggest = card.querySelector('[data-suggest]');
  function doSearch() {
    const t = `${first.value} ${last.value}`.trim().toLowerCase();
    if (t.length < 2) { suggest.style.display = "none"; return; }
    const matches = peopleCache.filter(p => `${p.first} ${p.middle || ""} ${p.last}`.toLowerCase().includes(t)).slice(0, 6);
    if (!matches.length) { suggest.style.display = "none"; return; }
    suggest.style.display = "";
    suggest.innerHTML = matches.map((p, i) => `<div class="suggest-item" data-i="${i}">${esc(personLabel(p))}<div class="si-sub">DOB ${esc(p.dob || "—")}</div></div>`).join("");
    suggest.querySelectorAll(".suggest-item").forEach(el => el.addEventListener("click", () => {
      fillPersonCard(card, matches[el.dataset.i]);
      suggest.style.display = "none";
    }));
  }
  first.addEventListener("input", doSearch);
  last.addEventListener("input", doSearch);
  card.querySelector('[data-field="injured"]').addEventListener("change", e => {
    card.querySelector(".injury-fields").style.display = e.target.checked ? "" : "none";
  });
  card.querySelector("[data-remove]").addEventListener("click", () => card.remove());
}
function readPersonCard(card) {
  const get = f => card.querySelector(`[data-field="${f}"]`)?.value || "";
  const getBool = f => card.querySelector(`[data-field="${f}"]`)?.value === "true";
  const injured = card.querySelector('[data-field="injured"]').checked;
  return {
    personId: card.dataset.personId || null,
    role: get("role"), first: get("first"), middle: get("middle"), last: get("last"),
    dob: get("dob"), sex: get("sex"), race: get("race"), height: get("height"), weight: get("weight"),
    hairColor: get("hairColor"), eyeColor: get("eyeColor"), address: get("address"),
    city: get("city"), state: get("state"), zip: get("zip"), phone: get("phone"),
    scarsMarksTattoos: get("scarsMarksTattoos"),
    injured, medicalTreatment: injured && getBool("medicalTreatment"),
    emsResponded: injured && getBool("emsResponded"), transported: injured && getBool("transported")
  };
}

function vehicleCardHTML(entry = {}) {
  return `
    <div class="repeat-card" data-vehicle-id="${entry.vehicleId || ""}">
      <button type="button" class="repeat-remove" data-remove>&times;</button>
      <div class="repeat-title">Vehicle involved</div>
      <div class="form-grid" style="padding:0;">
        <div class="field suggest-wrap"><label>Plate</label><input data-field="plate" value="${esc(entry.plate || "")}" autocomplete="off" /><div class="suggest-list" data-suggest style="display:none;"></div></div>
        <div class="field"><label>State</label><select data-field="state">${US_STATES.map(s => `<option ${s === (entry.state || DEFAULT_STATE) ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Year</label><input data-field="year" value="${esc(entry.year || "")}" /></div>
        <div class="field"><label>Make</label><input data-field="make" value="${esc(entry.make || "")}" /></div>
        <div class="field"><label>Model</label><input data-field="model" value="${esc(entry.model || "")}" /></div>
        <div class="field"><label>Color</label><input data-field="color" value="${esc(entry.color || "")}" /></div>
        <div class="field full"><label>Owner</label><input data-field="owner" value="${esc(entry.owner || "")}" placeholder="Name (link a person above if they're already listed)" /></div>
      </div>
      ${entry.vehicleId ? `<div class="matched-tag">Linked to record on file</div>` : ""}
    </div>`;
}
function fillVehicleCard(card, v) {
  card.dataset.vehicleId = v.id;
  const set = (f, val) => { const el = card.querySelector(`[data-field="${f}"]`); if (el) el.value = val || ""; };
  set("plate", v.plate); set("state", v.state || DEFAULT_STATE); set("year", v.year);
  set("make", v.make); set("model", v.model); set("color", v.color);
  if (!card.querySelector(".matched-tag")) {
    const tag = document.createElement("div");
    tag.className = "matched-tag";
    tag.textContent = "Linked to record on file";
    card.appendChild(tag);
  }
}
function wireVehicleCard(card) {
  const plate = card.querySelector('[data-field="plate"]');
  const suggest = card.querySelector('[data-suggest]');
  plate.addEventListener("input", () => {
    const t = plate.value.trim().toLowerCase();
    if (t.length < 2) { suggest.style.display = "none"; return; }
    const matches = vehicleCache.filter(v => (v.plate || "").toLowerCase().includes(t)).slice(0, 6);
    if (!matches.length) { suggest.style.display = "none"; return; }
    suggest.style.display = "";
    suggest.innerHTML = matches.map((v, i) => `<div class="suggest-item" data-i="${i}">${esc(vehicleLabel(v))}</div>`).join("");
    suggest.querySelectorAll(".suggest-item").forEach(el => el.addEventListener("click", () => {
      fillVehicleCard(card, matches[el.dataset.i]);
      suggest.style.display = "none";
    }));
  });
  card.querySelector("[data-remove]").addEventListener("click", () => card.remove());
}
function readVehicleCard(card) {
  const get = f => card.querySelector(`[data-field="${f}"]`)?.value || "";
  return {
    vehicleId: card.dataset.vehicleId || null,
    plate: get("plate"), state: get("state"), year: get("year"),
    make: get("make"), model: get("model"), color: get("color"), owner: get("owner")
  };
}

function evidenceCardHTML(entry = {}) {
  return `
    <div class="repeat-card">
      <button type="button" class="repeat-remove" data-remove>&times;</button>
      <div class="repeat-title">Evidence item</div>
      <div class="form-grid" style="padding:0;">
        <div class="field"><label>Quantity</label><input data-field="quantity" value="${esc(entry.quantity || "")}" /></div>
        <div class="field full"><label>Description</label><input data-field="description" value="${esc(entry.description || "")}" /></div>
        <div class="field"><label>Serial number</label><input data-field="serialNumber" value="${esc(entry.serialNumber || "")}" /></div>
        <div class="field"><label>Disposition</label><select data-field="disposition">${EVIDENCE_DISPOSITIONS.map(d => `<option ${d === entry.disposition ? "selected" : ""}>${d}</option>`).join("")}</select></div>
      </div>
    </div>`;
}
function wireEvidenceCard(card) { card.querySelector("[data-remove]").addEventListener("click", () => card.remove()); }
function readEvidenceCard(card) {
  const get = f => card.querySelector(`[data-field="${f}"]`)?.value || "";
  return { quantity: get("quantity"), description: get("description"), serialNumber: get("serialNumber"), disposition: get("disposition") };
}

function chargeCardHTML(entry = {}) {
  return `
    <div class="repeat-card" data-charge-name="${esc(entry.name || "")}">
      <button type="button" class="repeat-remove" data-remove>&times;</button>
      <div class="repeat-title">Charge</div>
      <div class="form-grid" style="padding:0;">
        <div class="field full suggest-wrap"><label>Charge (search database)</label><input data-field="search" value="${esc(entry.name || "")}" autocomplete="off" /><div class="suggest-list" data-suggest style="display:none;"></div></div>
        <div class="field"><label>Statute</label><input data-field="statute" value="${esc(entry.statute || "")}" readonly /></div>
        <div class="field"><label>Classification</label><input data-field="classification" value="${esc(entry.classification || "")}" readonly /></div>
        <div class="field"><label>Verdict</label><select data-field="verdict">${VERDICTS.map(v => `<option ${v === (entry.verdict || "Pending") ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div class="field full"><label>Punishment / sentence</label><input data-field="punishment" value="${esc(entry.punishment || "")}" placeholder="e.g. 90 days, $500 fine" /></div>
      </div>
    </div>`;
}
function wireChargeCard(card) {
  const search = card.querySelector('[data-field="search"]');
  const suggest = card.querySelector('[data-suggest]');
  search.addEventListener("input", () => {
    const t = search.value.trim().toLowerCase();
    if (!t) { suggest.style.display = "none"; return; }
    const matches = chargeCodesCache.filter(c => c.name.toLowerCase().includes(t) || (c.statute || "").toLowerCase().includes(t)).slice(0, 6);
    if (!matches.length) { suggest.style.display = "none"; return; }
    suggest.style.display = "";
    suggest.innerHTML = matches.map((c, i) => `<div class="suggest-item" data-i="${i}">${esc(c.name)}<div class="si-sub">${esc(c.statute)} &middot; ${esc(c.classification)}</div></div>`).join("");
    suggest.querySelectorAll(".suggest-item").forEach(el => el.addEventListener("click", () => {
      const c = matches[el.dataset.i];
      card.dataset.chargeName = c.name;
      search.value = c.name;
      card.querySelector('[data-field="statute"]').value = c.statute;
      card.querySelector('[data-field="classification"]').value = c.classification;
      suggest.style.display = "none";
    }));
  });
  card.querySelector("[data-remove]").addEventListener("click", () => card.remove());
}
function readChargeCard(card) {
  const get = f => card.querySelector(`[data-field="${f}"]`)?.value || "";
  return {
    name: card.dataset.chargeName || get("search"), statute: get("statute"),
    classification: get("classification"), verdict: get("verdict"), punishment: get("punishment")
  };
}

function addCard(listEl, html, wireFn) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  const card = wrap.firstElementChild;
  listEl.appendChild(card);
  wireFn(card);
}

// ==================== FORM (create + edit) ====================
async function renderForm(existing) {
  const isEdit = !!existing;
  const prefill = isEdit ? null : takePrefill();

  if (!peopleCache.length) peopleCache = await fetchAllOnce("people");
  if (!vehicleCache.length) vehicleCache = await fetchAllOnce("vehicles");
  if (!unitsCache.length) unitsCache = await fetchAllOnce("units");
  if (!chargeCodesCache.length) chargeCodesCache = await fetchChargeCodes();

  const unit = myUnit();
  let type = existing?.type || "incident";
  const cfg = () => TYPE_CONFIG[type];

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; ${isEdit ? "Back to report" : "Back to reports"}</div>
    ${prefill ? `<div class="prefill-box" id="prefill-box">
      <span>From Lookup — is this report about <strong>${esc(prefill.label)}</strong>?</span>
      <span class="spacer"></span>
      <button type="button" id="prefill-yes" style="width:auto;">Yes, attach</button>
      <button type="button" class="secondary" id="prefill-no" style="width:auto;">Not them</button>
    </div>` : ""}
    <div id="suggestion-slot"></div>

    <div class="panel">
      <div class="panel-head">${isEdit ? `Editing — ${esc(typeLabel(type))}` : "New report"}</div>
      ${isEdit ? "" : `<div class="type-picker" id="type-picker">
        ${Object.keys(TYPE_CONFIG).map(t => `<button type="button" data-type="${t}" class="${t === type ? "active" : ""}">${TYPE_CONFIG[t].label}</button>`).join("")}
      </div>`}

      <div class="section-title">Report details</div>
      <div class="form-grid">
        <div class="field full"><label>Title</label><input id="f-title" value="${esc(existing?.title || "")}" placeholder="Short summary of the report" /></div>
        <div class="field"><label id="date-label">${cfg().dateLabel}</label><input id="f-date" type="date" value="${existing?.date || todayISO()}" /></div>
        <div class="field"><label id="time-label">${cfg().timeLabel}</label><input id="f-time" type="time" value="${existing?.time || nowTimeHHMM()}" /></div>
        <div class="field"><label>Reporting agency</label><input id="f-agency" value="${esc(existing?.agency || (unit ? resolveDepartment(unit.department).name : ""))}" /></div>
        <div class="field"><label id="officer-label">${cfg().officerLabel}</label><input id="f-officer" value="${esc(existing?.officer || (unit ? `${unit.name} (${unit.unitNumber})` : ""))}" /></div>
        <div class="field full suggest-wrap"><label>Assisting officer(s)</label><input id="f-assist-search" placeholder="Search units..." autocomplete="off" /><div class="suggest-list" id="assist-suggest" style="display:none;"></div></div>
        <div class="chip-row" id="assist-chips" style="padding:0 0 10px;"></div>
      </div>

      <div class="section-title">Location</div>
      <div class="form-grid">
        <div class="field"><label>Incident type</label><input id="f-incidenttype" list="incident-type-opts" value="${esc(existing?.incidentType || "")}" /><datalist id="incident-type-opts">${INCIDENT_TYPES.map(t => `<option value="${t}">`).join("")}</datalist></div>
        <div class="field"><label>Location type (optional)</label><select id="f-loctype">${LOCATION_TYPES.map(t => `<option ${t === (existing?.locationType || "") ? "selected" : ""}>${t || "—"}</option>`).join("")}</select></div>
        <div class="field full"><label>Address</label><input id="f-address" value="${esc(existing?.address || "")}" /></div>
        <div class="field"><label>City</label><input id="f-city" value="${esc(existing?.city || DEFAULT_CITY)}" /></div>
        <div class="field"><label>State</label><select id="f-state">${US_STATES.map(s => `<option ${s === (existing?.state || DEFAULT_STATE) ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Zip</label><select id="f-zip">${FLINT_ZIPS.map(z => `<option ${z === (existing?.zip || DEFAULT_ZIP) ? "selected" : ""}>${z}</option>`).join("")}</select></div>
      </div>

      <div class="section-title">People involved</div>
      <div class="repeat-list" id="people-list"></div>
      <div class="repeat-add-row"><button type="button" class="secondary" id="add-person-btn">+ Add person</button></div>

      <div class="section-title">Vehicles involved</div>
      <div class="repeat-list" id="vehicles-list"></div>
      <div class="repeat-add-row"><button type="button" class="secondary" id="add-vehicle-btn">+ Add vehicle</button></div>

      <div class="section-title">Evidence</div>
      <div class="repeat-list" id="evidence-list"></div>
      <div class="repeat-add-row"><button type="button" class="secondary" id="add-evidence-btn">+ Add evidence item</button></div>

      <div id="arrest-section" style="display:${type === "arrest" ? "" : "none"};">
        <div class="section-title">Arrested person</div>
        <div class="repeat-list" id="arrested-list"></div>
        <div class="form-grid" style="padding-top:0;">
          <div class="field"><label>Juvenile?</label><select id="f-juvenile"><option value="auto">Auto (from DOB)</option><option value="true">Yes</option><option value="false">No</option></select></div>
          <div class="field"><label>Arrest type</label><select id="f-arresttype">${ARREST_TYPES.map(t => `<option ${t === (existing?.arrestType || "") ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        </div>

        <div class="section-title">Charges</div>
        <div class="repeat-list" id="charges-list"></div>
        <div class="repeat-add-row"><button type="button" class="secondary" id="add-charge-btn">+ Add charge</button></div>

        <div class="section-title">Use of force</div>
        <div class="form-grid" style="padding-top:0;">
          <div class="field full"><label class="checkbox-row" style="text-transform:none; font-size:12.5px; margin-bottom:8px;"><input type="checkbox" id="f-force" ${existing?.useOfForce ? "checked" : ""} /> Force was used during this arrest</label></div>
          <div class="field full" id="force-narrative-wrap" style="display:${existing?.useOfForce ? "" : "none"};"><label>Use of force narrative</label><textarea id="f-force-narrative" rows="3">${esc(existing?.useOfForceNarrative || "")}</textarea></div>
        </div>

        <div class="section-title">Result</div>
        <div class="form-grid">
          <div class="field"><label>Presiding judge</label><input id="f-judge" value="${esc(existing?.resultJudge || pick(COURT_JUDGES))}" /></div>
          <div class="field"><label>Court</label><input id="f-court" list="court-opts" value="${esc(existing?.resultCourt || pick(COURTS))}" /><datalist id="court-opts">${COURTS.map(c => `<option value="${c}">`).join("")}</datalist></div>
        </div>
      </div>

      <div class="section-title" id="disposition-title" style="display:${type === "arrest" ? "none" : ""};">Disposition</div>
      <div class="form-grid" id="disposition-wrap" style="display:${type === "arrest" ? "none" : ""};">
        <div class="field"><label>Disposition</label><select id="f-disposition">${DISPOSITIONS.map(d => `<option ${d === (existing?.disposition || "Report Only") ? "selected" : ""}>${d}</option>`).join("")}</select></div>
      </div>

      <div class="section-title">Narrative</div>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field full"><textarea id="f-narrative" rows="6" placeholder="Basic facts, witness statements, initial evidence...">${esc(existing?.narrative || "")}</textarea></div>
      </div>

      <div class="section-title">Related reports</div>
      <div class="chip-row" id="related-chips">
        ${(existing?.linkedReportIds || []).map(id => `<span class="chip" data-goto="reports/#${id}">Report #${esc(id)}</span>`).join("")}
      </div>
      <div class="form-grid suggest-wrap" style="padding-top:0;">
        <div class="field full"><input id="f-related-search" placeholder="Search reports to link (e.g. a DUI's incident/accident report)..." autocomplete="off" /><div class="suggest-list" id="related-suggest" style="display:none;"></div></div>
      </div>

      <div class="form-actions">
        <button class="secondary" id="cancel-btn" type="button">Cancel</button>
        <button id="save-btn" type="button">${isEdit ? "Save changes" : "Create report"}</button>
      </div>
    </div>`;

  const goBack = () => isEdit ? goTo(existing.id) : goTo("");
  document.getElementById("back-link").addEventListener("click", goBack);
  document.getElementById("cancel-btn").addEventListener("click", goBack);

  // ---- repeatable lists ----
  const peopleList = document.getElementById("people-list");
  const vehiclesList = document.getElementById("vehicles-list");
  const evidenceList = document.getElementById("evidence-list");
  const arrestedList = document.getElementById("arrested-list");
  const chargesList = document.getElementById("charges-list");

  (existing?.peopleInvolved || []).forEach(p => addCard(peopleList, personCardHTML(p), wirePersonCard));
  (existing?.vehiclesInvolved || []).forEach(v => addCard(vehiclesList, vehicleCardHTML(v), wireVehicleCard));
  (existing?.evidence || []).forEach(e => addCard(evidenceList, evidenceCardHTML(e), wireEvidenceCard));
  if (existing?.arrestedPerson) addCard(arrestedList, personCardHTML(existing.arrestedPerson), wirePersonCard);
  (existing?.charges || []).forEach(c => addCard(chargesList, chargeCardHTML(c), wireChargeCard));

  document.getElementById("add-person-btn").addEventListener("click", () => addCard(peopleList, personCardHTML(), wirePersonCard));
  document.getElementById("add-vehicle-btn").addEventListener("click", () => addCard(vehiclesList, vehicleCardHTML(), wireVehicleCard));
  document.getElementById("add-evidence-btn").addEventListener("click", () => addCard(evidenceList, evidenceCardHTML(), wireEvidenceCard));
  document.getElementById("add-charge-btn").addEventListener("click", () => addCard(chargesList, chargeCardHTML(), wireChargeCard));

  document.getElementById("f-force").addEventListener("change", e => {
    document.getElementById("force-narrative-wrap").style.display = e.target.checked ? "" : "none";
  });

  // ---- assisting officers (multi-select search over units) ----
  const assistChosen = [...(existing?.assistingOfficers || [])];
  function refreshAssistChips() {
    document.getElementById("assist-chips").innerHTML = assistChosen.map((u, i) => `<span class="chip" data-remove-assist="${i}">${esc(u)} &times;</span>`).join("");
    document.querySelectorAll("[data-remove-assist]").forEach(el => el.addEventListener("click", () => {
      assistChosen.splice(Number(el.dataset.removeAssist), 1);
      refreshAssistChips();
    }));
  }
  refreshAssistChips();
  const assistSearch = document.getElementById("f-assist-search");
  const assistSuggest = document.getElementById("assist-suggest");
  assistSearch.addEventListener("input", () => {
    const t = assistSearch.value.trim().toLowerCase();
    if (!t) { assistSuggest.style.display = "none"; return; }
    const matches = unitsCache.filter(u => !assistChosen.includes(`${u.name} (${u.unitNumber})`) &&
      `${u.name} ${u.unitNumber}`.toLowerCase().includes(t)).slice(0, 6);
    if (!matches.length) { assistSuggest.style.display = "none"; return; }
    assistSuggest.style.display = "";
    assistSuggest.innerHTML = matches.map((u, i) => `<div class="suggest-item" data-i="${i}">${esc(u.name)} (${esc(u.unitNumber)})</div>`).join("");
    assistSuggest.querySelectorAll(".suggest-item").forEach(el => el.addEventListener("click", () => {
      assistChosen.push(`${matches[el.dataset.i].name} (${matches[el.dataset.i].unitNumber})`);
      refreshAssistChips();
      assistSearch.value = ""; assistSuggest.style.display = "none";
    }));
  });

  // ---- related reports search ----
  const relatedChosen = [...(existing?.linkedReportIds || [])];
  const relatedSearch = document.getElementById("f-related-search");
  const relatedSuggest = document.getElementById("related-suggest");
  relatedSearch.addEventListener("input", () => {
    const t = relatedSearch.value.trim().toLowerCase();
    if (!t) { relatedSuggest.style.display = "none"; return; }
    const matches = allReports.filter(r => r.id !== existing?.id && !relatedChosen.includes(r.id) && `${r.title} ${r.id}`.toLowerCase().includes(t)).slice(0, 6);
    if (!matches.length) { relatedSuggest.style.display = "none"; return; }
    relatedSuggest.style.display = "";
    relatedSuggest.innerHTML = matches.map((r, i) => `<div class="suggest-item" data-i="${i}">${esc(r.title)}<div class="si-sub">#${esc(r.id)} &middot; ${esc(typeLabel(r.type))}</div></div>`).join("");
    relatedSuggest.querySelectorAll(".suggest-item").forEach(el => el.addEventListener("click", () => {
      const r = matches[el.dataset.i];
      relatedChosen.push(r.id);
      document.getElementById("related-chips").insertAdjacentHTML("beforeend", `<span class="chip">Report #${esc(r.id)} — ${esc(r.title)}</span>`);
      relatedSearch.value = ""; relatedSuggest.style.display = "none";
    }));
  });

  // ---- type switching (create mode only) ----
  function applyTypeUI() {
    document.getElementById("date-label").textContent = cfg().dateLabel;
    document.getElementById("time-label").textContent = cfg().timeLabel;
    document.getElementById("officer-label").textContent = cfg().officerLabel;
    document.getElementById("arrest-section").style.display = type === "arrest" ? "" : "none";
    document.getElementById("disposition-title").style.display = type === "arrest" ? "none" : "";
    document.getElementById("disposition-wrap").style.display = type === "arrest" ? "none" : "";
  }
  const typePicker = document.getElementById("type-picker");
  if (typePicker) typePicker.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    type = b.dataset.type;
    typePicker.querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
    applyTypeUI();
  }));

  // ---- lookup prefill: attach a person/vehicle card automatically, offer the linked one too ----
  function attachPrefillSubject(subj) {
    if (subj.type === "person") {
      const p = peopleCache.find(x => x.id === subj.id);
      addCard(peopleList, personCardHTML(p || { first: subj.label }), wirePersonCard);
      if (p) fillPersonCard(peopleList.lastElementChild, p);
    } else {
      const v = vehicleCache.find(x => x.id === subj.id);
      addCard(vehiclesList, vehicleCardHTML(v || { plate: subj.label }), wireVehicleCard);
      if (v) fillVehicleCard(vehiclesList.lastElementChild, v);
    }
  }
  function showSuggestion() {
    if (!prefill?.suggestion) return;
    const s = prefill.suggestion;
    document.getElementById("suggestion-slot").innerHTML = `
      <div class="prefill-box" id="suggest-box">
        <span>They also have <strong>${esc(s.label)}</strong> on file — add that to this report too?</span>
        <span class="spacer"></span>
        <button type="button" id="suggest-yes" style="width:auto;">Yes, attach</button>
        <button type="button" class="secondary" id="suggest-no" style="width:auto;">No thanks</button>
      </div>`;
    document.getElementById("suggest-yes").addEventListener("click", () => {
      attachPrefillSubject(s);
      document.getElementById("suggest-box").remove();
    });
    document.getElementById("suggest-no").addEventListener("click", () => document.getElementById("suggest-box").remove());
  }
  const prefillYes = document.getElementById("prefill-yes");
  if (prefillYes) prefillYes.addEventListener("click", () => {
    attachPrefillSubject(prefill);
    document.getElementById("prefill-box").remove();
    showSuggestion();
  });
  const prefillNo = document.getElementById("prefill-no");
  if (prefillNo) prefillNo.addEventListener("click", () => document.getElementById("prefill-box").remove());

  // ---- save ----
  document.getElementById("save-btn").addEventListener("click", async () => {
    const title = document.getElementById("f-title").value.trim();
    if (!title) { alert("Give the report a title."); return; }
    const btn = document.getElementById("save-btn");
    btn.disabled = true; btn.textContent = "Saving...";

    // Resolve people involved: create any new ones in the master DB, keep links for matched ones.
    const peopleCards = Array.from(peopleList.children);
    const peopleInvolved = [];
    for (const card of peopleCards) {
      const entry = readPersonCard(card);
      if (!entry.personId && (entry.first || entry.last)) {
        entry.personId = await createPerson({
          first: entry.first, middle: entry.middle, last: entry.last, dob: entry.dob || null,
          sex: entry.sex, race: entry.race, height: entry.height, weight: entry.weight,
          hairColor: entry.hairColor, eyeColor: entry.eyeColor, address: entry.address,
          phone: entry.phone, scarsMarksTattoos: entry.scarsMarksTattoos
        });
      }
      peopleInvolved.push(entry);
    }

    const vehicleCards = Array.from(vehiclesList.children);
    const vehiclesInvolved = [];
    for (const card of vehicleCards) {
      const entry = readVehicleCard(card);
      if (!entry.vehicleId && entry.plate) {
        entry.vehicleId = await createVehicle({
          plate: entry.plate, state: entry.state, year: entry.year, make: entry.make, model: entry.model, color: entry.color
        });
      }
      vehiclesInvolved.push(entry);
    }

    const evidence = Array.from(evidenceList.children).map(readEvidenceCard);

    let arrestedPerson = null;
    let arrestedPersonId = null;
    if (type === "arrest" && arrestedList.children.length) {
      const card = arrestedList.children[0];
      arrestedPerson = readPersonCard(card);
      if (!arrestedPerson.personId && (arrestedPerson.first || arrestedPerson.last)) {
        arrestedPerson.personId = await createPerson({
          first: arrestedPerson.first, middle: arrestedPerson.middle, last: arrestedPerson.last, dob: arrestedPerson.dob || null,
          sex: arrestedPerson.sex, race: arrestedPerson.race, height: arrestedPerson.height, weight: arrestedPerson.weight,
          hairColor: arrestedPerson.hairColor, eyeColor: arrestedPerson.eyeColor, address: arrestedPerson.address,
          phone: arrestedPerson.phone, scarsMarksTattoos: arrestedPerson.scarsMarksTattoos
        });
      }
      const juvenileSel = document.getElementById("f-juvenile").value;
      arrestedPerson.juvenile = juvenileSel === "auto" ? !!isJuvenile(arrestedPerson.dob) : juvenileSel === "true";
      arrestedPersonId = arrestedPerson.personId;
    }
    const charges = type === "arrest" ? Array.from(chargesList.children).map(readChargeCard) : [];

    const allPersonIds = [...peopleInvolved.map(p => p.personId), arrestedPersonId].filter(Boolean);
    const allPersonNames = [...peopleInvolved.map(p => `${p.last}, ${p.first}`.trim()), arrestedPerson ? `${arrestedPerson.last}, ${arrestedPerson.first}`.trim() : null].filter(Boolean);
    const allVehicleIds = vehiclesInvolved.map(v => v.vehicleId).filter(Boolean);
    const allVehicleLabels = vehiclesInvolved.map(v => `${v.plate} - ${v.color || ""} ${v.make || ""} ${v.model || ""}`.replace(/\s+/g, " ").trim()).filter(Boolean);

    const payload = {
      type, title,
      date: document.getElementById("f-date").value, time: document.getElementById("f-time").value,
      agency: document.getElementById("f-agency").value.trim(), officer: document.getElementById("f-officer").value.trim(),
      assistingOfficers: assistChosen,
      incidentType: document.getElementById("f-incidenttype").value.trim(),
      locationType: document.getElementById("f-loctype").value === "—" ? "" : document.getElementById("f-loctype").value,
      address: document.getElementById("f-address").value.trim(),
      city: document.getElementById("f-city").value.trim(), state: document.getElementById("f-state").value,
      zip: document.getElementById("f-zip").value,
      peopleInvolved, vehiclesInvolved, evidence,
      narrative: document.getElementById("f-narrative").value.trim(),
      disposition: type === "arrest" ? "Arrest" : document.getElementById("f-disposition").value,
      authorUnit: unit ? unit.unitNumber : "Unknown",
      linkedPersonIds: allPersonIds, linkedPersonNames: allPersonNames,
      linkedVehicleIds: allVehicleIds, linkedVehicleLabels: allVehicleLabels,
      linkedReportIds: relatedChosen
    };
    if (type === "arrest") {
      Object.assign(payload, {
        arrestedPerson, arrestType: document.getElementById("f-arresttype").value, charges,
        useOfForce: document.getElementById("f-force").checked,
        useOfForceNarrative: document.getElementById("f-force-narrative")?.value.trim() || "",
        resultJudge: document.getElementById("f-judge").value.trim(), resultCourt: document.getElementById("f-court").value.trim()
      });
    }

    if (isEdit) {
      await updateReport(existing.id, payload);
      goTo(existing.id);
    } else {
      const id = await createReport({ ...payload, linkedCitationIds: existing?.linkedCitationIds || [], status: "open" });
      goTo(id);
    }
  });
}

// ==================== DETAIL (read-only view) ====================
function renderDetail(r) {
  const citationsOnFile = allCitations.filter(c => (r.linkedCitationIds || []).includes(c.id));

  const peopleHTML = (r.peopleInvolved || []).length ? r.peopleInvolved.map(p => `
    <div class="repeat-card">
      <div class="repeat-title">${esc(p.role || "Person")}${p.personId ? ` <a href="lookup/#${p.personId}" style="color:var(--blue); font-weight:400; text-transform:none;">(view profile)</a>` : ""}</div>
      <div class="kv-grid" style="padding:0;">
        <div class="kv"><span class="k">Name</span><span class="v">${esc(`${p.first || ""} ${p.middle || ""} ${p.last || ""}`.replace(/\s+/g, " ").trim() || "—")}</span></div>
        <div class="kv"><span class="k">DOB</span><span class="v dim">${esc(p.dob || "—")}</span></div>
        <div class="kv"><span class="k">Sex / Race</span><span class="v dim">${esc(p.sex || "—")} / ${esc(p.race || "—")}</span></div>
        <div class="kv"><span class="k">Height / Weight</span><span class="v dim">${esc(p.height || "—")} / ${esc(p.weight || "—")}</span></div>
        <div class="kv"><span class="k">Hair / Eyes</span><span class="v dim">${esc(p.hairColor || "—")} / ${esc(p.eyeColor || "—")}</span></div>
        ${p.address ? `<div class="kv"><span class="k">Address</span><span class="v dim">${esc(p.address)}, ${esc(p.city)} ${esc(p.state)} ${esc(p.zip)}</span></div>` : ""}
        ${p.phone ? `<div class="kv"><span class="k">Phone</span><span class="v dim">${esc(p.phone)}</span></div>` : ""}
        ${p.scarsMarksTattoos ? `<div class="kv"><span class="k">Scars/marks/tattoos</span><span class="v dim">${esc(p.scarsMarksTattoos)}</span></div>` : ""}
        <div class="kv"><span class="k">Injured</span><span class="v dim">${p.injured ? `Yes — Medical: ${p.medicalTreatment ? "Y" : "N"}, EMS: ${p.emsResponded ? "Y" : "N"}, Transported: ${p.transported ? "Y" : "N"}` : "No"}</span></div>
      </div>
    </div>`).join("")
    : (r.linkedPersonIds || []).length
      ? `<div style="padding:14px;"><div class="chip-row" style="padding:0;">${r.linkedPersonIds.map((id, i) => `<span class="chip" data-goto="lookup/#${id}">${esc(r.linkedPersonNames?.[i] || "Person")}</span>`).join("")}</div><div style="color:var(--text-faint); font-size:11px; margin-top:8px;">Filed before detailed involvement fields existed — names only.</div></div>`
      : `<div style="color:var(--text-faint); font-size:12px; padding:14px;">None listed.</div>`;

  const vehiclesHTML = (r.vehiclesInvolved || []).length ? r.vehiclesInvolved.map(v => `
    <div class="repeat-card">
      <div class="repeat-title">Vehicle${v.vehicleId ? ` <a href="lookup/#${v.vehicleId}" style="color:var(--blue); font-weight:400; text-transform:none;">(view profile)</a>` : ""}</div>
      <div class="kv-grid" style="padding:0;">
        <div class="kv"><span class="k">Plate</span><span class="v mono">${esc(v.plate || "—")} (${esc(v.state || "—")})</span></div>
        <div class="kv"><span class="k">Vehicle</span><span class="v dim">${esc(v.year || "")} ${esc(v.color || "")} ${esc(v.make || "")} ${esc(v.model || "")}</span></div>
        ${v.owner ? `<div class="kv"><span class="k">Owner</span><span class="v dim">${esc(v.owner)}</span></div>` : ""}
      </div>
    </div>`).join("")
    : (r.linkedVehicleIds || []).length
      ? `<div style="padding:14px;"><div class="chip-row" style="padding:0;">${r.linkedVehicleIds.map((id, i) => `<span class="chip" data-goto="lookup/#${id}">${esc(r.linkedVehicleLabels?.[i] || "Vehicle")}</span>`).join("")}</div><div style="color:var(--text-faint); font-size:11px; margin-top:8px;">Filed before detailed involvement fields existed — labels only.</div></div>`
      : `<div style="color:var(--text-faint); font-size:12px; padding:14px;">None listed.</div>`;

  const evidenceHTML = (r.evidence || []).map(e => `
    <div class="repeat-card">
      <div class="kv-grid" style="padding:0;">
        <div class="kv"><span class="k">Qty</span><span class="v dim">${esc(e.quantity || "—")}</span></div>
        <div class="kv" style="grid-column: span 2;"><span class="k">Description</span><span class="v dim">${esc(e.description || "—")}</span></div>
        <div class="kv"><span class="k">Serial #</span><span class="v dim">${esc(e.serialNumber || "—")}</span></div>
        <div class="kv"><span class="k">Disposition</span><span class="v dim">${esc(e.disposition || "—")}</span></div>
      </div>
    </div>`).join("") || `<div style="color:var(--text-faint); font-size:12px; padding:14px;">None logged.</div>`;

  const arrestSectionHTML = r.type === "arrest" ? `
    <div class="panel">
      <div class="panel-head">Arrested person</div>
      <div class="repeat-list">
        ${r.arrestedPerson ? `<div class="repeat-card">
          <div class="repeat-title">${r.arrestedPerson.personId ? `<a href="lookup/#${r.arrestedPerson.personId}" style="color:var(--blue); text-transform:none; font-weight:400;">View profile</a>` : ""}</div>
          <div class="kv-grid" style="padding:0;">
            <div class="kv"><span class="k">Name</span><span class="v">${esc(`${r.arrestedPerson.first || ""} ${r.arrestedPerson.last || ""}`.trim())}</span></div>
            <div class="kv"><span class="k">DOB</span><span class="v dim">${esc(r.arrestedPerson.dob || "—")}</span></div>
            <div class="kv"><span class="k">Juvenile</span><span class="v dim">${r.arrestedPerson.juvenile ? "Yes" : "No"}</span></div>
            <div class="kv"><span class="k">Arrest type</span><span class="v dim">${esc(r.arrestType || "—")}</span></div>
          </div>
        </div>` : `<div style="color:var(--text-faint); font-size:12px; padding:14px;">Not recorded.</div>`}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">Charges</div>
      <table>
        <thead><tr><th>Charge</th><th>Statute</th><th>Classification</th><th>Verdict</th><th>Punishment</th></tr></thead>
        <tbody>
          ${(r.charges || []).length ? r.charges.map(c => `<tr><td class="strong">${esc(c.name)}</td><td class="dim">${esc(c.statute)}</td><td class="dim">${esc(c.classification)}</td><td>${esc(c.verdict)}</td><td class="dim">${esc(c.punishment || "—")}</td></tr>`).join("") : `<tr class="empty-row"><td colspan="5">No charges listed.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="panel">
      <div class="panel-head">Use of force</div>
      <div class="kv-grid"><div class="kv" style="grid-column:1/-1;"><span class="v dim" style="font-weight:400;">${r.useOfForce ? esc(r.useOfForceNarrative || "Force used — no narrative on file.") : "No force used."}</span></div></div>
    </div>
    <div class="panel">
      <div class="panel-head">Result</div>
      <div class="kv-grid bordered">
        <div class="kv"><span class="k">Presiding judge</span><span class="v dim">${esc(r.resultJudge || "—")}</span></div>
        <div class="kv"><span class="k">Court</span><span class="v dim">${esc(r.resultCourt || "—")}</span></div>
      </div>
    </div>` : "";

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to reports</div>
    <div class="detail-head">
      <div class="avatar">${esc((r.type || "R")[0].toUpperCase())}</div>
      <div class="who">
        <div class="title">${esc(r.title)}</div>
        <div class="meta">${esc(typeLabel(r.type))} &middot; ${esc(r.officer || r.authorUnit || "—")} &middot; ${r.date ? fmtDate(new Date(r.date)) : fmtDateTime(r.createdAt)}</div>
        <div class="case-id">Report #${esc(r.id)}</div>
      </div>
      <div class="detail-actions">
        ${statusPill(r.status)}
        <button class="secondary" id="edit-btn" style="width:auto;">Edit</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Report details</div>
      <div class="kv-grid bordered">
        <div class="kv"><span class="k">Agency</span><span class="v dim">${esc(r.agency || "—")}</span></div>
        <div class="kv"><span class="k">Assisting officer(s)</span><span class="v dim">${esc((r.assistingOfficers || []).join(", ") || "—")}</span></div>
        <div class="kv"><span class="k">Incident type</span><span class="v dim">${esc(r.incidentType || "—")}</span></div>
        <div class="kv"><span class="k">Location type</span><span class="v dim">${esc(r.locationType || "—")}</span></div>
        <div class="kv" style="grid-column: span 2;"><span class="k">Address</span><span class="v dim">${esc(r.address || "—")}${r.address ? `, ${esc(r.city)} ${esc(r.state)} ${esc(r.zip)}` : ""}</span></div>
      </div>
    </div>

    <div class="panel"><div class="panel-head">Narrative</div>
      <div class="kv-grid"><div class="kv" style="grid-column:1/-1;"><span class="v dim" style="font-weight:400; white-space:pre-wrap;">${esc(r.narrative || "—")}</span></div></div>
      ${r.type !== "arrest" ? `<div class="kv-grid" style="padding-top:0;"><div class="kv"><span class="k">Disposition</span><span class="v">${esc(r.disposition || "—")}</span></div></div>` : ""}
      <div class="quick-actions">
        <button class="secondary" data-status="open">Reopen</button>
        <button class="secondary" data-status="closed">Close report</button>
      </div>
    </div>

    <div class="panel"><div class="panel-head">People involved</div>${peopleHTML}</div>
    <div class="panel"><div class="panel-head">Vehicles involved</div>${vehiclesHTML}</div>
    <div class="panel"><div class="panel-head">Evidence</div>${evidenceHTML}</div>

    ${arrestSectionHTML}

    <div class="panel">
      <div class="panel-head">Linked citations</div>
      <div class="chip-row" style="padding-top:14px;">
        ${citationsOnFile.map(c => `<span class="chip" data-goto="citations/#${c.id}">${esc(c.violation)}</span>`).join("")}
        <span class="chip chip-add" id="add-citation-link">+ Link a citation</span>
      </div>
      <div id="citation-link-panel"></div>
    </div>

    <div class="panel">
      <div class="panel-head">Linked reports</div>
      <div class="chip-row" style="padding-top:14px;">
        ${(r.linkedReportIds || []).map(id => `<span class="chip" data-goto="reports/#${id}">Report #${esc(id)}</span>`).join("")}
        <span class="chip chip-add" id="add-report-link">+ Link another report</span>
      </div>
      <div id="report-link-panel"></div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  document.getElementById("edit-btn").addEventListener("click", () => goTo(`edit-${r.id}`));
  root.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", () => updateReport(r.id, { status: b.dataset.status })));
  root.querySelectorAll("[data-goto]").forEach(el => el.addEventListener("click", () => window.location.href = el.dataset.goto));

  document.getElementById("add-citation-link").addEventListener("click", () => {
    const panel = document.getElementById("citation-link-panel");
    if (panel.childElementCount) { panel.innerHTML = ""; return; }
    panel.innerHTML = `<div class="field full"><label>Search citations</label><input id="cl-search" placeholder="Violation or case #" /><div id="cl-results" style="margin-top:6px;"></div></div>`;
    panel.querySelector("#cl-search").addEventListener("input", (e) => {
      const t = e.target.value.trim().toLowerCase();
      const matches = !t ? [] : allCitations.filter(c => !(r.linkedCitationIds || []).includes(c.id) &&
        `${c.violation} ${c.id}`.toLowerCase().includes(t)).slice(0, 6);
      panel.querySelector("#cl-results").innerHTML = matches.map(c => `<div class="unit-option" data-id="${c.id}" style="margin-bottom:4px;"><div class="who"><div class="n">${esc(c.violation)}</div><div class="d">#${esc(c.id)}</div></div></div>`).join("");
      panel.querySelectorAll("[data-id]").forEach(el => el.addEventListener("click", async () => {
        await updateReport(r.id, { linkedCitationIds: [...(r.linkedCitationIds || []), el.dataset.id] });
        panel.innerHTML = `<div class="banner success">Linked.</div>`;
      }));
    });
  });
  document.getElementById("add-report-link").addEventListener("click", () => {
    const panel = document.getElementById("report-link-panel");
    if (panel.childElementCount) { panel.innerHTML = ""; return; }
    panel.innerHTML = `<div class="field full"><label>Search reports</label><input id="rl-search" placeholder="Title or case #" /><div id="rl-results" style="margin-top:6px;"></div></div>`;
    panel.querySelector("#rl-search").addEventListener("input", (e) => {
      const t = e.target.value.trim().toLowerCase();
      const matches = !t ? [] : allReports.filter(x => x.id !== r.id && !(r.linkedReportIds || []).includes(x.id) &&
        `${x.title} ${x.id}`.toLowerCase().includes(t)).slice(0, 6);
      panel.querySelector("#rl-results").innerHTML = matches.map(x => `<div class="unit-option" data-id="${x.id}" style="margin-bottom:4px;"><div class="who"><div class="n">${esc(x.title)}</div><div class="d">#${esc(x.id)}</div></div></div>`).join("");
      panel.querySelectorAll("[data-id]").forEach(el => el.addEventListener("click", async () => {
        await linkReports(r.id, el.dataset.id);
        panel.innerHTML = `<div class="banner success">Linked.</div>`;
      }));
    });
  });
}

onHashChange(render);
subscribeReports(rows => { allReports = rows; render(); });
subscribeCitations(rows => { allCitations = rows; });