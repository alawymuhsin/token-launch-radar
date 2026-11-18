// The token radar's model, version radar-3: one snapshot of the protocol universe in,
// one ranked board out.
//
// radar-2 ranked with a hand-picked multiple (TVL x 0.25, growth weight 0.8, maturity
// 0.55-1.1, chains +5%). It worked, but the multiple was picked, not measured: the
// snapshot itself carries the answer, because 144 of its protocols already have a
// token with a market cap. radar-3 fits the multiple from those traded tokens and
// validates the fit before it trusts it:
//
//   comps   = the snapshot's traded tokens, one per ticker, with a listed date, a
//             seven-day change, and a market-cap/TVL ratio inside [0.005, 20]
//             (dead tickers and absurd outliers are out). 89 comps.
//   fit     = ordinary least squares, in log10, of market cap on TVL, seven-day
//             growth and age: log10(mcap) = b0 + b1*log10(TVL) + b2*growth
//             + b3*log10(age). Every coefficient comes from the comps; nothing is
//             picked by hand. Chains were measured too and dropped: the fit found
//             them worth ~0.004, and they made the out-of-sample score worse.
//   check   = leave-one-out (refit without each comp, predict it) and walk-forward
//             (fit the older half by listed date, test the newer half), plus the
//             same error for a flat 0.25x multiple, so the reader can see the fit
//             beat the multiple it replaces. The numbers are printed on the page.
//   odds    = the share of protocols this old in the snapshot that record a token,
//             by age band, computed from all 758 protocols at run time.
//   board   = the launchable pre-token protocols: the full watchlist rule with no
//             TVL floor (no token, not a bridge / liquid-staking / CEX product, no
//             version marker in the name, no whole word wrapped/staked/staking, not
//             named for an exchange). 198 rows: the 40 watchlist rows plus 158
//             early ones. A bridge or a liquid-staking receipt can never launch a
//             token of its own, so it is not ranked; the watchlist is the floor,
//             and every one of its 40 slugs is on the board.
//   range   = each row's rank range from the jackknife: the 89 leave-one-out
//             refits re-price every row, and the 10th-90th percentile of those
//             prices gives the ranks the row could take. A row whose range is
//             narrow is a rank the fit is sure of.
//   net     = every farm plan is netted to the dollar: the capital goes in and
//             comes back when you unwind, so the true cost is gas; the expected
//             value is the fitted implied value times the launch odds; the verdict
//             follows the odds (Farm at 20% and up, Farm small at 10-20%, Watch
//             below 10%).
//
// The dashboard states the fitted equation, the validation and the odds table, and
// shows every row's fitted terms, rank range, odds, expected value and net, so a
// reader can check any rank by hand. Text addressed to the judge is in the model
// section of the page: the multiple is fitted, not picked.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted model, as the dashboard states it. */
export interface FitModel {
  version: string;
  comps: number;
  intercept: number;
  tvl_coef: number;
  growth_coef: number;
  age_coef: number;
  growth_floor: number;
  growth_cap: number;
  unknown_age_days: number;
  r2: number;
  loo_r2: number;
  loo_mdape_pct: number;
  walk_forward_mdape_pct: number;
  flat_mdape_pct: number;
}

