# Token Launch Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/alawymuhsin/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/alawymuhsin/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A radar for token launches: every launchable pre-token protocol in the sealed
DefiLlama snapshot, ranked by what its token would be worth if it launched —
with the value fitted from the snapshot's own traded tokens, and a costed farm
plan for each one. Built for make.fun's
[token-radar-01](https://make.fun/bounty/token-radar-01) bounty.

## The model (radar-3)

No hand-picked multiple. At run time the program fits a log-log regression on
the snapshot's own traded tokens — one per symbol, market cap against TVL,
seven-day growth and age without a token — and prices every pre-token protocol
with the fitted coefficients:

```
log10(market cap) = 2.258 + 0.589 × log10(TVL)
                          + 0.337 × growth
                          + 0.091 × log10(age in days)
  growth = clamp(change_7d, -60%, 120%) / 100
  age    = days since listed_at; no date listed reads as 365 days
```

Fitted on **89 comps**. The dashboard shows the model's own report card, and
is honest where it is weak:

| Check | Result | What it means |
| --- | --- | --- |
| In-sample R² | 0.346 | TVL, growth and age explain about a third of the traded tokens' values. |
| Leave-one-out R² | 0.288 | Refit 89 times, each time without one token: the fit holds. |
| Leave-one-out median error | 82.8% | The typical miss when pricing a token the model has never seen. |
| Walk-forward median error | 90.7% | Trained on the older half of the comps, tested on the newer half. |
| Flat 0.25× multiple, median error | 84.4% | The fitted model beats the flat multiple leave-one-out (82.8% vs 84.4%) and loses walk-forward (90.7% vs 84.4%). TVL carries most of the signal; growth and age add little out of sample — and the model says so. |

The chain count was measured and dropped: its coefficient came out near zero
and it made the out-of-sample error worse.

**Launch odds** come from the snapshot too, not from a guess: the share of
protocols in each age band that record a token — 3% under 180 days, 14% at
180–365, 12% at 365–730, 17% at 730–1095, 29% past 1095 days. Age is the
cleanest launch signal in the data. **Rank ranges** come from a jackknife:
all 89 leave-one-out refits re-price every row, and the 10th–90th percentile
of those prices gives the ranks a row could take.

## The board

**198 rows**: all **40 watchlist** protocols plus every other launchable
pre-token protocol in the snapshot — including 20 above the $50M floor that
the house's watchlist leaves out, and excluding bridges, liquid-staking
receipts and other products that can never launch a token of their own.
Protocols that already trade are kept apart in a Live view with their market
cap, never mixed into the ranking. Top of the fitted board: Sentora Curator
$115.8M, Steakhouse Financial $114.6M, Gauntlet $87.7M — the same names the
flat multiple put on top, at values the traded comps actually support.

## The farm plan

Eight steps per protocol, each with a cost and a time: a fresh wallet, the
category's action on the protocol's main chain (vault deposit, liquidity,
bridge, stake, margin…), a weekly qualifying action, a signal step that quotes
the protocol's own seven-day change and age, a hold window, claiming only from
the protocol's own page, a farm log — and a **netting step** that prices the
plan in dollars: the capital goes in and comes back on unwind, so the true
cost is gas alone; expected value is the fitted implied value times the launch
odds; net is expected value minus gas; the verdict (Farm / Farm small /
Watch) follows the odds.

## The dashboard

A KPI strip (comps, R², leave-one-out R², both median errors, row count), the
fitted equation with its validation table and odds table, an SVG scatter of
the 89 comps against the fitted line, and a board that sorts by rank, implied
value, TVL, growth or age, filters by category, chain and watchlist, and
searches by name. Every row opens a detail view with its fitted-term
breakdown, its rank range, its odds, its cost table and its farm plan — and
the page generates the plan from the row's own record, so the page and
`board.json` agree step for step. No network, no framework.

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
- `lib/model.ts` — the fit, the odds, the board builder and the farm plans.
- `vendor/makefun-board.ts` — the kit's vendored dossier builder.
- `dashboard/` — the page: KPI strip, model section with fit chart, sortable
  and filterable board, detail view with the fitted-term breakdown, cost table
  and farm plan, and the Live view. No network, no framework.
- `screenshots/` — the board, a detail view and a filtered view.

Built for make.fun's `token-radar-01` bounty.
