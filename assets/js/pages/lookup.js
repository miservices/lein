import { injectNav } from "../nav.js";
import { initAuth } from "../auth.js";
import {
  subscribePeople, subscribeVehicles, createPerson, createVehicle,
  linkPersonVehicle, getPersonHistory, getVehicleHistory, isFlagWorthy
} from "../data-service.js";
import { renderPersonPicker, renderVehiclePicker, personLabel, vehicleLabel } from "../link-picker.js";
import { esc, fmtAge, fmtDate, initialsBadge } from "../util.js";
import { currentHash, onHashChange, goTo, setPrefill } from "../router.js";

injectNav("lookup");
initAuth();

const root = document.getElementById("page-root");
let people = [];
let vehicles = [];

function render() {
  const hash = currentHash();
  const person = people.find(p => p.id === hash);
  const vehicle = vehicles.find(v => v.id === hash);
  if (person) return renderPersonDetail(person);
  if (vehicle) return renderVehicleDetail(vehicle);
  if (hash === "vehicle") return renderList("vehicle");
  renderList("person");
}

// ---------------- LIST VIEW ----------------
function renderList(tab) {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Lookup</h1><div class="sub">Personal records built from what you enter after a contact — CompuLite handles the in-game record check.</div></div>
    </div>
    <div class="tabbar">
      <button data-tab="person" class="${tab === "person" ? "active" : ""}">People <span class="tab-count">${people.length}</span></button>
      <button data-tab="vehicle" class="${tab === "vehicle" ? "active" : ""}">Vehicles <span class="tab-count">${vehicles.length}</span></button>
    </div>
    <div class="search-bar">
      <input id="search-input" placeholder="${tab === "person" ? "Search by name..." : "Search by plate, make, or model..."}" />
      <button id="add-btn">+ Add ${tab === "person" ? "person" : "vehicle"}</button>
    </div>
    <div id="add-panel"></div>
    <div class="panel"><table>
      <thead>${tab === "person"
        ? "<tr><th>Name</th><th>DOB</th><th>License</th><th>Address</th><th>Times stopped</th></tr>"
        : "<tr><th>Plate</th><th>Vehicle</th><th>Registration</th><th>Insurance</th><th>Stolen</th></tr>"}</thead>
      <tbody id="list-body"></tbody>
    </table></div>`;

  root.querySelectorAll(".tabbar button").forEach(b => b.addEventListener("click", () => goTo(b.dataset.tab === "person" ? "" : b.dataset.tab)));
  document.getElementById("add-btn").addEventListener("click", () => toggleAddPanel(tab));
  const input = document.getElementById("search-input");
  input.addEventListener("input", () => renderRows(tab, input.value.trim().toLowerCase()));
  renderRows(tab, "");
}

function renderRows(tab, term) {
  const body = document.getElementById("list-body");
  if (tab === "person") {
    let rows = people;
    if (term) rows = rows.filter(p => [p.first, p.middle, p.last, ...(p.akaNames || [])].join(" ").toLowerCase().includes(term));
    if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No people match.</td></tr>`; return; }
    body.innerHTML = rows.map(p => `
      <tr class="clickable" data-id="${p.id}">
        <td class="strong">${esc(personLabel(p))}</td>
        <td class="dim">${esc(p.dob || "—")}</td>
        <td>${licenseStatusPill(p.driverLicenseStatus)}</td>
        <td class="trunc dim">${esc(p.address || "—")}</td>
        <td class="dim">${p.timesStopped ?? 0}</td>
      </tr>`).join("");
  } else {
    let rows = vehicles;
    if (term) rows = rows.filter(v => `${v.plate} ${v.make} ${v.model}`.toLowerCase().includes(term));
    if (!rows.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">No vehicles match.</td></tr>`; return; }
    body.innerHTML = rows.map(v => `
      <tr class="clickable" data-id="${v.id}">
        <td class="strong">${esc(v.plate)}</td>
        <td class="dim">${esc(v.year || "")} ${esc(v.color || "")} ${esc(v.make || "")} ${esc(v.model || "")}</td>
        <td>${statusPill(v.registrationStatus)}</td>
        <td>${statusPill(v.insuranceStatus)}</td>
        <td>${v.stolen ? `<span class="status alert">STOLEN</span>` : `<span class="status active">Clear</span>`}</td>
      </tr>`).join("");
  }
  body.querySelectorAll("tr.clickable").forEach(tr => tr.addEventListener("click", () => goTo(tr.dataset.id)));
}

