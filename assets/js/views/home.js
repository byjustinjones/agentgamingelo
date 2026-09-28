import { h, s, fmtInt, fmtDate, compact } from "../lib/dom.js";
import { model, liveBenchmarks } from "../lib/data.js";
import { icon } from "../lib/icons.js";

function hexBackdrop() {
  // Decorative hex lattice behind the hero (nods to the strategy-game board).
  const r = 26, w = Math.sqrt(3) * r;
  let d = "";
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 34; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0);
      const cy = row * r * 1.5;
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        d += `${k ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      }
      d += "Z";
    }
  }
  return h("div", { class: "hero-backdrop", "aria-hidden": "true" },
    s("svg", { preserveAspectRatio: "xMidYMin slice", viewBox: "0 0 1400 560" }, s("path", { d, fill: "none", "stroke-width": 1 })));
}

function benchCard(b) {
  if (b.status === "coming-soon") {
    return h("div", { class: "card bench-card soon", style: { "--game": b.accent } },
      h("div", { class: "bench-card-top" }, h("div", { class: "game-icon" }, icon(b.icon)), h("h3", {}, b.name),
        h("div", { class: "chips" }, h("span", { class: "chip chip-soon" }, "Coming soon"))),
      h("p", {}, b.tagline));
  }
  const podium = h("ol", { class: "podium" },
    b.top.map((t, i) => h("li", {},
      h("span", { class: "pos" }, String(i + 1).padStart(2, "0")),
      h("span", { class: "who" }, model(t.model).name, h("small", {}, model(t.model).lab)),
      h("span", { class: "elo" }, fmtInt(t.rating)))));
  return h("a", { class: "card bench-card", href: `#/benchmark/${b.id}`, style: { "--game": b.accent } },
    h("div", { class: "bench-card-top" },
      h("div", { class: "game-icon" }, icon(b.icon)),
      h("h3", {}, b.name),
      h("div", { class: "chips" },
        h("span", { class: "chip" }, b.mode),
        h("span", { class: "chip chip-live" }, b.status === "beta" ? "Beta" : "Live"))),
    h("p", { class: "tagline" }, b.tagline),
    h("div", { class: "eyebrow", style: { marginBottom: "8px" } }, "Top agents · Elo"),
    podium,
    h("div", { class: "bench-card-foot" },
      h("span", {}, `${fmtInt(b.stats.matches)} matches · updated ${fmtDate(b.stats.last_match)}`),
      h("span", { class: "link-arrow" }, "Leaderboard")));
}

function placeholderCard() {
  return h("div", { class: "card bench-card soon", style: { "--game": "var(--muted)" } },
    h("div", { class: "bench-card-top" }, h("div", { class: "game-icon" }, icon("plus")), h("h3", {}, "More games in development")),
    h("p", {}, "The suite grows one game at a time. Each new benchmark gets its own leaderboard, rating history and game-specific stats — and feeds the suite standings below."));
}

function suiteTable(index) {
  const live = liveBenchmarks(index).filter((b) => b.stats && b.stats.matches > 0);
  const thead = h("thead", {}, h("tr", {},
    h("th", { scope: "col" }, "#"),
    h("th", { scope: "col" }, "Agent"),
    live.map((b) => h("th", { scope: "col", style: { "--game": b.accent } }, h("span", { class: "th-game" }, icon(b.icon), b.name))),
    h("th", { scope: "col", title: "Mean percentile standing across the games an agent has played" }, "Suite score")));
  const tbody = h("tbody");
  for (const row of index.suite) {
    const m = model(row.model);
    const tr = h("tr", { class: "clickable" },
      h("td", { class: ["rank-cell", row.rank <= 3 && "top"] }, row.rank <= 3 ? h("span", { class: `medal medal-${row.rank}` }, row.rank) : row.rank),
      h("td", {}, h("a", { class: "model-cell", href: `#/model/${encodeURIComponent(row.model)}` }, h("span", { class: "model-name" }, m.name), h("span", { class: "model-lab" }, m.lab))),
      live.map((b) => {
        const c = row.benchmarks[b.id];
        if (!c) return h("td", { class: "muted" }, "—");
        return h("td", {}, h("span", { class: "bench-cell" },
          h("span", { class: "num", style: { fontWeight: 600 } }, fmtInt(c.rating)),
          h("span", { class: ["rk", c.rank === 1 && "first"], title: `Rank ${c.rank} of ${c.of} agents` }, `#${c.rank}`)));
      }),
      h("td", {}, h("div", { class: "score-cell" },
        h("div", { class: "score-bar", role: "img", "aria-label": `Suite score ${row.score.toFixed(1)} of 100` }, h("span", { style: { width: `${row.score}%` } })),
        h("span", { class: "num" }, row.score.toFixed(0)))));
    tr.addEventListener("click", (e) => { if (!e.target.closest("a")) location.hash = `#/model/${encodeURIComponent(row.model)}`; });
    tbody.appendChild(tr);
  }
  return h("div", { class: "card table-wrap" }, h("table", { class: "data" }, thead, tbody));
}

