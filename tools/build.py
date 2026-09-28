#!/usr/bin/env python3
"""Build the site data from benchmarks/ into data/.

Reads benchmarks/site.json, benchmarks/models.json and, for every benchmark
listed in site.json, benchmarks/<id>/benchmark.json + matches.jsonl. Writes
data/index.json and data/benchmarks/<id>.json as described in
docs/DATA_SCHEMA.md.

    python3 tools/build.py
"""

from __future__ import annotations

import json
import math
import random
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "benchmarks"
OUT = ROOT / "data"

SCALE = 400            # Elo points per factor-of-10 in odds
CENTER = 1500          # mean rating of all rated players in a benchmark
BOOTSTRAP = 200        # resamples for the 95% confidence interval
BOOTSTRAP_SEED = 12345
PRIOR_WEIGHT = 1.0     # virtual draw against an average player; keeps ratings finite
MIN_GAMES_HISTORY = 5  # games needed before a model appears on the history chart
HISTORY_STEP_DAYS = 7
RECENT_MATCHES = 30
TOP_N = 3

ELO_PER_NAT = SCALE / math.log(10)


# ------------------------------------------------------------------ loading

def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def load_matches(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def pair_results(match: dict):
    """Yield (a, b, score_of_a) for every pair of players in a match."""
    players = match["players"]
    for i in range(len(players)):
        for j in range(i + 1, len(players)):
            a, b = players[i], players[j]
            if a["place"] < b["place"]:
                s = 1.0
            elif a["place"] > b["place"]:
                s = 0.0
            else:
                s = 0.5
            yield a["model"], b["model"], s


# ------------------------------------------------------------------- rating

def fit_bradley_terry(matches: list[dict]) -> dict[str, float]:
    """Weighted Bradley-Terry MLE, returned on the Elo scale (mean = CENTER).

    Each match contributes every pair of players, weighted 1/(N-1) so an
    N-player game counts as much as one head-to-head game per player. A virtual
    draw of PRIOR_WEIGHT against a fixed average opponent regularises the fit.
    Solved with damped Newton steps on log-strengths.
    """
    wins: dict[str, float] = defaultdict(float)       # weighted score per player
    pairs: dict[tuple[str, str], float] = defaultdict(float)  # weighted games per pair
    for m in matches:
        w = 1.0 / (len(m["players"]) - 1)
        for a, b, s in pair_results(m):
            wins[a] += w * s
            wins[b] += w * (1 - s)
            key = (a, b) if a < b else (b, a)
            pairs[key] += w
    models = sorted({p["model"] for m in matches for p in m["players"]})
    if not models:
        return {}
    idx = {name: i for i, name in enumerate(models)}
    n = len(models)
    theta = [0.0] * n
    pair_list = [(idx[a], idx[b], g) for (a, b), g in pairs.items()]

    for _ in range(100):
        grad = [wins[name] + PRIOR_WEIGHT / 2 for name in models]
        hess = [[0.0] * n for _ in range(n)]      # negative Hessian
        for i in range(n):
            p = 1 / (1 + math.exp(-theta[i]))      # vs. the virtual opponent at 0
            grad[i] -= PRIOR_WEIGHT * p
            hess[i][i] += PRIOR_WEIGHT * p * (1 - p)
        for i, j, g in pair_list:
            p = 1 / (1 + math.exp(theta[j] - theta[i]))
            grad[i] -= g * p
            grad[j] -= g * (1 - p)
            v = g * p * (1 - p)
            hess[i][i] += v
            hess[j][j] += v
            hess[i][j] -= v
            hess[j][i] -= v
        step = solve(hess, grad)
        biggest = max(abs(x) for x in step)
        if biggest > 1.0:                          # damp early, large steps
            step = [x / biggest for x in step]
        theta = [t + x for t, x in zip(theta, step)]
        if biggest < 1e-9:
            break

    mean = sum(theta) / n
    return {name: CENTER + ELO_PER_NAT * (theta[idx[name]] - mean) for name in models}


def solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Solve a·x = b by Gaussian elimination with partial pivoting."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[pivot] = m[pivot], m[col]
        for r in range(col + 1, n):
            f = m[r][col] / m[col][col]
            if f:
                for c in range(col, n + 1):
                    m[r][c] -= f * m[col][c]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (m[r][n] - sum(m[r][c] * x[c] for c in range(r + 1, n))) / m[r][r]
    return x


def bootstrap_ci(matches: list[dict], models: list[str]) -> dict[str, list[int]]:
    rng = random.Random(BOOTSTRAP_SEED)
    samples: dict[str, list[float]] = defaultdict(list)
    for _ in range(BOOTSTRAP):
        resample = [matches[rng.randrange(len(matches))] for _ in matches]
        for name, r in fit_bradley_terry(resample).items():
            samples[name].append(r)
    ci = {}
    for name in models:
        xs = sorted(samples[name])
        lo = xs[int(0.025 * (len(xs) - 1))]
        hi = xs[int(math.ceil(0.975 * (len(xs) - 1)))]
        ci[name] = [round(lo), round(hi)]
    return ci


def rating_history(matches: list[dict], first: date, last: date):
    """Weekly checkpoints of the cumulative fit, plus a final one at `last`."""
    checkpoints = []
    d = first + timedelta(HISTORY_STEP_DAYS)
    while d < last:
        checkpoints.append(d)
        d += timedelta(HISTORY_STEP_DAYS)
    checkpoints.append(last)

    ordered = sorted(matches, key=lambda m: m["date"])
    fits = []
    for cp in checkpoints:
        subset = [m for m in ordered if m["date"] <= cp.isoformat()]
        games = defaultdict(int)
        for m in subset:
            for p in m["players"]:
                games[p["model"]] += 1
        ratings = fit_bradley_terry(subset)
        fits.append({k: v for k, v in ratings.items() if games[k] >= MIN_GAMES_HISTORY})
    return checkpoints, fits


# ------------------------------------------------------------ per-model stats

def model_records(matches: list[dict]) -> dict[str, dict]:
    rec = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0,
                               "place_sum": 0, "pair_score": 0.0, "pair_games": 0})
    for m in matches:
        firsts = sum(1 for p in m["players"] if p["place"] == 1)
        for p in m["players"]:
            r = rec[p["model"]]
            r["games"] += 1
            r["place_sum"] += p["place"]
            if p["place"] == 1:
                r["wins" if firsts == 1 else "draws"] += 1
            else:
                r["losses"] += 1
        for a, b, s in pair_results(m):
            rec[a]["pair_score"] += s
            rec[b]["pair_score"] += 1 - s
            rec[a]["pair_games"] += 1
            rec[b]["pair_games"] += 1
    return rec


