// Teams Management JavaScript
let teams = [];
let currentTeam = null;

document.addEventListener('DOMContentLoaded', function() {
  loadUserTeams();
  setupEventListeners();
});

function setupEventListeners() {
  // Team creation button
  const createTeamBtn = document.getElementById('createTeamBtn');
  if (createTeamBtn) {
    createTeamBtn.addEventListener('click', openCreateTeamModal);
  }
  
  // Modal close button
  const closeModalBtn = document.getElementById('closeModalBtn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeCreateTeamModal);
  }
  
  // Join team button
  const joinTeamBtn = document.getElementById('joinTeamBtn');
  if (joinTeamBtn) {
    joinTeamBtn.addEventListener('click', joinTeam);
  }
  
  // Form submission
  const createTeamForm = document.getElementById('createTeamForm');
  if (createTeamForm) {
    createTeamForm.addEventListener('submit', function(e) {
      e.preventDefault();
      createTeam();
    });
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('createTeamModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeCreateTeamModal();
      }
    });
  }
}

async function loadUserTeams() {
  try {
    const response = await fetch('/api/teams/my-teams');
    const data = await response.json();
    
    if (response.ok) {
      teams = data.teams || [];
      renderUserTeams();
    } else {
      console.error('Error loading teams:', data.error);
      renderEmptyTeams();
    }
  } catch (error) {
    console.error('Load teams error:', error);
    renderEmptyTeams();
  }
}

