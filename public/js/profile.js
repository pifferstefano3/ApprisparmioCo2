requireAuth();

const FRAME_STYLES = {
  frame_leaf:   { border: '3px solid #4ade80', boxShadow: '0 0 16px rgba(74,222,128,0.6)', emoji: '🍃' },
  frame_fire:   { border: '3px solid #f97316', boxShadow: '0 0 16px rgba(249,115,22,0.7)', emoji: '🔥' },
  frame_gold:   { border: '3px solid #fbbf24', boxShadow: '0 0 20px rgba(251,191,36,0.7)', emoji: '👑' },
  frame_planet: { border: '3px solid #60a5fa', boxShadow: '0 0 16px rgba(96,165,250,0.6)', emoji: '🌍' },
};

const TRANSPORT_INFO = {
  walk:'{label:"A Piedi",icon:"🚶"}', bike:'{label:"Bici",icon:"🚴"}',
  bus:'{label:"Bus",icon:"🚌"}', tram:'{label:"Tram",icon:"🚃"}',
  carpool:'{label:"Carpool",icon:"🚗"}', carpool_ai:'{label:"Carpool AI",icon:"🤖🚗"}',
  car:'{label:"Auto",icon:"🚙"}', airplane:'{label:"Aereo",icon:"✈️"}',
};

const T_INFO = {
  walk:{label:'A Piedi',icon:'🚶'},bike:{label:'Bici',icon:'🚴'},
  bus:{label:'Bus',icon:'🚌'},tram:{label:'Tram',icon:'🚃'},
  carpool:{label:'Carpool',icon:'🚗'},carpool_ai:{label:'Carpool AI',icon:'🤖'},
  car:{label:'Auto',icon:'🚙'},airplane:{label:'Aereo',icon:'✈️'},
};

let currentUser = null;

async function init() {
  const [profileRes, shopRes] = await Promise.all([
    apiFetch('/api/profile'),
    apiFetch('/api/shop/items'),
  ]);

  if (!profileRes?.ok) { showToast('Errore caricamento profilo', 'error'); return; }

  currentUser = profileRes.data.user;
  renderProfile(currentUser);
  renderActivities(profileRes.data.recentActivities);
  document.getElementById('pPosts').textContent = profileRes.data.postCount || 0;

  if (shopRes?.ok) renderTitlePicker(shopRes.data.items, currentUser);
}

function renderProfile(user) {
  document.getElementById('profileUsername').textContent = user.username;
  document.getElementById('hPoints').textContent = user.stars ?? user.points ?? 0;
  document.getElementById('pStars').textContent  = user.stars ?? user.points ?? 0;
  document.getElementById('pCO2').textContent    = parseFloat(user.co2Saved || 0).toFixed(2);
  document.getElementById('bioInput').value      = user.bio || '';
  document.getElementById('profileBio').textContent = user.bio || '';

  if (user.honorTitle) {
    document.getElementById('profileHonorTitle').textContent = user.honorTitle;
  }

  // Email verify badge
  if (!user.emailVerified) {
    document.getElementById('emailVerifyBadge').style.display = 'block';
  }

  // Foto profilo
  if (user.profilePic) {
    const img = document.getElementById('profileImg');
    const emoji = document.getElementById('profileEmoji');
    img.src = user.profilePic;
    img.style.display = 'block';
    emoji.style.display = 'none';
  }

  // Cornice attiva
  const frame = user.honorFrame;
  if (frame && FRAME_STYLES[frame]) {
    const s = FRAME_STYLES[frame];
    const wrapper = document.getElementById('profilePicWrapper');
    wrapper.style.border = s.border;
    wrapper.style.boxShadow = s.boxShadow;
    document.getElementById('activeFrameEmoji').textContent = s.emoji;
    document.getElementById('activeFrameName').textContent = `Cornice attiva: ${frame.replace('frame_','').toUpperCase()}`;
  }
}

function renderActivities(activities) {
  const el = document.getElementById('profileActivities');
  if (!activities?.length) {
    el.innerHTML = '<div style="color:var(--text-muted); font-size:0.82rem; padding:8px 0;">Nessuna attività ancora.</div>';
    return;
  }
  el.innerHTML = activities.map(a => {
    const info = T_INFO[a.transport] || { icon:'🚌', label:a.transport };
    return `<div class="activity-item">
      <div class="activity-icon">${info.icon}</div>
      <div class="activity-info">
        <div class="activity-name">${info.label}</div>
        <div class="activity-meta">${parseFloat(a.distanceKm).toFixed(2)} km · ${formatDate(a.createdAt)}</div>
      </div>
      <div class="activity-points">+${a.pointsEarned} ⭐</div>
    </div>`;
  }).join('');
}

function renderTitlePicker(items, user) {
  const ownedTitles = items.filter(i => i.type === 'title' && i.owned);
  const picker = document.getElementById('titlePicker');
  if (!ownedTitles.length) {
    picker.innerHTML = '<span style="color:var(--text-muted); font-size:0.82rem;">Sblocca titoli nell\'EcoShop!</span>';
    return;
  }
  picker.innerHTML = ['', ...ownedTitles].map(t => {
    if (!t) return `<button class="transport-btn ${!user.honorTitle ? 'selected' : ''}" onclick="equipTitle('')" style="font-size:0.78rem; padding:8px 14px;">Nessuno</button>`;
    const active = user.honorTitle === t.name;
    return `<button class="transport-btn ${active ? 'selected' : ''}" onclick="equipTitle('${t.id}','${t.name}')" style="font-size:0.78rem; padding:8px 14px;">
      ${t.emoji} ${t.name}
    </button>`;
  }).join('');
}

async function equipTitle(itemId, titleName = '') {
  const res = await apiFetch('/api/profile', {
    method: 'PUT',
    body: { honorTitle: itemId },
  });
  if (res?.ok) {
    showToast(titleName ? `Titolo "${titleName}" equipaggiato!` : 'Titolo rimosso', 'success');
    document.getElementById('profileHonorTitle').textContent = titleName || '';
  }
}

async function saveBio() {
  const bio = document.getElementById('bioInput').value.trim();
  const res = await apiFetch('/api/profile', { method: 'PUT', body: { bio } });
  if (res?.ok) {
    showToast('Bio aggiornata!', 'success');
    document.getElementById('profileBio').textContent = bio;
  } else {
    showToast('Errore salvataggio bio', 'error');
  }
}

async function resendVerification() {
  const res = await apiFetch('/api/auth/resend-verification', { method: 'POST' });
  showToast(res?.data?.message || 'Email inviata!', 'success');
}

// Upload avatar
document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  showToast('Caricamento foto...', 'info');

  const token = getToken();
  const res = await fetch('/api/profile/avatar', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();

  if (res.ok) {
    const img = document.getElementById('profileImg');
    const emoji = document.getElementById('profileEmoji');
    img.src = data.profilePic + '?t=' + Date.now();
    img.style.display = 'block';
    emoji.style.display = 'none';
    showToast('Foto profilo aggiornata! 📸', 'success');
  } else {
    showToast(data.error || 'Errore upload', 'error');
  }
});

init();