function licenseStatusPill(s) {
  const map = { valid: "active", suspended: "alert", revoked: "alert", expired: "pending" };
  return `<span class="status ${map[s] || "info"}">${esc(s || "unknown")}</span>`;
}
function statusPill(s) {
  const map = { valid: "active", expired: "pending", suspended: "alert", revoked: "alert", invalid: "alert" };
  return `<span class="status ${map[s] || "info"}">${esc(s || "unknown")}</span>`;
}

function toggleAddPanel(tab) {
  const panel = document.getElementById("add-panel");
  if (panel.childElementCount) { panel.innerHTML = ""; return; }
  if (tab === "person") {
    panel.innerHTML = `
      <div class="panel"><div class="panel-head">Add a person</div>
      <div class="form-grid">
        <div class="field"><label>First name</label><input id="np-first" /></div>
        <div class="field"><label>Middle name</label><input id="np-middle" /></div>
        <div class="field"><label>Last name</label><input id="np-last" /></div>
        <div class="field"><label>Date of birth</label><input id="np-dob" type="date" /></div>
        <div class="field"><label>Sex</label><select id="np-sex"><option>M</option><option>F</option></select></div>
        <div class="field"><label>Race</label><input id="np-race" /></div>
        <div class="field"><label>Height</label><input id="np-height" placeholder="5'10&quot;" /></div>
        <div class="field"><label>Weight</label><input id="np-weight" placeholder="180" /></div>
        <div class="field"><label>Eye color</label><input id="np-eye" /></div>
        <div class="field"><label>Hair color</label><input id="np-hair" /></div>
        <div class="field full"><label>Address</label><input id="np-address" /></div>
        <div class="field"><label>Driver license #</label><input id="np-dl" /></div>
        <div class="field"><label>Driver license status</label>
          <select id="np-dlstatus"><option value="valid">Valid</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option><option value="expired">Expired</option></select>
        </div>
        <div class="field full"><label>Notes</label><textarea id="np-notes" rows="2"></textarea></div>
      </div>
      <div class="form-actions"><button class="secondary" id="np-cancel" type="button">Cancel</button><button id="np-save" type="button">Save person</button></div></div>`;
    panel.querySelector("#np-cancel").addEventListener("click", () => panel.innerHTML = "");
    panel.querySelector("#np-save").addEventListener("click", async () => {
      const first = panel.querySelector("#np-first").value.trim();
      const last = panel.querySelector("#np-last").value.trim();
      if (!first || !last) { alert("First and last name are required."); return; }
      const id = await createPerson({
        first, middle: panel.querySelector("#np-middle").value.trim(), last,
        dob: panel.querySelector("#np-dob").value || null,
        sex: panel.querySelector("#np-sex").value, race: panel.querySelector("#np-race").value.trim(),
        height: panel.querySelector("#np-height").value.trim(), weight: panel.querySelector("#np-weight").value.trim(),
        eyeColor: panel.querySelector("#np-eye").value.trim(), hairColor: panel.querySelector("#np-hair").value.trim(),
        address: panel.querySelector("#np-address").value.trim(),
        driverLicenseNumber: panel.querySelector("#np-dl").value.trim(),
        driverLicenseStatus: panel.querySelector("#np-dlstatus").value,
        notes: panel.querySelector("#np-notes").value.trim()
      });
      goTo(id);
    });
  } else {
    panel.innerHTML = `
      <div class="panel"><div class="panel-head">Add a vehicle</div>
      <div class="form-grid">
        <div class="field"><label>Plate</label><input id="nv-plate" /></div>
        <div class="field"><label>Year</label><input id="nv-year" /></div>
        <div class="field"><label>Make</label><input id="nv-make" /></div>
        <div class="field"><label>Model</label><input id="nv-model" /></div>
        <div class="field"><label>Color</label><input id="nv-color" /></div>
        <div class="field"><label>Registration status</label>
          <select id="nv-reg"><option value="valid">Valid</option><option value="expired">Expired</option><option value="suspended">Suspended</option></select>
        </div>
        <div class="field"><label>Insurance status</label>
          <select id="nv-ins"><option value="valid">Valid</option><option value="expired">Expired</option><option value="invalid">Invalid</option></select>
        </div>
        <div class="field"><label>Stolen</label><select id="nv-stolen"><option value="false">No</option><option value="true">Yes</option></select></div>
      </div>
      <div class="form-actions"><button class="secondary" id="nv-cancel" type="button">Cancel</button><button id="nv-save" type="button">Save vehicle</button></div></div>`;
    panel.querySelector("#nv-cancel").addEventListener("click", () => panel.innerHTML = "");
    panel.querySelector("#nv-save").addEventListener("click", async () => {
      const plate = panel.querySelector("#nv-plate").value.trim();
      if (!plate) { alert("Plate is required."); return; }
      const id = await createVehicle({
        plate, year: panel.querySelector("#nv-year").value.trim(), make: panel.querySelector("#nv-make").value.trim(),
        model: panel.querySelector("#nv-model").value.trim(), color: panel.querySelector("#nv-color").value.trim(),
        registrationStatus: panel.querySelector("#nv-reg").value, insuranceStatus: panel.querySelector("#nv-ins").value,
        stolen: panel.querySelector("#nv-stolen").value === "true"
      });
      goTo(id);
    });
  }
}

