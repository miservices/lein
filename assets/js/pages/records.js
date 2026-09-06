import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import { subscribeRecords, createRecordEntry, updateRecordEntry, isFlagWorthy, fetchAllOnce } from "../data-service.js";
import { renderPersonPicker, renderVehiclePicker, personLabel, vehicleLabel } from "../link-picker.js";
import { esc, fmtAge, fmtDate, COURTS } from "../util.js";
import { currentHash, onHashChange, goTo, takePrefill } from "../router.js";

injectNav("records");
initAuth();

const root = document.getElementById("page-root");
let allRecords = [];
let peopleCache = [];
let vehicleCache = [];

const RECORD_TYPES = [
  { key: "warrant", label: "Warrant" },
  { key: "courtOrder", label: "Court order" },
  { key: "probation", label: "Probation" },
  { key: "parole", label: "Parole" },
  { key: "license", label: "License" },
  { key: "suspension", label: "Suspension" },
  { key: "revocation", label: "Revocation" },
  { key: "stolenVehicle", label: "Stolen vehicle" }
];
const LICENSE_SUBTYPES = ["Driver's License", "Hunting License", "Fishing License", "License To Purchase (LTP)", "Concealed Pistol License (CPL)"];

// Each record type gets its own extra fields — this is what makes a stolen
// vehicle record look completely different from a license record, both on
// the create form and on the detail page, instead of one generic template.
const EXTRA_FIELDS = {
  warrant: [
    { key: "warrantType", label: "Warrant type", type: "select", options: ["Felony", "Misdemeanor"] },
    { key: "warrantNumber", label: "Warrant number", type: "text" }
  ],
  courtOrder: [
    { key: "orderType", label: "Order type", type: "select", options: ["Personal Protection Order", "Restraining Order", "Custody Order", "Other"] },
    { key: "protectedParty", label: "Protected party", type: "text" },
    { key: "expirationDate", label: "Expiration date", type: "date" }
  ],
  probation: [
    { key: "term", label: "Term", type: "text", placeholder: "e.g. 12 months" },
    { key: "supervisingAgency", label: "Supervising agency", type: "text" },
    { key: "endDate", label: "End date", type: "date" }
  ],
  parole: [
    { key: "term", label: "Term", type: "text", placeholder: "e.g. through 2027" },
    { key: "supervisingAgent", label: "Supervising agent", type: "text" },
    { key: "endDate", label: "End date", type: "date" }
  ],
  license: [
    { key: "licenseType", label: "License type", type: "select", options: LICENSE_SUBTYPES },
    { key: "issueDate", label: "Issue date", type: "date" },
    { key: "expirationDate", label: "Expiration date", type: "date" }
  ],
  suspension: [
    { key: "reason", label: "Reason", type: "text" },
    { key: "reinstatementEligible", label: "Reinstatement eligible", type: "text", placeholder: "date, or 'Not eligible'" }
  ],
  revocation: [
    { key: "reason", label: "Reason", type: "text" },
    { key: "reinstatementEligible", label: "Reinstatement eligible", type: "text" }
  ],
  stolenVehicle: [
    { key: "dateReported", label: "Date reported stolen", type: "date" },
    { key: "lastKnownLocation", label: "Last known location", type: "text" }
  ]
};

function typeLabel(t) { return (RECORD_TYPES.find(x => x.key === t) || {}).label || t; }
function statusPill(s) { return `<span class="status ${s === "active" ? "alert" : s === "cleared" ? "active" : "info"}">${s}</span>`; }

function render() {
  const hash = currentHash();
  if (hash === "new") return renderNewForm();
  if (hash === "flags") return renderList(null, true);
  const found = allRecords.find(r => r.id === hash);
  if (found) return renderDetail(found);
  renderList(null, false);
}

function renderList(typeFilter, flagsOnly) {
  let rows = allRecords;
  if (flagsOnly) rows = rows.filter(isFlagWorthy);
  if (typeFilter) rows = rows.filter(r => r.recordType === typeFilter);
  rows = [...rows].sort((a, b) => (a.status === "cleared") - (b.status === "cleared"));

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Records</h1><div class="sub">${flagsOnly ? "Active flags — warrants, orders, suspensions, stolen vehicles." : "Warrants, court orders, probation, parole, licenses, and stolen vehicles."}</div></div>
      <div class="spacer"></div>
      <button id="new-btn">+ New record</button>
    </div>
    <div class="tabbar" id="type-tabs">
      <button data-type="" class="${!typeFilter && !flagsOnly ? "active" : ""}">All</button>
      <button data-type="flags" class="${flagsOnly ? "active" : ""}">Active flags</button>
      ${RECORD_TYPES.map(t => `<button data-type="${t.key}" class="${typeFilter === t.key ? "active" : ""}">${t.label}</button>`).join("")}
    </div>
    <div class="panel"><table>
      <thead><tr><th>Type</th><th>Subject</th><th>Title</th><th>Status</th><th>Updated</th></tr></thead>
      <tbody id="body"></tbody>
    </table></div>`;

  document.getElementById("new-btn").addEventListener("click", () => goTo("new"));
  document.querySelectorAll("#type-tabs button").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.type === "flags") { goTo("flags"); return; }
    if (!b.dataset.type) { goTo(""); return; }
    renderList(b.dataset.type, false);
    document.querySelectorAll("#type-tabs button").forEach(x => x.classList.toggle("active", x === b));
  }));

  const body = document.getElementById("body");
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No matching records.</td></tr>`; return; }
  body.innerHTML = rows.map(r => `
    <tr class="clickable" data-id="${r.id}">
      <td><span class="rtype ${r.recordType}">${esc(typeLabel(r.recordType))}</span></td>
      <td class="strong">${esc(r.personName || r.vehicleLabel || "—")}</td>
      <td class="trunc dim">${esc(r.title)}</td>
      <td>${statusPill(r.status)}</td>
      <td class="dim">${fmtAge(r.updatedAt)}</td>
    </tr>`).join("");
  body.querySelectorAll("tr.clickable").forEach(tr => tr.addEventListener("click", () => goTo(tr.dataset.id)));
}