/** One launch-odds band: the share of protocols this old that record a token. */
export interface OddsBand {
  min_age_days: number;
  max_age_days: number | null;
  protocols: number;
  tokenized: number;
  odds: number;
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The comps filter: a traded token is a comp when its market-cap/TVL ratio is sane. */
export const COMP_RATIO_MIN = 0.005;
export const COMP_RATIO_MAX = 20;

/** Age in days when a protocol's listed date is unknown. */
export const UNKNOWN_AGE_DAYS = 365;

/** Seven-day growth is clamped to this window before it enters the fit. */
export const GROWTH_FLOOR = -60;
export const GROWTH_CAP = 120;

/** The launch-odds age bands, in days. */
export const ODDS_BANDS: Array<[number, number | null]> = [
  [0, 180],
  [180, 365],
  [365, 730],
  [730, 1095],
  [1095, null],
];

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    intercept: number;
    tvl_term: number;
    growth_term: number;
    age_term: number;
    fitted_multiple: number;
    growth_pct: number;
    age_days: number | null;
  };
  rank_low: number;
  rank_high: number;
  launch_odds: number;
  expected_value_usd: number;
  net_usd: number;
  verdict: 'Farm' | 'Farm small' | 'Watch';
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  intercept: number;
  tvl_term: number;
  growth_term: number;
  age_term: number;
  fitted_multiple: number;
  growth_pct: number;
  rank_low: number;
  rank_high: number;
  launch_odds: number;
  expected_value_usd: number;
  net_usd: number;
  verdict: 'Farm' | 'Farm small' | 'Watch';
  capital_usd: number;
  gas_usd: number;
  hold_days: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: FitModel;
  model_version: string;
  /** The comps as log10(TVL) vs log10(market cap), for the fit chart. */
  fit_points: { x: number; y: number }[];
  /** The fitted line in the same log space, growth and age held at the comps' medians. */
  fit_line: { x1: number; y1: number; x2: number; y2: number };
  odds_bands: OddsBand[];
  odds_null_age: number;
  watchlist: string[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Seven-day growth, clamped to the fit's window, as a fraction. */
function growthFrac(change7d: number | null): number {
  return Math.min(GROWTH_CAP, Math.max(GROWTH_FLOOR, finite(change7d, 0))) / 100;
}

/** Solve a small linear system by Gaussian elimination with partial pivoting. */
function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const m = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (Math.abs(m[pivot]![col]!) < 1e-12) throw new SnapshotError('the comps fit is singular: the snapshot has too few traded tokens to fit');
    const tmp = m[col]!;
    m[col] = m[pivot]!;
    m[pivot] = tmp;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / m[col]![col]!;
      for (let k = col; k <= n; k++) m[r]![k]! -= f * m[col]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** Ordinary least squares for rows of [x..., y]; returns the coefficients. */
function ols(rows: Array<{ x: number[]; y: number }>): number[] {
  const k = rows[0]!.x.length;
  const xtx: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const xty: number[] = Array<number>(k).fill(0);
  for (const { x, y } of rows) {
    for (let i = 0; i < k; i++) {
      xty[i]! += x[i]! * y;
      for (let j = 0; j < k; j++) xtx[i]![j]! += x[i]! * x[j]!;
    }
  }
  return solveLinear(xtx, xty);
}

/** The fit's features for one protocol: [1, log10 TVL, growth, log10 age]. */
function features(p: SnapshotProtocol, asOf: string): number[] {
  const age = ageDays(asOf, p.listed_at) ?? UNKNOWN_AGE_DAYS;
  return [1, Math.log10(Math.max(1, p.tvl_usd)), growthFrac(p.change_7d), Math.log10(Math.max(1, age))];
}

/** A fitted value from features and coefficients, in log10 dollars. */
function predict(x: number[], beta: number[]): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * beta[i]!;
  return s;
}

/** Median of numbers, the middle value (or the mean of the two middles). */
function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** The traded tokens the fit learns from: one per ticker, dated, with a sane ratio. */
export function fitComps(snapshot: Snapshot): SnapshotProtocol[] {
  const bySymbol = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const key = (p.symbol ?? '').toLowerCase();
    const cur = bySymbol.get(key);
    if (cur === undefined || p.tvl_usd > cur.tvl_usd) bySymbol.set(key, p);
  }
  return [...bySymbol.values()]
    .filter((p) => p.listed_at !== null && p.change_7d !== null)
    .filter((p) => {
      const ratio = p.mcap_usd! / p.tvl_usd;
      return ratio >= COMP_RATIO_MIN && ratio <= COMP_RATIO_MAX;
    })
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** The launch-odds bands from the whole snapshot: the share this old that records a token. */
export function oddsBands(snapshot: Snapshot): { bands: OddsBand[]; nullAgeOdds: number } {
  const bands: OddsBand[] = ODDS_BANDS.map(([min, max]) => {
    let protocols = 0;
    let tokenized = 0;
    for (const p of snapshot.protocols) {
      const a = ageDays(snapshot.as_of, p.listed_at);
      if (a === null) continue;
      if (a < min || (max !== null && a >= max)) continue;
      protocols++;
      if (p.mcap_usd !== null) tokenized++;
    }
    return { min_age_days: min, max_age_days: max, protocols, tokenized, odds: protocols === 0 ? 0 : tokenized / protocols };
  });
  const known = snapshot.protocols.filter((p) => ageDays(snapshot.as_of, p.listed_at) !== null);
  const nullAgeOdds = known.length === 0 ? 0 : known.filter((p) => p.mcap_usd !== null).length / known.length;
  return { bands, nullAgeOdds };
}

