import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import { subscribeUnits, subscribeCalls, createUnit, updateUnitStatus } from "../data-service.js";
import { resolveDepartment, DEPARTMENT_LIST, RANKS, esc, fmtAge } from "../util.js";
import { currentHash, onHashChange, goTo } from "../router.js";

injectNav("units");
initAuth();

const root = document.getElementById("page-root");
let allUnits = [];
let allCalls = [];

const STATUS_LABELS = { pending: "Pending", active: "Active", alert: "Alert", info: "Info", offduty: "10-7" };
function statusPill(s) { return `<span class="status ${s}">${STATUS_LABELS[s] || s}</span>`; }

function render() {
  const hash = currentHash();
  if (hash) renderDetail(hash);
  else renderList();
}

function renderList() {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Units</h1><div class="sub">Everyone currently signed into a unit.</div></div>
      <div class="spacer"></div>
      <button id="new-unit-btn">+ New unit</button>
    </div>
    <div id="new-unit-panel"></div>
    <div class="panel">
      <table>
        <thead><tr><th>Unit</th><th>Name</th><th>Agency</th><th>Rank</th><th>Status</th></tr></thead>
        <tbody id="units-body"></tbody>
      </table>
    </div>`;

  document.getElementById("new-unit-btn").addEventListener("click", toggleNewUnitForm);
  const body = document.getElementById("units-body");
  if (!allUnits.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No units yet.</td></tr>`; return; }
  body.innerHTML = allUnits.map(u => {
    const dept = resolveDepartment(u.department);
    return `<tr class="clickable" data-id="${u.id}">
      <td><span class="badge" style="background: var(--${dept.cssClass})">${esc(u.unitNumber)}</span></td>
      <td class="strong">${esc(u.name)}</td>
      <td>${esc(dept.name)}</td>
      <td>${esc(u.rank)}</td>
      <td>${statusPill(u.status)}</td>
    </tr>`;
  }).join("");
  body.querySelectorAll("tr.clickable").forEach(tr => tr.addEventListener("click", () => goTo(tr.dataset.id)));
}

function toggleNewUnitForm() {
  const panel = document.getElementById("new-unit-panel");
  if (panel.childElementCount) { panel.innerHTML = ""; return; }
  panel.innerHTML = `
    <div class="panel">
      <div class="panel-head">New unit</div>
      <div class="form-grid">
        <div class="field"><label>Unit number</label><input id="f-unit" placeholder="e.g. 2-L-21" /></div>
        <div class="field"><label>Name</label><input id="f-name" placeholder="e.g. J. Carter" /></div>
        <div class="field"><label>Agency</label>
          <input id="f-dept" list="dept-opts" placeholder="Choose or type your own" />
          <datalist id="dept-opts">${DEPARTMENT_LIST.map(d => `<option value="${d.name}">`).join("")}</datalist>
        </div>
        <div class="field"><label>Rank</label>
          <input id="f-rank" list="rank-opts" placeholder="Choose or type your own" />
          <datalist id="rank-opts">${RANKS.map(r => `<option value="${r}">`).join("")}</datalist>
        </div>
      </div>
      <div class="form-actions">
        <button class="secondary" id="cancel-unit" type="button">Cancel</button>
        <button id="save-unit" type="button">Create unit</button>
      </div>
    </div>`;
  document.getElementById("cancel-unit").addEventListener("click", () => panel.innerHTML = "");
  document.getElementById("save-unit").addEventListener("click", async () => {
    const unitNumber = document.getElementById("f-unit").value.trim();
    const name = document.getElementById("f-name").value.trim();
    const department = document.getElementById("f-dept").value.trim();
    const rank = document.getElementById("f-rank").value.trim();
    if (!unitNumber || !name || !department || !rank) { alert("Fill in every field."); return; }
    const id = await createUnit({ unitNumber, name, department, rank, status: "active" });
    goTo(id);
  });
}

function renderDetail(id) {
  const unit = allUnits.find(u => u.id === id);
  if (!unit) {
    root.innerHTML = `<div class="back-link" id="back-link">&larr; Back to units</div><div class="banner">Loading unit...</div>`;
    document.getElementById("back-link").addEventListener("click", () => goTo(""));
    return;
  }
  const dept = resolveDepartment(unit.department);
  const theirCalls = allCalls.filter(c => (c.units || []).includes(unit.unitNumber));

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to units</div>
    <div class="detail-head">
      <div class="avatar" style="background: var(--${dept.cssClass})">${esc(unit.unitNumber)}</div>
      <div class="who">
        <div class="title">${esc(unit.name)}</div>
        <div class="meta">${esc(dept.name)} &middot; ${esc(unit.rank)}</div>
      </div>
      <div class="detail-actions">${statusPill(unit.status)}</div>
    </div>
    <div class="panel">
      <div class="panel-head">Status</div>
      <div class="quick-actions">
        ${["active", "pending", "info", "offduty"].map(s => `<button class="secondary" data-status="${s}">${STATUS_LABELS[s]}</button>`).join("")}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">Current assignments</div>
      <table>
        <thead><tr><th>Code</th><th>Title</th><th>Address</th><th>Status</th><th>Age</th></tr></thead>
        <tbody>
          ${theirCalls.length ? theirCalls.map(c => `
            <tr class="clickable" data-call="${c.id}">
              <td class="dim">${esc(c.code || "—")}</td>
              <td class="trunc strong">${esc(c.title)}</td>
              <td class="trunc dim">${esc(c.address)}</td>
              <td><span class="status ${c.status === "closed" ? "offduty" : c.status}">${c.status}</span></td>
              <td class="dim">${fmtAge(c.updatedAt)}</td>
            </tr>`).join("") : `<tr class="empty-row"><td colspan="5">Not currently assigned to any calls.</td></tr>`}
        </tbody>
      </table>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  root.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", () => updateUnitStatus(unit.id, b.dataset.status)));
  root.querySelectorAll("[data-call]").forEach(tr => tr.addEventListener("click", () => window.location.href = `calls/#${tr.dataset.call}`));
}

onHashChange(render);
subscribeUnits(rows => { allUnits = rows; render(); });
subscribeCalls(rows => { allCalls = rows; if (currentHash()) render(); });
