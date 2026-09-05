import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import {
  subscribeReports, createReport, subscribeCitations, fetchAllOnce, linkReports, updateReport
} from "../data-service.js";
import { renderPersonPicker, renderVehiclePicker, personLabel, vehicleLabel } from "../link-picker.js";
import { esc, fmtAge, fmtDateTime } from "../util.js";
import { currentHash, onHashChange, goTo, takePrefill } from "../router.js";

injectNav("reports");
initAuth();

const root = document.getElementById("page-root");
let allReports = [];
let allCitations = [];
let peopleCache = [];
let vehicleCache = [];

const REPORT_TYPES = [
  { key: "incident", label: "Incident report" },
  { key: "accident", label: "Accident report" },
  { key: "arrest", label: "Arrest report" },
  { key: "writtenWarning", label: "Written warning" }
];

function myUnit() { return JSON.parse(localStorage.getItem("lein_active_unit") || "null"); }
function statusPill(s) { return `<span class="status ${s === "closed" ? "offduty" : "info"}">${s}</span>`; }
function typeLabel(t) { return (REPORT_TYPES.find(x => x.key === t) || {}).label || t; }

function render() {
  const hash = currentHash();
  if (hash === "new") return renderNewForm();
  const found = allReports.find(r => r.id === hash);
  if (found) return renderDetail(found);
  renderList();
}

