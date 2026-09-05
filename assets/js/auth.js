// Handles the gate shown before the dashboard is usable:
//  - never used this browser before  -> pick an existing unit OR create one
//  - used it before (localStorage has a saved unit) -> small "continue as..." login screen
// Fires `document.dispatchEvent(new CustomEvent('lein-auth-ready', { detail: unit }))`
// once a unit is confirmed. Any page can listen for that event.
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { DEPARTMENT_LIST, RANKS, resolveDepartment } from "./util.js";

const STORAGE_KEY = "lein_active_unit";

function proceed(unit) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unit));
  const screen = document.getElementById("auth-screen");
  if (screen) screen.classList.add("hidden");
  document.dispatchEvent(new CustomEvent("lein-auth-ready", { detail: unit }));
}

async function fetchExistingUnits() {
  try {
    const q = query(collection(db, "units"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[LEIN] Could not load existing units.", err.message);
    return [];
  }
}



async function renderFullGate(container) {
  container.innerHTML = `
    <div class="auth-card">
      <div class="auth-head">
        <div class="mark">L</div>
        <h1>Sign in to LEIN</h1>
        <div class="sub">Select an existing unit, or create your own for this session.</div>
      </div>
      <div class="auth-body">
        <div class="auth-tabs">
          <button id="tab-select" class="active">Select unit</button>
          <button id="tab-create">Create unit</button>
        </div>
        <div id="tab-panel"></div>
      </div>
    </div>`;

  const panel = document.getElementById("tab-panel");
  const tabSelect = document.getElementById("tab-select");
  const tabCreate = document.getElementById("tab-create");

  async function showSelect() {
    tabSelect.classList.add("active");
    tabCreate.classList.remove("active");
    panel.innerHTML = `<div class="unit-list" id="unit-list"><div class="d" style="color:var(--text-dim);padding:8px;">Loading units...</div></div>`;
    const units = await fetchExistingUnits();
    const list = document.getElementById("unit-list");
    if (!units.length) {
      list.innerHTML = `<div style="color:var(--text-dim); font-size:12.5px; padding: 8px;">No units created yet. Switch to "Create unit" to make the first one.</div>`;
      return;
    }
    list.innerHTML = units.map(u => {
      const dept = resolveDepartment(u.department);
      return `
      <div class="unit-option" data-id="${u.id}">
        <span class="badge" style="background:var(--blue)">${u.unitNumber}</span>
        <div class="who">
          <div class="n">${u.name}</div>
          <div class="d">${dept.name} &middot; ${u.rank}</div>
        </div>
      </div>`;
    }).join("");
    list.querySelectorAll(".unit-option").forEach(opt => {
      opt.addEventListener("click", () => {
        const unit = units.find(u => u.id === opt.dataset.id);
        proceed(unit);
      });
    });
  }

  function showCreate() {
    tabCreate.classList.add("active");
    tabSelect.classList.remove("active");
    panel.innerHTML = `
      <div class="field">
        <label>Unit number</label>
        <input id="f-unit" placeholder="e.g. 2-L-21" />
      </div>
      <div class="field">
        <label>Name</label>
        <input id="f-name" placeholder="e.g. J. Carter" />
      </div>
      <div class="auth-row2">
        <div class="field">
          <label>Agency</label>
          <input id="f-dept" list="dept-options" placeholder="Choose or type your own" />
          <datalist id="dept-options">${DEPARTMENT_LIST.map(d => `<option value="${d.name}">`).join("")}</datalist>
        </div>
        <div class="field">
          <label>Rank</label>
          <input id="f-rank" list="rank-options" placeholder="Choose or type your own" />
          <datalist id="rank-options">${RANKS.map(r => `<option value="${r}">`).join("")}</datalist>
        </div>
      </div>
      <button id="create-btn" style="width:100%;">Create unit and log in</button>
      <div class="auth-error" id="create-error">Enter a unit number, name, agency, and rank.</div>`;

    document.getElementById("create-btn").addEventListener("click", async () => {
      const unitNumber = document.getElementById("f-unit").value.trim();
      const name = document.getElementById("f-name").value.trim();
      const department = document.getElementById("f-dept").value.trim();
      const rank = document.getElementById("f-rank").value.trim();
      const errEl = document.getElementById("create-error");

      if (!unitNumber || !name || !department || !rank) {
        errEl.classList.add("show");
        return;
      }
      errEl.classList.remove("show");

      const btn = document.getElementById("create-btn");
      btn.disabled = true;
      btn.textContent = "Creating...";

      try {
        const docRef = await addDoc(collection(db, "units"), {
          unitNumber, name, department, rank, status: "active", isMock: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        proceed({ id: docRef.id, unitNumber, name, department, rank, status: "active", isMock: false });
      } catch (err) {
        console.warn("[LEIN] Could not save unit to Firestore, continuing locally.", err.message);
        proceed({ id: `local-${Date.now()}`, unitNumber, name, department, rank, status: "active", isMock: false });
      }
    });
  }

  tabSelect.addEventListener("click", showSelect);
  tabCreate.addEventListener("click", showCreate);
  showSelect();
}

export function initAuth() {
  const container = document.getElementById("auth-screen");
  if (!container) return;
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (saved) {
    // Already signed in on this browser. The overlay starts hidden by
    // default in the HTML (see the "hidden" class on #auth-screen), so
    // there's nothing to show or hide here — just resume the session.
    // Switching units is still one click away via "Switch" in the topbar.
    document.dispatchEvent(new CustomEvent("lein-auth-ready", { detail: saved }));
  } else {
    container.classList.remove("hidden");
    renderFullGate(container);
  }
}