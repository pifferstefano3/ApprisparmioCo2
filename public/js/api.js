/* ─── Token Management ───────────────────────────────────────────────────────── */
const TOKEN_KEY = 'verdent_token';

function saveToken(token) { localStorage.setItem(TOKEN_KEY, token); }
function getToken()       { return localStorage.getItem(TOKEN_KEY); }
function removeToken()    { localStorage.removeItem(TOKEN_KEY); }
function isLoggedIn()     { return !!getToken(); }

/* ─── API Fetch Wrapper ──────────────────────────────────────────────────────── */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { ...options, headers };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(endpoint, config);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    removeToken();
    window.location.href = '/';
    return;
  }

  return { ok: res.ok, status: res.status, data };
}

/* ─── Toast Helper ───────────────────────────────────────────────────────────── */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { toast.classList.add('show'); });
  });
  setTimeout(() => toast.classList.remove('show'), duration);
}

/* ─── Typewriter Effect ──────────────────────────────────────────────────────── */
function typewriter(element, text, speed = 28) {
  element.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    if (i >= text.length) { clearInterval(interval); return; }
    element.textContent += text[i++];
  }, speed);
}

/* ─── Auth Guard ─────────────────────────────────────────────────────────────── */
function requireAuth() {
  if (!isLoggedIn()) window.location.href = '/';
}

/* ─── Format Helpers ─────────────────────────────────────────────────────────── */
function formatKm(km) {
  const n = parseFloat(km) || 0;
  return n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

function formatCO2(kg) {
  const n = parseFloat(kg) || 0;
  return n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TRANSPORT_INFO = {
  walk:    { label: 'A Piedi',   icon: '🚶' },
  bike:    { label: 'Bici',      icon: '🚴' },
  bus:     { label: 'Autobus',   icon: '🚌' },
  tram:    { label: 'Tram',      icon: '🚃' },
  carpool: { label: 'Carpool',   icon: '🚗' },
  car:     { label: 'Auto',      icon: '🚙' },
};