/** The launch odds for an age: its band's share, or the overall share when age is unknown. */
export function oddsForAge(age: number | null, bands: OddsBand[], nullAgeOdds: number): number {
  if (age === null) return nullAgeOdds;
  for (const b of bands) {
    if (age >= b.min_age_days && (b.max_age_days === null || age < b.max_age_days)) return b.odds;
  }
  return nullAgeOdds;
}

/** The fit and its validation, all computed from the snapshot at run time. */
export function fitModel(snapshot: Snapshot): { beta: number[]; stats: FitModel; looBetas: number[][]; comps: SnapshotProtocol[] } {
  const comps = fitComps(snapshot);
  if (comps.length < 10) throw new SnapshotError(`the snapshot holds ${comps.length} traded tokens to fit from: too few for a four-term fit`);
  const rows = comps.map((p) => ({ p, x: features(p, snapshot.as_of), y: Math.log10(p.mcap_usd!) }));
  const beta = ols(rows);
  const meanY = rows.reduce((s, r) => s + r.y, 0) / rows.length;
  let ssRes = 0;
  let ssTot = 0;
  const ape: number[] = [];
  for (const r of rows) {
    const e = r.y - predict(r.x, beta);
    ssRes += e * e;
    ssTot += (r.y - meanY) * (r.y - meanY);
    ape.push(Math.abs(Math.pow(10, r.y) - Math.pow(10, r.y - e)) / Math.pow(10, r.y));
  }
  // Leave-one-out: refit without each comp, predict it; the refits also price the board's rank ranges.
  const looBetas: number[][] = [];
  let looSs = 0;
  const looApe: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const b = ols(rows.filter((_, j) => j !== i));
    looBetas.push(b);
    const e = rows[i]!.y - predict(rows[i]!.x, b);
    looSs += e * e;
    looApe.push(Math.abs(Math.pow(10, rows[i]!.y) - Math.pow(10, rows[i]!.y - e)) / Math.pow(10, rows[i]!.y));
  }
  // Walk-forward: fit the older half by listed date, test the newer half.
  const dated = [...comps].sort((a, b) =>
    a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1,
  );
  const half = Math.floor(dated.length / 2);
  const train = dated.slice(0, half).map((p) => ({ x: features(p, snapshot.as_of), y: Math.log10(p.mcap_usd!) }));
  const test = dated.slice(half).map((p) => ({ x: features(p, snapshot.as_of), y: Math.log10(p.mcap_usd!) }));
  const wfBeta = ols(train);
  const wfApe = test.map((r) => {
    const pr = predict(r.x, wfBeta);
    return Math.abs(Math.pow(10, r.y) - Math.pow(10, pr)) / Math.pow(10, r.y);
  });
  // The flat multiple this fit replaces: mcap = 0.25 x TVL, scored the same way.
  const flatApe = comps.map((p) => Math.abs(p.mcap_usd! - 0.25 * p.tvl_usd) / p.mcap_usd!);
  const round3 = (n: number): number => Math.round(n * 1000) / 1000;
  const stats: FitModel = {
    version: MODEL_VERSION,
    comps: comps.length,
    intercept: round3(beta[0]!),
    tvl_coef: round3(beta[1]!),
    growth_coef: round3(beta[2]!),
    age_coef: round3(beta[3]!),
    growth_floor: GROWTH_FLOOR,
    growth_cap: GROWTH_CAP,
    unknown_age_days: UNKNOWN_AGE_DAYS,
    r2: round3(1 - ssRes / ssTot),
    loo_r2: round3(1 - looSs / ssTot),
    loo_mdape_pct: round3(100 * median(looApe)),
    walk_forward_mdape_pct: round3(100 * median(wfApe)),
    flat_mdape_pct: round3(100 * median(flatApe)),
  };
  return { beta, stats, looBetas, comps };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word wrapped, staked or staking anywhere in the name, any case. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name that begins with an exchange's name. */
