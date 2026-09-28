import { h, fmtInt, fmtDate } from "../lib/dom.js";
import { model, isBaseline } from "../lib/data.js";
import { icon } from "../lib/icons.js";
import { leaderboard } from "../components/leaderboard.js";
import { historyChart } from "../charts/history.js";
import { headToHead, panel } from "../charts/panels.js";
import { matchCard, matchGrid } from "../components/matches.js";

function sectionHead(eyebrow, title, sub, extra) {
  return h("div", { class: "section-head" },
    h("div", {}, h("div", { class: "eyebrow" }, eyebrow), h("h2", { style: { marginTop: "8px" } }, title), sub ? h("p", { class: "sub" }, sub) : null),
    extra || null);
}

function pageNav(items) {
  const nav = h("nav", { class: "page-nav", "aria-label": "On this page" },
    items.map(([id, label]) => h("a", { href: `#sec-${id}`, "data-sec": id, onclick: (e) => {
      e.preventDefault();
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } }, label)));
  // highlight the section in view
  requestAnimationFrame(() => {
    const links = [...nav.querySelectorAll("a")];
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.dataset.sec === en.target.id.slice(4)));
      }
    }, { rootMargin: "-140px 0px -60% 0px" });
    items.forEach(([id]) => { const el = document.getElementById(`sec-${id}`); if (el) io.observe(el); });
  });
  return nav;
}

