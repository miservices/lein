import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import { subscribeBolos, createBolo, updateBolo, fetchAllOnce } from "../data-service.js";
import { renderPersonPicker, renderVehiclePicker, personLabel, vehicleLabel } from "../link-picker.js";
import { esc, fmtAge } from "../util.js";
import { currentHash, onHashChange, goTo, takePrefill } from "../router.js";

injectNav("bolo");
initAuth();

const root = document.getElementById("page-root");
let allBolos = [];
let peopleCache = [];
let vehicleCache = [];

function myUnit() { return JSON.parse(localStorage.getItem("lein_active_unit") || "null"); }
function statusPill(s) { return `<span class="status ${s === "active" ? "alert" : "offduty"}">${s}</span>`; }

function render() {
  const hash = currentHash();
  if (hash === "new") return renderNewForm();
  const found = allBolos.find(b => b.id === hash);
  if (found) return renderDetail(found);
  renderList();
}

function renderList() {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>BOLO</h1><div class="sub">Broadcast a be-on-the-lookout alert to every active unit.</div></div>
      <div class="spacer"></div>
      <button id="new-btn">+ New BOLO</button>
    </div>
    <div class="panel"><table>
      <thead><tr><th>Case #</th><th>Type</th><th>Subject</th><th>Reason</th><th>Status</th><th>Age</th></tr></thead>
      <tbody id="body"></tbody>
    </table></div>`;
  document.getElementById("new-btn").addEventListener("click", () => goTo("new"));
  const body = document.getElementById("body");
  const sorted = [...allBolos].sort((a, b) => (a.status === "cleared") - (b.status === "cleared"));
  if (!sorted.length) { body.innerHTML = `<tr class="empty-row"><td colspan="6">No active BOLOs.</td></tr>`; return; }
  body.innerHTML = sorted.map(b => `
    <tr class="clickable" data-id="${b.id}">
      <td class="dim">${esc(b.id)}</td>
      <td class="dim">${esc(b.type)}</td>
      <td class="strong">${esc(b.personName || b.vehicleLabel || "Unidentified")}</td>
      <td class="trunc dim">${esc(b.reason || b.freeText || "—")}</td>
      <td>${statusPill(b.status)}</td>
      <td class="dim">${fmtAge(b.updatedAt)}</td>
    </tr>`).join("");
  body.querySelectorAll("tr.clickable").forEach(tr => tr.addEventListener("click", () => goTo(tr.dataset.id)));
}

async function renderNewForm() {
  const prefill = takePrefill();
  if (!peopleCache.length) peopleCache = await fetchAllOnce("people");
  if (!vehicleCache.length) vehicleCache = await fetchAllOnce("vehicles");

  const draft = { personId: null, personName: null, vehicleId: null, vehicleLabel: null };
  let type = prefill?.type === "vehicle" ? "vehicle" : "person";

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to BOLO</div>
    ${prefill ? `<div class="prefill-box" id="prefill-box">
      <span>From Lookup — is this BOLO about <strong>${esc(prefill.label)}</strong>?</span>
      <span class="spacer"></span>
      <button type="button" id="prefill-yes" style="width:auto;">Yes, attach</button>
      <button type="button" class="secondary" id="prefill-no" style="width:auto;">Not them</button>
    </div>` : ""}
    <div id="suggestion-slot"></div>
    <div class="panel">
      <div class="panel-head">New BOLO</div>
      <div class="type-picker">
        <button type="button" data-type="person" class="${type === "person" ? "active" : ""}">Person</button>
        <button type="button" data-type="vehicle" class="${type === "vehicle" ? "active" : ""}">Vehicle</button>
      </div>
      <div class="form-grid">
        <div id="person-slot" style="display:${type === "person" ? "" : "none"};"></div>
        <div id="vehicle-slot" style="display:${type === "vehicle" ? "" : "none"};"></div>
      </div>
      <div class="chip-row" id="linked-chips"></div>
      <div class="form-grid">
        <div class="field full"><label>If unidentified, describe here</label><input id="f-freetext" placeholder="e.g. partial plate, suspect description..." /></div>
        <div class="field full"><label>Reason</label><textarea id="f-reason" rows="2" placeholder="Why this BOLO is being issued"></textarea></div>
      </div>
      <div class="form-actions">
        <button class="secondary" id="cancel-btn" type="button">Cancel</button>
        <button id="save-btn" type="button">Broadcast BOLO</button>
      </div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  document.getElementById("cancel-btn").addEventListener("click", () => goTo(""));

  document.querySelectorAll(".type-picker button").forEach(b => b.addEventListener("click", () => {
    type = b.dataset.type;
    document.querySelectorAll(".type-picker button").forEach(x => x.classList.toggle("active", x === b));
    document.getElementById("person-slot").style.display = type === "person" ? "" : "none";
    document.getElementById("vehicle-slot").style.display = type === "vehicle" ? "" : "none";
  }));

  function refreshChips() {
    document.getElementById("linked-chips").innerHTML = [
      draft.personName ? `<span class="chip">${esc(draft.personName)}</span>` : "",
      draft.vehicleLabel ? `<span class="chip">${esc(draft.vehicleLabel)}</span>` : ""
    ].join("");
  }
  refreshChips();
  renderPersonPicker(document.getElementById("person-slot"), peopleCache, (p) => { draft.personId = p.id; draft.personName = personLabel(p); refreshChips(); });
  renderVehiclePicker(document.getElementById("vehicle-slot"), vehicleCache, (v) => { draft.vehicleId = v.id; draft.vehicleLabel = vehicleLabel(v); refreshChips(); });

  function showSuggestion() {
    if (!prefill?.suggestion) return;
    const s = prefill.suggestion;
    document.getElementById("suggestion-slot").innerHTML = `
      <div class="prefill-box" id="suggest-box">
        <span>They also have <strong>${esc(s.label)}</strong> on file — issue this BOLO for both?</span>
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

  document.getElementById("save-btn").addEventListener("click", async () => {
    const reason = document.getElementById("f-reason").value.trim();
    const freeText = document.getElementById("f-freetext").value.trim();
    if (!reason) { alert("Give a reason for the BOLO."); return; }
    const id = await createBolo({
      type, personId: draft.personId, personName: draft.personName,
      vehicleId: draft.vehicleId, vehicleLabel: draft.vehicleLabel,
      freeText, reason
    });
    goTo(id);
  });
}

