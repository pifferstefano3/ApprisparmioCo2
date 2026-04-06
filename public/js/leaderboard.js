requireAuth();

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_CLASS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

let chartInstance = null;

async function init() {
  const [meRes, lbRes] = await Promise.all([
    apiFetch('/api/auth/me'),
    apiFetch('/api/leaderboard?limit=50'),
  ]);

  if (!lbRes?.ok) { showToast('Errore caricamento classifica', 'error'); return; }

  const { leaderboard, myPosition } = lbRes.data;
  const myUsername = meRes?.data?.username || '';
  const myCO2 = meRes?.data?.co2Points || 0;

  // Mia posizione
  document.getElementById('myRankBadge').textContent = `#${myPosition || '-'}`;
  document.getElementById('myRankDisplay').textContent = `#${myPosition || '-'}`;
  document.getElementById('myRankCO2').textContent = `${parseFloat(myCO2).toFixed(2)} punti CO2`;

  renderChart(leaderboard.slice(0, 10));
  renderList(leaderboard, myUsername);
}

function renderChart(top10) {
  const ctx = document.getElementById('leaderboardChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top10.map(u => u.username.length > 10 ? u.username.slice(0, 10) + '…' : u.username),
      datasets: [{
        label: 'Punti CO2',
        data: top10.map(u => u.co2Points),
        backgroundColor: top10.map((_, i) =>
          i === 0 ? 'rgba(251,191,36,0.8)' :
          i === 1 ? 'rgba(156,163,175,0.8)' :
          i === 2 ? 'rgba(217,119,6,0.8)' :
          'rgba(74,222,128,0.6)'
        ),
        borderColor: 'rgba(255,255,255,0.3)',
        borderWidth: 1,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y.toFixed(2)} punti CO2`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.1)' },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderList(leaderboard, myUsername) {
  const list = document.getElementById('rankingList');

  if (!leaderboard.length) {
    list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px 0; font-size:0.85rem;">Nessun utente in classifica ancora.</div>';
    return;
  }

  list.innerHTML = leaderboard.map(u => {
    const isMe = u.username === myUsername;
    const medal = MEDAL[u.rank] || '';
    const rankCls = RANK_CLASS[u.rank] || '';
    const avatar = u.profilePic
      ? `<img src="${u.profilePic}" alt="">`
      : `<span>🌿</span>`;

    return `<div class="rank-item ${isMe ? 'me' : ''}">
      <div class="rank-num ${rankCls}">${medal || '#' + u.rank}</div>
      <div class="rank-avatar">${avatar}</div>
      <div class="rank-info">
        <div class="rank-username">${u.username}${isMe ? ' 👈' : ''}</div>
        ${u.honorTitle ? `<div class="rank-title">${u.honorTitle}</div>` : ''}
      </div>
      <div class="rank-co2">${parseFloat(u.co2Points).toFixed(2)} <span style="font-size:0.68rem; opacity:0.7;">CO2 pts</span></div>
    </div>`;
  }).join('');
}

init();
