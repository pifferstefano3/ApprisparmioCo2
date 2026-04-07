// Real-time Chat with Socket.io
let socket;
let currentRoom = 'global';
let messages = [];
let rooms = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
  initializeChat();
  setupEventListeners();
});

function initializeChat() {
  // Get current user info
  getCurrentUser().then(user => {
    currentUser = user;
    connectSocket();
    loadRooms();
  });
}

function connectSocket() {
  // Get JWT token from localStorage or cookies
  const token = localStorage.getItem('token') || getCookie('token');
  
  if (!token) {
    showToast('Autenticazione richiesta', 'error');
    return;
  }
  
  socket = io({
    auth: {
      token: token
    }
  });
  
  socket.on('connect', () => {
    console.log('Connected to chat server');
    updateOnlineStatus('Connesso');
    loadMessages();
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from chat server');
    updateOnlineStatus('Disconnesso');
  });
  
  socket.on('newMessage', (message) => {
    addMessage(message);
  });
  
  socket.on('messageEdited', (message) => {
    updateMessage(message);
  });
  
  socket.on('messageDeleted', (data) => {
    removeMessage(data.messageId);
  });
  
  socket.on('userTyping', (data) => {
    showTypingIndicator(data.userName);
  });
  
  socket.on('userStopTyping', (data) => {
    hideTypingIndicator(data.userId);
  });
  
  socket.on('onlineUsers', (users) => {
    updateOnlineUsers(users);
  });
  
  socket.on('roomInfo', (data) => {
    updateRoomInfo(data);
  });
  
  socket.on('error', (error) => {
    showToast(error.message || 'Errore di connessione', 'error');
  });
}

function setupEventListeners() {
  const messageInput = document.getElementById('messageInput');
  const fileInput = document.getElementById('fileInput');
  
  // Message input events
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  messageInput.addEventListener('input', () => {
    if (socket && currentRoom) {
      socket.emit('typing', { roomId: currentRoom });
    }
  });
  
  // File input events
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });
  
  // Auto-resize textarea
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });
}

async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    
    if (response.ok && data.user) {
      return data.user;
    } else {
      throw new Error('User not found');
    }
  } catch (error) {
    console.error('Error getting current user:', error);
    return { name: 'User', _id: 'anonymous' };
  }
}

async function loadRooms() {
  try {
    const response = await fetch('/api/messages/rooms');
    const data = await response.json();
    
    if (response.ok && data.rooms) {
      rooms = data.rooms;
      renderRooms();
    }
  } catch (error) {
    console.error('Error loading rooms:', error);
  }
}

function renderRooms() {
  const roomsList = document.getElementById('roomsList');
  
  if (rooms.length === 0) {
    roomsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem;">Nessuna room disponibile</div>';
    return;
  }
  
  roomsList.innerHTML = '';
  
  rooms.forEach(room => {
    const roomElement = document.createElement('div');
    roomElement.className = 'room-item';
    roomElement.style.cssText = `
      display:flex; align-items:center; gap:8px; padding:8px 12px;
      background:${room.id === currentRoom ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.05)'};
      border-radius:8px; cursor:pointer; transition:background 0.2s ease;
    `;
    
    roomElement.innerHTML = `
      <div style="font-size:1.2rem;">${getRoomIcon(room.type)}</div>
      <div style="flex:1;">
        <div style="color:white; font-size:0.9rem;">${room.name}</div>
        <div style="color:var(--text-muted); font-size:0.7rem;">${room.unreadCount > 0 ? `${room.unreadCount} non letti` : 'Nessun nuovo messaggio'}</div>
      </div>
      ${room.unreadCount > 0 ? `<div style="background:#ef4444; color:white; padding:2px 6px; border-radius:10px; font-size:0.6rem; font-weight:bold;">${room.unreadCount}</div>` : ''}
    `;
    
    roomElement.onclick = () => joinRoom(room.id);
    roomsList.appendChild(roomElement);
  });
}

