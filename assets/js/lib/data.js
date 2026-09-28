// Loads the generated JSON in data/. Everything is cached per page load.

const cache = new Map();

async function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path, { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
        return r.json();
      })
    );
  }
  return cache.get(path);
}

let modelIndex = null;

export async function loadIndex() {
  const index = await getJSON("data/index.json");
  if (!modelIndex) {
    modelIndex = new Map(index.models.map((m) => [m.id, m]));
  }
  return index;
}

export function loadBenchmark(id) {
  return getJSON(`data/benchmarks/${encodeURIComponent(id)}.json`);
}

export function model(id) {
  return (modelIndex && modelIndex.get(id)) || { id, name: id, lab: "", kind: "model" };
}

export const isBaseline = (id) => model(id).kind === "baseline";

export function liveBenchmarks(index) {
  return index.benchmarks.filter((b) => b.status !== "coming-soon");
}

export function benchmarkLabel(bench, key) {
  if (key === null || key === undefined) return "—";
  const labels = bench.labels || {};
  if (labels[key]) return labels[key];
  if (typeof key === "number") return String(key);
  return String(key).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