export function renderBenchmark(bench) {
  if (bench.status === "coming-soon" || !bench.leaderboard || !bench.leaderboard.length) {
    return h("div", { class: "fade-in", style: { "--game": bench.accent } },
      h("div", { class: "crumbs" }, h("a", { href: "#/" }, "Benchmarks"), "/", h("span", {}, bench.name)),
      h("div", { class: "card bench-hero" },
        h("div", { class: "big-icon" }, icon(bench.icon, "big")),
        h("div", { class: "title-row" }, h("div", { class: "game-icon" }, icon(bench.icon)), h("h1", {}, bench.name), h("span", { class: "chip chip-soon" }, "Coming soon")),
        h("p", { class: "tagline" }, bench.tagline),
        (bench.description || []).map((p) => h("p", { class: "text-2", style: { marginTop: "12px", maxWidth: "70ch" } }, p))));
  }

  const lb = bench.leaderboard;
  const leader = lb[0];
  const ffa = (bench.players_per_match || 2) > 2;
  const agents = lb.filter((r) => !isBaseline(r.model)).length;

  const facts = h("div", { class: "facts" },
    h("span", { class: "fact" }, h("span", { class: "k" }, "Mode"), bench.mode),
    (bench.facts || []).slice(0, 4).map((f) => h("span", { class: "fact" }, h("span", { class: "k" }, f.label), f.value)));

  const hero = h("div", { class: "card bench-hero" },
    h("div", { class: "big-icon" }, icon(bench.icon, "big")),
    h("div", { class: "title-row" },
      h("div", { class: "game-icon" }, icon(bench.icon)),
      h("h1", {}, bench.name),
      h("span", { class: "chip chip-live" }, bench.status === "beta" ? "Beta" : "Live")),
    h("p", { class: "tagline" }, bench.tagline),
    facts);

  const stats = h("div", { class: "stat-row" },
    h("div", { class: "card stat" }, h("div", { class: "label" }, "Leader"),
      h("div", { class: "value sm" }, h("a", { href: `#/model/${encodeURIComponent(leader.model)}` }, model(leader.model).name)),
      h("div", { class: "foot" }, `${fmtInt(leader.rating)} Elo · ±${Math.round((leader.ci[1] - leader.ci[0]) / 2)}`)),
    h("div", { class: "card stat" }, h("div", { class: "label" }, "Matches played"), h("div", { class: "value" }, fmtInt(bench.stats.matches)),
      h("div", { class: "foot" }, `since ${fmtDate(bench.stats.first_match, true)}`)),
    h("div", { class: "card stat" }, h("div", { class: "label" }, "Agents rated"), h("div", { class: "value" }, agents),
      h("div", { class: "foot" }, lb.length > agents ? `+ ${lb.length - agents} baseline${lb.length - agents > 1 ? "s" : ""}` : "no baselines")),
    h("div", { class: "card stat" }, h("div", { class: "label" }, "Last match"), h("div", { class: "value" }, fmtDate(bench.stats.last_match)),
      h("div", { class: "foot" }, h("a", { href: `data/benchmarks/${bench.id}.json`, class: "link-arrow", download: "" }, "Download data"))));

  const panels = bench.panels || [];
  const navItems = [["leaderboard", "Leaderboard"], ["history", "Rating history"], ["h2h", "Head-to-head"]];
  if (panels.length) navItems.push(["stats", "Game stats"]);
  navItems.push(["matches", "Recent matches"], ["about", "About"]);

  const ffaNote = ffa
    ? `Free-for-all results count as pairwise games: finishing ahead of an opponent is a win against them.`
    : `Draws count as half a win.`;

  return h("div", { class: "fade-in", style: { "--game": bench.accent } },
    h("div", { class: "crumbs" }, h("a", { href: "#/" }, "Benchmarks"), "/", h("span", {}, bench.name)),
    hero,
    stats,
    pageNav(navItems),

    h("section", { class: "section", id: "sec-leaderboard" },
      sectionHead("Leaderboard", `${bench.name} Elo`, `Bradley–Terry ratings on the Elo scale, centred at ${bench.rating?.center ?? 1500}. Bars show 95% bootstrap intervals — overlapping bars mean the order isn't settled. ${ffaNote}`),
      leaderboard(bench)),

    h("section", { class: "section", id: "sec-history" },
      sectionHead("Trend", "Rating history", "Ratings refit weekly on all games played up to that date. Lines start once an agent has five games."),
      h("div", { class: "card card-pad" }, historyChart(bench))),

    h("section", { class: "section", id: "sec-h2h" },
      sectionHead("Matchups", "Head-to-head", ffa ? "Pairwise score between every two agents who have shared a table: how often the row agent finished ahead of the column agent." : "How the row agent scores against each opponent, ordered by rank."),
      h("div", { class: "card card-pad" }, headToHead(bench))),

    panels.length
      ? h("section", { class: "section", id: "sec-stats" },
          sectionHead("Game stats", `How ${bench.name} is played`, "Game-specific breakdowns, computed from match logs."),
          h("div", { class: "two-col" }, panels.map((p) => panel(p, bench))))
      : null,

    h("section", { class: "section", id: "sec-matches" },
      sectionHead("Log", "Recent matches", null),
      matchGrid((bench.recent_matches || []).map((m) => () => matchCard(bench, m)))),

    h("section", { class: "section", id: "sec-about" },
      sectionHead("About", `About ${bench.name}`, null),
      h("div", { class: "about-grid" },
        h("div", { class: "card card-pad" },
          h("div", { class: "prose" }, (bench.description || []).map((p) => h("p", {}, p))),
          bench.rules && bench.rules.length ? h("div", {}, h("h3", { class: "card-title", style: { margin: "22px 0 12px" } }, "Rules & setup"), h("ul", { class: "rules" }, bench.rules.map((r) => h("li", {}, h("span", {}, r))))) : null),
        h("div", { class: "card card-pad" },
          h("h3", { class: "card-title", style: { marginBottom: "8px" } }, "At a glance"),
          h("dl", { class: "facts-list" },
            h("div", {}, h("dt", {}, "Mode"), h("dd", {}, bench.mode)),
            h("div", {}, h("dt", {}, "Players per match"), h("dd", {}, bench.players_per_match)),
            (bench.facts || []).map((f) => h("div", {}, h("dt", {}, f.label), h("dd", {}, f.value))),
            h("div", {}, h("dt", {}, "Rating method"), h("dd", {}, "Bradley–Terry (Elo scale)")),
            h("div", {}, h("dt", {}, "Bootstrap resamples"), h("dd", {}, bench.rating?.bootstrap ?? "—")))))));
}
