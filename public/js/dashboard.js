requireAuth();

const TROPHY_LABELS = {
  streak_7:  { label: '7 giorni streak', emoji: '🔥' },
  km_100:    { label: '100 km sostenibili', emoji: '🚴' },
  co2_10kg:  { label: '10kg CO2 risparmiati', emoji: '🌍' },
};

/* ─── Init ───────────────────────────────────────────────────────────────────── */
async function init() {
  const [userRes, aiRes, activitiesRes] = await Promise.all([
    apiFetch('/api/auth/me'),
    apiFetch('/api/ai/analyze'),
    apiFetch('/api/activities?limit=5'),
  ]);

  if (userRes?.ok) renderUser(userRes.data);
  if (aiRes?.ok)   renderAiTip(aiRes.data);
  if (activitiesRes?.ok) renderActivities(activitiesRes.data.activities);
}

/* ─── Render User ────────────────────────────────────────────────────────────── */
function renderUser(user) {
  document.getElementById('headerUsername').textContent = user.username;
  document.getElementById('headerPoints').textContent   = user.points;
  document.getElementById('statCO2').textContent        = formatCO2(user.co2Saved);
  document.getElementById('statKm').textContent         = formatKm(user.kmSustainable);
  document.getElementById('statPoints').textContent     = user.points;

  const streak = user.streak?.current || 0;
  const streakMax = user.streak?.max || 0;
  document.getElementById('streakDays').textContent = `${streak} ${streak === 1 ? 'giorno' : 'giorni'}`;
  document.getElementById('streakMax').textContent  = streakMax;
  document.getElementById('streakValue').textContent = streak;

  // Avatar emoji in base alla skin
  const skinEmoji = { default:'🌿', skin_forest:'🌲', skin_ocean:'🌊', skin_mountain:'🏔️', skin_galaxy:'🌌', skin_aurora:'🌠' };
  document.getElementById('headerAvatar').textContent = skinEmoji[user.avatarSkin] || '🌿';

  // Trofei
  const trophyGrid = document.getElementById('trophyGrid');
  if (user.trophies?.length) {
    trophyGrid.innerHTML = user.trophies.map(t => {
      const info = TROPHY_LABELS[t] || { label: t, emoji: '🏆' };
      return `<div class="trophy-item">${info.emoji} ${info.label}</div>`;
    }).join('');
  }
}

/* ─── Render AI Tip ──────────────────────────────────────────────────────────── */
function renderAiTip(data) {
  const el = document.getElementById('aiTipText');
  if (data?.tip) {
    typewriter(el, data.tip, 25);
  } else {
    el.textContent = 'Effettua la tua prima attività per ricevere suggerimenti personalizzati!';
  }
}

/* ─── Render Activities ──────────────────────────────────────────────────────── */
function renderActivities(activities) {
  const list = document.getElementById('activityList');

  if (!activities?.length) {
    list.innerHTML = `
      <div style="text-align:center; padding:24px 0; color:var(--text-muted);">
        <div style="font-size:2rem; margin-bottom:8px;">🚶</div>
        <div style="font-size:0.85rem;">Nessuna attività ancora.</div>
        <a href="/map.html" style="color:#4ade80; font-weight:600; font-size:0.85rem; margin-top:8px; display:inline-block;">
          Registra il primo percorso →
        </a>
      </div>`;
    return;
  }

  list.innerHTML = activities.map(a => {
    const info = TRANSPORT_INFO[a.transport] || { label: a.transport, icon: '🚌' };
    const co2  = parseFloat(a.co2Saved || 0).toFixed(3);
    const dist = parseFloat(a.distanceKm || 0).toFixed(2);
    return `
      <div class="activity-item">
        <div class="activity-icon">${info.icon}</div>
        <div class="activity-info">
          <div class="activity-name">${info.label}</div>
          <div class="activity-meta">${dist} km · ${co2} kg CO₂ · ${formatDate(a.createdAt)}</div>
        </div>
        <div class="activity-points">+${a.pointsEarned} pt</div>
      </div>`;
  }).join('');
}

/* ─── Logout ─────────────────────────────────────────────────────────────────── */
document.getElementById('logoutBtn').addEventListener('click', () => {
  removeToken();
  window.location.href = '/';
});

init();
