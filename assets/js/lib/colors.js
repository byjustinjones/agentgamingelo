// Colour logic for charts.
//
// Categorical: 8 validated slots (see --series-N in style.css). Colour follows
// the entity — a SlotAllocator hands each series the lowest free slot and keeps
// it until that series is removed, so toggling one line never repaints others.
//
// Diverging: blue (row wins) ↔ neutral grey ↔ red (row loses), interpolated in
// OKLab so perceived steps are even.

export const MAX_SERIES = 8;

export const seriesVar = (slot) => `var(--series-${slot + 1})`;

export class SlotAllocator {
  constructor() {
    this.map = new Map();
  }
  get(id) {
    if (this.map.has(id)) return this.map.get(id);
    const used = new Set(this.map.values());
    for (let i = 0; i < MAX_SERIES; i++) {
      if (!used.has(i)) {
        this.map.set(id, i);
        return i;
      }
    }
    return null; // caller must cap selections at MAX_SERIES
  }
  release(id) {
    this.map.delete(id);
  }
  has(id) {
    return this.map.has(id);
  }
}

export function isDark() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// ---- OKLab interpolation ----

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
};
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, fromLin(c))));
}

const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

function mix(hexA, hexB, t) {
  const A = rgbToOklab(hexToRgb(hexA));
  const B = rgbToOklab(hexToRgb(hexB));
  return rgbToHex(oklabToRgb(A.map((v, i) => v + (B[i] - v) * t)));
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DIVERGING = {
  light: { pos: "#1c5cab", mid: "#f0efec", neg: "#c23b3b" },
  dark: { pos: "#3987e5", mid: "#383835", neg: "#e66767" },
};

// score in [0,1]; 0.5 → neutral. Returns { bg, fg } with fg chosen for contrast.
export function divergingColor(score) {
  const p = isDark() ? DIVERGING.dark : DIVERGING.light;
  const d = Math.max(-1, Math.min(1, (score - 0.5) * 2));
  // ease so small edges still read, but 50/50 stays neutral
  const t = Math.sign(d) * Math.pow(Math.abs(d), 0.8);
  const bg = t >= 0 ? mix(p.mid, p.pos, t) : mix(p.mid, p.neg, -t);
  const fg = luminance(bg) > 0.3 ? "#0b0b0b" : "#ffffff";
  return { bg, fg };
}

export function divergingGradient() {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((s) => `${divergingColor(s).bg} ${s * 100}%`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

// Text colour for a label sitting inside a filled categorical segment.
export function inkOn(slot) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--series-${slot + 1}`).trim();
  if (!v.startsWith("#")) return "#ffffff";
  return luminance(v) > 0.33 ? "#0b0b0b" : "#ffffff";
}