function renderDetail(b) {
  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to BOLO</div>
    <div class="detail-head">
      <div class="avatar">${b.type === "vehicle" ? "V" : "P"}</div>
      <div class="who">
        <div class="title">${esc(b.personName || b.vehicleLabel || "Unidentified subject")}</div>
        <div class="meta">${esc(b.freeText || "")}</div>
        <div class="case-id">BOLO #${esc(b.id)}</div>
      </div>
      <div class="detail-actions">${statusPill(b.status)}</div>
    </div>
    <div class="panel">
      <div class="panel-head">Reason</div>
      <div class="kv-grid"><div class="kv" style="grid-column:1/-1;"><span class="v dim" style="font-weight:400;">${esc(b.reason || "—")}</span></div></div>
      <div class="quick-actions">
        <button class="secondary" data-status="active">Reactivate</button>
        <button class="secondary" data-status="cleared">Clear BOLO</button>
      </div>
      ${b.personId ? `<div class="chip-row"><a href="lookup/#${b.personId}" class="chip">View person profile</a></div>` : ""}
      ${b.vehicleId ? `<div class="chip-row"><a href="lookup/#${b.vehicleId}" class="chip">View vehicle profile</a></div>` : ""}
    </div>`;
  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  root.querySelectorAll("[data-status]").forEach(el => el.addEventListener("click", () => updateBolo(b.id, { status: el.dataset.status })));
}

onHashChange(render);
subscribeBolos(rows => { allBolos = rows; render(); });