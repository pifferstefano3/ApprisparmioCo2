/* ─── Token Management ───────────────────────────────────────────────────────── */
const TOKEN_KEY = 'verdent_token';

function saveToken(token) { localStorage.setItem(TOKEN_KEY, token); }
function getToken()       { return localStorage.getItem(TOKEN_KEY); }
function removeToken()    { localStorage.removeItem(TOKEN_KEY); }
function isLoggedIn()     { return !!getToken(); }

/* ─── API Fetch Wrapper with Error Handling ─────────────────────────────────── */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { ...options, headers };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const res = await fetch(endpoint, { ...config, signal: controller.signal });
    clearTimeout(timeoutId);
    
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      removeToken();
      window.location.href = '/';
      return { ok: false, status: 401, data: { error: 'Sessione scaduta' } };
    }

    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    console.error('API Fetch Error:', error);
    if (error.name === 'AbortError') {
      return { ok: false, status: 408, data: { error: 'Timeout - Riprova più tardi' } };
    }
    return { ok: false, status: 0, data: { error: 'Errore di connessione. Controlla la tua rete.' } };
  }
}

/* ─── Safe API Wrapper with Try/Catch ────────────────────────────────────────── */
async function safeApiCall(apiFunction, errorMessage = 'Errore durante l\'operazione') {
  try {
    const result = await apiFunction();
    return result;
  } catch (error) {
    console.error('API Error:', error);
    showToast(errorMessage, 'error');
    return null;
  }
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

/* ─── Lazy Loading for Images ───────────────────────────────────────────────── */
function initLazyLoading() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src || img.src;
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '50px' });

    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

/* ─── Skeleton Loader Helpers ───────────────────────────────────────────────── */
function showSkeleton(container, type = 'card') {
  if (!container) return;
  
  const skeletons = {
    card: '<div class="skeleton skeleton-card"></div>',
    text: '<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div>',
    avatar: '<div class="skeleton skeleton-avatar"></div>',
    list: '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>'
  };
  
  container.innerHTML = skeletons[type] || skeletons.card;
  container.dataset.loading = 'true';
}

function hideSkeleton(container) {
  if (!container) return;
  container.innerHTML = '';
  container.dataset.loading = 'false';
}

/* ─── Loading State Helpers ──────────────────────────────────────────────────── */
function setLoading(element, isLoading) {
  if (!element) return;
  
  if (isLoading) {
    element.dataset.originalText = element.textContent;
    element.disabled = true;
    element.innerHTML = '<span class="spinner" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Caricamento...';
  } else {
    element.disabled = false;
    element.textContent = element.dataset.originalText || element.textContent;
  }
}

/* ─── Error Display Helper ──────────────────────────────────────────────────── */
function showError(container, message, retryCallback = null) {
  if (!container) return;
  
  container.innerHTML = `
    <div class="error-state">
      <div class="icon">⚠️</div>
      <p>${message}</p>
      ${retryCallback ? `<button class="btn btn-secondary" onclick="${retryCallback}()">Riprova</button>` : ''}
    </div>
  `;
}