// ---------------- PERSON DETAIL ----------------
async function renderPersonDetail(p) {
  root.innerHTML = `<div class="back-link" id="back-link">&larr; Back to lookup</div><div class="banner">Loading record...</div>`;
  document.getElementById("back-link").addEventListener("click", () => goTo(""));

  const { reports, citations, records } = await getPersonHistory(p.id);
  const flags = records.filter(isFlagWorthy);
  const linkedVehicles = (p.linkedVehicleIds || []).map(vid => vehicles.find(v => v.id === vid)).filter(Boolean);

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to lookup</div>
    <div class="detail-head">
      <div class="avatar">${initialsBadge(`${p.first} ${p.last}`)}</div>
      <div class="who">
        <div class="title">${esc(personLabel(p))}${(p.akaNames || []).length ? ` <span style="color:var(--text-dim); font-weight:400; font-size:12px;">aka ${esc(p.akaNames.join(", "))}</span>` : ""}</div>
        <div class="meta">DOB ${esc(p.dob || "—")} &middot; ${esc(p.sex || "—")} &middot; ${esc(p.race || "—")} &middot; ${esc(p.height || "—")}, ${esc(p.weight || "—")} lbs &middot; Eyes ${esc(p.eyeColor || "—")}, Hair ${esc(p.hairColor || "—")}</div>
      </div>
    </div>

    ${flags.length ? `<div class="panel"><div class="panel-head">Active flags</div><div class="chip-row" style="padding-top:14px;">
      ${flags.map(f => `<span class="rtype ${f.recordType}" style="cursor:pointer;" data-rec="${f.id}">${f.recordType.replace(/([A-Z])/g, " $1")}</span>`).join(" ")}
    </div></div>` : ""}

    <div class="panel">
      <div class="panel-head">Profile</div>
      <div class="kv-grid">
        <div class="kv"><span class="k">Address</span><span class="v dim">${esc(p.address || "—")}</span></div>
        <div class="kv"><span class="k">Driver license #</span><span class="v dim">${esc(p.driverLicenseNumber || "—")}</span></div>
        <div class="kv"><span class="k">License status</span><span class="v">${licenseStatusPill(p.driverLicenseStatus)}</span></div>
        <div class="kv"><span class="k">Gun permit</span><span class="v dim">${esc(p.gunPermitStatus || "none")}</span></div>
        <div class="kv"><span class="k">Gun license</span><span class="v dim">${esc(p.gunLicenseStatus || "none")}</span></div>
        <div class="kv"><span class="k">Probation</span><span class="v dim">${p.probation ? "Active" : "No"}</span></div>
        <div class="kv"><span class="k">Parole</span><span class="v dim">${p.parole ? "Active" : "No"}</span></div>
        <div class="kv"><span class="k">Times stopped</span><span class="v dim">${p.timesStopped ?? 0}</span></div>
      </div>
      ${p.notes ? `<div class="kv-grid" style="padding-top:0;"><div class="kv"><span class="k">Notes</span><span class="v dim" style="font-weight:400;">${esc(p.notes)}</span></div></div>` : ""}

      <div class="quick-actions">
        <button data-action="report">Create incident report</button>
        <button class="secondary" data-action="citation">Create citation</button>
        <button class="secondary" data-action="bolo">Create BOLO</button>
        <button class="secondary" data-action="record">Add record entry</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Linked vehicles</div>
      <div class="chip-row" style="padding-top:14px;">
        ${linkedVehicles.map(v => `<span class="chip" data-veh="${v.id}">${esc(vehicleLabel(v))}</span>`).join("")}
        <span class="chip chip-add" id="link-vehicle-toggle">+ Link vehicle</span>
      </div>
      <div id="link-vehicle-panel"></div>
    </div>

    <div class="panel">
      <div class="panel-head">History</div>
      <div class="timeline">
        ${renderHistoryItems(reports, citations, records)}
      </div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo(""));
  root.querySelectorAll("[data-rec]").forEach(el => el.addEventListener("click", () => window.location.href = `records/#${el.dataset.rec}`));
  root.querySelectorAll("[data-veh]").forEach(el => el.addEventListener("click", () => goTo(el.dataset.veh)));
  root.querySelectorAll(".timeline-item[data-goto]").forEach(el => el.addEventListener("click", () => window.location.href = el.dataset.goto));

  root.querySelector("[data-action='report']").addEventListener("click", () => {
    setPrefill({ type: "person", id: p.id, label: personLabel(p) });
    window.location.href = "reports/#new";
  });
  root.querySelector("[data-action='citation']").addEventListener("click", () => {
    setPrefill({ type: "person", id: p.id, label: personLabel(p) });
    window.location.href = "citations/#new";
  });
  root.querySelector("[data-action='bolo']").addEventListener("click", () => {
    setPrefill({ type: "person", id: p.id, label: personLabel(p) });
    window.location.href = "bolo/#new";
  });
  root.querySelector("[data-action='record']").addEventListener("click", () => {
    setPrefill({ type: "person", id: p.id, label: personLabel(p) });
    window.location.href = "records/#new";
  });

  document.getElementById("link-vehicle-toggle").addEventListener("click", () => {
    const panel = document.getElementById("link-vehicle-panel");
    if (panel.childElementCount) { panel.innerHTML = ""; return; }
    renderVehiclePicker(panel, vehicles, async (v) => {
      await linkPersonVehicle(p.id, v.id);
      panel.innerHTML = `<div class="banner success">Linked. Refresh the profile to see it in the list above.</div>`;
    }, p.linkedVehicleIds || []);
  });
}

