import { loadFromStorage } from './storage.js';

function primaryWho(log) {
  return Array.isArray(log.who) ? log.who[0] : (log.who || '');
}

function filterLogs(logs, period) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (period) {
    case 'day':
      return logs.filter(l => l.dateKey === today);
    case 'week': {
      const cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return logs.filter(l => l.dateKey >= cutoff);
    }
    case 'month':
      return logs.filter(l => l.monthKey === today.slice(0, 7));
    case 'year':
      return logs.filter(l => l.dateKey?.startsWith(today.slice(0, 4)));
    default:
      return logs;
  }
}

function barChart(items) {
  if (!items.length) return '<p class="empty-state">Not enough data for this period.</p>';
  const max = Math.max(...items.map(i => i.value), 1);
  return items.map(({ label, value }) => `
    <div class="stat-row">
      <span class="stat-label" title="${label}">${label}</span>
      <div class="stat-bar-wrap">
        <div class="stat-bar" style="width:${(value / max * 100).toFixed(1)}%"></div>
        <span class="stat-count">${value}</span>
      </div>
    </div>
  `).join('');
}

function section(icon, title, content) {
  return `<div class="analytics-card"><h3>${icon} ${title}</h3>${content}</div>`;
}

function renderSummary(logs, period) {
  const fronters = new Set(logs.map(primaryWho).filter(Boolean));
  const label = { day: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' }[period];
  return `
    <div class="analytics-summary">
      <div class="summary-item"><div class="summary-value">${logs.length}</div><div class="summary-label">Logs (${label})</div></div>
      <div class="summary-item"><div class="summary-value">${fronters.size}</div><div class="summary-label">Fronters</div></div>
    </div>
  `;
}

function renderFronterFrequency(logs) {
  const counts = {};
  logs.forEach(l => {
    const who = primaryWho(l);
    if (who) counts[who] = (counts[who] || 0) + 1;
  });
  const items = Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return section('👤', 'Fronter Frequency', barChart(items));
}

function renderAwareness(logs) {
  const sums = {}, counts = {};
  logs.forEach(l => {
    const who = primaryWho(l);
    if (who && l.awareness) {
      sums[who] = (sums[who] || 0) + l.awareness;
      counts[who] = (counts[who] || 0) + 1;
    }
  });
  const items = Object.keys(sums)
    .map(label => ({ label, value: parseFloat((sums[label] / counts[label]).toFixed(1)) }))
    .sort((a, b) => b.value - a.value);
  return section('🧠', 'Avg Awareness', barChart(items));
}

function renderLocations(logs) {
  const counts = {};
  logs.forEach(l => {
    const loc = (l.where || '').trim().toLowerCase();
    if (loc) counts[loc] = (counts[loc] || 0) + 1;
  });
  const items = Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  return section('📍', 'Top Locations', barChart(items));
}

function renderTimeOfDay(logs) {
  const buckets = { 'Night (0–5)': 0, 'Morning (6–11)': 0, 'Afternoon (12–17)': 0, 'Evening (18–23)': 0 };
  logs.forEach(l => {
    if (!l.timestamp) return;
    const h = new Date(l.timestamp).getHours();
    if (h < 6) buckets['Night (0–5)']++;
    else if (h < 12) buckets['Morning (6–11)']++;
    else if (h < 18) buckets['Afternoon (12–17)']++;
    else buckets['Evening (18–23)']++;
  });
  const items = Object.entries(buckets).map(([label, value]) => ({ label, value }));
  return section('🕐', 'Time of Day', barChart(items));
}

function renderDayOfWeek(logs, period) {
  if (period === 'day') return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = Object.fromEntries(days.map(d => [d, 0]));
  logs.forEach(l => {
    if (!l.dateKey) return;
    counts[days[new Date(l.dateKey + 'T12:00:00').getDay()]]++;
  });
  const items = days.map(label => ({ label, value: counts[label] }));
  return section('📅', 'Day of Week', barChart(items));
}

function renderCofronting(logs) {
  const pairs = {};
  logs.forEach(l => {
    if (!Array.isArray(l.who) || l.who.length < 2) return;
    const names = [...l.who].sort();
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const key = `${names[i]} & ${names[j]}`;
        pairs[key] = (pairs[key] || 0) + 1;
      }
  });
  const items = Object.entries(pairs).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  return section('🤝', 'Co-fronting Pairs', items.length ? barChart(items) : '<p class="empty-state">No co-fronting logs in this period.</p>');
}

function renderContextByFronter(logs) {
  const fronters = {};
  logs.forEach(l => {
    const who = primaryWho(l);
    if (!who) return;
    if (!fronters[who]) fronters[who] = { locations: {}, hours: [0,0,0,0] };
    const loc = (l.where || '').trim().toLowerCase();
    if (loc) fronters[who].locations[loc] = (fronters[who].locations[loc] || 0) + 1;
    if (l.timestamp) {
      const h = new Date(l.timestamp).getHours();
      const bucket = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
      fronters[who].hours[bucket]++;
    }
  });

  const names = Object.keys(fronters);
  if (!names.length) return '';

  const bucketLabels = ['Night', 'Morning', 'Afternoon', 'Evening'];
  const rows = names.map(name => {
    const { locations, hours } = fronters[name];
    const topLoc = Object.entries(locations).sort((a, b) => b[1] - a[1])[0];
    const topTime = hours.indexOf(Math.max(...hours));
    return `
      <div class="context-row">
        <span class="context-name">${name}</span>
        <span class="context-detail">${topLoc ? `📍 ${topLoc[0]}` : ''}</span>
        <span class="context-detail">${Math.max(...hours) > 0 ? `🕐 ${bucketLabels[topTime]}` : ''}</span>
      </div>
    `;
  }).join('');

  return section('🗂️', 'Context by Fronter', `<div class="context-table">${rows}</div>`);
}

function render(allLogs, period) {
  const logs = filterLogs(allLogs, period);
  const root = document.getElementById('analyticsRoot');

  if (!allLogs.length) {
    root.innerHTML = '<p class="empty-state" style="padding:24px 0">No log data yet. Start logging to see analytics.</p>';
    return;
  }

  root.innerHTML = [
    renderSummary(logs, period),
    renderFronterFrequency(logs),
    renderAwareness(logs),
    renderContextByFronter(logs),
    renderLocations(logs),
    renderTimeOfDay(logs),
    renderDayOfWeek(logs, period),
    renderCofronting(logs),
  ].join('');
}

window.addEventListener('DOMContentLoaded', () => {
  const active = loadFromStorage('front_logs', []);
  const archived = loadFromStorage('front_logs_archive', []);
  const allLogs = [...active, ...archived];

  let currentPeriod = 'week';

  const periodBar = document.getElementById('period-bar');
  if (periodBar) {
    periodBar.addEventListener('click', e => {
      const btn = e.target.closest('[data-period]');
      if (!btn) return;
      currentPeriod = btn.dataset.period;
      periodBar.querySelectorAll('[data-period]').forEach(b => b.classList.toggle('active', b === btn));
      render(allLogs, currentPeriod);
    });
    periodBar.querySelector(`[data-period="${currentPeriod}"]`)?.classList.add('active');
  }

  render(allLogs, currentPeriod);
});
