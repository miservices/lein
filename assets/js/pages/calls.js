import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import { subscribeCalls, createCall, joinCall, updateCall, addCallUpdate } from "../data-service.js";
import { esc, fmtAge, fmtDateTime, pickWeighted } from "../util.js";
import { currentHash, onHashChange, isRecordId, goTo } from "../router.js";

injectNav("calls");
initAuth();

const root = document.getElementById("page-root");
let allCalls = [];
let unsub = null;

function myUnit() {
  return JSON.parse(localStorage.getItem("lein_active_unit") || "null");
}

function statusPill(status) {
  const labels = { pending: "Pending", active: "Active", alert: "Alert", info: "Info", closed: "Closed" };
  const cls = status === "closed" ? "offduty" : status;
  return `<span class="status ${cls}">${labels[status] || status}</span>`;
}
function priorityBadge(p) {
  if (!p) return "";
  const colors = { high: "var(--alert)", medium: "var(--pending)", low: "var(--text-faint)" };
  return `<span class="badge" style="background:${colors[p] || colors.low}">${p.toUpperCase()}</span>`;
}

function render() {
  const hash = currentHash();
  if (isRecordId(hash)) {
    renderDetail(hash);
  } else {
    renderList(hash === "field" ? "field" : hash === "cfs" ? "cfs" : "all");
  }
}

// ---------------- LIST VIEW ----------------
function renderList(activeTab) {
  const cfsCount = allCalls.filter(c => c.kind === "cfs" && c.status !== "closed").length;
  const fieldCount = allCalls.filter(c => c.kind === "field" && c.status !== "closed").length;
  let rows = allCalls;
  if (activeTab === "cfs") rows = allCalls.filter(c => c.kind === "cfs");
  if (activeTab === "field") rows = allCalls.filter(c => c.kind === "field");
  rows = [...rows].sort((a, b) => (a.status === "closed") - (b.status === "closed"));

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Calls</h1>
        <div class="sub">Calls for service and field activities, in one place.</div>
      </div>
      <div class="spacer"></div>
      <button id="new-call-btn">+ New call</button>
    </div>

    <div id="new-call-panel"></div>

    <div class="tabbar">
      <button data-tab="all" class="${activeTab === "all" ? "active" : ""}">All <span class="tab-count">${allCalls.length}</span></button>
      <button data-tab="cfs" class="${activeTab === "cfs" ? "active" : ""}">Calls for service <span class="tab-count">${cfsCount}</span></button>
      <button data-tab="field" class="${activeTab === "field" ? "active" : ""}">Field activities <span class="tab-count">${fieldCount}</span></button>
    </div>

    <div class="panel">
      <table>
        <thead><tr><th>Code</th><th>Kind</th><th>Title</th><th>Address</th><th>Units</th><th>Priority</th><th>Status</th><th>Age</th></tr></thead>
        <tbody id="calls-list-body"></tbody>
      </table>
    </div>`;

  root.querySelectorAll(".tabbar button").forEach(b => b.addEventListener("click", () => goTo(b.dataset.tab === "all" ? "" : b.dataset.tab)));
  document.getElementById("new-call-btn").addEventListener("click", toggleNewCallForm);

  const body = document.getElementById("calls-list-body");
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="8">No calls yet.</td></tr>`; return; }
  body.innerHTML = rows.map(c => `
    <tr class="clickable" data-id="${c.id}">
      <td class="dim">${esc(c.code || "—")}</td>
      <td class="dim">${c.kind === "cfs" ? "CFS" : "Field"}</td>
      <td class="trunc strong">${esc(c.title)}</td>
      <td class="trunc dim">${esc(c.address)}</td>
      <td class="dim">${(c.units || []).join(", ") || "—"}</td>
      <td>${priorityBadge(c.priority)}</td>
      <td>${statusPill(c.status)}</td>
      <td class="dim">${fmtAge(c.updatedAt)}</td>
    </tr>`).join("");
  body.querySelectorAll("tr.clickable").forEach(tr => tr.addEventListener("click", () => goTo(tr.dataset.id)));
}

function toggleNewCallForm() {
  const panel = document.getElementById("new-call-panel");
  if (panel.childElementCount) { panel.innerHTML = ""; return; }
  panel.innerHTML = `
    <div class="panel">
      <div class="panel-head">New call</div>
      <div class="type-picker">
        <button type="button" data-kind="cfs" class="active">Call for service</button>
        <button type="button" data-kind="field">Field activity</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Code</label><input id="f-code" placeholder="e.g. 10-50" /></div>
        <div class="field"><label>Title</label><input id="f-title" placeholder="e.g. Traffic collision" /></div>
        <div class="field cfs-only"><label>Type</label>
          <select id="f-type"><option>EMERGENCY</option><option>CIVIL</option><option>TRAFFIC</option></select>
        </div>
        <div class="field cfs-only"><label>Caller</label><input id="f-caller" placeholder="Caller name / 'Unknown caller'" /></div>
        <div class="field"><label>Address</label><input id="f-address" placeholder="Street / cross street" /></div>
        <div class="field"><label>Priority</label>
          <select id="f-priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select>
        </div>
        <div class="field full"><label>Description</label><textarea id="f-desc" rows="2"></textarea></div>
      </div>
      <div class="form-actions">
        <button class="secondary" type="button" id="cancel-call">Cancel</button>
        <button type="button" id="save-call">Create call</button>
      </div>
    </div>`;

  let kind = "cfs";
  panel.querySelectorAll(".type-picker button").forEach(b => b.addEventListener("click", () => {
    kind = b.dataset.kind;
    panel.querySelectorAll(".type-picker button").forEach(x => x.classList.toggle("active", x === b));
    panel.querySelectorAll(".cfs-only").forEach(el => el.style.display = kind === "cfs" ? "" : "none");
  }));
  document.getElementById("cancel-call").addEventListener("click", () => panel.innerHTML = "");
  document.getElementById("save-call").addEventListener("click", async () => {
    const btn = document.getElementById("save-call");
    btn.disabled = true; btn.textContent = "Creating...";
    const unit = myUnit();
    const id = await createCall({
      kind,
      code: document.getElementById("f-code").value.trim() || null,
      title: document.getElementById("f-title").value.trim() || "Untitled call",
      type: kind === "cfs" ? document.getElementById("f-type").value : undefined,
      caller: kind === "cfs" ? document.getElementById("f-caller").value.trim() : undefined,
      address: document.getElementById("f-address").value.trim(),
      description: document.getElementById("f-desc").value.trim(),
      priority: document.getElementById("f-priority").value,
      units: unit ? [unit.unitNumber] : []
    });
    goTo(id);
  });
}

