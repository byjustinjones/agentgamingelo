// Elo-over-time line chart with toggleable series, crosshair tooltip,
// keyboard scrubbing, and collision-aware direct end labels.

import { h, s, clear, fmtDate, fmtInt, monthName, parseDate, onResize, showTooltip, hideTooltip } from "../lib/dom.js";
import { SlotAllocator, seriesVar, MAX_SERIES } from "../lib/colors.js";
import { linear, niceDomain } from "./scale.js";
import { model, isBaseline } from "../lib/data.js";

const DEFAULT_VISIBLE = 5;

export function historyChart(bench) {
  const { dates, series } = bench.history;
  const order = bench.leaderboard.map((r) => r.model).filter((id) => series[id]);
  const slots = new SlotAllocator();
  const selected = new Set();

  // Default: top N non-baseline agents; colours are allocated in that order.
  for (const id of order.filter((id) => !isBaseline(id)).slice(0, DEFAULT_VISIBLE)) {
    selected.add(id);
    slots.get(id);
  }

  const legend = h("div", { class: "legend", role: "group", "aria-label": "Agents shown on chart" });
  const chartEl = h("div", { class: "chart" });
  const wrap = h("div", {}, legend, chartEl);
  let width = 0;

  function toggle(id) {
    if (selected.has(id)) {
      if (selected.size === 1) return;
      selected.delete(id);
      slots.release(id);
    } else {
      if (selected.size >= MAX_SERIES) return;
      selected.add(id);
      slots.get(id);
    }
    renderLegend();
    if (width) draw(width);
  }

  function renderLegend() {
    clear(legend);
    for (const id of order) {
      const on = selected.has(id);
      const slot = on ? slots.get(id) : null;
      legend.appendChild(
        h(
          "button",
          {
            class: "legend-toggle",
            type: "button",
            "aria-pressed": on ? "true" : "false",
            disabled: !on && selected.size >= MAX_SERIES,
            onclick: () => toggle(id),
          },
          h("span", { class: "key-line", style: on ? { background: seriesVar(slot) } : null }),
          model(id).name
        )
      );
    }
    legend.appendChild(h("span", { class: "legend-hint" }, `Click to compare · up to ${MAX_SERIES}`));
  }

  function draw(w) {
    width = w;
    clear(chartEl);
    const narrow = w < 640;
    const H = narrow ? 280 : 360;
    const m = { top: 12, right: narrow ? 12 : 150, bottom: 28, left: 44 };
    const iw = w - m.left - m.right;
    const ih = H - m.top - m.bottom;

    const visible = order.filter((id) => selected.has(id));
    const times = dates.map((d) => parseDate(d).getTime());
    const x = linear([times[0], times[times.length - 1]], [0, iw]);

    let lo = Infinity, hi = -Infinity;
    for (const id of visible) for (const v of series[id]) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const yd = niceDomain(lo, hi, narrow ? 4 : 6);
    const y = linear([yd.lo, yd.hi], [ih, 0]);

    const svg = s("svg", { width: w, height: H, viewBox: `0 0 ${w} ${H}`, role: "img", "aria-label": `Elo rating over time for ${visible.map((id) => model(id).name).join(", ")}` });
    const g = s("g", { transform: `translate(${m.left},${m.top})` });
    svg.appendChild(g);

    // grid + y ticks
    const grid = s("g", { class: "grid" });
    const yt = s("g", { class: "tick" });
    for (const t of yd.ticks) {
      grid.appendChild(s("line", { x1: 0, x2: iw, y1: Math.round(y(t)) + 0.5, y2: Math.round(y(t)) + 0.5 }));
      yt.appendChild(s("text", { x: -10, y: y(t), dy: "0.32em", "text-anchor": "end" }, fmtInt(t)));
    }
    g.append(grid, yt);

    // x ticks: first date of each month
    const xt = s("g", { class: "tick" });
    let lastMonth = -1;
    dates.forEach((d, i) => {
      const dt = parseDate(d);
      if (dt.getUTCMonth() !== lastMonth) {
        lastMonth = dt.getUTCMonth();
        const px = x(times[i]);
        if (px > iw - 24 && i !== 0) return;
        xt.appendChild(s("text", { x: px, y: ih + 20, "text-anchor": i === 0 ? "start" : "middle" }, monthName(dt)));
      }
    });
    g.append(xt, s("line", { class: "baseline-axis", x1: 0, x2: iw, y1: ih + 0.5, y2: ih + 0.5 }));

    // lines
    const ends = [];
    for (const id of visible) {
      const vals = series[id];
      let d = "";
      let pen = false;
      let last = null;
      vals.forEach((v, i) => {
        if (v === null) { pen = false; return; }
        d += `${pen ? "L" : "M"}${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
        last = i;
      });
      if (last === null) continue;
      const color = seriesVar(slots.get(id));
      g.appendChild(s("path", { d, fill: "none", style: { stroke: color }, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      ends.push({ id, i: last, v: vals[last], px: x(times[last]), py: y(vals[last]), color });
    }
    for (const e of ends) {
      g.appendChild(s("circle", { cx: e.px, cy: e.py, r: 4, style: { fill: e.color, stroke: "var(--surface-1)" }, "stroke-width": 2 }));
    }

    // direct end labels (wide layouts only), spread to avoid collisions
    if (!narrow && ends.length) {
      const gap = 16;
      const labels = ends.map((e) => ({ ...e, ly: e.py })).sort((a, b) => a.ly - b.ly);
      for (let pass = 0; pass < 30; pass++) {
        let moved = false;
        for (let k = 1; k < labels.length; k++) {
          const overlap = labels[k - 1].ly + gap - labels[k].ly;
          if (overlap > 0) {
            labels[k - 1].ly -= overlap / 2;
            labels[k].ly += overlap / 2;
            moved = true;
          }
        }
        labels.forEach((l) => (l.ly = Math.max(6, Math.min(ih - 6, l.ly))));
        if (!moved) break;
      }
      const lx = iw + 18;
      for (const l of labels) {
        if (Math.abs(l.ly - l.py) > 1.5 || l.px < iw - 1) {
          g.appendChild(s("path", { class: "leader", d: `M${l.px + 6},${l.py} L${lx - 12},${l.py} L${lx - 4},${l.ly}` }));
        }
        const name = model(l.id).name;
        g.appendChild(
          s("text", { class: "end-label", x: lx, y: l.ly, dy: "0.32em" },
            name.length > 16 ? name.slice(0, 15) + "…" : name,
            s("tspan", { class: "v", dx: 6 }, fmtInt(l.v)))
        );
      }
    }

    // hover layer: crosshair snaps to nearest checkpoint
    const hover = s("g", { style: { display: "none" } });
    const cross = s("line", { class: "crosshair", y1: 0, y2: ih });
    hover.appendChild(cross);
    const dots = visible.map((id) => {
      const c = s("circle", { r: 4, style: { fill: seriesVar(slots.get(id)), stroke: "var(--surface-1)" }, "stroke-width": 2 });
      hover.appendChild(c);
      return { id, c };
    });
    g.appendChild(hover);

    const overlay = s("rect", { x: 0, y: 0, width: iw, height: ih, fill: "transparent", tabindex: 0, "aria-label": "Chart: use arrow keys to step through dates" });
    g.appendChild(overlay);

    let idx = dates.length - 1;
    const show = (i, cx, cy) => {
      idx = i;
      const px = x(times[i]);
      hover.style.display = "";
      cross.setAttribute("x1", px);
      cross.setAttribute("x2", px);
      for (const { id, c } of dots) {
        const v = series[id][i];
        c.style.display = v === null ? "none" : "";
        if (v !== null) { c.setAttribute("cx", px); c.setAttribute("cy", y(v)); }
      }
      const rows = visible
        .map((id) => ({ id, v: series[id][i] }))
        .filter((r) => r.v !== null)
        .sort((a, b) => b.v - a.v);
      const content = h("div", {},
        h("div", { class: "tt-title" }, fmtDate(dates[i], true)),
        rows.length ? rows.map((r) => h("div", { class: "tt-row" },
          h("span", { class: "key-line", style: { background: seriesVar(slots.get(r.id)) } }),
          h("span", { class: "v" }, fmtInt(r.v)),
          h("span", { class: "n" }, model(r.id).name))) : h("div", { class: "tt-sub" }, "Not yet rated"));
      if (cx === undefined) {
        const box = svg.getBoundingClientRect();
        cx = box.left + m.left + px;
        cy = box.top + m.top + 10;
      }
      showTooltip(content, cx, cy);
    };
    const nearest = (clientX) => {
      const box = svg.getBoundingClientRect();
      const t = x.invert(clientX - box.left - m.left);
      let best = 0;
      for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - t) < Math.abs(times[best] - t)) best = i;
      return best;
    };
    const hide = () => { hover.style.display = "none"; hideTooltip(); };
    overlay.addEventListener("pointermove", (e) => show(nearest(e.clientX), e.clientX, e.clientY));
    overlay.addEventListener("pointerleave", hide);
    overlay.addEventListener("focus", () => show(idx));
    overlay.addEventListener("blur", hide);
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(Math.max(0, idx - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(Math.min(dates.length - 1, idx + 1)); }
    });

    chartEl.appendChild(svg);
  }

  renderLegend();
  onResize(chartEl, draw);
  return wrap;
}

// Single-series sparkline with an area wash (model page).
export function sparkline(dates, values, color, { height = 56 } = {}) {
  const el = h("div", { class: "chart" });
  onResize(el, (w) => {
    clear(el);
    const pts = values.map((v, i) => (v === null ? null : [i, v])).filter(Boolean);
    if (pts.length < 2) return;
    const lo = Math.min(...pts.map((p) => p[1]));
    const hi = Math.max(...pts.map((p) => p[1]));
    const x = linear([0, values.length - 1], [2, w - 6]);
    const y = linear([lo - 5, hi + 5], [height - 4, 4]);
    const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    const area = `${line}L${x(pts[pts.length - 1][0])},${height}L${x(pts[0][0])},${height}Z`;
    const last = pts[pts.length - 1];
    const svg = s("svg", { width: w, height, viewBox: `0 0 ${w} ${height}`, role: "img", "aria-label": `Rating trend from ${fmtInt(pts[0][1])} to ${fmtInt(last[1])}` },
      s("path", { d: area, style: { fill: color, opacity: 0.1 } }),
      s("path", { d: line, fill: "none", style: { stroke: color }, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }),
      s("circle", { cx: x(last[0]), cy: y(last[1]), r: 4, style: { fill: color, stroke: "var(--surface-1)" }, "stroke-width": 2 }));
    // hover: nearest point
    const hover = s("circle", { r: 4, style: { fill: color, stroke: "var(--surface-1)", display: "none" }, "stroke-width": 2 });
    svg.appendChild(hover);
    svg.addEventListener("pointermove", (e) => {
      const box = svg.getBoundingClientRect();
      const i = Math.round(x.invert(e.clientX - box.left));
      const p = pts.reduce((a, b) => (Math.abs(b[0] - i) < Math.abs(a[0] - i) ? b : a));
      hover.setAttribute("cx", x(p[0]));
      hover.setAttribute("cy", y(p[1]));
      hover.style.display = "";
      showTooltip(h("div", {}, h("div", { class: "tt-title" }, fmtDate(dates[p[0]], true)), h("div", { class: "tt-big" }, fmtInt(p[1]))), e.clientX, e.clientY);
    });
    svg.addEventListener("pointerleave", () => { hover.style.display = "none"; hideTooltip(); });
    el.appendChild(svg);
  });
  return el;
}
