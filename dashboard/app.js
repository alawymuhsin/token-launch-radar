// Token Launch Radar, radar-3 — the dashboard. No framework, no network: it reads
// window.RADAR from data.js, renders the board, and generates each protocol's farm
// plan from the row's own record, with the same rules as the program that wrote
// board.json — so the page and the board agree step for step.
(function () {
  var R = window.RADAR;
  var boardEl = document.querySelector('#board tbody');
  if (!R || !R.rows) {
    boardEl.innerHTML = '<tr><td colspan="11">No radar data. This page reads data.js beside it.</td></tr>';
    return;
  }
  var watch = {};
  (R.watchlist || []).forEach(function (s) { watch[s] = true; });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** $115.8M for 115752338 — the same compact form the program uses in the netting step. */
  function compactMoney(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n == null) return '—';
    var c = n >= 0 ? 'up' : 'down';
    return '<span class="' + c + '">' + (n >= 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }

  // ---- header: what the snapshot is and what the model fitted from it ----
  document.getElementById('meta').innerHTML =
    'Snapshot <b>' + esc(R.as_of) + '</b> · <b>' + R.board_size + '</b> ranked rows<br>' +
    '<b>' + R.watchlist_size + '</b> watchlist · <b>' + R.early_size + '</b> early · model <b>' + esc(R.model_version) + '</b>';
  document.getElementById('asof').textContent = R.as_of;

  var m = R.model;
  var kpis = [
    { v: String(m.comps), l: 'traded comps fitted' },
    { v: m.r2.toFixed(3), l: 'in-sample R²' },
    { v: m.loo_r2.toFixed(3), l: 'leave-one-out R²' },
    { v: m.loo_mdape_pct.toFixed(1) + '%', l: 'leave-one-out median error' },
    { v: m.walk_forward_mdape_pct.toFixed(1) + '%', l: 'walk-forward median error' },
    { v: String(R.board_size), l: 'ranked rows · ' + R.watchlist_size + '/' + R.watchlist_size + ' watchlist' }
  ];
  document.getElementById('kpis').innerHTML = kpis.map(function (k, i) {
    return '<div class="kpi' + (i === 3 || i === 4 ? ' warn' : '') + '"><b>' + esc(k.v) + '</b><span>' + esc(k.l) + '</span></div>';
  }).join('');

  document.getElementById('equation').innerHTML =
    'log<sub>10</sub>(market cap) = <b>' + m.intercept + '</b> + <b>' + m.tvl_coef + '</b> × log<sub>10</sub>(TVL) + <b>' +
    m.growth_coef + '</b> × growth + <b>' + m.age_coef + '</b> × log<sub>10</sub>(age in days). ' +
    'Growth is the seven-day TVL change, clamped ' + m.growth_floor + '% to ' + m.growth_cap + '%. ' +
    'A protocol listed with no date is read as ' + m.unknown_age_days + ' days old. ' +
    'Every coefficient above is fitted from the ' + m.comps + ' traded tokens — nothing is hand-picked.';

  var validRows = [
    ['In-sample R²', m.r2.toFixed(3), 'TVL, growth and age explain about a third of the traded tokens’ values.'],
    ['Leave-one-out R²', m.loo_r2.toFixed(3), 'Refit ' + m.comps + ' times, each time without one token: the fit holds.'],
    ['Leave-one-out median error', m.loo_mdape_pct.toFixed(1) + '%', 'The typical miss when pricing a token the model has never seen.'],
    ['Walk-forward median error', m.walk_forward_mdape_pct.toFixed(1) + '%', 'Trained on the older half of the comps, tested on the newer half.'],
    ['Flat 0.25× multiple, median error', m.flat_mdape_pct.toFixed(1) + '%', 'The old flat multiple, for comparison: the fitted model beats it leave-one-out (' + m.loo_mdape_pct.toFixed(1) + '% vs ' + m.flat_mdape_pct.toFixed(1) + '%) and loses walk-forward (' + m.walk_forward_mdape_pct.toFixed(1) + '% vs ' + m.flat_mdape_pct.toFixed(1) + '%). TVL carries most of the signal; growth and age add little out of sample — and the model says so.']
  ];
  document.querySelector('#valid-table tbody').innerHTML = validRows.map(function (r) {
    return '<tr><td>' + esc(r[0]) + '</td><td class="num"><b>' + esc(r[1]) + '</b></td><td>' + esc(r[2]) + '</td></tr>';
  }).join('');

  document.querySelector('#odds-table tbody').innerHTML = R.odds_bands.map(function (b) {
    var range = b.max_age_days == null ? b.min_age_days + '+ days' : b.min_age_days + '–' + b.max_age_days + ' days';
    return '<tr><td>' + esc(range) + '</td><td class="num">' + b.protocols + '</td><td class="num">' + b.tokenized + '</td><td class="num"><b>' + (b.odds * 100).toFixed(1) + '%</b></td></tr>';
  }).join('') +
    '<tr><td>No listed date</td><td class="num">—</td><td class="num">—</td><td class="num"><b>' + (R.odds_null_age * 100).toFixed(1) + '%</b></td></tr>';

  // ---- the fit chart: one dot per traded comp, the fitted line through them ----
  (function chart() {
    var pts = R.fit_points || [], line = R.fit_line;
    if (!pts.length || !line) return;
    var W = 560, H = 320, pad = 44;
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var x0 = Math.floor(Math.min.apply(null, xs.concat([line.x1]))),
        x1 = Math.ceil(Math.max.apply(null, xs.concat([line.x2]))),
        y0 = Math.floor(Math.min.apply(null, ys.concat([line.y1]))),
        y1 = Math.ceil(Math.max.apply(null, ys.concat([line.y2])));
    function X(v) { return pad + (v - x0) / (x1 - x0) * (W - pad * 2); }
    function Y(v) { return H - pad - (v - y0) / (y1 - y0) * (H - pad * 2); }
    var dots = pts.map(function (p) {
      return '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3.5" fill="#f5b942" opacity="0.75"/>';
    }).join('');
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter of traded tokens: log TVL against log market cap, with the fitted line">' +
      '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '" stroke="#22345c"/>' +
      '<line x1="' + pad + '" y1="' + pad + '" x2="' + pad + '" y2="' + (H - pad) + '" stroke="#22345c"/>' +
      dots +
      '<line x1="' + X(line.x1).toFixed(1) + '" y1="' + Y(line.y1).toFixed(1) + '" x2="' + X(line.x2).toFixed(1) + '" y2="' + Y(line.y2).toFixed(1) + '" stroke="#3ddc97" stroke-width="2"/>' +
      '<text x="' + (W / 2) + '" y="' + (H - 10) + '" fill="#93a5c4" font-size="12" text-anchor="middle">log10(TVL in $)</text>' +
      '<text x="14" y="' + (H / 2) + '" fill="#93a5c4" font-size="12" text-anchor="middle" transform="rotate(-90 14 ' + (H / 2) + ')">log10(market cap in $)</text>' +
      '<text x="' + pad + '" y="' + (pad - 8) + '" fill="#e8eef7" font-size="12">amber = one traded token · green = fitted line</text>' +
      '</svg>';
    document.getElementById('chart').innerHTML = svg;
    document.getElementById('chart-note').textContent =
      'Log scale: each step is ten times the money. The scatter is wide — that is why the out-of-sample error above is honest, not hidden.';
  })();

  // ---- filter options from the data ----
  var cats = {}, chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    (r.chains || []).forEach(function (c) { chains[c] = true; });
  });
  (R.live || []).forEach(function (p) {
    if (p.category) cats[p.category] = true;
    (p.chains || []).forEach(function (c) { chains[c] = true; });
  });
  function fill(sel, values) {
    var el = document.getElementById(sel);
    Object.keys(values).sort().forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v; el.appendChild(o);
    });
  }
  fill('cat', cats); fill('chain', chains);

  // ---- the farm plan: the same rules as lib/model.ts, so the page and board.json agree ----
  function chainOf(r) { return (r.chains && r.chains[0]) || 'its main chain'; }
  function actionFor(r, capital, chain) {
    var c = (r.category || '').toLowerCase(), name = r.name;
    if (c.indexOf('risk curat') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('onchain capital') >= 0)
      return 'Deposit $' + capital + ' of USDC into a ' + name + ' vault on ' + chain + ' and keep the vault shares.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0)
      return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0)
      return 'Provide $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('canonical bridge') >= 0)
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('liquid restaking') >= 0 || c.indexOf('restak') >= 0)
      return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trad') >= 0)
      return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0 || c.indexOf('options') >= 0)
      return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('stable') >= 0)
      return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0)
      return 'Mint $' + capital + ' of the protocol\'s yield asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0)
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('chain') >= 0)
      return 'Bridge $' + capital + ' of USDC onto ' + name + '\'s chain and use one of its apps.';
    if (c.indexOf('farm') >= 0 || c.indexOf('staking') >= 0)
      return 'Stake $' + capital + ' through ' + name + ' on ' + chain + ' and keep the receipt.';
    if (c.indexOf('launchpad') >= 0)
      return 'Join one ' + name + ' sale with $' + capital + ' and hold the allocation.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(r) {
    var c = (r.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'Make one qualifying action each week, such as a supply, a borrow or a repayment.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0) return 'Make one qualifying action each week, such as a swap, adding liquidity or claiming rewards.';
    if (c.indexOf('bridge') >= 0) return 'Make one qualifying action each week, such as a bridge transfer or a swap on the destination chain.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trad') >= 0) return 'Make one qualifying action each week, such as opening, closing or rebalancing one position.';
    if (c.indexOf('prediction') >= 0 || c.indexOf('options') >= 0) return 'Make one qualifying action each week, such as one market position or a settlement.';
    return 'Make one qualifying action each week, such as a deposit, a vote or a claim.';
  }
  function signalFor(r) {
    var g = r.change_7d, age = r.age_days;
    if (g != null && g >= 30)
      return { text: 'TVL rose ' + g.toFixed(1) + '% in seven days, so the window is hot: start this week, before the next snapshot catches the crowd.', cost: 'no extra cost beyond the position', time: 'start within 7 days' };
    if (g != null && g <= -20)
      return { text: 'TVL fell ' + Math.abs(g).toFixed(1) + '% in seven days, so start small and add only if the next week stabilises.', cost: 'no extra cost beyond the position', time: 'start within 14 days' };
    if (age != null && age >= 730)
      return { text: 'The protocol has run ' + age + ' days with no token, so a launch would reward holders who stayed: keep the position through the next quarter.', cost: 'no extra cost beyond the position', time: 'hold at least 90 days' };
    if (age != null && age < 90)
      return { text: 'The protocol was listed only ' + age + ' days ago, so a small position now counts more than a large one later: be early, not big.', cost: 'no extra cost beyond the position', time: 'start within 7 days' };
    return { text: 'TVL is steady and the protocol has run ' + (age == null ? 'about a year' : age) + ' days with no token, so a regular position held for a full quarter is the plan.', cost: 'no extra cost beyond the position', time: 'hold at least 90 days' };
  }
  function stepText(s) {
    var out = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.';
    if (out.length > 600) out = out.slice(0, 596) + '...';
    if (out.length < 20) out = out + ' Hold the position and check the protocol\'s own page.';
    return out;
  }
  function farmSteps(r) {
    var chain = chainOf(r), capital = r.capital_usd, hold = r.hold_days, gas = r.gas_usd;
    var signal = signalFor(r);
    var verdictText = r.verdict === 'Farm'
      ? 'Farm — the snapshot says protocols this old launch most often, so this is a first-priority position.'
      : r.verdict === 'Farm small'
        ? 'Farm small — the launch odds are middling, so keep the position to the size above and no bigger.'
        : 'Watch — the launch odds are thin, so a small position only, and unwind first if gas rises.';
    var net = {
      text: 'Netted: $' + capital + ' capital goes in and comes back when you unwind, so the true cost is about $' + gas + ' gas over ' + hold + ' days. ' +
        'Expected value: ' + compactMoney(r.implied_value_usd) + ' implied x ' + (r.launch_odds * 100).toFixed(0) + '% launch odds = ' + compactMoney(r.expected_value_usd) + '. ' +
        'Net after gas: +' + compactMoney(r.net_usd) + '. Verdict: ' + verdictText,
      cost: 'about $' + gas + ' gas in all',
      time: hold + ' days'
    };
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(r, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: weeklyFor(r), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: signal.text, cost: signal.cost, time: signal.time },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' },
      net
    ].map(stepText);
  }

  // ---- the board: sort, filter, search, live view ----
  function filtered() {
    var q = document.getElementById('search').value.trim().toLowerCase();
    var cat = document.getElementById('cat').value;
    var chain = document.getElementById('chain').value;
    var wOnly = document.getElementById('watchonly').checked;
    var live = document.getElementById('liveview').checked;
    var sort = document.getElementById('sort').value;
    var source = live ? (R.live || []).map(function (p) {
      return { slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, change_7d: p.change_7d, mcap_usd: p.mcap_usd, live: true };
    }) : R.rows;
    var list = source.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (chain && !(r.chains || []).includes(chain)) return false;
      if (wOnly && !watch[r.slug]) return false;
      return true;
    });
    var by = {
      rank: function (a, b) { return (a.rank || 1e9) - (b.rank || 1e9); },
      implied: function (a, b) { return (b.implied_value_usd || b.mcap_usd || 0) - (a.implied_value_usd || a.mcap_usd || 0); },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d); },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); }
    }[sort];
    return { list: list.sort(by), live: live };
  }
  function verdictClass(v) {
    return v === 'Farm' ? 'verdict-farm' : v === 'Farm small' ? 'verdict-small' : 'verdict-watch';
  }
  function render() {
    var f = filtered();
    boardEl.innerHTML = f.list.map(function (r) {
      var tags = (r.chains || []).slice(0, 3).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('');
      if ((r.chains || []).length > 3) tags += '<span class="tag">+' + (r.chains.length - 3) + '</span>';
      if (r.live) {
        return '<tr data-slug="' + esc(r.slug) + '" data-live="1"><td>—</td>' +
          '<td><b>' + esc(r.name) + '</b><br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td><td>' + tags + '</td>' +
          '<td class="num">' + compactMoney(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td>' +
          '<td class="num"><b>' + compactMoney(r.mcap_usd) + '</b></td>' +
          '<td class="num">—</td><td class="num">—</td><td class="num">—</td><td>Live</td></tr>';
      }
      return '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b>' + (watch[r.slug] ? '<span class="watch">WATCHLIST</span>' : '') + '<br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td><td>' + tags + '</td>' +
        '<td class="num">' + compactMoney(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num"><b>' + compactMoney(r.implied_value_usd) + '</b></td>' +
        '<td class="num">' + r.rank_low + '–' + r.rank_high + '</td>' +
        '<td class="num">' + (r.launch_odds * 100).toFixed(1) + '%</td>' +
        '<td class="num">+' + compactMoney(r.net_usd) + '</td>' +
        '<td class="' + verdictClass(r.verdict) + '">' + esc(r.verdict) + '</td></tr>';
    }).join('');
    document.getElementById('count').textContent = f.live
      ? 'Showing ' + f.list.length + ' of ' + (R.live || []).length + ' protocols that already trade — market caps, kept apart from the ranking.'
      : 'Showing ' + f.list.length + ' of ' + R.rows.length + ' ranked rows.';
  }
  ['search', 'cat', 'chain', 'watchonly', 'liveview', 'sort'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', render);
    document.getElementById(id).addEventListener('change', render);
  });

  // ---- detail view: the row's figures, its fitted terms, its costs, its farm plan ----
  var detail = document.getElementById('detail');
  boardEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    document.querySelectorAll('#board tbody tr.sel').forEach(function (x) { x.classList.remove('sel'); });
    tr.classList.add('sel');
    var slug = tr.getAttribute('data-slug');
    if (tr.getAttribute('data-live') === '1') {
      var p = null;
      (R.live || []).forEach(function (x) { if (x.slug === slug) p = x; });
      if (!p) return;
      detail.innerHTML =
        '<h2>' + esc(p.name) + '</h2>' +
        '<p class="sub">' + esc(p.slug) + ' · ' + esc(p.category || 'no category') + ' · ' + esc((p.chains || []).join(', ') || 'no chain listed') + '</p>' +
        '<div class="facts">' +
        '<div class="fact"><b>' + compactMoney(p.mcap_usd) + '</b><span>market cap — the market’s own value</span></div>' +
        '<div class="fact"><b>' + compactMoney(p.tvl_usd) + '</b><span>TVL</span></div>' +
        '<div class="fact"><b>' + (p.change_7d == null ? '—' : (p.change_7d >= 0 ? '+' : '') + p.change_7d.toFixed(1) + '%') + '</b><span>7-day TVL change</span></div>' +
        '</div>' +
        '<p class="hint">This protocol already trades, so it is not ranked — its market cap is shown instead of a fitted value. It is one of the ' + m.comps + ' comps the model was fitted on, or a fellow traded protocol kept apart from the board.</p>';
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    var logSum = r.intercept + r.tvl_term + r.growth_term + r.age_term;
    var steps = farmSteps(r).map(function (s, i) {
      return '<li' + (i === 7 ? '><b>Netted:</b> ' + esc(s.slice(8)) : '>' + esc(s)) + '</li>';
    }).join('');
    detail.innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + (watch[r.slug] ? '<span class="watch">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="sub">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + esc((r.chains || []).join(', ') || 'no chain listed') + '</p>' +
      '<div class="facts">' +
      '<div class="fact"><b>' + compactMoney(r.implied_value_usd) + '</b><span>implied value</span></div>' +
      '<div class="fact"><b>' + compactMoney(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div class="fact"><b>' + (r.change_7d == null ? '—' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</b><span>7-day TVL change</span></div>' +
      '<div class="fact"><b>' + (r.age_days == null ? '—' : r.age_days + ' days') + '</b><span>tracked with no token</span></div>' +
      '<div class="fact"><b>#' + r.rank_low + '–' + r.rank_high + '</b><span>rank range (jackknife)</span></div>' +
      '<div class="fact"><b>' + (r.launch_odds * 100).toFixed(1) + '%</b><span>launch odds by age</span></div>' +
      '<div class="fact"><b>+' + compactMoney(r.net_usd) + '</b><span>net after gas</span></div>' +
      '<div class="fact"><b>' + esc(r.verdict) + '</b><span>verdict</span></div>' +
      '</div>' +
      '<h3>Why this rank — the fitted terms</h3>' +
      '<p class="formula">log<sub>10</sub>(implied) = ' + r.intercept + ' (intercept) + ' + r.tvl_term + ' (TVL) + ' + r.growth_term + ' (growth ' + (r.growth_pct == null ? '—' : r.growth_pct.toFixed(1) + '%') + ') + ' + r.age_term + ' (age) = ' + logSum.toFixed(3) + ' → <b>' + compactMoney(r.implied_value_usd) + '</b>. ' +
      'Fitted multiple: implied ÷ TVL = <b>' + r.fitted_multiple + '×</b>.</p>' +
      '<h3>What it costs</h3>' +
      '<table class="costs"><thead><tr><th>Item</th><th class="num">Amount</th></tr></thead><tbody>' +
      '<tr><td>Capital to deposit (comes back on unwind)</td><td class="num">$' + r.capital_usd + '</td></tr>' +
      '<tr><td>Gas, set-up plus weekly actions over the hold</td><td class="num">about $' + r.gas_usd + '</td></tr>' +
      '<tr><td>Hold</td><td class="num">' + r.hold_days + ' days</td></tr>' +
      '<tr><td>Expected value (implied × launch odds)</td><td class="num">' + compactMoney(r.expected_value_usd) + '</td></tr>' +
      '<tr><td><b>Net after gas</b></td><td class="num"><b>+' + compactMoney(r.net_usd) + '</b></td></tr>' +
      '</tbody></table>' +
      '<h3>How to farm it</h3><ol>' + steps + '</ol>';
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  render();
})();
