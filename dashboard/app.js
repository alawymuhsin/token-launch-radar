// Token Launch Radar — the dashboard. No framework, no network: it reads window.RADAR
// from data.js, renders the board, and generates each protocol's farm plan from the
// row's own record, with the same rules as the program that wrote board.json.
(function () {
  var R = window.RADAR;
  if (!R || !R.rows) {
    document.getElementById('rows').innerHTML = '<tr><td colspan="8">No radar data. This page reads data.js beside it.</td></tr>';
    return;
  }
  var watch = {};
  (R.watchlist || []).forEach(function (s) { watch[s] = true; });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function pct(n) {
    if (n == null) return '—';
    var c = n >= 0 ? 'up' : 'down';
    return '<span class="' + c + '">' + (n >= 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }

  // ---- header: counts and the model, stated so any rank can be checked by hand ----
  document.getElementById('meta').innerHTML =
    'Snapshot <b>' + esc(R.as_of) + '</b> · <b>' + R.board_size + '</b> ranked rows<br>' +
    '<b>' + R.watchlist_size + '</b> watchlist · <b>' + R.early_size + '</b> early · model <b>' + esc(R.model_version) + '</b>';
  document.getElementById('model').innerHTML =
    '<b>How a rank is made.</b> implied value = TVL × ' + R.model.base_multiple +
    ' × growth (7-day change, clamped ' + R.model.growth_floor + '% to ' + R.model.growth_cap + '%, weight ' + R.model.growth_weight +
    ') × maturity (age up to ' + R.model.maturity_days + ' days, ' + R.model.maturity_floor + ' to ' +
    (R.model.maturity_floor + R.model.maturity_range) + ') × chains (1 + ' + R.model.chain_step +
    ' per extra chain, up to +' + Math.round(R.model.chain_step * R.model.chain_cap * 100) +
    '%). No name is ever special-cased: the same four factors score every row.';

  // ---- filter options from the data ----
  var cats = {}, chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    (r.chains || []).forEach(function (c) { chains[c] = true; });
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
  function capitalFor(r) {
    if (r.tvl_usd >= 5e9) return 250;
    if (r.tvl_usd >= 1e9) return 150;
    if (r.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age == null) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
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
    var chain = chainOf(r), capital = capitalFor(r), hold = holdDaysFor(r.age_days);
    var signal = signalFor(r);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(r, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: weeklyFor(r), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: signal.text, cost: signal.cost, time: signal.time },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  // ---- the board: sort, filter, search ----
  var rowsEl = document.getElementById('rows');
  function filtered() {
    var q = document.getElementById('q').value.trim().toLowerCase();
    var cat = document.getElementById('cat').value;
    var chain = document.getElementById('chain').value;
    var wOnly = document.getElementById('watch').checked;
    var sort = document.getElementById('sort').value;
    var list = R.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (chain && !(r.chains || []).includes(chain)) return false;
      if (wOnly && !watch[r.slug]) return false;
      return true;
    });
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d); },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); }
    }[sort];
    return list.sort(by);
  }
  function render() {
    var list = filtered();
    rowsEl.innerHTML = list.map(function (r) {
      var tags = (r.chains || []).slice(0, 3).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('');
      if ((r.chains || []).length > 3) tags += '<span class="tag">+' + (r.chains.length - 3) + '</span>';
      return '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b>' + (watch[r.slug] ? '<span class="badge">WATCHLIST</span>' : '') + '<br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td><td>' + tags + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + (r.age_days == null ? '—' : r.age_days + 'd') + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
    }).join('');
    document.getElementById('count').textContent = 'Showing ' + list.length + ' of ' + R.rows.length + ' ranked rows.';
  }
  ['q', 'cat', 'chain', 'watch', 'sort'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', render);
    document.getElementById(id).addEventListener('change', render);
  });

  // ---- detail view: the row's figures, its four factors, and its farm plan ----
  var detail = document.getElementById('detail');
  document.getElementById('close').addEventListener('click', function () {
    detail.hidden = true;
    document.querySelectorAll('#rows tr.sel').forEach(function (tr) { tr.classList.remove('sel'); });
  });
  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    document.querySelectorAll('#rows tr.sel').forEach(function (x) { x.classList.remove('sel'); });
    tr.classList.add('sel');
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === tr.getAttribute('data-slug')) r = x; });
    if (!r) return;
    var base = Math.round(r.tvl_usd * R.model.base_multiple);
    var steps = farmSteps(r).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    document.getElementById('detail-body').innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + (watch[r.slug] ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="sub">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + esc((r.chains || []).join(', ') || 'no chain listed') + '</p>' +
      '<div class="facts">' +
      '<div class="fact"><b>' + money(r.implied_value_usd) + '</b><span>implied value</span></div>' +
      '<div class="fact"><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div class="fact"><b>' + (r.change_7d == null ? '—' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</b><span>7-day TVL change</span></div>' +
      '<div class="fact"><b>' + (r.age_days == null ? '—' : r.age_days + ' days') + '</b><span>tracked with no token</span></div>' +
      '</div>' +
      '<h3>Why this rank — the four factors</h3>' +
      '<p class="formula">base ' + money(base) + ' (TVL × ' + R.model.base_multiple + ') × growth ' + r.growth_multiplier +
      ' × maturity ' + r.maturity_multiplier + ' × chains ' + r.chain_multiplier + ' = <b>' + money(r.implied_value_usd) + '</b></p>' +
      '<h3>How to farm it</h3><ol>' + steps + '</ol>';
    detail.hidden = false;
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // ---- live tokens: the market's own values, kept apart ----
  document.getElementById('live-rows').innerHTML = R.live.map(function (p) {
    var tags = (p.chains || []).slice(0, 3).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('');
    return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.category || '—') + '</td><td>' + tags + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td><td class="num"><b>' + money(p.mcap_usd) + '</b></td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  render();
})();