def head_to_head(matches: list[dict], order: list[str]) -> dict:
    score = defaultdict(float)
    games = defaultdict(int)
    for m in matches:
        for a, b, s in pair_results(m):
            score[a, b] += s
            score[b, a] += 1 - s
            games[a, b] += 1
            games[b, a] += 1
    cells = []
    for a in order:
        row = []
        for b in order:
            g = games[a, b]
            row.append(None if a == b or g == 0 else {"score": round(score[a, b] / g, 3), "games": g})
        cells.append(row)
    return {"models": order, "cells": cells}


def compute_panel(spec: dict, matches: list[dict], order: list[str], labels: dict) -> dict:
    """Evaluate one panel spec into rows, one per model in leaderboard order."""
    field, scope, flt = spec["field"], spec.get("scope", "match"), spec.get("filter", "all")
    values = defaultdict(list)  # model -> field values over its relevant games
    for m in matches:
        firsts = sum(1 for p in m["players"] if p["place"] == 1)
        for p in m["players"]:
            if flt == "wins" and not (p["place"] == 1 and firsts == 1):
                continue
            v = (p if scope == "player" else m).get(field)
            if v is not None:
                values[p["model"]].append(v)

    out = {k: v for k, v in spec.items() if k != "categories"}
    if spec["type"] == "distribution":
        keys = spec["categories"]
        out["categories"] = [{"key": k, "label": labels.get(k, k.replace("-", " ").replace("_", " ").title())}
                             for k in keys]
        rows = []
        for name in order:
            vs = [v for v in values[name] if v in keys]  # values outside the categories are ignored
            n = len(vs)
            rows.append({"model": name, "n": n,
                         "values": [round(vs.count(k) / n, 4) if n else 0 for k in keys]})
        out["rows"] = rows
    elif spec["type"] == "average":
        out["rows"] = [{"model": name, "n": len(values[name]),
                        "value": round(sum(values[name]) / len(values[name]), 2) if values[name] else None}
                       for name in order]
    else:
        raise ValueError(f"unknown panel type {spec['type']!r}")
    return out


# ---------------------------------------------------------------- benchmark

def build_benchmark(meta: dict, matches: list[dict]) -> dict:
    out = dict(meta)
    if not matches:
        out.update({
            "stats": {"matches": 0, "models": 0, "first_match": None, "last_match": None},
            "rating": rating_info(),
            "leaderboard": [], "history": {"dates": [], "series": {}},
            "head_to_head": {"models": [], "cells": []},
            "panels": [compute_panel(p, [], [], meta.get("labels", {})) for p in meta.get("panels", [])],
            "recent_matches": [],
        })
        return out

    matches = sorted(matches, key=lambda m: (m["date"], m["id"]))
    first = date.fromisoformat(matches[0]["date"])
    last = date.fromisoformat(matches[-1]["date"])

    ratings = fit_bradley_terry(matches)
    order = sorted(ratings, key=lambda k: (-ratings[k], k))
    ci = bootstrap_ci(matches, order)
    checkpoints, fits = rating_history(matches, first, last)
    records = model_records(matches)

    # delta_30d: compare with the checkpoint closest to 30 days before last_match.
    target = last - timedelta(30)
    ref = min(range(len(checkpoints)), key=lambda i: (abs((checkpoints[i] - target).days), checkpoints[i]))

    leaderboard = []
    for rank, name in enumerate(order, start=1):
        r = records[name]
        current = round(ratings[name])
        past = fits[ref].get(name)
        leaderboard.append({
            "rank": rank, "model": name, "rating": current, "ci": ci[name],
            "games": r["games"], "wins": r["wins"], "draws": r["draws"], "losses": r["losses"],
            "score_pct": round(100 * r["pair_score"] / r["pair_games"], 1),
            "avg_place": round(r["place_sum"] / r["games"], 2),
            "delta_30d": None if past is None else current - round(past),
        })

    out.update({
        "stats": {"matches": len(matches), "models": len(order),
                  "first_match": first.isoformat(), "last_match": last.isoformat()},
        "rating": rating_info(),
        "leaderboard": leaderboard,
        "history": {
            "dates": [d.isoformat() for d in checkpoints],
            "series": {name: [round(f[name]) if name in f else None for f in fits] for name in order},
        },
        "head_to_head": head_to_head(matches, order),
        "panels": [compute_panel(p, matches, order, meta.get("labels", {})) for p in meta.get("panels", [])],
        "recent_matches": matches[-RECENT_MATCHES:][::-1],
    })
    return out


