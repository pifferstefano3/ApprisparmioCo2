// Goals Management with Yellow->Gray Transitions
let currentTeam = null;
let goals = [];
let keyPointCount = 1;

document.addEventListener('DOMContentLoaded', function() {
  loadUserTeams();
  setupEventListeners();
});

function setupEventListeners() {
  const teamSelector = document.getElementById('teamSelector');
  teamSelector.addEventListener('change', function() {
    currentTeam = this.value;
    loadTeamGoals(currentTeam);
  });
}

async function loadUserTeams() {
  try {
    const response = await fetch('/api/teams/my');
    const data = await response.json();
    
    if (response.ok && data.teams) {
      const teamSelector = document.getElementById('teamSelector');
      teamSelector.innerHTML = '<option value="">Seleziona un team...</option>';
      
      data.teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team._id;
        option.textContent = team.name;
        teamSelector.appendChild(option);
      });
      
      if (data.teams.length > 0) {
        currentTeam = data.teams[0]._id;
        teamSelector.value = currentTeam;
        loadTeamGoals(currentTeam);
      }
    }
  } catch (error) {
    console.error('Error loading teams:', error);
    showToast('Errore nel caricamento dei team', 'error');
  }
}

async function loadTeamGoals(teamId) {
  if (!teamId) {
    document.getElementById('goalsContainer').innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--text-muted);">
        Seleziona un team per vedere gli obiettivi
      </div>
    `;
    return;
  }
  
  try {
    const response = await fetch(`/api/goals/team/${teamId}`);
    const data = await response.json();
    
    if (response.ok && data.goals) {
      goals = data.goals;
      renderGoals(goals);
    } else {
      throw new Error(data.error || 'Errore caricamento obiettivi');
    }
  } catch (error) {
    console.error('Error loading goals:', error);
    document.getElementById('goalsContainer').innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--text-muted);">
        Errore nel caricamento degli obiettivi
      </div>
    `;
  }
}

function renderGoals(goalsToRender) {
  const container = document.getElementById('goalsContainer');
  
  if (goalsToRender.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--text-muted);">
        Nessun obiettivo trovato. Crea il primo obiettivo!
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  goalsToRender.forEach(goal => {
    const goalElement = createGoalElement(goal);
    container.appendChild(goalElement);
  });
}

function createGoalElement(goal) {
  const div = document.createElement('div');
  div.className = `goal-item ${goal.status ? 'completed' : ''}`;
  div.dataset.goalId = goal._id;
  
  const assigneesHtml = goal.assignees.map(assignee => 
    `<div class="assignee-avatar">${assignee.user.name.charAt(0).toUpperCase()}</div>`
  ).join('');
  
  const keyPointsHtml = goal.keyPoints.length > 0 ? 
    `<div style="margin-top:8px;">
      ${goal.keyPoints.map(point => `<div style="font-size:0.8rem; color:#666; margin-left:16px;">L ${point}</div>`).join('')}
    </div>` : '';
  
  const dueDateHtml = goal.dueDate ? 
    `<div style="font-size:0.8rem; color:#666;">Scadenza: ${new Date(goal.dueDate).toLocaleDateString('it-IT')}</div>` : '';
  
  div.innerHTML = `
    <div style="display:flex; align-items:flex-start; gap:12px;">
      <div class="goal-checkbox" onclick="toggleGoalStatus('${goal._id}')"></div>
      <div style="flex:1;">
        <div class="goal-title">${escapeHtml(goal.title)}</div>
        <div class="goal-description">${escapeHtml(goal.description)}</div>
        ${keyPointsHtml}
        <div class="goal-meta">
          <div>
            <span class="goal-priority priority-${goal.priority}">${getPriorityLabel(goal.priority)}</span>
            <span style="margin-left:8px; color:#666;">${getCategoryLabel(goal.category)}</span>
            ${dueDateHtml}
          </div>
          <div class="goal-assignees">
            ${assigneesHtml}
          </div>
        </div>
        <div class="goal-actions">
          <button class="goal-btn goal-btn-edit" onclick="editGoal('${goal._id}')">Modifica</button>
          <button class="goal-btn goal-btn-delete" onclick="deleteGoal('${goal._id}')">Elimina</button>
        </div>
      </div>
    </div>
  `;
  
  return div;
}