function renderUserTeams() {
  const container = document.getElementById('myTeamsContainer');
  
  if (!teams || teams.length === 0) {
    renderEmptyTeams();
    return;
  }
  
  container.innerHTML = teams.map(team => `
    <div class="team-card glass-card" style="padding:16px; cursor:pointer;" onclick="viewTeamDetails('${team._id}')">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4 style="color:white; margin:0;">${escapeHtml(team.name)}</h4>
        <span style="background:#4ade80; color:white; padding:4px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold;">${team.code}</span>
      </div>
      <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:8px;">
        ${team.description ? escapeHtml(team.description) : 'Nessuna descrizione'}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#4ade80; font-size:0.8rem;">${team.members ? team.members.length : 0} membri</span>
        <span style="color:var(--text-muted); font-size:0.7rem;">Creato: ${formatDate(team.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

function renderEmptyTeams() {
  const container = document.getElementById('myTeamsContainer');
  container.innerHTML = `
    <div style="text-align:center; padding:40px 0; color:var(--text-muted);">
      <div style="font-size:2rem; margin-bottom:12px;">?</div>
      <div style="font-weight:600; margin-bottom:8px;">Nessun team</div>
      <div style="font-size:0.85rem; margin-bottom:16px;">Crea il tuo primo team o unisciti a uno esistente!</div>
      <button class="btn btn-primary btn-sm" style="width:auto;" onclick="openCreateTeamModal()">+ Crea Team</button>
    </div>
  `;
}

function openCreateTeamModal() {
  const modal = document.getElementById('createTeamModal');
  if (modal) {
    modal.style.display = 'flex';
    // Focus on name input
    setTimeout(() => {
      document.getElementById('teamName')?.focus();
    }, 100);
  }
}

function closeCreateTeamModal() {
  const modal = document.getElementById('createTeamModal');
  if (modal) {
    modal.style.display = 'none';
    // Reset form
    const form = document.getElementById('createTeamForm');
    if (form) {
      form.reset();
    }
  }
}

async function createTeam() {
  const nameInput = document.getElementById('teamName');
  const descriptionInput = document.getElementById('teamDescription');
  
  const name = nameInput?.value?.trim();
  const description = descriptionInput?.value?.trim();
  
  if (!name) {
    showToast('Il nome del team è obbligatorio', 'error');
    return;
  }
  
  if (name.length < 3) {
    showToast('Il nome deve essere almeno 3 caratteri', 'error');
    return;
  }
  
  const submitBtn = document.querySelector('#createTeamForm button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  try {
    // Show loading state
    submitBtn.textContent = 'Creazione...';
    submitBtn.disabled = true;
    
    const response = await fetch('/api/teams/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast(`Team "${name}" creato con successo! Codice: ${data.team.code}`, 'success');
      closeCreateTeamModal();
      
      // Reload teams list
      await loadUserTeams();
      
      // Show team details
      viewTeamDetails(data.team._id);
    } else {
      showToast(data.error || 'Errore nella creazione del team', 'error');
    }
  } catch (error) {
    console.error('Create team error:', error);
    showToast('Errore di connessione', 'error');
  } finally {
    // Reset button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

async function joinTeam() {
  const codeInput = document.getElementById('joinCode');
  const code = codeInput?.value?.trim().toUpperCase();
  
  if (!code) {
    showToast('Il codice team è obbligatorio', 'error');
    return;
  }
  
  if (code.length !== 8) {
    showToast('Il codice team deve essere di 8 caratteri', 'error');
    return;
  }
  
  const joinBtn = document.getElementById('joinTeamBtn');
  const originalText = joinBtn.textContent;
  
  try {
    // Show loading state
    joinBtn.textContent = 'Unione...';
    joinBtn.disabled = true;
    
    const response = await fetch('/api/teams/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast(`Ti sei unito al team "${data.team.name}"!`, 'success');
      codeInput.value = '';
      
      // Reload teams list
      await loadUserTeams();
      
      // Show team details
      viewTeamDetails(data.team._id);
    } else {
      showToast(data.error || 'Errore nell\'unione al team', 'error');
    }
  } catch (error) {
    console.error('Join team error:', error);
    showToast('Errore di connessione', 'error');
  } finally {
    // Reset button state
    joinBtn.textContent = originalText;
    joinBtn.disabled = false;
  }
}

async function viewTeamDetails(teamId) {
  try {
    const response = await fetch(`/api/teams/${teamId}`);
    const data = await response.json();
    
    if (response.ok) {
      currentTeam = data.team;
      renderTeamDetails();
    } else {
      showToast(data.error || 'Errore nel caricamento dei dettagli', 'error');
    }
  } catch (error) {
    console.error('Load team details error:', error);
    showToast('Errore di connessione', 'error');
  }
}

function renderTeamDetails() {
  if (!currentTeam) return;
  
  const container = document.getElementById('teamDetailsContainer');
  container.style.display = 'block';
  
  container.innerHTML = `
    <div class="glass-card" style="padding:20px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="color:white; margin:0;">${escapeHtml(currentTeam.name)}</h3>
        <button onclick="closeTeamDetails()" class="btn btn-ghost btn-sm" style="width:auto; padding:4px 8px;">×</button>
      </div>
      
      <div style="background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.3); border-radius:8px; padding:12px; margin-bottom:16px; text-align:center;">
        <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:4px;">Codice Team</div>
        <div style="color:#4ade80; font-size:1.2rem; font-weight:bold; letter-spacing:2px;">${currentTeam.code}</div>
      </div>
      
      ${currentTeam.description ? `
        <div style="margin-bottom:16px;">
          <h4 style="color:white; font-size:0.9rem; margin-bottom:8px;">Descrizione</h4>
          <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">${escapeHtml(currentTeam.description)}</p>
        </div>
      ` : ''}
      
      <div style="margin-bottom:16px;">
        <h4 style="color:white; font-size:0.9rem; margin-bottom:12px;">Membri (${currentTeam.members ? currentTeam.members.length : 0})</h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${renderTeamMembers()}
        </div>
      </div>
      
      <div style="display:flex; gap:8px;">
        <button onclick="openTeamChat()" class="btn btn-primary" style="flex:1;">Chat Team</button>
        <button onclick="leaveTeam()" class="btn btn-secondary" style="width:auto;">Lascia Team</button>
      </div>
    </div>
  `;
}

function renderTeamMembers() {
  if (!currentTeam.members || currentTeam.members.length === 0) {
    return '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:20px;">Nessun membro</div>';
  }
  
  return currentTeam.members.map(member => `
    <div style="display:flex; align-items:center; gap:12px; padding:8px; background:rgba(255,255,255,0.05); border-radius:8px;">
      <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#2e8b57,#4ade80); display:flex; align-items:center; justify-content:center; font-size:0.9rem;">
        ${member.user?.name ? member.user.name.charAt(0).toUpperCase() : '?'}
      </div>
      <div style="flex:1;">
        <div style="color:white; font-weight:600;">${escapeHtml(member.user?.name || 'Utente')}</div>
        <div style="color:var(--text-muted); font-size:0.7rem;">Unito: ${formatDate(member.joinedAt)}</div>
      </div>
      ${member.user?._id === currentTeam.creator?._id ? '<span style="background:#fbbf24; color:white; padding:2px 6px; border-radius:4px; font-size:0.6rem;">CREATOR</span>' : ''}
    </div>
  `).join('');
}

function closeTeamDetails() {
  const container = document.getElementById('teamDetailsContainer');
  container.style.display = 'none';
  currentTeam = null;
}

async function leaveTeam() {
  if (!currentTeam) return;
  
  if (!confirm(`Sei sicuro di voler lasciare il team "${currentTeam.name}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/teams/${currentTeam._id}/leave`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast(`Hai lasciato il team "${currentTeam.name}"`, 'success');
      closeTeamDetails();
      await loadUserTeams();
    } else {
      showToast(data.error || 'Errore nel lasciare il team', 'error');
    }
  } catch (error) {
    console.error('Leave team error:', error);
    showToast('Errore di connessione', 'error');
  }
}

function openTeamChat() {
  if (!currentTeam) return;
  
  // Open team chat in a modal or navigate to chat page
  showToast(`Chat team "${currentTeam.name}" coming soon!`, 'info');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return 'Oggi';
  } else if (days === 1) {
    return 'Ieri';
  } else if (days < 7) {
    return `${days} giorni fa`;
  } else {
    return date.toLocaleDateString('it-IT');
  }
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
