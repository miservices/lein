// Shared navigation. Every page includes:
//   <div id="app-topbar"></div>  ... page content ...  <div id="app-bottombar"></div>
//   <script type="module"> import { injectNav } from "/assets/js/nav.js"; injectNav("dashboard"); </script>
// Add new pages to NAV_ITEMS here ONCE and every page's nav updates.
import { DEPT_CLASS } from "./mock-data.js";

export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/index.html" },
  { key: "calls", label: "911 calls", href: "/calls/active.html" },
  { key: "lookup", label: "Lookup", href: "/lookup/person.html" },
  { key: "reports", label: "Reports", href: "/reports/incident/list.html" },
  { key: "citations", label: "Citations", href: "/citations/list.html" },
  { key: "bolo", label: "BOLO", href: "/bolo/list.html" },
  { key: "records", label: "Records", href: "/records/index.html" },
  { key: "units", label: "Units", href: "/units/roster.html" }
];

function navHtml(activeKey) {
  const links = NAV_ITEMS.map(
    item => `<a href="${item.href}" class="${item.key === activeKey ? "active" : ""}">${item.label}</a>`
  ).join("");
  return `
    <div class="toolbar">
      <a class="logo" href="/index.html">
        <div class="mark">L</div>
        <div>
          <div class="name">LEIN Terminal</div>
          <div class="sub">Flint, MI &middot; Genesee County</div>
        </div>
      </a>
      <div class="nav">${links}</div>
      <div class="spacer"></div>
      <div class="pill unit" id="nav-unit-pill">Not signed in</div>
      <div class="pill link-btn" id="nav-switch-btn" title="Switch unit">Switch</div>
    </div>`;
}

function bottombarHtml() {
  return `
    <div class="bottombar">
      <div class="item">Flint PD</div>
      <div class="item">Genesee Co. SO</div>
      <div class="item">MSP - Flint Post</div>
      <div class="item">Flint Fire / EMS</div>
      <div class="spacer"></div>
      <div class="clock" id="nav-clock">--:--:--</div>
    </div>`;
}

export function injectNav(activeKey) {
  const top = document.getElementById("app-topbar");
  const bottom = document.getElementById("app-bottombar");
  if (top) top.innerHTML = navHtml(activeKey);
  if (bottom) bottom.innerHTML = bottombarHtml();

  const tick = () => {
    const el = document.getElementById("nav-clock");
    if (el) el.textContent = new Date().toTimeString().slice(0, 8);
  };
  tick();
  setInterval(tick, 1000);

  const switchBtn = document.getElementById("nav-switch-btn");
  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      localStorage.removeItem("lein_active_unit");
      window.location.reload();
    });
  }

  // Reflect whatever unit is already saved, in case this page loads
  // after auth already happened on a previous page.
  const saved = JSON.parse(localStorage.getItem("lein_active_unit") || "null");
  if (saved) updateNavUnit(saved);

  document.addEventListener("lein-auth-ready", e => updateNavUnit(e.detail));
}

export function updateNavUnit(unit) {
  const pill = document.getElementById("nav-unit-pill");
  if (!pill || !unit) return;
  pill.textContent = `${unit.unitNumber} \u00b7 ${unit.name}`;
  const cls = DEPT_CLASS[unit.department];
  pill.style.borderColor = cls ? "var(--blue)" : "";
}