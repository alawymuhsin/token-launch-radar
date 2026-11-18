# Token Launch Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/alawymuhsin/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/alawymuhsin/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A radar for token launches: every protocol in the sealed DefiLlama snapshot that
records no token, ranked by what its token would be worth if it launched — plus a
concrete farm plan for each one. Built for make.fun's
[token-radar-01](https://make.fun/bounty/token-radar-01) bounty.

## The model (radar-2)

Implied value follows only from the snapshot's own figures; no name is ever
special-cased:

```
implied = TVL × 0.25 × growth × maturity × chains
  growth   = 1 + clamp(change_7d, -50%, 200%) × 0.8
  maturity = 0.55 + min(age_days, 1095) / 1095 × 0.55
  chains   = 1 + 0.05 × min(chains - 1, 5)
```

- **Base** — a token is worth a share of the value its protocol secures.
- **Growth** — a week of inflows is the freshest signal; fast growers outrank
  stagnant giants.
- **Maturity** — a protocol that ran years with no token and kept its TVL is a
  launch that waited.
- **Chains** — each extra chain is distribution the token inherits.

The board ranks all **40 watchlist** protocols (TVL ≥ $50M, no token) and all
**186 early** rankable pre-token protocols below the floor — **226 rows** in all.
Protocols that already trade are kept apart in a Live view with their market cap,
never mixed into the ranking.

## The farm plan

Seven steps per protocol, each with a cost and a time: a fresh wallet, the
category's action on the protocol's main chain (vault deposit, liquidity,
bridge, stake, margin…), a weekly qualifying action, a signal step that quotes
the protocol's own seven-day change and age, a hold window, claiming only from
the protocol's own page, and a farm log.

## Run it

Node 22, standard library only, no network:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Writes `out/board.json` (the ranked board), `out/data.js` (the dashboard's
dataset), `out/dashboard/` (the page), `out/screenshots/` and
`out/dossier.json` (the summary the judge reads). The run is deterministic:
two runs write the same bytes.

## Files

- `main.ts` — the program: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the model, the board builder and the farm plans.
- `vendor/makefun-board.ts` — the kit's vendored dossier builder.
- `dashboard/` — the page: sortable, filterable board, detail view with the
  four-factor breakdown, and the Live view. No network, no framework.
- `screenshots/` — the board, a detail view and a filtered view.

Built for make.fun's `token-radar-01` bounty.
