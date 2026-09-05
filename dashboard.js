import { injectNav } from "./nav.js";
import { initAuth } from "./auth.js";
import { subscribeUnits, subscribeCalls, subscribeGroups, subscribeRecords, isFlagWorthy } from "./data-service.js";
import { resolveDepartment, fmtAge } from "./util.js";

injectNav("dashboard");
initAuth();

const STATUS_LABELS = { pending: "Pending", active: "Active", alert: "Alert", info: "Info", offduty: "10-7", closed: "Closed" };
function statusPill(status) {
  const s = status || "info";
  const cls = s === "closed" ? "offduty" : s;
  return `<span class="status ${cls}">${STATUS_LABELS[s] || s}</span>`;
}
function row(html, id, section) {
  return `<tr class="clickable" data-id="${id}" data-section="${section}">${html}</tr>`;
}
function wireRowClicks(tbody) {
  tbody.querySelectorAll("tr.clickable").forEach(tr => {
    tr.addEventListener("click", () => {
      const { id, section } = tr.dataset;
      window.location.href = `${section}/#${id}`;
    });
  });
}

// ---- Units on duty ----------------------------------------------------
function renderUnits(rows) {
  const body = document.getElementById("units-body");
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No units on duty.</td></tr>`; return; }
  body.innerHTML = rows.map(u => {
    const dept = resolveDepartment(u.department);
    return row(`
      <td><span class="badge" style="background: var(--${dept.cssClass})">${u.unitNumber}</span></td>
      <td class="strong">${u.name}</td>
      <td>${dept.name}</td>
      <td>${u.rank}</td>
      <td>${statusPill(u.status)}</td>`, u.id, "units");
  }).join("");
  wireRowClicks(body);
}

// ---- Calls (centralized store, split by kind for two panels) ----------
let allCalls = [];
function renderCallPanels() {
  const cfs = allCalls.filter(c => c.kind === "cfs" && c.status !== "closed").slice(0, 8);
  const field = allCalls.filter(c => c.kind === "field" && c.status !== "closed").slice(0, 8);

  const cfsBody = document.getElementById("emergency-body");
  if (!cfs.length) { cfsBody.innerHTML = `<tr class="empty-row"><td colspan="5">No active calls for service.</td></tr>`; }
  else {
    cfsBody.innerHTML = cfs.map(c => row(`
      <td><span class="status ${c.type === "EMERGENCY" ? "alert" : "info"}">${c.type || "CFS"}</span></td>
      <td class="trunc dim">${c.caller || "—"}</td>
      <td class="trunc strong">${c.title}</td>
      <td class="trunc dim">${c.address}</td>
      <td>${statusPill(c.status)}</td>`, c.id, "calls")).join("");
    wireRowClicks(cfsBody);
  }

  const fieldBody = document.getElementById("field-body");
  if (!field.length) { fieldBody.innerHTML = `<tr class="empty-row"><td colspan="5">No field activities.</td></tr>`; }
  else {
    fieldBody.innerHTML = field.map(c => row(`
      <td class="dim">${c.code || "—"}</td>
      <td class="trunc strong">${c.title}</td>
      <td class="trunc dim">${c.address}</td>
      <td class="dim">${(c.units || []).join(", ") || "—"}</td>
      <td>${statusPill(c.status)}</td>`, c.id, "calls")).join("");
    wireRowClicks(fieldBody);
  }
}

// ---- Groups -------------------------------------------------------------
function renderGroups(rows) {
  const body = document.getElementById("groups-body");
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="3">No groups.</td></tr>`; return; }
  body.innerHTML = rows.map(g => {
    const dept = resolveDepartment(g.department);
    return `<tr><td class="strong">${g.name}</td><td>${dept.name}</td><td>${statusPill(g.status)}</td></tr>`;
  }).join("");
}

// ---- Record flags (derived live from the Records collection) ------------
function renderFlags(rows) {
  const flags = rows.filter(isFlagWorthy);
  const body = document.getElementById("flags-body");
  const badge = document.getElementById("flags-count");
  const realHits = flags.filter(r => !r.isMock).length;
  badge.textContent = String(realHits);
  badge.style.display = realHits > 0 ? "inline-block" : "none";
  if (!flags.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No active record flags.</td></tr>`; return; }
  body.innerHTML = flags.slice(0, 10).map(f => row(`
    <td><span class="rtype ${f.recordType}">${f.recordType.replace(/([A-Z])/g, " $1")}</span></td>
    <td class="strong">${f.personName || f.vehicleLabel || "—"}</td>
    <td class="trunc dim">${f.title}</td>
    <td class="dim">${fmtAge(f.updatedAt)}</td>
    <td>${statusPill(f.status === "active" ? "alert" : f.status)}</td>`, f.id, "records")).join("");
  wireRowClicks(body);
}

subscribeUnits(renderUnits);
subscribeCalls(rows => { allCalls = rows; renderCallPanels(); });
subscribeGroups(renderGroups);
subscribeRecords(renderFlags);
