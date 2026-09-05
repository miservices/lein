// =========================================================
// LEIN — shared "find or create" picker for people and vehicles.
// Used by Reports, Citations, and BOLO so that linking a person or
// vehicle into any of those works the same way everywhere, and so a
// person/vehicle typed in on any page ends up as one real record in
// Firestore instead of being duplicated per-page.
// =========================================================
import { createPerson, createVehicle } from "./data-service.js";
import { esc } from "./util.js";

function personLabel(p) { return `${p.last}, ${p.first}${p.middle ? " " + p.middle : ""}`; }
function vehicleLabel(v) { return `${v.plate} - ${v.color || ""} ${v.make || ""} ${v.model || ""}`.replace(/\s+/g, " ").trim(); }

// container: element to render into. people: cached array of person docs.
// onSelect(personDoc): called when an existing or newly-created person is chosen.
export function renderPersonPicker(container, people, onSelect, existingIds = []) {
  container.innerHTML = `
    <div class="field full">
      <label>Link a person</label>
      <input id="pp-search" placeholder="Search by name..." />
      <div id="pp-results" style="margin-top:6px; max-height:160px; overflow-y:auto;"></div>
      <div style="margin-top:6px;"><a href="#" id="pp-new-toggle" style="font-size:12px; color:var(--blue);">+ Add a person not on file</a></div>
      <div id="pp-new-form"></div>
    </div>`;

  const input = container.querySelector("#pp-search");
  const results = container.querySelector("#pp-results");
  input.addEventListener("input", () => {
    const t = input.value.trim().toLowerCase();
    const matches = !t ? [] : people.filter(p => !existingIds.includes(p.id) &&
      [p.first, p.middle, p.last, ...(p.akaNames || [])].join(" ").toLowerCase().includes(t)).slice(0, 8);
    results.innerHTML = matches.map(p => `<div class="unit-option" data-id="${p.id}" style="margin-bottom:4px;">
      <div class="who"><div class="n">${esc(personLabel(p))}</div><div class="d">DOB ${esc(p.dob || "—")}</div></div></div>`).join("");
    results.querySelectorAll(".unit-option").forEach(el => el.addEventListener("click", () => {
      onSelect(people.find(p => p.id === el.dataset.id));
      input.value = ""; results.innerHTML = "";
    }));
  });

  container.querySelector("#pp-new-toggle").addEventListener("click", e => {
    e.preventDefault();
    const formEl = container.querySelector("#pp-new-form");
    if (formEl.childElementCount) { formEl.innerHTML = ""; return; }
    formEl.innerHTML = `
      <div class="form-grid" style="padding:10px 0 0;">
        <div class="field"><label>First name</label><input id="pp-first" /></div>
        <div class="field"><label>Last name</label><input id="pp-last" /></div>
        <div class="field"><label>Date of birth</label><input id="pp-dob" type="date" /></div>
        <div class="field"><label>Address</label><input id="pp-addr" /></div>
      </div>
      <button type="button" id="pp-create-btn" style="margin-top:4px;">Create &amp; link person</button>`;
    formEl.querySelector("#pp-create-btn").addEventListener("click", async () => {
      const first = formEl.querySelector("#pp-first").value.trim();
      const last = formEl.querySelector("#pp-last").value.trim();
      if (!first || !last) { alert("First and last name are required."); return; }
      const id = await createPerson({
        first, last,
        dob: formEl.querySelector("#pp-dob").value || null,
        address: formEl.querySelector("#pp-addr").value.trim()
      });
      const newPerson = { id, first, last };
      people.push(newPerson);
      onSelect(newPerson);
      formEl.innerHTML = "";
    });
  });
}

export function renderVehiclePicker(container, vehicles, onSelect, existingIds = []) {
  container.innerHTML = `
    <div class="field full">
      <label>Link a vehicle</label>
      <input id="vp-search" placeholder="Search by plate or make/model..." />
      <div id="vp-results" style="margin-top:6px; max-height:160px; overflow-y:auto;"></div>
      <div style="margin-top:6px;"><a href="#" id="vp-new-toggle" style="font-size:12px; color:var(--blue);">+ Add a vehicle not on file</a></div>
      <div id="vp-new-form"></div>
    </div>`;

  const input = container.querySelector("#vp-search");
  const results = container.querySelector("#vp-results");
  input.addEventListener("input", () => {
    const t = input.value.trim().toLowerCase();
    const matches = !t ? [] : vehicles.filter(v => !existingIds.includes(v.id) &&
      `${v.plate} ${v.make} ${v.model}`.toLowerCase().includes(t)).slice(0, 8);
    results.innerHTML = matches.map(v => `<div class="unit-option" data-id="${v.id}" style="margin-bottom:4px;">
      <div class="who"><div class="n">${esc(vehicleLabel(v))}</div></div></div>`).join("");
    results.querySelectorAll(".unit-option").forEach(el => el.addEventListener("click", () => {
      onSelect(vehicles.find(v => v.id === el.dataset.id));
      input.value = ""; results.innerHTML = "";
    }));
  });

  container.querySelector("#vp-new-toggle").addEventListener("click", e => {
    e.preventDefault();
    const formEl = container.querySelector("#vp-new-form");
    if (formEl.childElementCount) { formEl.innerHTML = ""; return; }
    formEl.innerHTML = `
      <div class="form-grid" style="padding:10px 0 0;">
        <div class="field"><label>Plate</label><input id="vp-plate" /></div>
        <div class="field"><label>Make</label><input id="vp-make" /></div>
        <div class="field"><label>Model</label><input id="vp-model" /></div>
        <div class="field"><label>Color</label><input id="vp-color" /></div>
      </div>
      <button type="button" id="vp-create-btn" style="margin-top:4px;">Create &amp; link vehicle</button>`;
    formEl.querySelector("#vp-create-btn").addEventListener("click", async () => {
      const plate = formEl.querySelector("#vp-plate").value.trim();
      if (!plate) { alert("Plate is required."); return; }
      const data = {
        plate, make: formEl.querySelector("#vp-make").value.trim(),
        model: formEl.querySelector("#vp-model").value.trim(), color: formEl.querySelector("#vp-color").value.trim()
      };
      const id = await createVehicle(data);
      const newVehicle = { id, ...data };
      vehicles.push(newVehicle);
      onSelect(newVehicle);
      formEl.innerHTML = "";
    });
  });
}

export { personLabel, vehicleLabel };
