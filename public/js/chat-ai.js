// EcoChat AI Handler
document.addEventListener('DOMContentLoaded', function() {
  const aiInput = document.getElementById('aiInput');
  const sendBtn = document.getElementById('sendAiBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatStars = document.getElementById('chatStars');
  
  if (!aiInput || !sendBtn || !chatMessages) {
    console.error('Chat elements not found');
    return;
  }
  
  // Load initial AI message
  addAIMessage('Ciao! Sono l\'assistente AI di VERDENT ? Chiedimi qualsiasi cosa su come ridurre la tua impronta di CO2, trasporti ecologici, stile di vita sostenibile e molto altro. Ogni domanda eco-friendly ti guadagna stelle bonus!');
  
  // Setup event listeners
  sendBtn.addEventListener('click', sendAIMessage);
  aiInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAIMessage();
    }
  });
  
  // Load user stars
  loadUserStars();
});

async function sendAIMessage() {
  const aiInput = document.getElementById('aiInput');
  const message = aiInput.value.trim();
  
  if (!message) return;
  
  const sendBtn = document.getElementById('sendAiBtn');
  const originalText = sendBtn.textContent;
  
  // Add user message
  addUserMessage(message);
  
  // Show loading state
  sendBtn.textContent = 'Invio...';
  sendBtn.disabled = true;
  aiInput.value = '';
  
  // Create abort controller for 5s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.error('[AI CHAT] Timeout: Richiesta AI scaduta dopo 5s');
  }, 5000);
  
  try {
    console.log('[AI CHAT] Invio messaggio:', message);
    
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('verdent_token') || ''}`
      },
      body: JSON.stringify({ message }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('[AI CHAT] Risposta ricevuta, status:', response.status);
    
    const data = await response.json();
    console.log('[AI CHAT] Dati ricevuti:', data);
    
    if (response.ok && data.response) {
      // Add AI response
      addAIMessage(data.response);
      
      // Update stars if earned
      if (data.bonusPointsAwarded && data.bonusPointsAwarded > 0) {
        updateStars(data.bonusPointsAwarded);
        showToast(`+${data.bonusPointsAwarded} stelle eco! 🌟`, 'success');
      }
    } else {
      console.error('[AI CHAT] Errore risposta:', data.error || 'Nessuna risposta');
      addAIMessage('⚠️ ' + (data.error || 'Errore nel servizio AI. Riprova tra qualche istante.'));
      showToast(data.error || 'Errore nella risposta AI', 'error');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('[AI CHAT] Timeout errore: La richiesta ha impiegato più di 5 secondi');
      addAIMessage('⏱️ Il server sta impiegando troppo tempo. Riprova più tardi.');
      showToast('Timeout - Il server non risponde', 'error');
    } else {
      console.error('[AI CHAT] Errore di connessione:', error);
      addAIMessage('❌ Errore di connessione. Verifica la tua rete e riprova.');
      showToast('Errore di connessione', 'error');
    }
  } finally {
    // Reset button state
    sendBtn.textContent = originalText;
    sendBtn.disabled = false;
  }
}

function addUserMessage(message) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-bubble user animate-fade-in-up';
  messageDiv.innerHTML = `
    <div class="bubble-content">${escapeHtml(message)}</div>
    <div class="bubble-time">Tu ? ${formatTime(new Date())}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addAIMessage(message) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-bubble ai animate-fade-in-up';
  messageDiv.innerHTML = `
    <div class="bubble-content">${escapeHtml(message)}</div>
    <div class="bubble-time">AI ? ${formatTime(new Date())}</div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadUserStars() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    
    if (response.ok && data.user) {
      const chatStars = document.getElementById('chatStars');
      if (chatStars) {
        chatStars.textContent = data.user.points || 0;
      }
    }
  } catch (error) {
    console.error('Load user stars error:', error);
  }
}

function updateStars(pointsEarned, totalPoints) {
  const chatStars = document.getElementById('chatStars');
  if (chatStars) {
    chatStars.textContent = totalPoints;
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }
}
