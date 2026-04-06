requireAuth();

let totalStars = 0;

async function loadStars() {
  const res = await apiFetch('/api/auth/me');
  if (res?.ok) {
    totalStars = res.data.stars ?? res.data.points ?? 0;
    document.getElementById('chatStars').textContent = totalStars;
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function fillInput(text) {
  const input = document.getElementById('chatInput');
  input.value = text;
  input.focus();
  autoResize(input);
}

function scrollToBottom() {
  const msgs = document.getElementById('chatMessages');
  msgs.scrollTop = msgs.scrollHeight;
}

function appendMessage(role, content, { bonus = '', moderated = false, time = 'ora' } = {}) {
  const msgs = document.getElementById('chatMessages');
  const div  = document.createElement('div');
  div.className = `chat-bubble ${role}${moderated ? ' moderated' : ''} animate-fade-in`;
  div.innerHTML = `
    <div class="bubble-content">${content}</div>
    ${bonus ? `<div class="bubble-bonus">${bonus}</div>` : ''}
    <div class="bubble-time">${role === 'ai' ? 'AI' : 'Tu'} · ${time}</div>`;
  msgs.appendChild(div);
  scrollToBottom();
}

function showTyping() {
  const msgs = document.getElementById('chatMessages');
  const typing = document.createElement('div');
  typing.id = 'typingIndicator';
  typing.className = 'chat-bubble ai';
  typing.innerHTML = `<div class="typing-indicator">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`;
  msgs.appendChild(typing);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  input.style.height = 'auto';

  const now = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  appendMessage('user', escapeHtml(message), { time: now });

  document.getElementById('sendBtn').disabled = true;
  showTyping();

  // Simula latenza AI
  await new Promise(r => setTimeout(r, 700 + Math.random() * 800));

  const res = await apiFetch('/api/chat', { method: 'POST', body: { message } });
  hideTyping();
  document.getElementById('sendBtn').disabled = false;

  if (!res) { appendMessage('ai', '⚠️ Errore di connessione. Riprova.', { time: now }); return; }

  if (res.data.moderated) {
    appendMessage('ai', res.data.message, { moderated: true, time: now });
    totalStars = res.data.remainingStars;
    document.getElementById('chatStars').textContent = totalStars;
    showToast(`-50 stelle per linguaggio non consentito`, 'error');
  } else {
    const bonus = res.data.starsEarned > 0 ? `+${res.data.starsEarned} stelle guadagnate! 🌿` : '';
    appendMessage('ai', escapeHtml(res.data.reply), { bonus, time: now });
    if (res.data.starsEarned > 0) {
      totalStars = res.data.totalStars;
      document.getElementById('chatStars').textContent = totalStars;
      showToast(`+${res.data.starsEarned} stelle guadagnate!`, 'success');
    }
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadStars();
