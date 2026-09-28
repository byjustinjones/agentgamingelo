// Sortable leaderboard with an inline 95% CI range plot on a shared scale.

import { h, clear, fmtInt, fmtSigned, fmtNum } from "../lib/dom.js";
import { model, isBaseline } from "../lib/data.js";

export function leaderboard(bench) {
  const rows = bench.leaderboard;
  const ffa = (bench.players_per_match || 2) > 2;

  let lo = Infinity, hi = -Infinity;
  for (const r of rows) { lo = Math.min(lo, r.ci[0]); hi = Math.max(hi, r.ci[1]); }
  // Tight shared scale, snapped to 50 so the axis labels stay round.
  const dom = { lo: Math.floor((lo - 10) / 50) * 50, hi: Math.ceil((hi + 10) / 50) * 50 };
  const pos = (v) => ((v - dom.lo) / (dom.hi - dom.lo)) * 100;

  const winPct = (r) => (r.games ? r.wins / r.games : 0);

  const columns = [
    { key: "rank", label: "#", cls: "", sort: (r) => r.rank },
    { key: "model", label: "Agent", sort: (r) => model(r.model).name.toLowerCase() },
    { key: "rating", label: "Elo", cls: "r", sort: (r) => r.rating, desc: true },
    { key: "ci", label: "95% CI", cls: "ci-col hide-sm", sort: (r) => r.ci[1] - r.ci[0] },
    { key: "delta", label: "30d", cls: "r", sort: (r) => r.delta_30d ?? -Infinity, desc: true, title: "Rating change over the last 30 days" },
    { key: "games", label: "Games", cls: "r hide-sm", sort: (r) => r.games, desc: true },
    ffa
      ? { key: "win", label: "Win %", cls: "r", sort: winPct, desc: true, title: "Share of games finished outright first" }
      : { key: "record", label: "W–D–L", cls: "r", sort: (r) => r.wins, desc: true },
    ffa
      ? { key: "place", label: "Avg place", cls: "r", sort: (r) => r.avg_place, title: "Mean finishing position (1 = first)" }
      : null,
    { key: "score", label: "Score", cls: "r hide-sm", sort: (r) => r.score_pct, desc: true, title: ffa ? "Pairwise score vs every opponent in the same game" : "(Wins + ½ draws) / games" },
  ].filter(Boolean);

  let sortKey = "rank";
  let sortDesc = false;

  const thead = h("thead");
  const tbody = h("tbody");
  const table = h("table", { class: "data" }, thead, tbody);

  function cell(col, r) {
    switch (col.key) {
      case "rank":
        return h("td", { class: ["rank-cell", r.rank <= 3 && "top"] }, r.rank <= 3 ? h("span", { class: `medal medal-${r.rank}` }, r.rank) : r.rank);
      case "model": {
        const m = model(r.model);
        return h("td", {},
          h("a", { class: "model-cell", href: `#/model/${encodeURIComponent(r.model)}` },
            h("span", { class: "model-name" }, m.name, isBaseline(r.model) ? h("span", { class: "tag-baseline" }, "baseline") : null),
            h("span", { class: "model-lab" }, m.lab)));
      }
      case "rating":
        return h("td", { class: "r elo-cell" }, fmtInt(r.rating));
      case "ci":
        return h("td", { class: "ci-col hide-sm", title: `${r.ci[0]} – ${r.ci[1]}` },
          h("div", { class: "ci-track", role: "img", "aria-label": `95% interval ${r.ci[0]} to ${r.ci[1]}` },
            h("span", { class: "ci-bar", style: { left: `${pos(r.ci[0])}%`, width: `${pos(r.ci[1]) - pos(r.ci[0])}%` } }),
            h("span", { class: "ci-dot", style: { left: `${pos(r.rating)}%` } })),
          h("div", { class: "ci-text" }, `−${r.rating - r.ci[0]} / +${r.ci[1] - r.rating}`));
      case "delta": {
        const d = r.delta_30d;
        const cls = d === null || d === undefined ? "muted" : d > 0 ? "up" : d < 0 ? "down" : "muted";
        return h("td", { class: `r delta ${cls}`, title: d === null ? "New in the last 30 days" : null }, d === null || d === undefined ? "new" : fmtSigned(d));
      }
      case "games":
        return h("td", { class: "r num hide-sm" }, fmtInt(r.games));
      case "record":
        return h("td", { class: "r record" }, h("span", { class: "w" }, r.wins), h("span", { class: "sep" }, "–"), r.draws, h("span", { class: "sep" }, "–"), r.losses);
      case "win":
        return h("td", { class: "r num" }, `${Math.round(winPct(r) * 100)}%`);
      case "place":
        return h("td", { class: "r num" }, fmtNum(r.avg_place, 2));
      case "score":
        return h("td", { class: "r num hide-sm" }, `${fmtNum(r.score_pct, 1)}%`);
    }
  }

  function render() {
    clear(thead);
    clear(tbody);
    const tr = h("tr");
    for (const col of columns) {
      const active = col.key === sortKey;
      const th = h("th", {
        class: [col.cls, "sortable"],
        scope: "col",
        title: col.title,
        "aria-sort": active ? (sortDesc ? "descending" : "ascending") : "none",
        tabindex: 0,
      });
      if (col.key === "ci") {
        th.appendChild(h("div", {}, col.label));
        th.appendChild(h("div", { class: "ci-axis" }, h("span", {}, dom.lo), h("span", {}, dom.hi)));
      } else {
        th.append(col.label, h("span", { class: "sort-ind" }, active ? (sortDesc ? "↓" : "↑") : ""));
      }
      const activate = () => {
        if (sortKey === col.key) sortDesc = !sortDesc;
        else { sortKey = col.key; sortDesc = !!col.desc; }
        render();
      };
      th.addEventListener("click", activate);
      th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
      tr.appendChild(th);
    }
    thead.appendChild(tr);

    const col = columns.find((c) => c.key === sortKey);
    const sorted = [...rows].sort((a, b) => {
      const va = col.sort(a), vb = col.sort(b);
      const c = va < vb ? -1 : va > vb ? 1 : a.rank - b.rank;
      return sortDesc ? -c : c;
    });
    for (const r of sorted) {
      const row = h("tr", { class: ["clickable", isBaseline(r.model) && "baseline"] }, columns.map((c) => cell(c, r)));
      row.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        location.hash = `#/model/${encodeURIComponent(r.model)}`;
      });
      tbody.appendChild(row);
    }
  }

  render();
  return h("div", { class: "card table-wrap" }, table);
}
