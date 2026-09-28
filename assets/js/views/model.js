import { h, fmtInt, fmtSigned, fmtNum, fmtPct } from "../lib/dom.js";
import { model, isBaseline } from "../lib/data.js";
import { icon } from "../lib/icons.js";
import { sparkline } from "../charts/history.js";
import { matchCard, matchGrid } from "../components/matches.js";

function opponents(bench, id) {
  const { models, cells } = bench.head_to_head;
  const i = models.indexOf(id);
  if (i < 0) return { best: null, worst: null };
  const list = cells[i]
    .map((c, j) => (c && c.games >= 5 && j !== i ? { id: models[j], ...c } : null))
    .filter(Boolean);
  if (!list.length) return { best: null, worst: null };
  list.sort((a, b) => b.score - a.score);
  return { best: list[0], worst: list[list.length - 1] };
}

function benchCard(bench, id) {
  const row = bench.leaderboard.find((r) => r.model === id);
  const style = { "--game": bench.accent };
  if (!row) {
    return h("div", { class: "card mb-card absent", style },
      h("div", { class: "mb-head" }, h("div", { class: "game-icon" }, icon(bench.icon)), h("h3", {}, bench.name)),
      h("p", {}, `${model(id).name} hasn't played ${bench.name} yet.`));
  }
  const ffa = (bench.players_per_match || 2) > 2;
  const d = row.delta_30d;
  const { best, worst } = opponents(bench, id);
  const series = bench.history.series[id] || [];

  return h("div", { class: "card mb-card", style },
    h("div", { class: "mb-head" },
      h("div", { class: "game-icon" }, icon(bench.icon)),
      h("h3", {}, bench.name),
      h("a", { class: "link-arrow", href: `#/benchmark/${bench.id}` }, "Leaderboard")),
    h("div", { class: "mb-main" },
      h("div", { class: "mb-elo" }, fmtInt(row.rating)),
      h("div", { class: "mb-rank" }, h("strong", {}, `#${row.rank}`), ` of ${bench.leaderboard.length}`, h("br"),
        h("span", { class: "muted" }, `95% CI ${row.ci[0]}–${row.ci[1]}`))),
    h("div", { class: "mb-spark" }, sparkline(bench.history.dates, series, "var(--game)")),
    h("div", { class: "mb-grid" },
      h("div", {}, h("div", { class: "k" }, "30-day change"), h("div", { class: ["v", d > 0 ? "up" : d < 0 ? "down" : ""] }, d === null ? "new" : fmtSigned(d))),
      h("div", {}, h("div", { class: "k" }, "Games"), h("div", { class: "v" }, fmtInt(row.games))),
      ffa
        ? h("div", {}, h("div", { class: "k" }, "Avg place"), h("div", { class: "v" }, fmtNum(row.avg_place, 2)))
        : h("div", {}, h("div", { class: "k" }, "W–D–L"), h("div", { class: "v" }, `${row.wins}–${row.draws}–${row.losses}`))),
    best
      ? h("div", { class: "mb-opps" },
          h("div", {}, h("div", { class: "k" }, "Best matchup"), h("a", { href: `#/model/${encodeURIComponent(best.id)}` }, model(best.id).name), h("span", { class: "muted" }, ` · ${fmtPct(best.score)}`)),
          h("div", {}, h("div", { class: "k" }, "Toughest opponent"), h("a", { href: `#/model/${encodeURIComponent(worst.id)}` }, model(worst.id).name), h("span", { class: "muted" }, ` · ${fmtPct(worst.score)}`)))
      : null);
}

export function renderModel(index, benches, id) {
  const m = model(id);
  const suite = index.suite.find((r) => r.model === id);
  const played = benches.filter((b) => b.leaderboard?.some((r) => r.model === id));

  const recent = [];
  for (const b of played) for (const mt of b.recent_matches || []) if (mt.players.some((p) => p.model === id)) recent.push({ b, mt });
  recent.sort((a, b) => (a.mt.date < b.mt.date ? 1 : a.mt.date > b.mt.date ? -1 : 0));

  return h("div", { class: "fade-in" },
    h("div", { class: "crumbs" }, h("a", { href: "#/" }, "Agents"), "/", h("span", {}, m.name)),
    h("section", { class: "model-hero" },
      h("div", { class: "eyebrow" }, isBaseline(id) ? "Baseline agent" : "Agent profile"),
      h("h1", { style: { marginTop: "14px" } }, m.name),
      h("div", { class: "lab" }, m.lab),
      h("div", { class: "suite-line" },
        suite ? h("span", { class: "chip" }, `Suite rank #${suite.rank} of ${index.suite.length}`) : null,
        suite ? h("span", { class: "chip" }, `Suite score ${suite.score.toFixed(0)} / 100`) : null,
        isBaseline(id) ? h("span", { class: "chip" }, "Reference opponent · excluded from suite") : null,
        h("span", { class: "chip" }, `${played.length} of ${benches.length} game${benches.length === 1 ? "" : "s"} played`))),
    h("div", { class: "model-bench-grid" }, benches.map((b) => benchCard(b, id))),
    recent.length
      ? h("section", { class: "section" },
          h("div", { class: "section-head" }, h("div", {}, h("div", { class: "eyebrow" }, "Log"), h("h2", { style: { marginTop: "8px" } }, "Recent matches"),
            h("p", { class: "sub" }, "Drawn from each benchmark's most recent games."))),
          matchGrid(recent.map(({ b, mt }) => () => matchCard(b, mt, { self: id, showGame: true }))))
      : null);
}
