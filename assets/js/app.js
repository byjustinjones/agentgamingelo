// Entry point: shell (banner, nav, footer, theme) + hash router.
//
// Routes
//   #/                    home: benchmarks + suite standings
//   #/benchmark/<id>      one game's leaderboard and stats
//   #/model/<id>          one agent across every game
//   #/methodology         how ratings are computed

import { h, clear, fmtDate } from "./lib/dom.js";
import { loadIndex, loadBenchmark, liveBenchmarks } from "./lib/data.js";
import { icon } from "./lib/icons.js";
import { renderHome } from "./views/home.js";
import { renderBenchmark } from "./views/benchmark.js";
import { renderModel } from "./views/model.js";
import { renderMethodology } from "./views/methodology.js";

const app = document.getElementById("app");
let index = null;

// ---------- theme ----------

function currentTheme() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t) return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function paintToggle() {
  const btn = document.getElementById("theme-toggle");
  clear(btn).appendChild(icon(currentTheme() === "dark" ? "sun" : "moon"));
  btn.setAttribute("aria-label", currentTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme");
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("age-theme", next); } catch (e) {}
  paintToggle();
  route(); // charts compute some colours in JS, so redraw
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!document.documentElement.getAttribute("data-theme")) { paintToggle(); route(); }
});

// ---------- shell ----------

function renderShell() {
  const site = index.site;
  document.getElementById("brand-name").textContent = site.name;
  document.getElementById("brand-short").textContent = site.short_name || site.name;

  const banner = document.getElementById("banner");
  clear(banner);
  if (site.sample_data) {
    banner.appendChild(h("div", { class: "banner" }, h("strong", {}, "Preview"), " — the agents and ratings shown are simulated sample data."));
  }

  const nav = document.getElementById("nav");
  clear(nav);
  nav.appendChild(h("a", { href: "#/", "data-route": "home" }, icon("grid"), h("span", { class: "nav-label-hide" }, "Overview")));
  for (const b of index.benchmarks) {
    nav.appendChild(h("a", { href: `#/benchmark/${b.id}`, "data-route": `benchmark/${b.id}`, style: { "--game": b.accent } }, icon(b.icon), b.name));
  }
  nav.appendChild(h("a", { href: "#/methodology", "data-route": "methodology" }, icon("book"), h("span", { class: "nav-label-hide" }, "Methodology")));

  const footer = document.getElementById("footer");
  clear(footer);
  footer.append(
    h("div", {}, h("strong", { style: { color: "var(--text)" } }, site.name), ` · ratings generated ${fmtDate(index.generated_at, true)}`),
    h("div", { class: "footer-links" },
      h("a", { href: "#/methodology" }, "Methodology"),
      h("a", { href: "data/index.json" }, "Raw data"),
      (site.links || []).map((l) => h("a", { href: l.url, target: "_blank", rel: "noopener" }, l.label))));
}

function markNav(key) {
  for (const a of document.querySelectorAll("#nav a")) {
    if (a.dataset.route === key) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

// ---------- router ----------

function parse() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [section, ...rest] = raw.split("/");
  return { section: section || "home", arg: rest.length ? decodeURIComponent(rest.join("/")) : null };
}

function notFound(msg) {
  return h("div", { class: "container error-state" }, h("h1", {}, "Not found"), h("p", {}, msg), h("a", { class: "btn btn-ghost", href: "#/", style: { marginTop: "16px" } }, "Back to overview"));
}

let token = 0;
let lastKey = null;

async function route() {
  const my = ++token;
  const { section, arg } = parse();
  const key = arg ? `${section}/${arg}` : section;
  let view;
  try {
    if (section === "home") {
      view = renderHome(index);
      document.title = index.site.name;
    } else if (section === "benchmark" && index.benchmarks.some((b) => b.id === arg)) {
      const bench = await loadBenchmark(arg);
      view = renderBenchmark(bench);
      document.title = `${bench.name} · ${index.site.name}`;
    } else if (section === "model" && index.models.some((m) => m.id === arg)) {
      const benches = await Promise.all(liveBenchmarks(index).map((b) => loadBenchmark(b.id)));
      view = renderModel(index, benches, arg);
      document.title = `${index.models.find((m) => m.id === arg).name} · ${index.site.name}`;
    } else if (section === "methodology") {
      view = renderMethodology(index);
      document.title = `Methodology · ${index.site.name}`;
    } else {
      view = notFound("That page doesn't exist.");
    }
  } catch (err) {
    console.error(err);
    view = notFound(`Couldn't load data (${err.message}).`);
  }
  if (my !== token) return;
  clear(app).appendChild(h("div", { class: "container" }, view));
  markNav(key === "home" ? "home" : key);
  if (key !== lastKey) window.scrollTo(0, 0);
  lastKey = key;
}

// ---------- boot ----------

async function boot() {
  paintToggle();
  try {
    index = await loadIndex();
  } catch (err) {
    console.error(err);
    clear(app).appendChild(h("div", { class: "container error-state" }, h("h1", {}, "No data yet"),
      h("p", {}, "Run ", h("code", {}, "python3 tools/build.py"), " to generate data/index.json, then serve this folder over HTTP.")));
    return;
  }
  renderShell();
  window.addEventListener("hashchange", route);
  route();
}

boot();
