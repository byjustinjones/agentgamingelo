// Head-to-head heatmap + generic game-specific panels (distribution, average).
// Panels are declared per benchmark in benchmark.json, so a new game gets its
// own charts without touching this file.

import { h, fmtPct, fmtNum, bindTooltip } from "../lib/dom.js";
import { model, isBaseline } from "../lib/data.js";
import { divergingColor, divergingGradient, seriesVar, inkOn, MAX_SERIES } from "../lib/colors.js";

const modelLink = (id) => h("a", { href: `#/model/${encodeURIComponent(id)}` }, model(id).name);

// ---------- Head-to-head ----------

export function headToHead(bench) {
  const { models, cells } = bench.head_to_head;
  const n = models.length;
  const grid = h("div", {
    class: "h2h",
    style: { gridTemplateColumns: `minmax(120px, 170px) repeat(${n}, minmax(30px, 46px))`, width: "fit-content", minWidth: `${140 + n * 32}px` },
    role: "table",
    "aria-label": "Head-to-head score: row agent versus column agent",
  });

  grid.appendChild(h("div", { class: "hc", role: "columnheader" }, ""));
  models.forEach((id, j) => grid.appendChild(h("div", { class: "hc", role: "columnheader", title: model(id).name }, `#${j + 1}`)));

  models.forEach((rowId, i) => {
    grid.appendChild(
      h("div", { class: "hl", role: "rowheader" }, h("span", { class: "rk" }, `#${i + 1}`), h("span", {}, model(rowId).name))
    );
    models.forEach((colId, j) => {
      const c = cells[i][j];
      if (i === j) {
        grid.appendChild(h("div", { class: "cell self", role: "cell", "aria-label": "Same agent" }));
        return;
      }
      if (!c) {
        const el = h("div", { class: "cell empty", role: "cell", tabindex: 0, "aria-label": `${model(rowId).name} has not played ${model(colId).name}` });
        bindTooltip(el, () => h("div", {}, h("div", { class: "tt-title" }, `${model(rowId).name} vs ${model(colId).name}`), h("div", { class: "tt-sub" }, "No games yet")));
        grid.appendChild(el);
        return;
      }
      const { bg, fg } = divergingColor(c.score);
      const el = h(
        "div",
        { class: "cell", role: "cell", tabindex: 0, style: { background: bg, color: fg }, "aria-label": `${model(rowId).name} scores ${fmtPct(c.score)} against ${model(colId).name} over ${c.games} games` },
        Math.round(c.score * 100)
      );
      bindTooltip(el, () =>
        h("div", {},
          h("div", { class: "tt-title" }, `${model(rowId).name} vs ${model(colId).name}`),
          h("div", { class: "tt-big" }, fmtPct(c.score)),
          h("div", { class: "tt-sub" }, `score over ${c.games} game${c.games === 1 ? "" : "s"}`))
      );
      grid.appendChild(el);
    });
  });

  const scale = h("div", { class: "h2h-scale" },
    h("span", {}, "Row loses"),
    h("span", { class: "grad", style: { background: divergingGradient() } }),
    h("span", {}, "Row wins"),
    h("span", { style: { marginLeft: "auto" } }, "Cells show the row agent's score % (wins + ½ draws)."));

  return h("div", {}, h("div", { class: "h2h-wrap" }, grid), scale);
}

// ---------- Panels ----------

export function panel(p, bench) {
  const card = h("div", { class: "card card-pad" }, h("h3", { class: "card-title" }, p.title), p.subtitle ? h("p", { class: "card-sub" }, p.subtitle) : null);
  if (p.type === "distribution") card.appendChild(distribution(p));
  else if (p.type === "average") card.appendChild(average(p, bench));
  else card.appendChild(h("p", { class: "muted" }, `Unsupported panel type “${p.type}”.`));
  return card;
}

function distribution(p) {
  const cats = p.categories.slice(0, MAX_SERIES);
  const legend = h("div", { class: "legend legend-static" },
    cats.map((c, k) => h("span", { class: "legend-item" }, h("span", { class: "key-rect", style: { background: seriesVar(k) } }), c.label)));

  const rows = h("div", { class: "hbars" });
  for (const r of p.rows) {
    const stack = h("div", { class: ["stack", r.n === 0 && "empty"] });
    if (r.n > 0) {
      cats.forEach((c, k) => {
        const v = r.values[k] || 0;
        if (v <= 0) return;
        const seg = h("div", {
          class: "seg",
          tabindex: 0,
          style: { flex: `${v} 1 0`, background: seriesVar(k), color: inkOn(k) },
          "aria-label": `${model(r.model).name}: ${c.label} ${fmtPct(v)}`,
        });
        // label only when it fits comfortably; tooltip carries the rest
        if (v >= 0.12) seg.textContent = fmtPct(v);
        bindTooltip(seg, () =>
          h("div", {},
            h("div", { class: "tt-title" }, model(r.model).name),
            h("div", { class: "tt-row" }, h("span", { class: "key-line", style: { background: seriesVar(k) } }), h("span", { class: "v" }, fmtPct(v, 1)), h("span", { class: "n" }, c.label)),
            h("div", { class: "tt-sub" }, `of ${r.n} ${p.filter === "wins" ? "wins" : "games"}`))
        );
        stack.appendChild(seg);
      });
    }
    rows.appendChild(
      h("div", { class: ["hbar-row", isBaseline(r.model) && "baseline"] },
        h("div", { class: "lbl", title: model(r.model).name }, modelLink(r.model)),
        r.n > 0 ? stack : h("div", { class: "hbar-track" }, h("span", { class: "muted", style: { fontSize: "12px" } }, p.filter === "wins" ? "No wins yet" : "No games")))
    );
  }
  return h("div", {}, legend, rows);
}

function average(p, bench) {
  const rows = p.rows.filter((r) => r.value !== null && r.value !== undefined);
  const sorted = [...rows].sort((a, b) => (p.lower_is_better ? a.value - b.value : b.value - a.value));
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const decimals = max < 10 ? 2 : 1;
  const list = h("div", { class: "hbars" });
  for (const r of sorted) {
    const fill = h("div", {
      class: "hbar-fill",
      tabindex: 0,
      style: { width: `calc(${(r.value / max) * 100}% - 64px)`, background: "var(--game)" },
      "aria-label": `${model(r.model).name}: ${fmtNum(r.value, decimals)} ${p.unit || ""}`,
    });
    bindTooltip(fill, () =>
      h("div", {}, h("div", { class: "tt-title" }, model(r.model).name), h("div", { class: "tt-big" }, `${fmtNum(r.value, decimals)} ${p.unit || ""}`), h("div", { class: "tt-sub" }, `mean over ${r.n} games`))
    );
    list.appendChild(
      h("div", { class: ["hbar-row", isBaseline(r.model) && "baseline"] },
        h("div", { class: "lbl", title: model(r.model).name }, modelLink(r.model)),
        h("div", { class: "hbar-track" }, fill, h("span", { class: "hbar-val" }, fmtNum(r.value, decimals))))
    );
  }
  const note = h("p", { class: "panel-note" }, `${p.lower_is_better ? "Lower is better · " : ""}Sorted by value${p.unit ? ` · ${p.unit}` : ""}.`);
  return h("div", {}, list, note);
}
