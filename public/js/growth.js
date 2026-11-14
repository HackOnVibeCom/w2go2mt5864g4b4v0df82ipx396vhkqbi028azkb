// Live growth-loop numbers straight from this deployment's database.
import { api, esc, money, paths } from './core.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const num = (x) => new Intl.NumberFormat().format(x);

export function mountGrowth(root) {
  let dead = false;
  root.innerHTML = `
    <section class="hero">
      <h1>Every split puts Tapsplit in front of <mark>the whole table</mark>.</h1>
      <p>A payer shares the bill. Friends open the link, claim their items and can start a bill of their own. See how often that happens on this site.</p>
    </section>
    <div id="g"><div class="skeleton"></div></div>`;

  async function load() {
    let g;
    try {
      g = await api('GET', '/growth');
    } catch (err) {
      if (!dead) root.querySelector('#g').innerHTML = `<div class="card"><p class="muted">${esc(err.message)}</p></div>`;
      return;
    }
    if (dead) return;
    const funnelMax = Math.max(1, g.peopleReached, g.joined);
    const bar = (v) => `<div class="funnel-bar"><span style="width:${Math.round((v / funnelMax) * 100)}%"></span></div>`;
    const dayMax = Math.max(1, ...g.days.map((d) => Math.max(d.splits, d.joins)));
    root.querySelector('#g').innerHTML = `
      <div class="stats">
        <div class="stat hero-stat">
          <div class="v">${g.kFactor.toFixed(2)}</div>
          <div class="k">Estimated viral coefficient · ${g.invitesPerSplit.toFixed(1)} guest browsers reached per bill × ${pct(g.conversion)} of reached browsers later creating a bill.</div>
        </div>
        <div class="stat"><div class="v">${num(g.splits)}</div><div class="k">bills split</div></div>
        <div class="stat"><div class="v">${num(g.peopleReached)}</div><div class="k">guest browsers reached through shared links</div></div>
        <div class="stat"><div class="v">${num(g.referredSplits)}</div><div class="k">splits started from someone else's split</div></div>
        <div class="stat"><div class="v">${num(g.longestChain)}</div><div class="k">longest referral chain (generations)</div></div>
      </div>
      <section class="card">
        <h2>The loop</h2>
        <div class="funnel">
          <div class="funnel-row"><span>Opened a friend's link</span>${bar(g.peopleReached)}<span class="mono">${num(g.peopleReached)}</span></div>
          <div class="funnel-row"><span>Joined a bill</span>${bar(g.joined)}<span class="mono">${num(g.joined)}</span></div>
          <div class="funnel-row"><span>Marked as paid</span>${bar(g.paid)}<span class="mono">${num(g.paid)}</span></div>
          <div class="funnel-row"><span>Split their own bill</span>${bar(g.becameCreators)}<span class="mono">${num(g.becameCreators)}</span></div>
        </div>
        <p class="small muted">Link opens and new creators count unique browsers. Joins and payment marks count each bill separately.</p>
      </section>
      <section class="card">
        <h2>Last 14 days</h2>
        <div class="days">${g.days
          .map(
            (d) => `<div class="day" title="${d.day}: ${d.splits} splits, ${d.joins} friends joined">
              <span class="j" style="height:${(d.joins / dayMax) * 100}%"></span>
              <span class="s" style="height:${(d.splits / dayMax) * 100}%"></span></div>`,
          )
          .join('')}</div>
        <div class="legend"><span><i style="background:var(--ink)"></i>splits created</span><span><i style="background:var(--hl)"></i>friends joined</span></div>
      </section>
      <section class="card">
        <h2>Payments confirmed by the person who paid the bill</h2>
        ${
          g.settled.length
            ? g.settled.map((s) => `<div class="trow"><span>${num(s.n)} payment${s.n === 1 ? '' : 's'}</span><span class="mono">${money(s.amount, s.currency)}</span></div>`).join('')
            : '<p class="muted small" style="margin:0">No payments confirmed yet.</p>'
        }
        <h2 style="margin-top:16px">How links get shared</h2>
        ${
          g.shareClicks.length
            ? g.shareClicks.map((s) => `<div class="trow"><span>${esc(s.channel)}</span><span class="mono">${num(s.n)}</span></div>`).join('')
            : '<p class="muted small" style="margin:0">No shares yet.</p>'
        }
      </section>
      <a class="btn primary big" href="${paths.home()}" data-link>Split a bill</a>`;
  }

  load();
  const timer = setInterval(load, 15000);
  return () => {
    dead = true;
    clearInterval(timer);
  };
}
