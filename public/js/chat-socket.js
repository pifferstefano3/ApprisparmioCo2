// Socket.io Real-time Chat for VERDENT
requireAuth();

let socket = null;
let currentRoom = 'global';
let myUserId = null;
let isTyping = false;

// Initialize Socket.io connection
function initSocket() {
  const token = localStorage.getItem('verdent_token');
  
  socket = io({
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('[Chat Socket] Connected:', socket.id);
    joinRoom(currentRoom);
    loadUserInfo();
    loadHistory();
  });

  socket.on('disconnect', () => {
    console.log('[Chat Socket] Disconnected');
    showConnectionStatus('disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('[Chat Socket] Connection error:', err.message);
    showConnectionStatus('error');
  });

  socket.on('newMessage', (data) => {
    console.log('[Chat Socket] New message:', data);
    displayMessage(data);
    if (data.sender.id !== myUserId) {
      playMessageSound();
    }
  });

  socket.on('userJoined', (data) => {
    console.log('[Chat Socket] User joined:', data);
    showSystemMessage(`${data.userName} è entrato nella chat`);
  });

  socket.on('userLeft', (data) => {
    console.log('[Chat Socket] User left:', data);
    showSystemMessage(`${data.userName} ha lasciato la chat`);
  });

  socket.on('userTyping', (data) => {
    if (data.userId !== myUserId) {
      showTypingIndicator(data.userName, data.isTyping);
    }
  });

  socket.on('error', (data) => {
    console.error('[Chat Socket] Error:', data);
    showToast(data.message || 'Errore chat', 'error');
  });
}

async function loadUserInfo() {
  const res = await apiFetch('/api/auth/me');
  if (res?.ok && res.data) {
    myUserId = res.data._id || res.data.id;
    document.getElementById('chatStars').textContent = res.data.points || res.data.stars || 0;
  }
}

async function loadHistory() {
  try {
    const res = await apiFetch(`/api/chat/messages/${currentRoom}?limit=50`);
    if (res?.ok && res.data?.messages) {
      const messages = res.data.messages;
      messages.forEach(msg => displayMessage(msg));
    }
  } catch (error) {
    console.error('[Chat] Load history error:', error);
  }
}

function joinRoom(room) {
  if (socket) {
    socket.emit('joinRoom', room);
    currentRoom = room;
    document.getElementById('chatMessages').innerHTML = '';
    showSystemMessage(`Sei entrato in #${room}`);
  }
}

function leaveRoom() {
  if (socket && currentRoom) {
    socket.emit('leaveRoom', currentRoom);
  }
}

function sendSocketMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message || !socket) return;

  // Stop typing indicator
  if (isTyping) {
    socket.emit('typing', { room: currentRoom, isTyping: false });
    isTyping = false;
  }

  // Send via Socket.io for instant delivery
  socket.emit('sendMessage', {
    room: currentRoom,
    message: message,
    type: 'text'
  });

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Also save to server via REST as backup
  apiFetch('/api/chat/send', {
    method: 'POST',
    body: { room: currentRoom, message, type: 'text' }
  }).catch(err => console.error('[Chat] REST backup error:', err));
}

function displayMessage(data) {
  const msgs = document.getElementById('globalMessages');
  const isOwn = data.sender.id === myUserId;
  const isAI = data.sender.id === 'ai';
  
  const div = document.createElement('div');
  div.className = `chat-bubble ${isOwn ? 'user' : isAI ? 'ai' : 'other'} animate-fade-in`;
  
  const time = new Date(data.timestamp).toLocaleTimeString('it-IT', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const avatar = data.sender.avatar 
    ? `<img src="${data.sender.avatar}" class="avatar-img">` 
    : `<span class="avatar-emoji">🌿</span>`;
  
  div.innerHTML = `
    <div class="message-header">
      ${!isOwn ? avatar : ''}
      <span class="sender-name">${data.sender.name}</span>
      <span class="message-time">${time}</span>
    </div>
    <div class="bubble-content">${escapeHtml(data.message)}</div>
  `;
  
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showSystemMessage(text) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'system-message';
  div.innerHTML = `<span>${text}</span>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTypingIndicator(userName, isTyping) {
  const indicator = document.getElementById('typingIndicator');
  if (isTyping) {
    indicator.innerHTML = `<span>${userName} sta scrivendo...</span>`;
    indicator.style.display = 'block';
  } else {
    indicator.style.display = 'none';
  }
}

function showConnectionStatus(status) {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;
  
  const statusMap = {
    connected: { text: '🟢 Connesso', class: 'connected' },
    disconnected: { text: '🟡 Disconnesso', class: 'disconnected' },
    error: { text: '🔴 Errore connessione', class: 'error' }
  };
  
  const info = statusMap[status] || statusMap.disconnected;
  statusEl.textContent = info.text;
  statusEl.className = info.class;
}

function playMessageSound() {
  // Optional: Add sound notification
  // const audio = new Audio('/sounds/message.mp3');
  // audio.play().catch(() => {});
}

// Input handlers
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendSocketMessage();
  }
}

function handleInput(e) {
  const input = e.target;
  autoResize(input);
  
  // Typing indicator
  if (socket && !isTyping && input.value.trim()) {
    isTyping = true;
    socket.emit('typing', { room: currentRoom, isTyping: true });
    
    // Stop typing after 3 seconds of no input
    setTimeout(() => {
      if (!input.value.trim()) {
        isTyping = false;
        socket.emit('typing', { room: currentRoom, isTyping: false });
      }
    }, 3000);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  
  const input = document.getElementById('chatInput');
  if (input) {
    input.addEventListener('keypress', handleKey);
    input.addEventListener('input', handleInput);
  }
  
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendSocketMessage);
  }
  
  // Leave room on page unload
  window.addEventListener('beforeunload', leaveRoom);
});

// Expose functions globally
window.sendSocketMessage = sendSocketMessage;
window.joinRoom = joinRoom;
