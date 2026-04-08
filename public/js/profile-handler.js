// Profile Form Handler
document.addEventListener('DOMContentLoaded', function() {
  const profileForm = document.getElementById('profileForm');
  
  if (profileForm) {
    profileForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      
      // Show loading state
      submitBtn.textContent = '💾 Salvataggio...';
      submitBtn.disabled = true;
      
      try {
        console.log('[PROFILE] Sending update...');
        const response = await fetch('/api/profile/update', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        console.log('[PROFILE] Update response:', result);
        
        if (response.ok) {
          // Update UI with new data immediately
          if (result.user) {
            updateProfileUI(result.user);
          }
          
          // Show success feedback
          submitBtn.textContent = '✅ Salvato!';
          showToast(result.message || 'Profilo aggiornato!', 'success');
          
          // Reset button after 2 seconds
          setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }, 2000);
        } else {
          showToast(result.error || 'Errore aggiornamento', 'error');
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        console.error('[PROFILE] Update error:', error);
        showToast('Errore di connessione', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
  
  // Avatar upload click handlers
  setupAvatarUpload();
  
  // Load initial profile data
  loadProfileData();
});

function setupAvatarUpload() {
  const avatarInput = document.getElementById('avatarInput');
  const profilePicWrapper = document.getElementById('profilePicWrapper');
  
  if (avatarInput && profilePicWrapper) {
    profilePicWrapper.addEventListener('click', () => {
      avatarInput.click();
    });
    
    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const profileImg = document.getElementById('profileImg');
          const profileEmoji = document.getElementById('profileEmoji');
          
          if (profileImg) {
            profileImg.src = e.target.result;
            profileImg.style.display = 'block';
          }
          if (profileEmoji) {
            profileEmoji.style.display = 'none';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

async function loadProfileData() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    
    if (response.ok && data.user) {
      updateProfileUI(data.user);
    } else {
      console.error('[PROFILE] Failed to load user data:', data.error);
      showToast('Errore caricamento profilo', 'error');
    }
  } catch (error) {
    console.error('[PROFILE] Load profile error:', error);
    showToast('Dati non disponibili', 'error');
  }
}

function updateProfileUI(user) {
  // Update form fields
  const nameInput = document.getElementById('nameInput');
  const bioInput = document.getElementById('bioInput');
  const trophiesInput = document.getElementById('trophiesInput');
  
  if (nameInput) nameInput.value = user.name || '';
  if (bioInput) bioInput.value = user.bio || '';
  if (trophiesInput) trophiesInput.value = user.trophies || 0;
  
  // Update profile display
  const profileUsername = document.getElementById('profileUsername');
  const profileBio = document.getElementById('profileBio');
  const profileHonorTitle = document.getElementById('profileHonorTitle');
  const profileImg = document.getElementById('profileImg');
  const profileEmoji = document.getElementById('profileEmoji');
  
  if (profileUsername) profileUsername.textContent = user.name || '...';
  if (profileBio) profileBio.textContent = user.bio || '';
  if (profileHonorTitle) profileHonorTitle.textContent = user.honorTitle || '';
  
  if (profileImg && user.avatar) {
    profileImg.src = user.avatar;
    profileImg.style.display = 'block';
    if (profileEmoji) profileEmoji.style.display = 'none';
  }
  
  // Update stats
  const pStars = document.getElementById('pStars');
  const hPoints = document.getElementById('hPoints');
  const pCO2 = document.getElementById('pCO2');
  const pPosts = document.getElementById('pPosts');
  
  if (pStars) pStars.textContent = user.points || 0;
  if (hPoints) hPoints.textContent = user.points || 0;
  if (pCO2) pCO2.textContent = user.co2Saved || 0;
  if (pPosts) pPosts.textContent = user.postCount || 0;
  
  // Load recent activities
  loadRecentActivities();
}

async function loadRecentActivities() {
  try {
    const response = await fetch('/api/profile/activities');
    const data = await response.json();
    
    if (response.ok && data.activities) {
      renderRecentActivities(data.activities);
    }
  } catch (error) {
    console.error('Load activities error:', error);
  }
}

function renderRecentActivities(activities) {
  const container = document.getElementById('recentActivities');
  
  if (!activities || activities.length === 0) {
    if (container) {
      container.innerHTML = `
        <div style="text-align:center; padding:20px 0; color:var(--text-muted);">
          <div style="font-size:1.5rem; margin-bottom:8px;">?</div>
          <div style="font-size:0.85rem;">Nessuna attività recente</div>
        </div>
      `;
    }
    return;
  }
  
  if (container) {
    container.innerHTML = activities.slice(0, 5).map(activity => `
      <div style="display:flex; align-items:center; gap:12px; padding:8px; background:rgba(255,255,255,0.05); border-radius:8px;">
        <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#2e8b57,#4ade80); display:flex; align-items:center; justify-content:center; font-size:0.9rem;">
          ${getActivityIcon(activity.type)}
        </div>
        <div style="flex:1;">
          <div style="color:white; font-weight:600; font-size:0.85rem;">${getActivityName(activity.type)}</div>
          <div style="color:var(--text-muted); font-size:0.7rem;">${formatDate(activity.createdAt)}</div>
        </div>
        <div style="color:#4ade80; font-size:0.8rem; font-weight:bold;">+${activity.points || 0}</div>
      </div>
    `).join('');
  }
}

function getActivityIcon(type) {
  const icons = {
    'walk': '?',
    'bike': '?',
    'bus': '?',
    'train': '?',
    'car': '?',
    'post': '?',
    'team': '?',
    'goal': '?'
  };
  return icons[type] || '?';
}

function getActivityName(type) {
  const names = {
    'walk': 'Camminata',
    'bike': 'Bicicletta',
    'bus': 'Autobus',
    'train': 'Treno',
    'car': 'Automobile',
    'post': 'Post Pubblicato',
    'team': 'Team Creato',
    'goal': 'Obiettivo Completato'
  };
  return names[type] || 'Attività';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) {
    return `${days} giorni fa`;
  } else if (hours > 0) {
    return `${hours} ore fa`;
  } else {
    return 'Ora';
  }
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