// ---------------- DETAIL VIEW ----------------
function renderDetail(id) {
  const call = allCalls.find(c => c.id === id);
  if (!call) {
    root.innerHTML = `<div class="back-link" id="back-link">&larr; Back to calls</div><div class="banner">Loading call #${esc(id)}...</div>`;
    document.getElementById("back-link").addEventListener("click", () => goTo(""));
    return;
  }
  const unit = myUnit();
  const alreadyJoined = unit && (call.units || []).includes(unit.unitNumber);

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to calls</div>
    <div class="detail-head">
      <div class="avatar">${call.kind === "cfs" ? "CFS" : "FA"}</div>
      <div class="who">
        <div class="title">${esc(call.title)}</div>
        <div class="meta">${esc(call.address || "No address on file")} &middot; ${esc(call.code || "no code")}</div>
        <div class="case-id">Call #${esc(call.id)}</div>
      </div>
      <div class="detail-actions">
        ${statusPill(call.status)} ${priorityBadge(call.priority)}
      </div>
    </div>

    <div class="cols">
      <div class="panel">
        <div class="panel-head">Details</div>
        <div class="kv-grid">
          <div class="kv"><span class="k">Type</span><span class="v">${esc(call.type || (call.kind === "cfs" ? "Call for service" : "Field activity"))}</span></div>
          <div class="kv"><span class="k">Caller</span><span class="v dim">${esc(call.caller || "—")}</span></div>
          <div class="kv"><span class="k">Postal</span><span class="v dim">${esc(call.postal || "—")}</span></div>
          <div class="kv"><span class="k">Created</span><span class="v dim">${fmtDateTime(call.createdAt)}</span></div>
        </div>
        <div class="chip-row"><div class="kv" style="padding:0 0 10px;"><span class="k">Description</span><span class="v dim" style="font-weight:400;">${esc(call.description || "—")}</span></div></div>
        <div class="quick-actions">
          ${alreadyJoined ? "" : `<button id="join-btn">${unit ? `Join as ${esc(unit.unitNumber)}` : "Join call"}</button>`}
          <button class="secondary" data-status="active">Mark active</button>
          <button class="secondary" data-status="pending">Mark pending</button>
          <button class="secondary" data-status="closed">Close call</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">Units assigned</div>
        <div class="chip-row" style="padding-top:14px;">
          ${(call.units || []).length ? call.units.map(u => `<span class="chip">${esc(u)}</span>`).join("") : `<span style="color:var(--text-faint); font-size:12px;">No units assigned yet.</span>`}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Call updates</div>
      <div class="timeline" id="update-timeline">
        ${(call.updates || []).slice().reverse().map(u => `
          <div class="timeline-item" style="cursor:default;">
            <div class="t-badge"><span class="status info">${esc(u.by || "—")}</span></div>
            <div class="t-body"><div class="t-title">${esc(u.text)}</div></div>
            <div class="t-when">${fmtAge(u.at)}</div>
          </div>`).join("") || `<div style="padding:14px; color:var(--text-faint); font-size:12px;">No updates logged yet.</div>`}
      </div>
      <div class="form-grid" style="grid-template-columns:1fr; padding-top:0;">
        <div class="field full" style="margin-bottom:0;">
          <div style="display:flex; gap:8px;">
            <input id="update-text" placeholder="Add an update to this call..." />
            <button id="add-update-btn" style="width:auto; white-space:nowrap;">Post</button>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  const joinBtn = document.getElementById("join-btn");
  if (joinBtn) joinBtn.addEventListener("click", async () => {
    if (!unit) { alert("Sign in as a unit first."); return; }
    await joinCall(call.id, unit.unitNumber);
  });
  root.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", async () => {
    await updateCall(call.id, { status: b.dataset.status });
    await addCallUpdate(call.id, `Status changed to ${b.dataset.status}.`, unit ? unit.unitNumber : "Dispatch");
  }));
  document.getElementById("add-update-btn").addEventListener("click", async () => {
    const input = document.getElementById("update-text");
    const text = input.value.trim();
    if (!text) return;
    await addCallUpdate(call.id, text, unit ? unit.unitNumber : "Dispatch");
    input.value = "";
  });
}

onHashChange(render);
unsub = subscribeCalls(rows => { allCalls = rows; render(); });
