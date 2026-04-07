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
  addAIMessage('Ciao! Sono l\'assistente AI di VERDENT 🌿 Chiedimi qualsiasi cosa su come ridurre la tua impronta di CO2, trasporti ecologici, stile di vita sostenibile e molto altro. Ogni domanda eco-friendly ti guadagna stelle bonus!');
  
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
  
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Add AI response
      addAIMessage(data.response);
      
      // Update stars if earned
      if (data.pointsEarned) {
        updateStars(data.pointsEarned, data.totalPoints);
        showToast(`+${data.pointsEarned} stelle guadagnate!`, 'success');
      }
    } else {
      addAIMessage('Spiacente, c\'è stato un errore. Riprova più tardi.');
      showToast(data.error || 'Errore nella risposta AI', 'error');
    }
  } catch (error) {
    console.error('AI Chat error:', error);
    addAIMessage('Errore di connessione. Controlla la tua connessione e riprova.');
    showToast('Errore di connessione', 'error');
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
    <div class="bubble-time">Tu · ${formatTime(new Date())}</div>
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
    <div class="bubble-time">AI · ${formatTime(new Date())}</div>
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
