// Instagram-style Feed with .populate() functionality
let currentPage = 1;
let isLoading = false;

document.addEventListener('DOMContentLoaded', function() {
  loadFeed();
  setupMediaPreview();
});

async function loadFeed(page = 1) {
  if (isLoading) return;
  isLoading = true;
  
  const feedContainer = document.getElementById('feedContainer');
  const loadMoreWrapper = document.getElementById('loadMoreWrapper');
  
  if (page === 1) {
    feedContainer.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
  }
  
  try {
    const response = await fetch(`/api/feed?page=${page}&limit=10`);
    const data = await response.json();
    
    if (response.ok && data.posts) {
      if (page === 1) {
        feedContainer.innerHTML = '';
      }
      
      data.posts.forEach(post => {
        const postCard = createInstagramPostCard(post);
        feedContainer.appendChild(postCard);
      });
      
      if (data.hasMore) {
        loadMoreWrapper.style.display = 'block';
        currentPage = page;
      } else {
        loadMoreWrapper.style.display = 'none';
      }
    } else {
      throw new Error(data.error || 'Errore caricamento feed');
    }
  } catch (error) {
    console.error('Feed load error:', error);
    feedContainer.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Errore nel caricamento del feed</div>';
  } finally {
    isLoading = false;
  }
}

function createInstagramPostCard(post) {
  const card = document.createElement('div');
  card.className = 'feed-card glass-card animate-fade-in-up';
  
  const authorName = post.author?.name || 'Utente Anonimo';
  const authorAvatar = post.author?.avatar || null;
  const mediaHtml = post.media ? 
    (post.media.includes('video') ? 
      `<video class="feed-media" controls><source src="/uploads/${post.media}" type="video/mp4"></video>` :
      `<img class="feed-media" src="/uploads/${post.media}" alt="Post image">`
    ) : '';
  
  card.innerHTML = `
    <div class="feed-header">
      <div class="feed-avatar">
        ${authorAvatar ? `<img src="/uploads/${authorAvatar}" alt="${authorName}">` : 'U'}
      </div>
      <div style="flex:1;">
        <div class="feed-username">${authorName}</div>
        <div class="feed-date">${formatDate(post.createdAt)}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="togglePostMenu('${post._id}')" style="width:auto;">...</button>
    </div>
    
    ${post.title ? `<div class="feed-title">${escapeHtml(post.title)}</div>` : ''}
    
    ${mediaHtml}
    
    ${post.description ? `<div class="feed-desc">${escapeHtml(post.description)}</div>` : ''}
    
    <div class="feed-actions">
      <button class="action-btn ${post.liked ? 'liked' : ''}" onclick="toggleLike('${post._id}')">
        <span>${post.liked ? 'R' : 'L'}</span>
        <span>${post.likes || 0}</span>
      </button>
      <button class="action-btn" onclick="openComments('${post._id}')">
        <span>C</span>
        <span>${post.comments || 0}</span>
      </button>
      <button class="action-btn" onclick="sharePost('${post._id}')">
        <span>S</span>
      </button>
    </div>
  `;
  
  return card;
}

async function submitPost() {
  const title = document.getElementById('postTitle').value.trim();
  const description = document.getElementById('postDesc').value.trim();
  const mediaFile = document.getElementById('postMedia').files[0];
  const submitBtn = document.getElementById('submitPostBtn');
  
  if (!title) {
    showToast('Il titolo è obbligatorio', 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  if (mediaFile) {
    formData.append('media', mediaFile);
  }
  
  submitBtn.textContent = 'Pubblicazione...';
  submitBtn.disabled = true;
  
  try {
    const response = await fetch('/api/feed/create', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('Post pubblicato con successo! +10 stelle', 'success');
      closePostModal();
      loadFeed(1); // Reload feed
    } else {
      showToast(result.error || 'Errore nella pubblicazione', 'error');
    }
  } catch (error) {
    console.error('Post submission error:', error);
    showToast('Errore di connessione. Riprova più tardi.', 'error');
  } finally {
    submitBtn.textContent = 'Pubblica';
    submitBtn.disabled = false;
  }
}

function setupMediaPreview() {
  const mediaInput = document.getElementById('postMedia');
  const preview = document.getElementById('mediaPreview');
  
  mediaInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const isVideo = file.type.startsWith('video/');
        preview.innerHTML = isVideo ? 
          `<video style="width:100%; max-height:200px; border-radius:8px;" controls><source src="${e.target.result}" type="${file.type}"></video>` :
          `<img style="width:100%; max-height:200px; border-radius:8px; object-fit:cover;" src="${e.target.result}" alt="Preview">`;
      };
      reader.readAsDataURL(file);
    }
  });
}

function openPostModal() {
  document.getElementById('postModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePostModal() {
  document.getElementById('postModal').style.display = 'none';
  document.body.style.overflow = '';
  document.getElementById('postTitle').value = '';
  document.getElementById('postDesc').value = '';
  document.getElementById('postMedia').value = '';
  document.getElementById('mediaPreview').innerHTML = '';
}

function loadMore() {
  loadFeed(currentPage + 1);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'ora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min fa`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h fa`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} gg fa`;
  
  return date.toLocaleDateString('it-IT');
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