function extraFieldInput(f, value = "") {
  if (f.type === "select") {
    return `<select id="ef-${f.key}">${f.options.map(o => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  }
  return `<input id="ef-${f.key}" type="${f.type}" value="${esc(value)}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""} />`;
}

async function renderNewForm() {
  const prefill = takePrefill();
  if (!peopleCache.length) peopleCache = await fetchAllOnce("people");
  if (!vehicleCache.length) vehicleCache = await fetchAllOnce("vehicles");

  const draft = { personId: null, personName: null, vehicleId: null, vehicleLabel: null };
  let recordType = prefill?.type === "vehicle" ? "stolenVehicle" : "warrant";

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to records</div>
    ${prefill ? `<div class="prefill-box" id="prefill-box">
      <span>From Lookup — is this record about <strong>${esc(prefill.label)}</strong>?</span>
      <span class="spacer"></span>
      <button type="button" id="prefill-yes" style="width:auto;">Yes, attach</button>
      <button type="button" class="secondary" id="prefill-no" style="width:auto;">Not them</button>
    </div>` : ""}
    <div id="suggestion-slot"></div>
    <div class="panel">
      <div class="panel-head">New record</div>
      <div class="type-picker" id="type-picker">
        ${RECORD_TYPES.map(t => `<button type="button" data-type="${t.key}" class="${t.key === recordType ? "active" : ""}">${t.label}</button>`).join("")}
      </div>
      <div class="form-grid">
        <div id="person-slot"></div>
        <div id="vehicle-slot" style="display:none;"></div>
      </div>
      <div class="chip-row" id="linked-chips"></div>
      <div class="form-grid">
        <div class="field full"><label>Title</label><input id="f-title" placeholder="e.g. Felony warrant - controlled substance" /></div>
        <div class="field full"><label>Description</label><textarea id="f-desc" rows="3"></textarea></div>
      </div>
      <div class="section-title">Type-specific details</div>
      <div class="form-grid" id="extra-fields"></div>
      <div class="form-grid">
        <div class="field"><label>Issuing court (if applicable)</label><input id="f-court" list="court-opts" /><datalist id="court-opts">${COURTS.map(c => `<option value="${c}">`).join("")}</datalist></div>
      </div>
      <div class="form-actions">
        <button class="secondary" id="cancel-btn" type="button">Cancel</button>
        <button id="save-btn" type="button">Create record</button>
      </div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  document.getElementById("cancel-btn").addEventListener("click", () => goTo(""));

  function refreshChips() {
    document.getElementById("linked-chips").innerHTML = [
      draft.personName ? `<span class="chip">${esc(draft.personName)}</span>` : "",
      draft.vehicleLabel ? `<span class="chip">${esc(draft.vehicleLabel)}</span>` : ""
    ].join("");
  }
  function renderExtraFields() {
    const fields = EXTRA_FIELDS[recordType] || [];
    document.getElementById("extra-fields").innerHTML = fields.map(f => `
      <div class="field"><label>${esc(f.label)}</label>${extraFieldInput(f)}</div>`).join("")
      || `<div style="color:var(--text-faint); font-size:12px; padding-bottom:10px;">No additional fields for this record type.</div>`;
  }
  function mountPickers() {
    document.getElementById("person-slot").style.display = recordType === "stolenVehicle" ? "none" : "";
    document.getElementById("vehicle-slot").style.display = recordType === "stolenVehicle" ? "" : "none";
    renderPersonPicker(document.getElementById("person-slot"), peopleCache, (p) => { draft.personId = p.id; draft.personName = personLabel(p); refreshChips(); });
    renderVehiclePicker(document.getElementById("vehicle-slot"), vehicleCache, (v) => { draft.vehicleId = v.id; draft.vehicleLabel = vehicleLabel(v); refreshChips(); });
  }
  mountPickers();
  renderExtraFields();
  refreshChips();

  const prefillYes = document.getElementById("prefill-yes");
  if (prefillYes) prefillYes.addEventListener("click", () => {
    if (prefill.type === "person") { draft.personId = prefill.id; draft.personName = prefill.label; }
    if (prefill.type === "vehicle") { draft.vehicleId = prefill.id; draft.vehicleLabel = prefill.label; }
    refreshChips();
    document.getElementById("prefill-box").remove();
    showSuggestion();
  });
  const prefillNo = document.getElementById("prefill-no");
  if (prefillNo) prefillNo.addEventListener("click", () => document.getElementById("prefill-box").remove());

  function showSuggestion() {
    if (!prefill?.suggestion) return;
    const s = prefill.suggestion;
    document.getElementById("suggestion-slot").innerHTML = `
      <div class="prefill-box" id="suggest-box">
        <span>They also have <strong>${esc(s.label)}</strong> on file — attach that too?</span>
        <span class="spacer"></span>
        <button type="button" id="suggest-yes" style="width:auto;">Yes, attach</button>
        <button type="button" class="secondary" id="suggest-no" style="width:auto;">No thanks</button>
      </div>`;
    document.getElementById("suggest-yes").addEventListener("click", () => {
      if (s.type === "vehicle") { draft.vehicleId = s.id; draft.vehicleLabel = s.label; }
      else { draft.personId = s.id; draft.personName = s.label; }
      refreshChips();
      document.getElementById("suggest-box").remove();
    });
    document.getElementById("suggest-no").addEventListener("click", () => document.getElementById("suggest-box").remove());
  }

  document.querySelectorAll("#type-picker button").forEach(b => b.addEventListener("click", () => {
    recordType = b.dataset.type;
    document.querySelectorAll("#type-picker button").forEach(x => x.classList.toggle("active", x === b));
    mountPickers();
    renderExtraFields();
  }));

  document.getElementById("save-btn").addEventListener("click", async () => {
    const title = document.getElementById("f-title").value.trim();
    if (!title) { alert("Give the record a title."); return; }
    if (recordType === "stolenVehicle" && !draft.vehicleId) { alert("Link a vehicle for a stolen-vehicle record."); return; }
    if (recordType !== "stolenVehicle" && !draft.personId) { alert("Link a person for this record type."); return; }

    const extras = {};
    (EXTRA_FIELDS[recordType] || []).forEach(f => {
      const el = document.getElementById(`ef-${f.key}`);
      if (el) extras[f.key] = el.value.trim ? el.value.trim() : el.value;
    });

    const id = await createRecordEntry({
      recordType, title, description: document.getElementById("f-desc").value.trim(),
      issuingCourt: document.getElementById("f-court").value.trim() || null,
      personId: draft.personId, personName: draft.personName,
      vehicleId: draft.vehicleId, vehicleLabel: draft.vehicleLabel,
      ...extras
    });
    goTo(id);
  });
}

function renderDetail(r) {
  const extras = EXTRA_FIELDS[r.recordType] || [];
  const extraRows = extras.map(f => {
    const val = r[f.key];
    const display = f.type === "date" && val ? fmtDate(new Date(val)) : (val || "—");
    return `<div class="kv"><span class="k">${esc(f.label)}</span><span class="v dim">${esc(display)}</span></div>`;
  }).join("");

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to records</div>
    <div class="detail-head">
      <div class="avatar" style="background:${r.status === "active" ? "var(--alert)" : "var(--blue)"}">${esc(typeLabel(r.recordType)[0])}</div>
      <div class="who">
        <div class="title">${esc(r.title)}</div>
        <div class="meta">${esc(typeLabel(r.recordType))} &middot; ${esc(r.personName || r.vehicleLabel || "—")}</div>
        <div class="case-id">Record #${esc(r.id)}</div>
      </div>
      <div class="detail-actions">${statusPill(r.status)}</div>
    </div>

    <div class="panel">
      <div class="panel-head">${esc(typeLabel(r.recordType))} details</div>
      <div class="kv-grid bordered">
        <div class="kv"><span class="k">Subject</span><span class="v">${r.personId ? `<a href="lookup/#${r.personId}" style="color:var(--blue);">${esc(r.personName)}</a>` : r.vehicleId ? `<a href="lookup/#${r.vehicleId}" style="color:var(--blue);">${esc(r.vehicleLabel)}</a>` : "—"}</span></div>
        <div class="kv"><span class="k">Issuing court</span><span class="v dim">${esc(r.issuingCourt || "—")}</span></div>
        ${extraRows}
      </div>
      <div class="kv-grid" style="padding-top:0;"><div class="kv"><span class="k">Description</span><span class="v dim" style="font-weight:400;">${esc(r.description || "—")}</span></div></div>
      <div class="quick-actions">
        <button class="secondary" data-status="active">Mark active</button>
        <button class="secondary" data-status="cleared">Clear / resolve</button>
      </div>
    </div>`;
  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  root.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", () => updateRecordEntry(r.id, { status: b.dataset.status })));
}

onHashChange(render);
subscribeRecords(rows => { allRecords = rows; render(); });