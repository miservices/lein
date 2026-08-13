import { injectNav } from "./nav.js";
import { initAuth } from "./auth.js";
import {
  subscribeUnits, subscribeCalls, subscribeEmergencyCalls, subscribeRecordFlags, subscribeGroups
} from "./data-service.js";
import { DEPT_CLASS } from "./mock-data.js";

injectNav("dashboard");
initAuth();

const STATUS_LABELS = {
  pending: "Pending", active: "Active", alert: "Alert", info: "Info", offduty: "10-7"
};
function statusPill(status) {
  const s = status || "info";
  return `<span class="status ${s}">${STATUS_LABELS[s] || s}</span>`;
}
function mockTag(row) {
  return row.isMock ? `<span class="mock-tag">sample</span>` : "";
}
function rowClasses(row) {
  const classes = [];
  if (row.isMock) classes.push("is-mock");
  if (row.status === "alert") classes.push("flag-hit");
  return classes.join(" ");
}

function renderUnits(rows) {
  const body = document.getElementById("units-body");
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No units on duty.</td></tr>`; return; }
  body.innerHTML = rows.map(u => `
    <tr class="${rowClasses(u)}">
      <td><span class="badge" style="background: var(--${DEPT_CLASS[u.department] || "dept-dispatch"})">${u.unitNumber}</span></td>
      <td>${u.name}${mockTag(u)}</td>
      <td class="dim">${u.department}</td>
      <td class="dim">${u.rank}</td>
      <td>${statusPill(u.status)}</td>
    </tr>`).join("");
}

function renderCalls(rows) {
  const body = document.getElementById("calls-body");
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="6">No active calls.</td></tr>`; return; }
  body.innerHTML = rows.slice(0, 6).map(c => `
    <tr class="${rowClasses(c)}">
      <td class="dim">${c.code || "-"}</td>
      <td class="trunc">${c.callTitle}${mockTag(c)}</td>
      <td class="trunc dim">${c.address}</td>
      <td class="dim">${c.units || "-"}</td>
      <td>${statusPill(c.status)}</td>
    </tr>`).join("");
}

function renderEmergencyCalls(rows) {
  const body = document.getElementById("emergency-body");
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No emergency calls.</td></tr>`; return; }
  body.innerHTML = rows.slice(0, 6).map(c => `
    <tr class="${rowClasses(c)}">
      <td><span class="status ${c.type === "EMERGENCY" ? "alert" : "info"}">${c.type}</span></td>
      <td class="dim">${c.caller}${mockTag(c)}</td>
      <td class="trunc dim">${c.location}</td>
      <td class="trunc dim">${c.description}</td>
    </tr>`).join("");
}

function renderFlags(rows) {
  const body = document.getElementById("flags-body");
  const badge = document.getElementById("flags-count");
  const realHits = rows.filter(r => !r.isMock && r.status === "alert").length;
  badge.textContent = String(realHits);
  badge.style.display = realHits > 0 ? "inline-block" : "none";
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No record flags.</td></tr>`; return; }
  body.innerHTML = rows.map(f => `
    <tr class="${rowClasses(f)}">
      <td>${f.flagType}</td>
      <td class="dim">${f.subject}${mockTag(f)}</td>
      <td class="trunc dim">${f.location}</td>
      <td class="trunc dim">${f.description}</td>
      <td>${statusPill(f.status)}</td>
    </tr>`).join("");
}

function renderGroups(rows) {
  const body = document.getElementById("groups-body");
  if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="3">No groups.</td></tr>`; return; }
  body.innerHTML = rows.map(g => `
    <tr class="${rowClasses(g)}">
      <td>${g.name}${mockTag(g)}</td>
      <td class="dim">${g.department}</td>
      <td>${statusPill(g.status)}</td>
    </tr>`).join("");
}

subscribeUnits(renderUnits);
subscribeCalls(renderCalls);
subscribeEmergencyCalls(renderEmergencyCalls);
subscribeRecordFlags(renderFlags);
subscribeGroups(renderGroups);