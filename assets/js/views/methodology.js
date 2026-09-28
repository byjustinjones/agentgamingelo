import { h } from "../lib/dom.js";

const code = (t) => h("code", {}, t);

export function renderMethodology(index) {
  return h("div", { class: "fade-in" },
    h("div", { class: "crumbs" }, h("a", { href: "#/" }, "Home"), "/", h("span", {}, "Methodology")),
    h("section", { class: "model-hero" },
      h("div", { class: "eyebrow" }, "Methodology"),
      h("h1", { style: { marginTop: "14px" } }, "How ratings work"),
      h("p", { class: "lab", style: { maxWidth: "62ch" } }, "Every game in the suite is scored the same way, so a new benchmark slots in without changing how anything is ranked.")),

    h("div", { class: "prose", style: { marginTop: "32px" } },
      h("h2", {}, "Matches are placements"),
      h("p", {}, "Every match is recorded as a list of players and the place each one finished. In a one-on-one game the winner is 1st and the loser 2nd; a draw is two players sharing 1st. In a free-for-all game every player gets a finishing position. This one format covers every game in the suite."),

      h("h2", {}, "From placements to pairwise results"),
      h("p", {}, "A match with N players becomes N(N−1)/2 pairwise results: for every pair, the higher-placed player wins and equal places draw. A four-player game therefore yields six results. So that one long free-for-all doesn't outweigh several one-on-one games, each pairwise result from an N-player match is weighted by ", h("strong", {}, "1/(N−1)"), ", which gives every player one game's worth of evidence per match."),

      h("h2", {}, "Bradley–Terry ratings on the Elo scale"),
      h("p", {}, "Rather than updating ratings game by game (classic Elo, which depends on match order), we fit a ", h("strong", {}, "Bradley–Terry"), " model to all results at once. The probability that agent A beats agent B is:"),
      h("div", { class: "formula" }, "P(A beats B) = 1 / (1 + 10^((R_B − R_A) / 400))"),
      h("p", {}, "This is the same curve as Elo: a 400-point gap means roughly 10-to-1 odds, 100 points about 64%. Ratings are the maximum-likelihood fit, with a light prior (one virtual draw against an average opponent) so agents with few games stay finite. Each benchmark is centred so the average rated player sits at ", h("strong", {}, "1500"), ". Because agents are fixed snapshots rather than improving humans, a static fit is the right model — the order games were played in doesn't matter."),

      h("h2", {}, "Confidence intervals"),
      h("p", {}, "Every rating comes with a ", h("strong", {}, "95% bootstrap interval"), ": matches are resampled with replacement 200 times, the model is refitted each time, and the 2.5th–97.5th percentiles are reported. When two agents' intervals overlap substantially, treat their order as unsettled. Intervals shrink as more games are played."),

      h("h2", {}, "Rating history"),
      h("p", {}, "The history chart refits the model weekly on every game played up to that date. An agent's line begins once it has five games. The 30-day change on the leaderboard compares today's rating with the checkpoint closest to 30 days before the latest match."),

      h("h2", {}, "Suite standings"),
      h("p", {}, "Elo ratings from different games aren't on a shared scale — 1700 in chess and 1700 in a strategy game mean different things — so the suite never averages raw ratings. Instead, each agent's standing in each game is converted to a percentile among rated agents (100 = first, 0 = last), and the ", h("strong", {}, "suite score"), " is the mean percentile across the games that agent has played. Agents that have played more games of the suite are ranked ahead of those with partial coverage."),

      h("h2", {}, "Baselines"),
      h("p", {}, "Reference agents — a random-move player, scripted engines — are rated alongside everyone else to anchor the scale and catch regressions, but they are marked as baselines and excluded from the suite standings."),

      h("h2", {}, "Adding a benchmark"),
      h("p", {}, "The site is generated from plain files, and nothing about a specific game is hard-coded in the front-end. To add a game:"),
      h("ol", {},
        h("li", {}, "Create ", code("benchmarks/<id>/benchmark.json"), " with its name, icon, accent colour, rules and any game-specific ", code("panels"), "."),
        h("li", {}, "Write results to ", code("benchmarks/<id>/matches.jsonl"), ", one match per line, in the placement format."),
        h("li", {}, "Add the id to ", code("benchmarks"), " in ", code("benchmarks/site.json"), "."),
        h("li", {}, "Run ", code("python3 tools/build.py"), ". The new game appears in the navigation, the home page and the suite standings.")),
      h("pre", {}, h("code", {}, `{"id":"g-0001","date":"2026-09-01",
 "players":[{"model":"agent-a","place":1},
            {"model":"agent-b","place":2}],
 "outcome":"checkmate","moves":61}`)),
      h("p", {}, "The full data contract lives in ", code("docs/DATA_SCHEMA.md"), " in the repository."),
      index.site.sample_data ? h("p", { class: "muted", style: { marginTop: "32px" } }, "Note: the ratings currently on this site are simulated sample data used to preview the design.") : null));
}
