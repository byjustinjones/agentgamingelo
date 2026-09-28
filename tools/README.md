# tools

Python 3.11, standard library only.

## Build the site data

```sh
python3 tools/build.py
```

Reads `benchmarks/site.json`, `benchmarks/models.json` and each listed
`benchmarks/<id>/benchmark.json` + `matches.jsonl`, then writes
`data/index.json` and `data/benchmarks/<id>.json` (format: `docs/DATA_SCHEMA.md`).
Run it after adding matches or editing any benchmark metadata; it prints each
leaderboard and the suite standings.

Ratings are a Bradley–Terry fit over every pair of players in each match
(pairs weighted 1/(N−1), ties count ½, a one-game virtual draw against an
average player keeps ratings finite), shown on the Elo scale (400 points per
10× odds) with the benchmark mean at 1500. The 95% interval comes from 200
bootstrap resamples of matches; the history chart refits weekly on cumulative
data (a model needs 5 games before it appears). Output is deterministic apart
from `generated_at`.

## Regenerate the sample data

```sh
python3 tools/generate_sample.py
```

Overwrites `benchmarks/chess/matches.jsonl` and `benchmarks/empires/matches.jsonl`
with a seeded, fictional simulation (same output every run). Once real results
exist, stop running this, replace the `matches.jsonl` files and set
`"sample_data": false` in `benchmarks/site.json`.
