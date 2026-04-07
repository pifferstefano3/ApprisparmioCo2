// Teams Management JavaScript
let teams = [];
let currentTeam = null;

document.addEventListener('DOMContentLoaded', function() {
  loadUserTeams();
});

async function loadUserTeams() {
  try {
    const response = await fetch('/api/teams/my');
    const data = await response.json();
    
    if (response.ok && data.teams) {
      teams = data.teams;
      renderTeams();
    } else {
      throw new Error(data.error || 'Errore caricamento team');
    }
  } catch (error) {
    console.error('Error loading teams:', error);
    document.getElementById('myTeamsContainer').innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--text-muted);">
        Errore nel caricamento dei team
      </div>
    `;
  }
}

function renderTeams() {
  const container = document.getElementById('myTeamsContainer');
  
  if (teams.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--text-muted);">
        Non hai ancora team. Crea il tuo primo team!
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  teams.forEach(team => {
    const teamElement = createTeamElement(team);
    container.appendChild(teamElement);
  });
}

function createTeamElement(team) {
  const div = document.createElement('div');
  div.className = 'glass-card';
  div.style.cssText = 'padding:16px; cursor:pointer; transition:transform 0.2s ease;';
  
  const membersHtml = team.members.slice(0, 3).map(member => 
    `<div class="member-avatar">${member.user.name.charAt(0).toUpperCase()}</div>`
  ).join('');
  
  const memberCount = team.members.length;
  const isLeader = team.getUserRole ? team.getUserRole(getCurrentUserId()) === 'leader' : team.creator._id === getCurrentUserId();
  
  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
      <div>
        <div style="font-weight:bold; color:white; font-size:1.1rem; margin-bottom:4px;">${escapeHtml(team.name)}</div>
        <div style="color:var(--text-muted); font-size:0.8rem;">Codice: <span style="font-family:monospace; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">${team.code}</span></div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        ${isLeader ? '<span style="background:gold; color:#333; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold;">LEADER</span>' : ''}
        <span style="background:rgba(46,204,113,0.2); color:#4ade80; padding:2px 8px; border-radius:12px; font-size:0.7rem;">${memberCount} membri</span>
      </div>
    </div>
    
    ${team.description ? `<div style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:12px;">${escapeHtml(team.description)}</div>` : ''}
    
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; gap:4px; align-items:center;">
        ${membersHtml}
        ${memberCount > 3 ? `<div style="color:var(--text-muted); font-size:0.8rem;">+${memberCount - 3}</div>` : ''}
      </div>
      <div style="display:flex; gap:8px;">
        <button onclick="viewTeamDetails('${team._id}')" class="btn btn-secondary btn-sm">Dettagli</button>
        <button onclick="openTeamChat('${team._id}')" class="btn btn-primary btn-sm">Chat</button>
      </div>
    </div>
  `;
  
  div.onclick = function(e) {
    if (!e.target.closest('button')) {
      viewTeamDetails(team._id);
    }
  };
  
  return div;
}

function openCreateTeamModal() {
  document.getElementById('createTeamModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Reset form
  document.getElementById('teamName').value = '';
  document.getElementById('teamDescription').value = '';
  document.getElementById('teamMaxMembers').value = '20';
}

function closeCreateTeamModal() {
  document.getElementById('createTeamModal').style.display = 'none';
  document.body.style.overflow = '';
}

async function createTeam() {
  const name = document.getElementById('teamName').value.trim();
  const description = document.getElementById('teamDescription').value.trim();
  const maxMembers = parseInt(document.getElementById('teamMaxMembers').value);
  
  if (!name) {
    showToast('Il nome del team è obbligatorio', 'error');
    return;
  }
  
  const teamData = {
    name: name,
    description: description,
    maxMembers: maxMembers
  };
  
  try {
    const response = await fetch('/api/teams/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(teamData)
    });
    
    const data = await response.json();
    
    if (response.ok && data.team) {
      showToast('Team creato con successo!', 'success');
      closeCreateTeamModal();
      loadUserTeams();
    } else {
      throw new Error(data.error || 'Errore creazione team');
    }
  } catch (error) {
    console.error('Create team error:', error);
    showToast('Errore nella creazione del team', 'error');
  }
}

async function joinTeam() {
  const code = document.getElementById('joinCode').value.trim();
  
  if (!code || code.length !== 8) {
    showToast('Inserisci un codice team valido (8 caratteri)', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/teams/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code: code })
    });
    
    const data = await response.json();
    
    if (response.ok && data.team) {
      showToast('Ti sei unito al team con successo!', 'success');
      document.getElementById('joinCode').value = '';
      loadUserTeams();
    } else {
      throw new Error(data.error || 'Errore unione al team');
    }
  } catch (error) {
    console.error('Join team error:', error);
    showToast(error.message || 'Errore nell\'unione al team', 'error');
  }
}

async function viewTeamDetails(teamId) {
  try {
    const response = await fetch(`/api/teams/${teamId}`);
    const data = await response.json();
    
    if (response.ok && data.team) {
      currentTeam = data.team;
      renderTeamDetails();
    } else {
      throw new Error(data.error || 'Errore caricamento dettagli team');
    }
  } catch (error) {
    console.error('View team details error:', error);
    showToast('Errore nel caricamento dei dettagli', 'error');
  }
}

function renderTeamDetails() {
  const container = document.getElementById('teamDetailsContainer');
  const team = currentTeam;
  
  if (!team) return;
  
  const membersHtml = team.members.map(member => `
    <div style="display:flex; align-items:center; gap:8px; padding:8px; background:rgba(255,255,255,0.05); border-radius:8px;">
      <div class="member-avatar">${member.user.name.charAt(0).toUpperCase()}</div>
      <div style="flex:1;">
        <div style="color:white; font-size:0.9rem;">${escapeHtml(member.user.name)}</div>
        <div style="color:var(--text-muted); font-size:0.7rem;">${getRoleLabel(member.role)} - ${new Date(member.joinedAt).toLocaleDateString('it-IT')}</div>
      </div>
      ${member.role === 'leader' ? '<span style="background:gold; color:#333; padding:2px 8px; border-radius:12px; font-size:0.6rem; font-weight:bold;">LEADER</span>' : ''}
    </div>
  `).join('');
  
  container.innerHTML = `
    <div class="glass-card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="color:white; font-size:1rem;">${escapeHtml(team.name)}</h3>
        <button onclick="closeTeamDetails()" class="btn btn-ghost btn-sm">Chiudi</button>
      </div>
      
      <div style="margin-bottom:16px;">
        <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:4px;">Codice Team</div>
        <div style="font-family:monospace; background:rgba(255,255,255,0.1); padding:8px 12px; border-radius:8px; color:#4ade80; font-weight:bold;">${team.code}</div>
      </div>
      
      ${team.description ? `
        <div style="margin-bottom:16px;">
          <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:4px;">Descrizione</div>
          <div style="color:white;">${escapeHtml(team.description)}</div>
        </div>
      ` : ''}
      
      <div style="margin-bottom:16px;">
        <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:8px;">Membri (${team.members.length}/${team.maxMembers})</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${membersHtml}
        </div>
      </div>
      
      <div style="display:flex; gap:8px;">
        <button onclick="openTeamChat('${team._id}')" class="btn btn-primary">Apri Chat</button>
        <button onclick="viewTeamGoals('${team._id}')" class="btn btn-secondary">Obiettivi</button>
      </div>
    </div>
  `;
  
  container.style.display = 'block';
  
  // Scroll to team details
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeTeamDetails() {
  document.getElementById('teamDetailsContainer').style.display = 'none';
  currentTeam = null;
}

function openTeamChat(teamId) {
  // Redirect to chat page with team parameter
  window.location.href = `/chat.html?team=${teamId}`;
}

function viewTeamGoals(teamId) {
  // Redirect to goals page with team parameter
  window.location.href = `/goals.html?team=${teamId}`;
}

// Helper functions
function getCurrentUserId() {
  // This should get the current user ID from session or local storage
  // For now, return a placeholder - this would need to be implemented
  return localStorage.getItem('userId') || null;
}

function getRoleLabel(role) {
  const labels = {
    leader: 'Leader',
    admin: 'Admin',
    member: 'Membro'
  };
  return labels[role] || role;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// CSS for member avatars
const style = document.createElement('style');
style.textContent = `
  .member-avatar {
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
  }
`;
document.head.appendChild(style);
