requireAuth();

async function init() {
  const [meRes, challengeRes] = await Promise.all([
    apiFetch('/api/auth/me'),
    apiFetch('/api/challenges'),
  ]);

  if (meRes?.ok) {
    document.getElementById('sfideStars').textContent = meRes.data.stars ?? meRes.data.points ?? 0;
  }

  if (!challengeRes?.ok) {
    showToast('Errore caricamento sfide', 'error');
    document.getElementById('challengeCard').innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">Errore caricamento sfida.</div>';
    return;
  }

  const { challenge, progress, progressPct, completed } = challengeRes.data;

  // Countdown
  document.getElementById('daysLeft').textContent = `${challenge.daysLeft} giorni rimasti`;
  document.getElementById('deadline').textContent = `Scade: ${new Date(challenge.deadline).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  // Sfida card
  document.getElementById('challengeCard').innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
      <div style="font-size:2.5rem;">${challenge.icon}</div>
      <div>
        <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.1em; color:#4ade80; font-weight:700; margin-bottom:3px;">SFIDA DEL MESE — AI GENERATA</div>
        <h2 style="color:white; font-size:1.1rem; margin:0;">${challenge.title}</h2>
      </div>
    </div>
    <p style="color:rgba(255,255,255,0.85); font-size:0.9rem; line-height:1.6; margin-bottom:16px;">${challenge.description}</p>
    <div style="background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.3); border-radius:12px; padding:12px 16px;">
      <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; color:#fbbf24; font-weight:700; margin-bottom:4px;">🎁 PREMIO</div>
      <div style="color:white; font-weight:600; font-size:0.9rem;">${challenge.reward}</div>
    </div>
    <div style="margin-top:12px; font-size:0.75rem; color:var(--text-muted);">
      Obiettivo: <strong style="color:white;">${challenge.target} ${challenge.unit}</strong>
    </div>`;

  // Progresso
  const progressCard = document.getElementById('progressCard');
  progressCard.style.display = 'block';
  document.getElementById('progressLabel').textContent = `${parseFloat(progress).toFixed(2)} / ${challenge.target} ${challenge.unit}`;
  document.getElementById('progressPct').textContent = `${progressPct}%`;

  // Anima barra
  setTimeout(() => {
    document.getElementById('progressBar').style.width = `${progressPct}%`;
  }, 100);

  if (completed) {
    document.getElementById('completedBanner').style.display = 'block';
    document.getElementById('progressBar').style.background = 'linear-gradient(90deg,#fbbf24,#f59e0b)';
  }
}

init();