function renderHistoryItems(reports, citations, records) {
  const items = [
    ...reports.map(r => ({ kind: "Report", type: r.type, title: r.title, when: r.updatedAt, href: `reports/#${r.id}` })),
    ...citations.map(c => ({ kind: "Citation", type: c.disposition, title: c.violation, when: c.updatedAt, href: `citations/#${c.id}` })),
    ...records.map(r => ({ kind: "Record", type: r.recordType, title: r.title, when: r.updatedAt, href: `records/#${r.id}` }))
  ].sort((a, b) => (b.when?.toMillis?.() || 0) - (a.when?.toMillis?.() || 0));
  if (!items.length) return `<div style="padding:16px; color:var(--text-faint); font-size:12px;">No reports, citations, or records on file for this person yet.</div>`;
  return items.map(it => `
    <div class="timeline-item" data-goto="${it.href}">
      <div class="t-badge"><span class="status info">${esc(it.kind)}</span></div>
      <div class="t-body"><div class="t-title">${esc(it.title)}</div><div class="t-desc">${esc(it.type || "")}</div></div>
      <div class="t-when">${fmtAge(it.when)}</div>
    </div>`).join("");
}

// ---------------- VEHICLE DETAIL ----------------
async function renderVehicleDetail(v) {
  root.innerHTML = `<div class="back-link" id="back-link">&larr; Back to lookup</div><div class="banner">Loading record...</div>`;
  document.getElementById("back-link").addEventListener("click", () => goTo("vehicle"));

  const { reports, citations, records } = await getVehicleHistory(v.id);
  const flags = records.filter(isFlagWorthy);
  const linkedPeople = (v.linkedPersonIds || []).map(pid => people.find(p => p.id === pid)).filter(Boolean);
  const owner = people.find(p => p.id === v.registeredOwnerPersonId);

  root.innerHTML = `
    <div class="back-link" id="back-link">&larr; Back to lookup</div>
    <div class="detail-head">
      <div class="avatar">${esc((v.make || "V")[0])}${esc((v.model || "")[0] || "")}</div>
      <div class="who">
        <div class="title">${esc(v.plate)} ${v.stolen ? `<span class="status alert">STOLEN</span>` : ""}</div>
        <div class="meta">${esc(v.year || "—")} ${esc(v.color || "")} ${esc(v.make || "")} ${esc(v.model || "")}</div>
      </div>
    </div>

    ${flags.length ? `<div class="panel"><div class="panel-head">Active flags</div><div class="chip-row" style="padding-top:14px;">
      ${flags.map(f => `<span class="rtype ${f.recordType}" style="cursor:pointer;" data-rec="${f.id}">${f.recordType.replace(/([A-Z])/g, " $1")}</span>`).join(" ")}
    </div></div>` : ""}

    <div class="panel">
      <div class="panel-head">Profile</div>
      <div class="kv-grid">
        <div class="kv"><span class="k">Registration</span><span class="v">${statusPill(v.registrationStatus)}</span></div>
        <div class="kv"><span class="k">Insurance</span><span class="v">${statusPill(v.insuranceStatus)}</span></div>
        <div class="kv"><span class="k">Registered owner</span><span class="v dim">${owner ? esc(personLabel(owner)) : "—"}</span></div>
      </div>
      <div class="quick-actions">
        <button data-action="report">Create incident report</button>
        <button class="secondary" data-action="citation">Create citation</button>
        <button class="secondary" data-action="bolo">Create BOLO</button>
        <button class="secondary" data-action="record">Add record entry</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Linked people</div>
      <div class="chip-row" style="padding-top:14px;">
        ${linkedPeople.map(p => `<span class="chip" data-per="${p.id}">${esc(personLabel(p))}</span>`).join("")}
        <span class="chip chip-add" id="link-person-toggle">+ Link person</span>
      </div>
      <div id="link-person-panel"></div>
    </div>

    <div class="panel">
      <div class="panel-head">History</div>
      <div class="timeline">${renderHistoryItems(reports, citations, records)}</div>
    </div>`;

  document.getElementById("back-link").addEventListener("click", () => goTo("vehicle"));
  root.querySelectorAll("[data-rec]").forEach(el => el.addEventListener("click", () => window.location.href = `records/#${el.dataset.rec}`));
  root.querySelectorAll("[data-per]").forEach(el => el.addEventListener("click", () => goTo(el.dataset.per)));
  root.querySelectorAll(".timeline-item[data-goto]").forEach(el => el.addEventListener("click", () => window.location.href = el.dataset.goto));

  root.querySelector("[data-action='report']").addEventListener("click", () => {
    setPrefill({ type: "vehicle", id: v.id, label: vehicleLabel(v) });
    window.location.href = "reports/#new";
  });
  root.querySelector("[data-action='citation']").addEventListener("click", () => {
    setPrefill({ type: "vehicle", id: v.id, label: vehicleLabel(v) });
    window.location.href = "citations/#new";
  });
  root.querySelector("[data-action='bolo']").addEventListener("click", () => {
    setPrefill({ type: "vehicle", id: v.id, label: vehicleLabel(v) });
    window.location.href = "bolo/#new";
  });
  root.querySelector("[data-action='record']").addEventListener("click", () => {
    setPrefill({ type: "vehicle", id: v.id, label: vehicleLabel(v) });
    window.location.href = "records/#new";
  });

  document.getElementById("link-person-toggle").addEventListener("click", () => {
    const panel = document.getElementById("link-person-panel");
    if (panel.childElementCount) { panel.innerHTML = ""; return; }
    renderPersonPicker(panel, people, async (p) => {
      await linkPersonVehicle(p.id, v.id);
      panel.innerHTML = `<div class="banner success">Linked. Refresh the profile to see it in the list above.</div>`;
    }, v.linkedPersonIds || []);
  });
}

onHashChange(render);
subscribePeople(rows => { people = rows; render(); });
subscribeVehicles(rows => { vehicles = rows; render(); });
