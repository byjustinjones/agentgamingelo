#!/usr/bin/env python3
"""Generate deterministic SAMPLE match data for the benchmarks.

Writes benchmarks/<id>/matches.jsonl for chess and empires from a seeded
simulation with hidden "true" strengths per model. The data is fictional and
exists only so the site has something realistic to render; delete these files
(and set "sample_data": false in benchmarks/site.json) once real results land.

    python3 tools/generate_sample.py
"""

from __future__ import annotations

import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = 20260601
START = date(2026, 6, 1)
END = date(2026, 9, 26)

# Late entrants: model -> first day it can be scheduled.
JOINS = {
    "meridian-4-flash": date(2026, 7, 15),
    "kestrel-1-5": date(2026, 8, 25),
}

# Hidden true strengths on an Elo-like scale. The two games deliberately
# disagree: Quill R1 is a chess specialist but middling at Empires, while
# Meridian 4 and Tessera Large shine at long-horizon strategy.
CHESS_STRENGTH = {
    "halcyon-2-ultra": 1810, "quill-r1": 1790, "meridian-4": 1700,
    "kestrel-1-5": 1690, "vantage-x": 1580, "tessera-large": 1590,
    "halcyon-2-mini": 1510, "meridian-4-flash": 1470, "orca-70b": 1430,
    "scripted-l1": 1330, "random": 1000,
}
EMPIRES_STRENGTH = {
    "meridian-4": 1780, "tessera-large": 1730, "halcyon-2-ultra": 1700,
    "kestrel-1-5": 1650, "vantage-x": 1560, "orca-70b": 1560,
    "meridian-4-flash": 1530, "quill-r1": 1490, "halcyon-2-mini": 1470,
    "random": 1050,
}
# Mean illegal-move attempts per chess game (Poisson) and forfeit tendency.
ILLEGAL_RATE = {
    "halcyon-2-ultra": 0.15, "quill-r1": 0.2, "meridian-4": 0.35,
    "kestrel-1-5": 0.3, "vantage-x": 0.6, "tessera-large": 0.7,
    "halcyon-2-mini": 1.1, "meridian-4-flash": 1.3, "orca-70b": 1.8,
    "scripted-l1": 0.0, "random": 0.0,
}
# Preferred victory types in Empires: (domination, science, culture).
EMPIRES_STYLE = {
    "meridian-4": (0.55, 0.25, 0.20), "tessera-large": (0.15, 0.25, 0.60),
    "halcyon-2-ultra": (0.20, 0.55, 0.25), "kestrel-1-5": (0.34, 0.33, 0.33),
    "vantage-x": (0.60, 0.20, 0.20), "orca-70b": (0.50, 0.20, 0.30),
    "meridian-4-flash": (0.50, 0.30, 0.20), "quill-r1": (0.10, 0.70, 0.20),
    "halcyon-2-mini": (0.30, 0.40, 0.30), "random": (0.34, 0.33, 0.33),
}
BASELINE_ACTIVITY = {"random": 0.5, "scripted-l1": 0.6}


def lerp_date(day: date, start: date, end: date, a: float, b: float) -> float:
    if day <= start:
        return a
    if day >= end:
        return b
    t = (day - start).days / (end - start).days
    return a + (b - a) * t


def chess_strength(model: str, day: date) -> float:
    # Vantage X ships an updated agent in early August.
    if model == "vantage-x":
        return lerp_date(day, date(2026, 7, 28), date(2026, 8, 12), 1560, 1730)
    return CHESS_STRENGTH[model]


def empires_strength(model: str, day: date) -> float:
    if model == "vantage-x":
        return lerp_date(day, date(2026, 7, 28), date(2026, 8, 12), 1540, 1640)
    return EMPIRES_STRENGTH[model]


def available(models: list[str], day: date) -> list[str]:
    return [m for m in models if JOINS.get(m, START) <= day]


def activity(model: str, day: date) -> float:
    """Scheduling weight: baselines play less, newcomers play more for 3 weeks."""
    w = BASELINE_ACTIVITY.get(model, 1.0)
    joined = JOINS.get(model)
    if joined and (day - joined).days < 21:
        w *= 2.0
    return w


def weighted_choice(rng: random.Random, items: list, weights: list[float]):
    return rng.choices(items, weights=weights, k=1)[0]


def poisson(rng: random.Random, lam: float) -> int:
    if lam <= 0:
        return 0
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1


def daily_counts(rng: random.Random, total: int) -> list[tuple[date, int]]:
    """Spread `total` matches over the date range with a gentle ramp-up."""
    days = [START + timedelta(d) for d in range((END - START).days + 1)]
    weights = [0.7 + 0.6 * i / len(days) + rng.random() * 0.4 for i in range(len(days))]
    scale = total / sum(weights)
    counts = [max(1, round(w * scale)) for w in weights]
    return list(zip(days, counts))


# --------------------------------------------------------------------- chess

def simulate_chess(rng: random.Random) -> list[dict]:
    models = list(CHESS_STRENGTH)
    matches = []
    for day, n in daily_counts(rng, 1500):
        pool = available(models, day)
        for _ in range(n):
            a = weighted_choice(rng, pool, [activity(m, day) for m in pool])
            others = [m for m in pool if m != a]
            sa = chess_strength(a, day)
            # Mostly random pairings with a mild preference for close strengths.
            w = [activity(m, day) * (0.35 + math.exp(-((sa - chess_strength(m, day)) / 350) ** 2))
                 for m in others]
            b = weighted_choice(rng, others, w)
            white, black = (a, b) if rng.random() < 0.5 else (b, a)
            matches.append(play_chess(rng, day, white, black))
    return matches