async function toggleGoalStatus(goalId) {
  const goalElement = document.querySelector(`[data-goal-id="${goalId}"]`);
  
  // Add completing animation
  goalElement.classList.add('completing');
  
  try {
    const response = await fetch(`/api/goals/${goalId}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok && data.goal) {
      // Update goal in local array
      const goalIndex = goals.findIndex(g => g._id === goalId);
      if (goalIndex !== -1) {
        goals[goalIndex] = data.goal;
      }
      
      // Update UI with transition
      setTimeout(() => {
        goalElement.classList.remove('completing');
        
        if (data.goal.status) {
          goalElement.classList.add('completed');
          showToast('Obiettivo completato! Ottimo lavoro!', 'success');
        } else {
          goalElement.classList.remove('completed');
          showToast('Obiettivo riattivato', 'info');
        }
      }, 300);
    } else {
      throw new Error(data.error || 'Errore aggiornamento stato');
    }
  } catch (error) {
    console.error('Toggle goal status error:', error);
    goalElement.classList.remove('completing');
    showToast('Errore nell\'aggiornamento dello stato', 'error');
  }
}

function openGoalModal() {
  if (!currentTeam) {
    showToast('Seleziona prima un team', 'warning');
    return;
  }
  
  document.getElementById('goalModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Load team members for assignees
  loadTeamMembersForAssignees();
  
  // Reset form
  document.getElementById('goalTitle').value = '';
  document.getElementById('goalDescription').value = '';
  document.getElementById('goalPriority').value = 'medium';
  document.getElementById('goalCategory').value = 'environmental';
  document.getElementById('goalDueDate').value = '';
  
  // Reset key points
  keyPointCount = 1;
  document.getElementById('keyPointsContainer').innerHTML = 
    '<input type="text" class="form-input" placeholder="Punto chiave 1..." maxlength="200">';
}

function closeGoalModal() {
  document.getElementById('goalModal').style.display = 'none';
  document.body.style.overflow = '';
}

function addKeyPoint() {
  keyPointCount++;
  const container = document.getElementById('keyPointsContainer');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-input';
  input.placeholder = `Punto chiave ${keyPointCount}...`;
  input.maxLength = '200';
  container.appendChild(input);
}

async function loadTeamMembersForAssignees() {
  try {
    const response = await fetch(`/api/teams/${currentTeam}`);
    const data = await response.json();
    
    if (response.ok && data.team) {
      const container = document.getElementById('assigneesContainer');
      container.innerHTML = '';
      
      data.team.members.forEach(member => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        
        div.innerHTML = `
          <input type="checkbox" id="assignee-${member.user._id}" value="${member.user._id}">
          <label for="assignee-${member.user._id}" style="color:white; cursor:pointer;">
            ${member.user.name}
          </label>
        `;
        
        container.appendChild(div);
      });
    }
  } catch (error) {
    console.error('Error loading team members:', error);
  }
}

async function createGoal() {
  const title = document.getElementById('goalTitle').value.trim();
  const description = document.getElementById('goalDescription').value.trim();
  const priority = document.getElementById('goalPriority').value;
  const category = document.getElementById('goalCategory').value;
  const dueDate = document.getElementById('goalDueDate').value;
  
  if (!title || !description) {
    showToast('Titolo e descrizione sono obbligatori', 'error');
    return;
  }
  
  // Collect key points
  const keyPointInputs = document.querySelectorAll('#keyPointsContainer input');
  const keyPoints = Array.from(keyPointInputs)
    .map(input => input.value.trim())
    .filter(point => point.length > 0);
  
  // Collect assignees
  const assigneeCheckboxes = document.querySelectorAll('#assigneesContainer input:checked');
  const assignees = Array.from(assigneeCheckboxes).map(cb => cb.value);
  
  const goalData = {
    title,
    description,
    keyPoints,
    teamId: currentTeam,
    priority,
    category,
    dueDate: dueDate || null,
    assignees
  };
  
  try {
    const response = await fetch('/api/goals/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(goalData)
    });
    
    const data = await response.json();
    
    if (response.ok && data.goal) {
      showToast('Obiettivo creato con successo!', 'success');
      closeGoalModal();
      loadTeamGoals(currentTeam);
    } else {
      throw new Error(data.error || 'Errore creazione obiettivo');
    }
  } catch (error) {
    console.error('Create goal error:', error);
    showToast('Errore nella creazione dell\'obiettivo', 'error');
  }
}

async function deleteGoal(goalId) {
  if (!confirm('Sei sicuro di voler eliminare questo obiettivo?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showToast('Obiettivo eliminato con successo', 'success');
      loadTeamGoals(currentTeam);
    } else {
      throw new Error(data.error || 'Errore eliminazione obiettivo');
    }
  } catch (error) {
    console.error('Delete goal error:', error);
    showToast('Errore nell\'eliminazione dell\'obiettivo', 'error');
  }
}

function editGoal(goalId) {
  // Placeholder for edit functionality
  showToast('Funzionalità di modifica in arrivo!', 'info');
}

// Helper functions
function getPriorityLabel(priority) {
  const labels = {
    low: 'Bassa',
    medium: 'Media',
    high: 'Alta'
  };
  return labels[priority] || priority;
}

function getCategoryLabel(category) {
  const labels = {
    environmental: 'Ambientale',
    social: 'Sociale',
    economic: 'Economico',
    educational: 'Educativo',
    health: 'Salute'
  };
  return labels[category] || category;
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
