// Redirect se già loggato
if (isLoggedIn()) window.location.href = '/dashboard.html';

/* ─── Tab Switching ──────────────────────────────────────────────────────────── */
const tabBtns   = document.querySelectorAll('.tab-btn');
const loginForm = document.getElementById('loginForm');
const regForm   = document.getElementById('registerForm');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const panel = btn.dataset.tab;
    loginForm.style.display = panel === 'login'    ? 'block' : 'none';
    regForm.style.display   = panel === 'register' ? 'block' : 'none';
    clearErrors();
  });
});

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.style.display = 'none';
    el.textContent = '';
  });
  document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function setLoading(btnId, textId, loading, defaultText) {
  const btn  = document.getElementById(btnId);
  const text = document.getElementById(textId);
  btn.disabled = loading;
  text.innerHTML = loading ? '<span style="opacity:0.7">Attendere...</span>' : defaultText;
}

/* ─── Login ──────────────────────────────────────────────────────────────────── */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email)    { showError('loginEmailErr', 'Inserisci la tua email'); return; }
  if (!password) { showError('loginPasswordErr', 'Inserisci la password'); return; }

  setLoading('loginBtn', 'loginBtnText', true);

  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  setLoading('loginBtn', 'loginBtnText', false, 'Accedi a VERDENT 🌿');

  if (!result) return;

  if (result.ok) {
    saveToken(result.data.token);
    window.location.href = '/dashboard.html';
  } else {
    showError('loginError', result.data.error || 'Errore di accesso');
    document.getElementById('loginError').style.display = 'block';
  }
});

/* ─── Register ───────────────────────────────────────────────────────────────── */
regForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  let valid = true;
  if (!username || username.length < 3) { showError('regUsernameErr', 'Username minimo 3 caratteri'); valid = false; }
  if (!email) { showError('regEmailErr', 'Inserisci un\'email valida'); valid = false; }
  if (!password || password.length < 6) { showError('regPasswordErr', 'Password minimo 6 caratteri'); valid = false; }
  if (!valid) return;

  setLoading('registerBtn', 'registerBtnText', true);

  const result = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: { username, email, password },
  });

  setLoading('registerBtn', 'registerBtnText', false, 'Crea il tuo account 🌱');

  if (!result) return;

  if (result.ok) {
    saveToken(result.data.token);
    window.location.href = '/dashboard.html';
  } else {
    showError('registerError', result.data.error || 'Errore nella registrazione');
    document.getElementById('registerError').style.display = 'block';
  }
});
