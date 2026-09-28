// Recent-match cards. Rendering is driven by the benchmark's match_fields and
// player_fields, so any game's log format displays without custom code.

import { h, fmtDate, ordinal } from "../lib/dom.js";
import { model, benchmarkLabel } from "../lib/data.js";
import { icon } from "../lib/icons.js";

// Renders one match/player field. Numbers get their unit (default: the label).
function fieldValue(bench, f, v) {
  if (v === null || v === undefined) return null;
  if (f.hide_zero && v === 0) return null;
  if (f.format === "label") return benchmarkLabel(bench, v);
  if (typeof v !== "number") return String(v);
  const unit = f.unit ?? f.label.toLowerCase();
  return unit ? `${v.toLocaleString("en-US")} ${unit}` : v.toLocaleString("en-US");
}

export function matchCard(bench, m, { self = null, showGame = false } = {}) {
  const players = [...m.players].sort((a, b) => a.place - b.place);
  const topPlace = players[0].place;
  const tiedTop = players.filter((p) => p.place === topPlace).length > 1;
  const twoPlayer = players.length === 2;

  const list = h("ul", { class: "match-players" },
    players.map((p) => {
      const extras = (bench.player_fields || [])
        .map((f) => fieldValue(bench, f, p[f.key]))
        .filter((v) => v !== null);
      const win = p.place === topPlace && !tiedTop;
      let badge = String(p.place);
      if (twoPlayer) badge = tiedTop ? "½" : win ? "W" : "L";
      return h("li", { class: [win && "win", p.model === self && "self"] },
        h("span", { class: "pl", title: tiedTop ? "Draw" : ordinal(p.place) }, badge),
        h("span", { class: "nm" }, h("a", { href: `#/model/${encodeURIComponent(p.model)}` }, model(p.model).name)),
        h("span", { class: "ex" }, extras.join(" · ")));
    }));

  const meta = (bench.match_fields || [])
    .map((f) => {
      const v = fieldValue(bench, f, m[f.key]);
      if (v === null) return null;
      return h("span", { class: "chip" }, v);
    })
    .filter(Boolean);
  if (m.replay_url) meta.push(h("a", { class: "chip", href: m.replay_url, target: "_blank", rel: "noopener" }, "Replay ↗"));

  return h("article", { class: "card match", style: { "--game": bench.accent } },
    h("div", { class: "match-head" },
      showGame ? h("span", { class: "game" }, icon(bench.icon), bench.name) : h("span", {}, m.id),
      h("span", {}, fmtDate(m.date, true))),
    list,
    meta.length ? h("div", { class: "match-meta" }, meta) : null);
}

export function matchGrid(items, { initial = 9 } = {}) {
  const grid = h("div", { class: "match-grid" });
  const wrap = h("div", {}, grid);
  let shown = 0;
  const more = h("button", { class: "btn btn-ghost", type: "button" }, "Show more");
  const moreRow = h("div", { class: "more-row" }, more);
  const step = () => {
    const next = items.slice(shown, shown + initial);
    next.forEach((el) => grid.appendChild(el()));
    shown += next.length;
    if (shown >= items.length) moreRow.remove();
  };
  more.addEventListener("click", step);
  step();
  if (shown < items.length) wrap.appendChild(moreRow);
  return wrap;
}