function getRoomIcon(type) {
  const icons = {
    global: 'Team',
    team: 'Team',
    private: 'Team'
  };
  return icons[type] || 'Team';
}

function joinRoom(roomId) {
  if (!socket) return;
  
  // Leave current room
  if (currentRoom && currentRoom !== roomId) {
    socket.emit('leaveRoom', currentRoom);
  }
  
  // Join new room
  socket.emit('joinRoom', roomId);
  currentRoom = roomId;
  
  // Update UI
  updateChatTitle(roomId);
  loadMessages();
  hideRoomSelector();
  renderRooms(); // Update room selection
}

function updateChatTitle(roomId) {
  const room = rooms.find(r => r.id === roomId);
  const chatTitle = document.getElementById('chatTitle');
  
  if (room) {
    chatTitle.textContent = room.name;
  } else if (roomId === 'global') {
    chatTitle.textContent = 'Chat Globale';
  } else {
    chatTitle.textContent = 'Chat Team';
  }
}

async function loadMessages() {
  if (!currentRoom) return;
  
  try {
    const response = await fetch(`/api/messages/room/${currentRoom}`);
    const data = await response.json();
    
    if (response.ok && data.messages) {
      messages = data.messages;
      renderMessages();
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

function renderMessages() {
  const messagesList = document.getElementById('messagesList');
  
  if (messages.length === 0) {
    messagesList.innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--text-muted);">
        Nessun messaggio in questa room
      </div>
    `;
    return;
  }
  
  messagesList.innerHTML = '';
  
  messages.forEach(message => {
    const messageElement = createMessageElement(message);
    messagesList.appendChild(messageElement);
  });
  
  // Scroll to bottom
  messagesList.scrollTop = messagesList.scrollHeight;
}

function createMessageElement(message) {
  const div = document.createElement('div');
  const isOwn = message.sender._id === currentUser._id;
  
  div.className = `message ${isOwn ? 'own' : 'other'}`;
  div.style.cssText = `
    display:flex; flex-direction:${isOwn ? 'row-reverse' : 'row'};
    gap:8px; margin-bottom:12px; align-items:flex-start;
  `;
  
  const avatarHtml = `<div class="message-avatar">${message.sender.name.charAt(0).toUpperCase()}</div>`;
  
  const contentHtml = `
    <div class="message-content" style="${isOwn ? 'align-items:flex-end;' : ''}">
      <div class="message-header" style="${isOwn ? 'text-align:right;' : ''}">
        <span style="color:white; font-weight:600; font-size:0.8rem;">${escapeHtml(message.sender.name)}</span>
        <span style="color:var(--text-muted); font-size:0.7rem; margin-left:8px;">${formatTime(message.createdAt)}</span>
      </div>
      <div class="message-bubble" style="${isOwn ? 'background:linear-gradient(135deg, #2ecc71, #27ae60);' : 'background:rgba(255,255,255,0.1);'}">
        ${message.type === 'text' ? escapeHtml(message.content) : createFileContent(message)}
      </div>
      <div class="message-reactions" style="${isOwn ? 'justify-content:flex-end;' : ''}">
        ${renderReactions(message.reactions)}
      </div>
    </div>
  `;
  
  div.innerHTML = isOwn ? contentHtml + avatarHtml : avatarHtml + contentHtml;
  
  return div;
}

function createFileContent(message) {
  if (!message.file) return '';
  
  const file = message.file;
  
  if (file.mimetype.startsWith('image/')) {
    return `<img src="${file.url}" alt="${file.originalName}" style="max-width:200px; max-height:200px; border-radius:8px;">`;
  } else if (file.mimetype.startsWith('video/')) {
    return `<video src="${file.url}" controls style="max-width:200px; max-height:200px; border-radius:8px;"></video>`;
  } else {
    return `
      <div style="display:flex; align-items:center; gap:8px; padding:8px; background:rgba(255,255,255,0.1); border-radius:8px;">
        <span style="font-size:1.2rem;">Team</span>
        <div>
          <div style="color:white; font-size:0.8rem;">${escapeHtml(file.originalName)}</div>
          <div style="color:var(--text-muted); font-size:0.7rem;">${formatFileSize(file.size)}</div>
        </div>
      </div>
    `;
  }
}

function renderReactions(reactions) {
  if (!reactions || reactions.length === 0) return '';
  
  const groupedReactions = {};
  reactions.forEach(reaction => {
    if (!groupedReactions[reaction.emoji]) {
      groupedReactions[reaction.emoji] = 0;
    }
    groupedReactions[reaction.emoji]++;
  });
  
  return Object.entries(groupedReactions)
    .map(([emoji, count]) => `<span style="background:rgba(255,255,255,0.2); padding:2px 6px; border-radius:12px; font-size:0.7rem; margin:0 2px;">${emoji} ${count}</span>`)
    .join('');
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (!content || !socket || !currentRoom) return;
  
  const messageData = {
    content: content,
    type: 'text',
    room: currentRoom
  };
  
  // Send via API for database storage
  fetch('/api/messages/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      showToast(data.error, 'error');
    } else {
      input.value = '';
      input.style.height = 'auto';
      // Socket.io will emit the new message automatically
    }
  })
  .catch(error => {
    console.error('Send message error:', error);
    showToast('Errore nell\'invio del messaggio', 'error');
  });
}

function attachFile() {
  document.getElementById('fileInput').click();
}

async function handleFileUpload(file) {
  if (!socket || !currentRoom) return;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploadType', 'chat');
  formData.append('room', currentRoom);
  formData.append('type', file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file');
  
  try {
    const response = await fetch('/api/messages/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok && data.message) {
      // Socket.io will emit the new message automatically
    } else {
      showToast(data.error || 'Errore caricamento file', 'error');
    }
  } catch (error) {
    console.error('File upload error:', error);
    showToast('Errore nel caricamento del file', 'error');
  }
  
  // Reset file input
  document.getElementById('fileInput').value = '';
}

function toggleRoomSelector() {
  const selector = document.getElementById('roomSelector');
  selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
}

function hideRoomSelector() {
  document.getElementById('roomSelector').style.display = 'none';
}

function updateOnlineStatus(status) {
  const statusElement = document.getElementById('onlineStatus');
  statusElement.textContent = status;
}

function updateOnlineUsers(users) {
  const statusElement = document.getElementById('onlineStatus');
  statusElement.textContent = `${users.length} utenti online`;
}

function updateRoomInfo(data) {
  const statusElement = document.getElementById('onlineStatus');
  statusElement.textContent = `${data.userCount} utenti online`;
}

function showTypingIndicator(userName) {
  // Show typing indicator implementation
}

function hideTypingIndicator(userId) {
  // Hide typing indicator implementation
}

function addMessage(message) {
  messages.push(message);
  const messageElement = createMessageElement(message);
  document.getElementById('messagesList').appendChild(messageElement);
  
  // Scroll to bottom
  const messagesList = document.getElementById('messagesList');
  messagesList.scrollTop = messagesList.scrollHeight;
}

function updateMessage(message) {
  const index = messages.findIndex(m => m._id === message._id);
  if (index !== -1) {
    messages[index] = message;
    renderMessages();
  }
}

function removeMessage(messageId) {
  messages = messages.filter(m => m._id !== messageId);
  renderMessages();
}

// Helper functions
function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// CSS for messages
const style = document.createElement('style');
style.textContent = `
  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #2ecc71, #27ae60);
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    color: white;
    font-weight: bold;
    flex-shrink: 0;
  }
  
  .message-content {
    display: flex;
    flex-direction: column;
    max-width: 70%;
  }
  
  .message-header {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
  }
  
  .message-bubble {
    padding: 8px 12px;
    border-radius: 16px;
    word-wrap: break-word;
    color: white;
  }
  
  .message-bubble img,
  .message-bubble video {
    max-width: 100%;
    border-radius: 8px;
  }
  
  .message-reactions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  
  .room-item:hover {
    background: rgba(46,204,113,0.3) !important;
  }
`;
document.head.appendChild(style);
