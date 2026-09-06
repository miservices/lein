import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import { subscribeCitations, createCitation, updateCitation, fetchAllOnce, fetchCitationCodes } from "../data-service.js";
import { renderPersonPicker, renderVehiclePicker, personLabel, vehicleLabel } from "../link-picker.js";
import { esc, fmtAge, fmtDate, pick, COURT_JUDGES, COURTS } from "../util.js";
import { currentHash, onHashChange, goTo, takePrefill } from "../router.js";

injectNav("citations");
initAuth();

const root = document.getElementById("page-root");
let allCitations = [];
let peopleCache = [];
let vehicleCache = [];
let citationCodes = [];

function myUnit() { return JSON.parse(localStorage.getItem("lein_active_unit") || "null"); }
function dispositionPill(d) {
  const map = { pending: "pending", guilty: "alert", dismissed: "active", "not guilty": "info" };
  return `<span class="status ${map[d] || "info"}">${esc(d || "pending")}</span>`;
}

function render() {
  const hash = currentHash();
  if (hash === "new") return renderNewForm();
  const found = allCitations.find(c => c.id === hash);
  if (found) return renderDetail(found);
  renderList();
}

function renderList() {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Citations</h1><div class="sub">Write a citation and track its court disposition.</div></div>
      <div class="spacer"></div>
      <button id="new-btn">+ New citation</button>
    </div>
    <div class="panel"><table>
      <thead><tr><th>Case #</th><th>Person</th><th>Vehicle</th><th>Violation</th><th>Fine</th><th>Disposition</th><th>Age</th></tr></thead>
      <tbody id="body"></tbody>
    </table></div>`;
  document.getElementById("new-btn").addEventListener("click", () => goTo("new"));
  const body = document.getElementById("body");
  if (!allCitations.length) { body.innerHTML = `<tr class="empty-row"><td colspan="7">No citations yet.</td></tr>`; return; }
  const sorted = [...allCitations].sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
  body.innerHTML = sorted.map(c => `
    <tr class="clickable" data-id="${c.id}">
      <td class="dim">${esc(c.id)}</td>
      <td class="strong">${esc(c.personName || "—")}</td>
      <td class="dim">${esc(c.vehicleLabel || "—")}</td>
      <td class="trunc dim">${esc(c.violation)}</td>
      <td class="dim">${esc(c.fine || "—")}</td>
      <td>${dispositionPill(c.disposition)}</td>
      <td class="dim">${fmtAge(c.updatedAt)}</td>
    </tr>`).join("");
  body.querySelectorAll("tr.clickable").forEach(tr => tr.addEventListener("click", () => goTo(tr.dataset.id)));
}

async function renderNewForm() {
  const prefill = takePrefill();
  if (!peopleCache.length) peopleCache = await fetchAllOnce("people");
  if (!vehicleCache.length) vehicleCache = await fetchAllOnce("vehicles");
  if (!citationCodes.length) citationCodes = await fetchCitationCodes();

  const draft = { personId: null, personName: null, vehicleId: null, vehicleLabel: null };

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to citations</div>
    ${prefill ? `<div class="prefill-box" id="prefill-box">
      <span>From Lookup — is this citation for <strong>${esc(prefill.label)}</strong>?</span>
      <span class="spacer"></span>
      <button type="button" id="prefill-yes" style="width:auto;">Yes, attach</button>
      <button type="button" class="secondary" id="prefill-no" style="width:auto;">Not them</button>
    </div>` : ""}
    <div id="suggestion-slot"></div>
    <div class="panel">
      <div class="panel-head">New citation</div>
      <div class="form-grid">
        <div id="person-slot"></div>
        <div id="vehicle-slot"></div>
      </div>
      <div class="chip-row" id="linked-chips"></div>
      <div class="form-grid">
        <div class="field full suggest-wrap">
          <label>Violation (search the citation code database, or type your own)</label>
          <input id="f-violation-search" placeholder="e.g. speeding, expired registration..." autocomplete="off" />
          <div id="violation-suggest" class="suggest-list" style="display:none;"></div>
        </div>
        <div class="field"><label>Violation</label><input id="f-violation" placeholder="e.g. Speeding 15 over" /></div>
        <div class="field"><label>Statute / code</label><input id="f-code" placeholder="e.g. MCL 257.627(1)" /></div>
        <div class="field"><label>Classification</label><input id="f-classification" placeholder="e.g. Civil Infraction" /></div>
        <div class="field"><label>Fine</label><input id="f-fine" placeholder="e.g. $165" /></div>
        <div class="field"><label>Disposition</label>
          <select id="f-disposition"><option value="pending">Pending</option><option value="guilty">Guilty</option><option value="not guilty">Not guilty</option><option value="dismissed">Dismissed</option></select>
        </div>
        <div class="field"><label>Court</label><input id="f-court" placeholder="e.g. Genesee County 67th District Court" /></div>
        <div class="field"><label>Presiding judge</label><input id="f-judge" /></div>
        <div class="field full"><a href="#" id="randomize-court" style="font-size:12px; color:var(--blue);">Randomize court &amp; judge</a></div>
      </div>
      <div class="form-actions">
        <button class="secondary" id="cancel-btn" type="button">Cancel</button>
        <button id="save-btn" type="button">Create citation</button>
      </div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  document.getElementById("cancel-btn").addEventListener("click", () => goTo(""));
  document.getElementById("randomize-court").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("f-court").value = pick(COURTS);
    document.getElementById("f-judge").value = pick(COURT_JUDGES);
  });

  // Violation search against the citationCodes database
  const violationSearch = document.getElementById("f-violation-search");
  const violationSuggest = document.getElementById("violation-suggest");
  violationSearch.addEventListener("input", () => {
    const t = violationSearch.value.trim().toLowerCase();
    if (!t) { violationSuggest.style.display = "none"; return; }
    const matches = citationCodes.filter(c => c.violation.toLowerCase().includes(t) || (c.statute || "").toLowerCase().includes(t)).slice(0, 8);
    if (!matches.length) { violationSuggest.style.display = "none"; return; }
    violationSuggest.style.display = "";
    violationSuggest.innerHTML = matches.map((c, i) => `
      <div class="suggest-item" data-i="${i}">${esc(c.violation)}<div class="si-sub">${esc(c.statute)} &middot; ${esc(c.classification)}${c.fineDisplay ? ` &middot; ${esc(c.fineDisplay)}` : ""}</div></div>`).join("");
    violationSuggest.querySelectorAll(".suggest-item").forEach(el => el.addEventListener("click", () => {
      const c = matches[el.dataset.i];
      document.getElementById("f-violation").value = c.violation;
      document.getElementById("f-code").value = c.statute;
      document.getElementById("f-classification").value = c.classification;
      if (c.fineDisplay) document.getElementById("f-fine").value = c.fineDisplay;
      violationSearch.value = "";
      violationSuggest.style.display = "none";
    }));
  });

  function refreshChips() {
    const chips = document.getElementById("linked-chips");
    chips.innerHTML = [
      draft.personName ? `<span class="chip" data-remove="person">${esc(draft.personName)} &times;</span>` : "",
      draft.vehicleLabel ? `<span class="chip" data-remove="vehicle">${esc(draft.vehicleLabel)} &times;</span>` : ""
    ].join("");
    chips.querySelectorAll("[data-remove]").forEach(el => el.addEventListener("click", () => {
      if (el.dataset.remove === "person") { draft.personId = null; draft.personName = null; }
      else { draft.vehicleId = null; draft.vehicleLabel = null; }
      refreshChips();
    }));
  }
  refreshChips();

  renderPersonPicker(document.getElementById("person-slot"), peopleCache, (p) => {
    draft.personId = p.id; draft.personName = personLabel(p); refreshChips();
  });
  renderVehiclePicker(document.getElementById("vehicle-slot"), vehicleCache, (v) => {
    draft.vehicleId = v.id; draft.vehicleLabel = vehicleLabel(v); refreshChips();
  });

  function showVehicleSuggestion() {
    if (!prefill?.suggestion || prefill.suggestion.type !== "vehicle" || draft.vehicleId) return;
    document.getElementById("suggestion-slot").innerHTML = `
      <div class="prefill-box" id="suggest-box">
        <span>They also have <strong>${esc(prefill.suggestion.label)}</strong> on file — attach that vehicle too?</span>
        <span class="spacer"></span>
        <button type="button" id="suggest-yes" style="width:auto;">Yes, attach</button>
        <button type="button" class="secondary" id="suggest-no" style="width:auto;">No thanks</button>
      </div>`;
    document.getElementById("suggest-yes").addEventListener("click", () => {
      draft.vehicleId = prefill.suggestion.id; draft.vehicleLabel = prefill.suggestion.label;
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
    showVehicleSuggestion();
  });
  const prefillNo = document.getElementById("prefill-no");
  if (prefillNo) prefillNo.addEventListener("click", () => document.getElementById("prefill-box").remove());

  document.getElementById("save-btn").addEventListener("click", async () => {
    const violation = document.getElementById("f-violation").value.trim();
    if (!violation) { alert("Enter the violation."); return; }
    const unit = myUnit();
    const id = await createCitation({
      personId: draft.personId, personName: draft.personName,
      vehicleId: draft.vehicleId, vehicleLabel: draft.vehicleLabel,
      violation, code: document.getElementById("f-code").value.trim(),
      classification: document.getElementById("f-classification").value.trim(),
      fine: document.getElementById("f-fine").value.trim(),
      disposition: document.getElementById("f-disposition").value,
      court: document.getElementById("f-court").value.trim(),
      presidingJudge: document.getElementById("f-judge").value.trim() || null,
      issuedBy: unit ? unit.unitNumber : "Unknown"
    });
    goTo(id);
  });
}

function renderDetail(c) {
  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to citations</div>
    <div class="detail-head">
      <div class="avatar">CT</div>
      <div class="who">
        <div class="title">${esc(c.violation)}</div>
        <div class="meta">${esc(c.code || "—")}${c.classification ? ` &middot; ${esc(c.classification)}` : ""} &middot; Issued by ${esc(c.issuedBy || "—")}</div>
        <div class="case-id">Citation #${esc(c.id)}</div>
      </div>
      <div class="detail-actions">${dispositionPill(c.disposition)}</div>
    </div>

    <div class="panel">
      <div class="panel-head">Details</div>
      <div class="kv-grid bordered">
        <div class="kv"><span class="k">Person</span><span class="v">${c.personId ? `<a href="lookup/#${c.personId}" style="color:var(--blue);">${esc(c.personName)}</a>` : "—"}</span></div>
        <div class="kv"><span class="k">Vehicle</span><span class="v">${c.vehicleId ? `<a href="lookup/#${c.vehicleId}" style="color:var(--blue);">${esc(c.vehicleLabel)}</a>` : "—"}</span></div>
        <div class="kv"><span class="k">Fine</span><span class="v dim">${esc(c.fine || "—")}</span></div>
        <div class="kv"><span class="k">Court</span><span class="v dim">${esc(c.court || "—")}</span></div>
        <div class="kv"><span class="k">Presiding judge</span><span class="v dim">${esc(c.presidingJudge || "—")}</span></div>
        <div class="kv"><span class="k">Hearing date</span><span class="v dim">${c.hearingDate ? fmtDate(new Date(c.hearingDate)) : "Not scheduled"}</span></div>
      </div>
      <div class="quick-actions">
        ${["pending", "guilty", "not guilty", "dismissed"].map(d => `<button class="secondary" data-disp="${d}">${d}</button>`).join("")}
      </div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  root.querySelectorAll("[data-disp]").forEach(b => b.addEventListener("click", () => updateCitation(c.id, { disposition: b.dataset.disp })));
}

onHashChange(render);
subscribeCitations(rows => { allCitations = rows; render(); });