// ---------------- LIST ----------------
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
      <td class="dim">${esc(r.authorUnit || "—")}</td>
      <td>${statusPill(r.status)}</td>
      <td class="dim">${fmtAge(r.updatedAt)}</td>
    </tr>`).join("");
  body.querySelectorAll("tr.clickable").forEach(tr => tr.addEventListener("click", () => goTo(tr.dataset.id)));
}

// ---------------- NEW REPORT FORM ----------------
async function renderNewForm() {
  const prefill = takePrefill();
  const draft = { linkedPersonIds: [], linkedPersonNames: [], linkedVehicleIds: [], linkedVehicleLabels: [], linkedReportIds: [], linkedCitationIds: [] };

  if (!peopleCache.length) peopleCache = await fetchAllOnce("people");
  if (!vehicleCache.length) vehicleCache = await fetchAllOnce("vehicles");

  let selectedType = "incident";

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to reports</div>
    ${prefill ? `<div class="prefill-box" id="prefill-box">
      <span>From Lookup — is this report about <strong>${esc(prefill.label)}</strong>?</span>
      <span class="spacer"></span>
      <button type="button" id="prefill-yes" style="width:auto;">Yes, attach</button>
      <button type="button" class="secondary" id="prefill-no" style="width:auto;">Not them</button>
    </div>` : ""}
    <div class="panel">
      <div class="panel-head">New report</div>
      <div class="type-picker" id="type-picker">
        ${REPORT_TYPES.map((t, i) => `<button type="button" data-type="${t.key}" class="${i === 0 ? "active" : ""}">${t.label}</button>`).join("")}
      </div>
      <div class="form-grid">
        <div class="field full"><label>Title</label><input id="f-title" placeholder="Short summary of the report" /></div>
        <div class="field full"><label>Narrative</label><textarea id="f-narrative" rows="6" placeholder="Basic facts, witness statements, initial evidence..."></textarea></div>
      </div>
      <div class="form-grid" style="padding-top:0;">
        <div id="person-picker-slot"></div>
        <div id="vehicle-picker-slot"></div>
      </div>
      <div class="chip-row" id="linked-chips"></div>
      <div class="form-actions">
        <button class="secondary" id="cancel-btn" type="button">Cancel</button>
        <button id="save-btn" type="button">Create report</button>
      </div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  document.getElementById("cancel-btn").addEventListener("click", () => goTo(""));

  document.querySelectorAll("#type-picker button").forEach(b => b.addEventListener("click", () => {
    selectedType = b.dataset.type;
    document.querySelectorAll("#type-picker button").forEach(x => x.classList.toggle("active", x === b));
  }));

  function refreshChips() {
    const chips = document.getElementById("linked-chips");
    chips.innerHTML = [
      ...draft.linkedPersonNames.map((n, i) => `<span class="chip" data-remove="person:${i}">${esc(n)} &times;</span>`),
      ...draft.linkedVehicleLabels.map((n, i) => `<span class="chip" data-remove="vehicle:${i}">${esc(n)} &times;</span>`)
    ].join("");
    chips.querySelectorAll("[data-remove]").forEach(el => el.addEventListener("click", () => {
      const [kind, idx] = el.dataset.remove.split(":");
      if (kind === "person") { draft.linkedPersonIds.splice(idx, 1); draft.linkedPersonNames.splice(idx, 1); }
      else { draft.linkedVehicleIds.splice(idx, 1); draft.linkedVehicleLabels.splice(idx, 1); }
      refreshChips();
    }));
  }
  refreshChips();

  const prefillYes = document.getElementById("prefill-yes");
  if (prefillYes) prefillYes.addEventListener("click", () => {
    if (prefill.type === "person" && !draft.linkedPersonIds.includes(prefill.id)) {
      draft.linkedPersonIds.push(prefill.id); draft.linkedPersonNames.push(prefill.label);
    }
    if (prefill.type === "vehicle" && !draft.linkedVehicleIds.includes(prefill.id)) {
      draft.linkedVehicleIds.push(prefill.id); draft.linkedVehicleLabels.push(prefill.label);
    }
    refreshChips();
    document.getElementById("prefill-box").remove();
  });
  const prefillNo = document.getElementById("prefill-no");
  if (prefillNo) prefillNo.addEventListener("click", () => document.getElementById("prefill-box").remove());

  renderPersonPicker(document.getElementById("person-picker-slot"), peopleCache, (p) => {
    draft.linkedPersonIds.push(p.id); draft.linkedPersonNames.push(personLabel(p)); refreshChips();
  }, draft.linkedPersonIds);
  renderVehiclePicker(document.getElementById("vehicle-picker-slot"), vehicleCache, (v) => {
    draft.linkedVehicleIds.push(v.id); draft.linkedVehicleLabels.push(vehicleLabel(v)); refreshChips();
  }, draft.linkedVehicleIds);

  document.getElementById("save-btn").addEventListener("click", async () => {
    const title = document.getElementById("f-title").value.trim();
    if (!title) { alert("Give the report a title."); return; }
    const unit = myUnit();
    const btn = document.getElementById("save-btn");
    btn.disabled = true; btn.textContent = "Saving...";
    const id = await createReport({
      type: selectedType, title,
      narrative: document.getElementById("f-narrative").value.trim(),
      authorUnit: unit ? unit.unitNumber : "Unknown",
      linkedPersonIds: draft.linkedPersonIds, linkedPersonNames: draft.linkedPersonNames,
      linkedVehicleIds: draft.linkedVehicleIds, linkedVehicleLabels: draft.linkedVehicleLabels
    });
    goTo(id);
  });
}

// ---------------- DETAIL ----------------
function renderDetail(r) {
  const citationsOnFile = allCitations.filter(c => (r.linkedCitationIds || []).includes(c.id));
  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to reports</div>
    <div class="detail-head">
      <div class="avatar">${esc(r.type?.[0]?.toUpperCase() || "R")}</div>
      <div class="who">
        <div class="title">${esc(r.title)}</div>
        <div class="meta">${esc(typeLabel(r.type))} &middot; Filed by ${esc(r.authorUnit || "—")} &middot; ${fmtDateTime(r.createdAt)}</div>
        <div class="case-id">Report #${esc(r.id)}</div>
      </div>
      <div class="detail-actions">${statusPill(r.status)}</div>
    </div>

    <div class="panel">
      <div class="panel-head">Narrative</div>
      <div class="kv-grid"><div class="kv" style="grid-column:1/-1;"><span class="v dim" style="font-weight:400; white-space:pre-wrap;">${esc(r.narrative || "—")}</span></div></div>
      <div class="quick-actions">
        <button class="secondary" data-status="open">Reopen</button>
        <button class="secondary" data-status="closed">Close report</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Linked people &amp; vehicles</div>
      <div class="chip-row" style="padding-top:14px;">
        ${(r.linkedPersonIds || []).map((id, i) => `<span class="chip" data-goto="lookup/#${id}">${esc(r.linkedPersonNames?.[i] || "Person")}</span>`).join("")}
        ${(r.linkedVehicleIds || []).map((id, i) => `<span class="chip" data-goto="lookup/#${id}">${esc(r.linkedVehicleLabels?.[i] || "Vehicle")}</span>`).join("")}
        ${!(r.linkedPersonIds || []).length && !(r.linkedVehicleIds || []).length ? `<span style="color:var(--text-faint); font-size:12px;">None linked.</span>` : ""}
      </div>
    </div>

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