def play_chess(rng: random.Random, day: date, white: str, black: str) -> dict:
    diff = chess_strength(white, day) + 30 - chess_strength(black, day)  # white edge
    expected = 1 / (1 + 10 ** (-diff / 400))
    p_draw = 0.24 * math.exp(-(diff / 260) ** 2)
    if "random" in (white, black):
        p_draw = 0.02  # stalemates and 200-ply shuffles
    p_white = max(0.0, expected - p_draw / 2)
    r = rng.random()
    if r < p_draw:
        result = "draw"
    elif r < p_draw + p_white:
        result = "white"
    else:
        result = "black"

    attempts = {m: poisson(rng, ILLEGAL_RATE[m]) for m in (white, black)}
    if result == "draw":
        outcome = "draw"
        moves = 200 if rng.random() < 0.25 else rng.randint(60, 199)
        places = {white: 1, black: 1}
    else:
        winner, loser = (white, black) if result == "white" else (black, white)
        places = {winner: 1, loser: 2}
        forfeit_p = min(0.6, 0.02 + 0.12 * ILLEGAL_RATE[loser])
        if winner == "random":
            forfeit_p = 0.8  # random only wins when the opponent breaks the rules
        if rng.random() < forfeit_p and ILLEGAL_RATE[loser] > 0:
            outcome = "forfeit"
            attempts[loser] = max(attempts[loser], 3) + (rng.random() < 0.3)
            moves = rng.randint(20, 150)
        elif loser in ("random", "scripted-l1") or rng.random() < 0.55:
            outcome = "checkmate"
            lo, hi = (20, 70) if loser == "random" else (35, 170)
            moves = rng.randint(lo, hi)
        else:
            outcome = "resignation"
            moves = rng.randint(40, 150)
    return {
        "date": day.isoformat(),
        "players": [
            {"model": white, "place": places[white], "side": "white", "illegal_attempts": attempts[white]},
            {"model": black, "place": places[black], "side": "black", "illegal_attempts": attempts[black]},
        ],
        "outcome": outcome,
        "moves": moves,
    }


# ------------------------------------------------------------------- empires

def simulate_empires(rng: random.Random) -> list[dict]:
    models = list(EMPIRES_STRENGTH)
    matches = []
    for day, n in daily_counts(rng, 450):
        pool = available(models, day)
        for _ in range(n):
            seats: list[str] = []
            while len(seats) < 4:
                rest = [m for m in pool if m not in seats]
                seats.append(weighted_choice(rng, rest, [activity(m, day) for m in rest]))
            matches.append(play_empires(rng, day, seats))
    return matches


def plackett_luce(rng: random.Random, players: list[str], day: date) -> list[str]:
    remaining, order = list(players), []
    while remaining:
        w = [10 ** (empires_strength(m, day) / 400) for m in remaining]
        pick = weighted_choice(rng, remaining, w)
        order.append(pick)
        remaining.remove(pick)
    return order


def play_empires(rng: random.Random, day: date, seats: list[str]) -> dict:
    order = plackett_luce(rng, seats, day)
    winner = order[0]
    p_score = 0.75 if winner == "random" else 0.22
    if rng.random() < p_score:
        victory, turns = "score", 150
    else:
        victory = weighted_choice(rng, ["domination", "science", "culture"], list(EMPIRES_STYLE[winner]))
        turns = {"domination": rng.randint(80, 140), "science": rng.randint(110, 149),
                 "culture": rng.randint(100, 149)}[victory]

    # Scores grow with game length; sort so they agree with placement.
    raw = sorted((rng.gauss(4.2, 0.9) * turns * (1.0 - 0.18 * i) for i in range(4)), reverse=True)
    players = []
    for place, (model, score) in enumerate(zip(order, raw), start=1):
        skill = (empires_strength(model, day) - 1000) / 130
        mu = 1.5 + skill + (4 - place) * 0.9 + (1.5 if victory == "domination" and place == 1 else 0)
        cities = max(1, round(rng.gauss(mu * turns / 150 + 0.5, 1.2)))
        if model == "random":
            score *= 0.6
        players.append({"model": model, "place": place, "score": max(20, round(score)), "cities": cities})
    # Keep scores strictly consistent with places after the random-agent penalty.
    for i in range(1, 4):
        if players[i]["score"] >= players[i - 1]["score"]:
            players[i]["score"] = players[i - 1]["score"] - rng.randint(5, 40)
    return {"date": day.isoformat(), "players": players, "victory": victory, "turns": turns}


# ---------------------------------------------------------------------- main

def write(bench_id: str, matches: list[dict]) -> None:
    matches.sort(key=lambda m: m["date"])  # stable: keeps simulation order within a day
    path = ROOT / "benchmarks" / bench_id / "matches.jsonl"
    with path.open("w") as f:
        for i, m in enumerate(matches, start=1):
            f.write(json.dumps({"id": f"{bench_id}-{i:06d}", **m}, separators=(",", ":")) + "\n")
    print(f"{bench_id}: wrote {len(matches)} matches to {path.relative_to(ROOT)}")


def main() -> None:
    write("chess", simulate_chess(random.Random(SEED)))
    write("empires", simulate_empires(random.Random(SEED + 1)))


if __name__ == "__main__":
    main()