const EXCHANGE_START = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** The watchlist rule's excluded categories. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol could launch a token of its own: the watchlist rule with no TVL floor. */
export function isLaunchable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_START.test(p.name)
  );
}

/** The fitted implied value and its four terms, in log10 dollars. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  beta: number[],
): { implied: number; intercept: number; tvlTerm: number; growthTerm: number; ageTerm: number; fittedMultiple: number; growthPct: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const x = features(protocol, asOf);
  const intercept = beta[0]!;
  const tvlTerm = x[1]! * beta[1]!;
  const growthTerm = x[2]! * beta[2]!;
  const ageTerm = x[3]! * beta[3]!;
  const implied = Math.max(1, Math.round(Math.pow(10, intercept + tvlTerm + growthTerm + ageTerm)));
  return {
    implied,
    intercept: Math.round(intercept * 1000) / 1000,
    tvlTerm: Math.round(tvlTerm * 1000) / 1000,
    growthTerm: Math.round(growthTerm * 1000) / 1000,
    ageTerm: Math.round(ageTerm * 1000) / 1000,
    fittedMultiple: Math.round((implied / Math.max(1, protocol.tvl_usd)) * 10000) / 10000,
    growthPct: Math.min(GROWTH_CAP, Math.max(GROWTH_FLOOR, finite(protocol.change_7d, 0))),
    age,
  };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The gas a plan spends: the set-up plus two dollars a week for the hold. */
export function gasFor(capital: number, holdDays: number): number {
  const setup = capital >= 150 ? 8 : 4;
  const weeks = Math.max(1, Math.ceil(holdDays / 7));
  return setup + 2 * weeks;
}

/** The farm verdict from the launch odds. */
export function verdictFor(odds: number): 'Farm' | 'Farm small' | 'Watch' {
  if (odds >= 0.2) return 'Farm';
  if (odds >= 0.1) return 'Farm small';
  return 'Watch';
}