def rating_info() -> dict:
    return {"method": "bradley-terry", "scale": SCALE, "center": CENTER, "bootstrap": BOOTSTRAP}


# -------------------------------------------------------------------- suite

def build_suite(benchmarks: list[dict], kinds: dict[str, str]) -> list[dict]:
    """Percentile standing among non-baseline models, averaged over benchmarks."""
    per_model = defaultdict(dict)
    for b in benchmarks:
        if b["status"] == "coming-soon" or not b["leaderboard"]:
            continue
        rows = [r for r in b["leaderboard"] if kinds.get(r["model"]) != "baseline"]
        n = len(rows)
        for i, row in enumerate(rows, start=1):
            pct = 100.0 if n == 1 else 100 * (n - i) / (n - 1)
            per_model[row["model"]][b["id"]] = {"rating": row["rating"], "rank": i, "of": n, "_pct": pct}

    suite = []
    for name, entries in per_model.items():
        score = sum(e.pop("_pct") for e in entries.values()) / len(entries)
        suite.append({"model": name, "score": round(score, 1), "coverage": len(entries), "benchmarks": entries})
    suite.sort(key=lambda s: (-s["coverage"], -s["score"], s["model"]))
    return [{"model": s["model"], "rank": i, **{k: s[k] for k in ("score", "coverage", "benchmarks")}}
            for i, s in enumerate(suite, start=1)]


# --------------------------------------------------------------------- main

def write_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text + "\n")
    return len(text)


def main() -> None:
    site = load_json(SRC / "site.json")
    models = load_json(SRC / "models.json")
    kinds = {m["id"]: m["kind"] for m in models}

    built, cards = [], []
    all_matches, all_models = 0, set()
    for bench_id in site["benchmarks"]:
        meta = load_json(SRC / bench_id / "benchmark.json")
        matches = load_matches(SRC / bench_id / "matches.jsonl")
        unknown = {p["model"] for m in matches for p in m["players"]} - kinds.keys()
        if unknown:
            raise SystemExit(f"{bench_id}: models missing from models.json: {sorted(unknown)}")

        data = build_benchmark(meta, matches)
        built.append(data)
        size = write_json(OUT / "benchmarks" / f"{bench_id}.json", data)

        all_matches += len(matches)
        all_models.update(r["model"] for r in data["leaderboard"])
        cards.append({
            **{k: meta.get(k) for k in ("id", "name", "tagline", "status", "icon", "accent",
                                        "mode", "players_per_match")},
            "stats": data["stats"],
            "top": [{"model": r["model"], "rating": r["rating"], "ci": r["ci"]}
                    for r in data["leaderboard"][:TOP_N]],
        })

        print(f"\n{bench_id}: {len(matches)} matches, {len(data['leaderboard'])} models, "
              f"{len(data['history']['dates'])} history points, {size / 1024:.0f} KB")
        for r in data["leaderboard"]:
            delta = "new" if r["delta_30d"] is None else f"{r['delta_30d']:+d}"
            print(f"  {r['rank']:>2}. {r['model']:<18} {r['rating']:>5}  "
                  f"[{r['ci'][0]}, {r['ci'][1]}]  {r['games']:>4} games  30d {delta}")

    index = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "site": {k: v for k, v in site.items() if k != "benchmarks"},
        "models": models,
        "benchmarks": cards,
        "totals": {"matches": all_matches, "models": len(all_models),
                   "benchmarks_live": sum(1 for b in built if b["status"] == "live")},
        "suite": build_suite(built, kinds),
    }
    write_json(OUT / "index.json", index)

    print("\nsuite:")
    for s in index["suite"]:
        print(f"  {s['rank']:>2}. {s['model']:<18} {s['score']:>5}  ({s['coverage']} benchmarks)")
    print(f"\nwrote {OUT.relative_to(ROOT)}/index.json and {len(built)} benchmark files")


if __name__ == "__main__":
    main()
