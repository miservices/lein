import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import { subscribeRecords, createRecordEntry, updateRecordEntry, isFlagWorthy, fetchAllOnce } from "../data-service.js";
import { renderPersonPicker, renderVehiclePicker, personLabel, vehicleLabel } from "../link-picker.js";
import { esc, fmtAge, COURTS } from "../util.js";
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
    // Specific record types filter in place — no separate route needed for these,
    // only "All" and "Active flags" are addressable via the hash.
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
    <div class="panel">
      <div class="panel-head">New record</div>
      <div class="type-picker" id="type-picker">
        ${RECORD_TYPES.map(t => `<button type="button" data-type="${t.key}" class="${t.key === recordType ? "active" : ""}">${t.label}</button>`).join("")}
      </div>
      <div class="form-grid">
        <div id="license-subtype-wrap" class="field" style="display:none;">
          <label>License type</label>
          <select id="f-licensetype">${LICENSE_SUBTYPES.map(l => `<option>${l}</option>`).join("")}</select>
        </div>
        <div id="person-slot"></div>
        <div id="vehicle-slot" style="display:none;"></div>
      </div>
      <div class="chip-row" id="linked-chips"></div>
      <div class="form-grid">
        <div class="field full"><label>Title</label><input id="f-title" placeholder="e.g. Felony warrant - controlled substance" /></div>
        <div class="field full"><label>Description</label><textarea id="f-desc" rows="3"></textarea></div>
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
  function mountPickers() {
    document.getElementById("person-slot").style.display = recordType === "stolenVehicle" ? "none" : "";
    document.getElementById("vehicle-slot").style.display = recordType === "stolenVehicle" ? "" : "none";
    document.getElementById("license-subtype-wrap").style.display = recordType === "license" ? "" : "none";
    renderPersonPicker(document.getElementById("person-slot"), peopleCache, (p) => { draft.personId = p.id; draft.personName = personLabel(p); refreshChips(); });
    renderVehiclePicker(document.getElementById("vehicle-slot"), vehicleCache, (v) => { draft.vehicleId = v.id; draft.vehicleLabel = vehicleLabel(v); refreshChips(); });
  }
  mountPickers();
  refreshChips();

  const prefillYes = document.getElementById("prefill-yes");
  if (prefillYes) prefillYes.addEventListener("click", () => {
    if (prefill.type === "person") { draft.personId = prefill.id; draft.personName = prefill.label; }
    if (prefill.type === "vehicle") { draft.vehicleId = prefill.id; draft.vehicleLabel = prefill.label; }
    refreshChips();
    document.getElementById("prefill-box").remove();
  });
  const prefillNo = document.getElementById("prefill-no");
  if (prefillNo) prefillNo.addEventListener("click", () => document.getElementById("prefill-box").remove());

  document.querySelectorAll("#type-picker button").forEach(b => b.addEventListener("click", () => {
    recordType = b.dataset.type;
    document.querySelectorAll("#type-picker button").forEach(x => x.classList.toggle("active", x === b));
    mountPickers();
  }));

  document.getElementById("save-btn").addEventListener("click", async () => {
    const title = document.getElementById("f-title").value.trim();
    if (!title) { alert("Give the record a title."); return; }
    if (recordType === "stolenVehicle" && !draft.vehicleId) { alert("Link a vehicle for a stolen-vehicle record."); return; }
    if (recordType !== "stolenVehicle" && !draft.personId) { alert("Link a person for this record type."); return; }
    const finalTitle = recordType === "license" ? `${document.getElementById("f-licensetype").value} - ${title}` : title;
    const id = await createRecordEntry({
      recordType, title: finalTitle, description: document.getElementById("f-desc").value.trim(),
      issuingCourt: document.getElementById("f-court").value.trim() || null,
      personId: draft.personId, personName: draft.personName,
      vehicleId: draft.vehicleId, vehicleLabel: draft.vehicleLabel
    });
    goTo(id);
  });
}

function renderDetail(r) {
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
      <div class="panel-head">Details</div>
      <div class="kv-grid">
        <div class="kv"><span class="k">Issuing court</span><span class="v dim">${esc(r.issuingCourt || "—")}</span></div>
        <div class="kv"><span class="k">Subject</span><span class="v">${r.personId ? `<a href="lookup/#${r.personId}" style="color:var(--blue);">${esc(r.personName)}</a>` : r.vehicleId ? `<a href="lookup/#${r.vehicleId}" style="color:var(--blue);">${esc(r.vehicleLabel)}</a>` : "—"}</span></div>
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
