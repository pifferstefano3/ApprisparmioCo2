// Profile Form Handler
document.addEventListener('DOMContentLoaded', function() {
  const profileForm = document.getElementById('profileForm');
  
  profileForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Show loading state
    submitBtn.textContent = 'Aggiornamento...';
    submitBtn.disabled = true;
    
    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Update UI with new data
        if (result.name) {
          document.getElementById('profileUsername').textContent = result.name;
          document.getElementById('nameInput').value = result.name;
        }
        
        if (result.bio) {
          document.getElementById('profileBio').textContent = result.bio;
          document.getElementById('bioInput').value = result.bio;
        }
        
        if (result.trophies !== undefined) {
          document.getElementById('pStars').textContent = result.trophies;
          document.getElementById('trophiesInput').value = result.trophies;
        }
        
        if (result.avatar) {
          const profileImg = document.getElementById('profileImg');
          profileImg.src = `/uploads/${result.avatar}`;
          profileImg.style.display = 'block';
          document.getElementById('profileEmoji').style.display = 'none';
        }
        
        // Update navbar if exists
        const navbarName = document.getElementById('navbar-name');
        const navbarTrophies = document.getElementById('navbar-trophies');
        const navbarAvatar = document.getElementById('navbar-avatar');
        
        if (navbarName && result.name) navbarName.textContent = result.name;
        if (navbarTrophies && result.trophies !== undefined) navbarTrophies.textContent = result.trophies;
        if (navbarAvatar && result.avatar) navbarAvatar.src = `/uploads/${result.avatar}`;
        
        showToast('Profilo aggiornato con successo!', 'success');
      } else {
        showToast(result.error || 'Errore nell\'aggiornamento del profilo', 'error');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      showToast('Errore di connessione. Riprova più tardi.', 'error');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
  
  // Avatar preview
  const avatarInput = document.getElementById('avatarInput');
  avatarInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const profileImg = document.getElementById('profileImg');
        profileImg.src = e.target.result;
        profileImg.style.display = 'block';
        document.getElementById('profileEmoji').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });
});

// Toast notification function
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}