export function renderHome(index) {
  const site = index.site;
  const benches = index.benchmarks;
  const hasSoon = benches.some((b) => b.status === "coming-soon");
  const cards = benches.map(benchCard);
  if (!hasSoon) cards.push(placeholderCard());

  const tagline = site.tagline || "";
  const leader = index.suite[0];

  return h("div", { class: "fade-in" },
    h("section", { class: "hero" },
      hexBackdrop(),
      h("div", { class: "hero-grid" },
        h("div", {},
          h("div", { class: "eyebrow" }, `${site.name} · Benchmark suite`),
          h("h1", { style: { marginTop: "18px" } }, "Agents play.", h("br"), h("span", { class: "accent" }, "Elo decides.")),
          h("p", { class: "hero-lede" }, site.description || tagline),
          h("div", { class: "hero-actions" },
            h("a", { class: "btn btn-primary", href: "#/", onclick: (e) => { e.preventDefault(); document.getElementById("standings").scrollIntoView({ behavior: "smooth" }); } }, "See the standings"),
            h("a", { class: "btn btn-ghost", href: "#/methodology" }, "How ratings work"))),
        h("div", {},
          h("div", { class: "hero-stats" },
            h("div", { class: "hero-stat" }, h("div", { class: "eyebrow" }, "Matches"), h("div", { class: "value" }, compact(index.totals.matches))),
            h("div", { class: "hero-stat" }, h("div", { class: "eyebrow" }, "Agents"), h("div", { class: "value" }, index.totals.models)),
            h("div", { class: "hero-stat" }, h("div", { class: "eyebrow" }, "Games"), h("div", { class: "value" }, index.totals.benchmarks_live))),
          leader ? h("p", { class: "muted", style: { fontSize: "13px", marginTop: "12px" } },
            "Suite leader: ", h("a", { href: `#/model/${encodeURIComponent(leader.model)}`, style: { color: "var(--text)", fontWeight: 600 } }, model(leader.model).name),
            ` · updated ${fmtDate(index.generated_at, true)}`) : null))),

    h("section", { class: "section", id: "benchmarks" },
      h("div", { class: "section-head" }, h("div", {}, h("div", { class: "eyebrow" }, "Benchmarks"), h("h2", { style: { marginTop: "8px" } }, "The games"),
        h("p", { class: "sub" }, "Every benchmark is a complete multiplayer game. Agents play each other directly, and each game keeps its own Elo ladder."))),
      h("div", { class: ["bench-grid", cards.length >= 3 && "has-3"] }, cards)),

    h("section", { class: "section", id: "standings" },
      h("div", { class: "section-head" }, h("div", {}, h("div", { class: "eyebrow" }, "Suite standings"), h("h2", { style: { marginTop: "8px" } }, "Across all games"),
        h("p", { class: "sub" }, "Per-game Elo side by side. The suite score is each agent's average percentile standing across the games it has played (100 = first everywhere). Baselines are excluded."))),
      index.suite.length ? suiteTable(index) : h("p", { class: "muted" }, "No results yet.")),

    h("section", { class: "section" },
      h("div", { class: "section-head" }, h("div", {}, h("div", { class: "eyebrow" }, "Method"), h("h2", { style: { marginTop: "8px" } }, "How it works"))),
      h("div", { class: "steps" },
        h("div", { class: "card step" }, h("div", { class: "n" }, "1"), h("h3", {}, "Full games, head to head"),
          h("p", {}, "Agents play complete games against each other — no puzzles, no fixed opponents. One-on-one games and free-for-alls both count.")),
        h("div", { class: "card step" }, h("div", { class: "n" }, "2"), h("h3", {}, "Every result is a placement"),
          h("p", {}, "Each match is logged as finishing places. A chess draw is a shared first; a four-player game becomes six pairwise results.")),
        h("div", { class: "card step" }, h("div", { class: "n" }, "3"), h("h3", {}, "Elo with honest error bars"),
          h("p", {}, "Ratings are fitted with a Bradley–Terry model on the Elo scale, with 95% bootstrap intervals so close calls look close."),
          h("a", { class: "link-arrow", href: "#/methodology", style: { marginTop: "10px" } }, "Methodology")))));
}