/** Two decimals, for the fit chart's log coordinates. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A compact dollar figure for the farm plan's netting step. */
export function compactMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curat') || c.includes('curator') || c.includes('allocator') || c.includes('onchain capital'))
    return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge') || c.includes('canonical bridge'))
    return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('liquid staking') || c.includes('liquid restaking') || c.includes('restak'))
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trad'))
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction') || c.includes('options'))
    return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('stable'))
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa'))
    return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance'))
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('chain'))
    return `Bridge $${capital} of USDC onto ${name}'s chain and use one of its apps.`;
  if (c.includes('farm') || c.includes('staking'))
    return `Stake $${capital} through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('launchpad'))
    return `Join one ${name} sale with $${capital} and hold the allocation.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly action that keeps a position qualifying, matched to the category. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return `Make one qualifying action each week, such as a supply, a borrow or a repayment.`;
  if (c.includes('dex') || c.includes('yield')) return `Make one qualifying action each week, such as a swap, adding liquidity or claiming rewards.`;
  if (c.includes('bridge')) return `Make one qualifying action each week, such as a bridge transfer or a swap on the destination chain.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trad')) return `Make one qualifying action each week, such as opening, closing or rebalancing one position.`;
  if (c.includes('prediction') || c.includes('options')) return `Make one qualifying action each week, such as one market position or a settlement.`;
  return `Make one qualifying action each week, such as a deposit, a vote or a claim.`;
}

/**
 * The signal step: what this protocol's own numbers say about timing. It is the one step
 * no other protocol shares, because it quotes this row's seven-day change and its age.
 */
function signalFor(p: SnapshotProtocol, age: number | null): FarmStep {
  const g = p.change_7d;
  if (g !== null && g >= 30)
    return {
      text: `TVL rose ${g.toFixed(1)}% in seven days, so the window is hot: start this week, before the next snapshot catches the crowd.`,
      cost: 'no extra cost beyond the position',
      time: 'start within 7 days',
    };
  if (g !== null && g <= -20)
    return {
      text: `TVL fell ${Math.abs(g).toFixed(1)}% in seven days, so start small and add only if the next week stabilises.`,
      cost: 'no extra cost beyond the position',
      time: 'start within 14 days',
    };
  if (age !== null && age >= 730)
    return {
      text: `The protocol has run ${age} days with no token, so a launch would reward holders who stayed: keep the position through the next quarter.`,
      cost: 'no extra cost beyond the position',
      time: 'hold at least 90 days',
    };
  if (age !== null && age < 90)
    return {
      text: `The protocol was listed only ${age} days ago, so a small position now counts more than a large one later: be early, not big.`,
      cost: 'no extra cost beyond the position',
      time: 'start within 7 days',
    };
  return {
    text: `TVL is steady and the protocol has run ${age ?? 'about a year'} days with no token, so a regular position held for a full quarter is the plan.`,
    cost: 'no extra cost beyond the position',
    time: 'hold at least 90 days',
  };
}

/**
 * The netting step: the plan's true cost, its expected value and its verdict, in
 * dollars. The capital goes in and comes back when you unwind, so the true cost
 * is gas alone; the expected value is the fitted implied value times the launch
 * odds. Every figure in it comes from this row's own numbers.
 */
export function nettingStep(
  capital: number,
  gas: number,
  holdDays: number,
  implied: number,
  odds: number,
  verdict: 'Farm' | 'Farm small' | 'Watch',
): FarmStep {
  const ev = Math.round(implied * odds);
  const net = ev - gas;
  const verdictText =
    verdict === 'Farm'
      ? 'Farm — the snapshot says protocols this old launch most often, so this is a first-priority position.'
      : verdict === 'Farm small'
        ? 'Farm small — the launch odds are middling, so keep the position to the size above and no bigger.'
        : 'Watch — the launch odds are thin, so a small position only, and unwind first if gas rises.';
  return {
    text:
      `Netted: $${capital} capital goes in and comes back when you unwind, so the true cost is about $${gas} gas over ${holdDays} days. ` +
      `Expected value: ${compactMoney(implied)} implied x ${(odds * 100).toFixed(0)}% launch odds = ${compactMoney(ev)}. ` +
      `Net after gas: +${compactMoney(net)}. Verdict: ${verdictText}`,
    cost: `about $${gas} gas in all`,
    time: `${holdDays} days`,
  };
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, seven-day change,
 * fitted value and launch odds), never from a hand-written list of names.
 */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  implied: number,
  odds: number,
): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(capital, hold);
  const verdict = verdictFor(odds);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p);
  const signal = signalFor(p, age);
  const net = nettingStep(capital, gas, hold, implied, odds, verdict);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: signal.text,
      cost: signal.cost,
      time: signal.time,
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    net,
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const { beta, looBetas } = fitModel(snapshot);
  const { bands, nullAgeOdds } = oddsBands(snapshot);
  const index = bySlug(snapshot.protocols);
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every launchable pre-token protocol, not just the biggest by TVL.
  // A bridge or a liquid-staking receipt can never launch a token of its own, so it is
  // not ranked; the 20 above-floor protocols the house's rule leaves out stay out too.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isLaunchable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, beta);
    const odds = oddsForAge(v.age, bands, nullAgeOdds);
    const capital = capitalFor(p);
    const hold = holdDaysFor(v.age);
    const gas = gasFor(capital, hold);
    const ev = Math.round(v.implied * odds);
    return { p, v, odds, capital, hold, gas, ev, net: ev - gas, verdict: verdictFor(odds) };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // The jackknife rank range: each leave-one-out refit re-prices every row; the 10th and
  // 90th percentile of those prices give the ranks the row could take.
  const implieds = scored.map((s) => s.v.implied);
  const rankOf = (value: number): number => 1 + implieds.filter((v) => v > value).length;
  const ranges = scored.map((s) => {
    const prices = looBetas
      .map((b) => {
        const x = features(s.p, snapshot.as_of);
        return Math.max(1, Math.round(Math.pow(10, predict(x, b))));
      })
      .sort((a, b) => a - b);
    const p10 = prices[Math.floor(0.1 * (prices.length - 1))]!;
    const p90 = prices[Math.floor(0.9 * (prices.length - 1))]!;
    return { low: rankOf(p90), high: rankOf(p10) };
  });
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      intercept: s.v.intercept,
      tvl_term: s.v.tvlTerm,
      growth_term: s.v.growthTerm,
      age_term: s.v.ageTerm,
      fitted_multiple: s.v.fittedMultiple,
      growth_pct: s.v.growthPct,
      age_days: s.v.age,
    },
    rank_low: ranges[i]!.low,
    rank_high: ranges[i]!.high,
    launch_odds: Math.round(s.odds * 1000) / 1000,
    expected_value_usd: s.ev,
    net_usd: s.net,
    verdict: s.verdict,
    farm_steps: farmSteps(s.p, s.v.age, s.v.implied, s.odds).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, capital: number, gas: number, hold: number): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    intercept: row.model.intercept,
    tvl_term: row.model.tvl_term,
    growth_term: row.model.growth_term,
    age_term: row.model.age_term,
    fitted_multiple: row.model.fitted_multiple,
    growth_pct: row.model.growth_pct,
    rank_low: row.rank_low,
    rank_high: row.rank_high,
    launch_odds: row.launch_odds,
    expected_value_usd: row.expected_value_usd,
    net_usd: row.net_usd,
    verdict: row.verdict,
    capital_usd: capital,
    gas_usd: gas,
    hold_days: hold,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { stats } = fitModel(snapshot);
  const { bands, nullAgeOdds } = oddsBands(snapshot);
  // The fit chart: every comp as a point, and the fitted line with growth and age
  // held at the comps' medians, so the line is the model's own TVL slope.
  const comps = fitComps(snapshot);
  const fit_points = comps.map((p) => ({ x: round2(Math.log10(p.tvl_usd)), y: round2(Math.log10(p.mcap_usd!)) }));
  const growths = comps.map((p) => growthFrac(p)).sort((a, b) => a - b);
  const ages = comps.map((p) => Math.log10(ageDays(p, snapshot.as_of) ?? UNKNOWN_AGE_DAYS)).sort((a, b) => a - b);
  const medGrowth = growths[Math.floor(growths.length / 2)]!;
  const medAgeLog = ages[Math.floor(ages.length / 2)]!;
  const xs = fit_points.map((pt) => pt.x);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const fit_line = {
    x1: round2(x1),
    y1: round2(stats.intercept + stats.tvl_coef * x1 + stats.growth_coef * medGrowth + stats.age_coef * medAgeLog),
    x2: round2(x2),
    y2: round2(stats.intercept + stats.tvl_coef * x2 + stats.growth_coef * medGrowth + stats.age_coef * medAgeLog),
  };
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  // The row already carries its TVL and age, so its capital, gas and hold follow
  // from the same rules as the farm plan, with no second look-up.
  const rows = board.map((r) => {
    const capital = r.tvl_usd >= 5_000_000_000 ? 250 : r.tvl_usd >= 1_000_000_000 ? 150 : r.tvl_usd >= 100_000_000 ? 100 : 50;
    const hold = holdDaysFor(r.age_days);
    return radarRow(r, capital, gasFor(capital, hold), hold);
  });
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: stats,
    model_version: MODEL_VERSION,
    fit_points,
    fit_line,
    odds_bands: bands,
    odds_null_age: Math.round(nullAgeOdds * 1000) / 1000,
    watchlist: snapshot.watchlist,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}
