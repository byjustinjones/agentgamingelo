// Tiny DOM helpers. Text children always become text nodes, so data
// (model names, labels from JSON) is never interpreted as HTML.

const SVG_NS = "http://www.w3.org/2000/svg";

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function applyAttrs(el, attrs, isSvg) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.setAttribute("class", Array.isArray(v) ? v.filter(Boolean).join(" ") : v);
    else if (k === "style" && typeof v === "object") {
      for (const [p, val] of Object.entries(v)) {
        if (val === null || val === undefined) continue;
        if (p.startsWith("--")) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    } else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") el.innerHTML = v; // only ever used with static, trusted markup (icons)
    else if (!isSvg && k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
}

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  applyAttrs(el, attrs, false);
  return append(el, children);
}

export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyAttrs(el, attrs, true);
  return append(el, children);
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// ---------- formatting ----------

const nf = new Intl.NumberFormat("en-US");
export const fmtInt = (n) => (n === null || n === undefined ? "—" : nf.format(Math.round(n)));
export const fmtPct = (x, digits = 0) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(digits)}%`);
export const fmtNum = (x, digits = 1) => (x === null || x === undefined ? "—" : x.toFixed(digits));

export function fmtSigned(n) {
  if (n === null || n === undefined) return "—";
  const r = Math.round(n);
  if (r === 0) return "±0";
  return (r > 0 ? "+" : "−") + Math.abs(r);
}

export function compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return nf.format(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function parseDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmtDate(iso, withYear = false) {
  if (!iso) return "—";
  const d = parseDate(iso);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${base}, ${d.getUTCFullYear()}` : base;
}
export const monthName = (d) => MONTHS[d.getUTCMonth()];

export function titleCase(key) {
  return String(key).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------- tooltip (one shared instance) ----------

let tipEl = null;
function tip() {
  if (!tipEl) {
    tipEl = h("div", { class: "tooltip", role: "tooltip" });
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

export function showTooltip(content, x, y) {
  const el = tip();
  clear(el);
  append(el, [content]);
  el.classList.add("show");
  const pad = 14;
  const { width, height } = el.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + width > window.innerWidth - 8) left = x - width - pad;
  if (top + height > window.innerHeight - 8) top = y - height - pad;
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, top)}px`;
}

export function hideTooltip() {
  if (tipEl) tipEl.classList.remove("show");
}

// Attach hover + keyboard-focus tooltip behaviour to a mark.
export function bindTooltip(el, build) {
  el.addEventListener("pointermove", (e) => showTooltip(build(), e.clientX, e.clientY));
  el.addEventListener("pointerleave", hideTooltip);
  el.addEventListener("focus", () => {
    const r = el.getBoundingClientRect();
    showTooltip(build(), r.right, r.top);
  });
  el.addEventListener("blur", hideTooltip);
}

// Re-run `draw(width)` whenever the container's width changes.
export function onResize(el, draw) {
  let last = -1;
  const ro = new ResizeObserver((entries) => {
    const w = Math.floor(entries[0].contentRect.width);
    if (w !== last && w > 0) {
      last = w;
      draw(w);
    }
  });
  ro.observe(el);
  return ro;
}
