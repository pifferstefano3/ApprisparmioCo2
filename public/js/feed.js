requireAuth();

let currentPage = 1;
let totalPages  = 1;
let currentPostId = null;
let myUserId = null;
let posts = [];

async function init() {
  const me = await apiFetch('/api/auth/me');
  if (me?.ok) myUserId = me.data._id;
  await loadFeed(1, true);
}

async function loadFeed(page = 1, replace = false) {
  // Use fast 3s timeout for feed to prevent lag
  const res = await apiFetchFast(`/api/feed?page=${page}&limit=10`);
  
  if (!res?.ok) { 
    const container = document.getElementById('feedContainer');
    if (res?.status === 408) {
      // Timeout error
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:12px;">⏱️</div>
          <div style="margin-bottom:8px;">Il server sta impiegando troppo tempo</div>
          <button class="btn btn-primary btn-sm" onclick="loadFeed(1, true)">Riprova</button>
        </div>
      `;
    } else {
      showToast('Errore caricamento feed: ' + (res?.data?.error || ''), 'error'); 
    }
    return; 
  }

  currentPage = res.data.pagination.page;
  totalPages  = res.data.pagination.pages;
  
  if (replace) {
    posts = res.data.posts;
    renderPosts();
  } else {
    posts.push(...res.data.posts);
    appendPosts(res.data.posts);
  }

  const container = document.getElementById('feedContainer');
  if (!res.data.posts.length && replace) {
    // Show sample posts for new users
    const samplePosts = [
      {
        _id: 'sample1',
        username: 'EcoTeam VERDENT',
        profilePic: null,
        title: '🌱 Benvenuto nel Feed Eco!',
        description: 'Condividi i tuoi viaggi sostenibili e ispira altri utenti. Ogni km in bici o a piedi conta!',
        mediaUrl: null,
        mediaType: 'image',
        likesCount: 42,
        commentsCount: 5,
        likedByMe: false,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        _id: 'sample2',
        username: 'GreenTraveler',
        profilePic: null,
        title: '🚴‍♂️ 10km in bici oggi!',
        description: 'Ho evitato l\'auto e ho pedalato fino al lavoro. CO2 risparmiata: 1.7kg! 💚',
        mediaUrl: null,
        mediaType: 'image',
        likesCount: 28,
        commentsCount: 3,
        likedByMe: false,
        createdAt: new Date(Date.now() - 172800000).toISOString()
      },
      {
        _id: 'sample3',
        username: 'EcoWarrior',
        profilePic: null,
        title: '🚌 Scoperto il bus 73',
        description: 'Non sapevo che passasse così vicino a casa! Da oggi addio auto in città.',
        mediaUrl: null,
        mediaType: 'image',
        likesCount: 15,
        commentsCount: 8,
        likedByMe: false,
        createdAt: new Date(Date.now() - 259200000).toISOString()
      }
    ];
    
    posts = samplePosts;
    renderPosts();
    
    // Add banner to encourage posting
    const banner = document.createElement('div');
    banner.className = 'glass-card';
    banner.style.cssText = 'text-align:center; padding:20px; margin-bottom:16px; background:linear-gradient(135deg, rgba(46,139,87,0.3), rgba(74,222,128,0.1));';
    banner.innerHTML = `
      <div style="font-size:1.8rem; margin-bottom:8px;">📸</div>
      <div style="color:white; font-weight:600; margin-bottom:6px;">Il tuo feed è vuoto</div>
      <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:12px;">Sii il primo a condividere i tuoi viaggi ecologici!</div>
      <button class="btn btn-primary btn-sm" style="width:auto;" onclick="openPostModal()">+ Crea il tuo primo post</button>
    `;
    container.prepend(banner);
    return;
  }

  const wrapper = document.getElementById('loadMoreWrapper');
  wrapper.style.display = currentPage < totalPages ? 'block' : 'none';
}

function buildPostCard(post) {
  const div = document.createElement('div');
  div.className = 'glass-card feed-card animate-fade-in-up';
  div.id = `post-${post._id}`;

  const avatar = post.profilePic
    ? `<img src="${post.profilePic}" alt="">`
    : `<span>🌿</span>`;

  const media = post.mediaUrl
    ? post.mediaType === 'video'
      ? `<video class="feed-media" controls muted playsinline><source src="${post.mediaUrl}"></video>`
      : `<img class="feed-media" src="${post.mediaUrl}" alt="${post.title}" loading="lazy">`
    : '';

  const isOwn = post.userId?.toString() === myUserId?.toString();

  div.innerHTML = `
    <div class="feed-header">
      <div class="feed-avatar">${avatar}</div>
      <div class="feed-info">
        <div class="feed-username">@${post.username}</div>
        <div class="feed-date">${formatDate(post.createdAt)}</div>
      </div>
      ${isOwn ? `<button onclick="deletePost('${post._id}')" class="btn btn-ghost btn-sm" style="width:auto; padding:4px 8px; font-size:0.75rem; color:var(--text-muted);">🗑️</button>` : ''}
    </div>
    ${media}
    <div class="feed-title">${escapeHtml(post.title)}</div>
    ${post.description ? `<div class="feed-desc">${escapeHtml(post.description)}</div>` : ''}
    <div class="feed-actions">
      <button class="action-btn ${post.likedByMe ? 'liked' : ''}" id="like-${post._id}" onclick="toggleLike('${post._id}', this)">
        <span>${post.likedByMe ? '❤️' : '🤍'}</span>
        <span class="likes-count">${post.likesCount}</span>
      </button>
      <button class="action-btn" onclick="openComments('${post._id}')">
        <span>💬</span>
        <span>${post.commentsCount}</span>
      </button>
    </div>`;
  return div;
}

async function toggleLike(postId, btn) {
  const res = await apiFetch(`/api/feed/${postId}/like`, { method: 'POST' });
  if (!res?.ok) return;
  const liked = res.data.liked;
  btn.className = `action-btn ${liked ? 'liked' : ''}`;
  btn.querySelector('span').textContent = liked ? '❤️' : '🤍';
  btn.querySelector('.likes-count').textContent = res.data.likesCount;
}

async function deletePost(postId) {
  if (!confirm('Eliminare questo post?')) return;
  const res = await apiFetch(`/api/feed/${postId}`, { method: 'DELETE' });
  if (res?.ok) {
    document.getElementById(`post-${postId}`)?.remove();
    showToast('Post eliminato', 'success');
  }
}

window.loadMore = function() { loadFeed(currentPage + 1, false); };

/* ─── Modal Nuovo Post ─────────────────────────────────────────────────────── */
window.openPostModal = function () {
  document.getElementById('postModal').style.display = 'flex';
};
window.closePostModal = function () {
  document.getElementById('postModal').style.display = 'none';
  document.getElementById('postTitle').value = '';
  document.getElementById('postDesc').value  = '';
  document.getElementById('postMedia').value = '';
  document.getElementById('mediaPreview').innerHTML = '';
};

document.getElementById('postMedia').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('mediaPreview');
  if (!file) { preview.innerHTML = ''; return; }
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video')) {
    preview.innerHTML = `<video src="${url}" style="width:100%;max-height:200px;border-radius:10px;" controls muted></video>`;
  } else {
    preview.innerHTML = `<img src="${url}" style="width:100%;max-height:200px;border-radius:10px;object-fit:cover;">`;
  }
});

window.submitPost = async function () {
  const title = document.getElementById('postTitle').value.trim();
  if (!title) { showToast('Il titolo è obbligatorio', 'error'); return; }

  const btn = document.getElementById('submitPostBtn');
  btn.disabled = true; btn.textContent = 'Pubblicazione...';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', document.getElementById('postDesc').value.trim());
  const mediaFile = document.getElementById('postMedia').files[0];
  if (mediaFile) formData.append('media', mediaFile);

  const token = getToken();
  const res = await fetch('/api/feed', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();

  btn.disabled = false; btn.textContent = 'Pubblica 🌿';

  if (res.ok) {
    showToast(`Post pubblicato! +${data.starsEarned} stelle 🌟`, 'success', 4000);
    closePostModal();
    loadFeed(1, true); // ricarica feed
  } else {
    showToast(data.error || 'Errore pubblicazione', 'error');
  }
};

/* ─── Commenti ──────────────────────────────────────────────────────────────── */
window.openComments = async function (postId) {
  currentPostId = postId;
  document.getElementById('commentsModal').style.display = 'flex';
  document.getElementById('commentsList').innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';

  const res = await apiFetch(`/api/feed?page=1&limit=100`);
  const post = res?.data?.posts?.find(p => p._id === postId);

  if (!post) {
    document.getElementById('commentsList').innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;">Nessun commento.</div>';
    return;
  }
  renderComments(post.comments || []);
};

window.closeCommentsModal = function () {
  document.getElementById('commentsModal').style.display = 'none';
  currentPostId = null;
};

function renderComments(comments) {
  const list = document.getElementById('commentsList');
  if (!comments.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">Nessun commento. Sii il primo!</div>';
    return;
  }
  list.innerHTML = comments.map(c => `
    <div class="comment-item">
      <div class="comment-avatar">🌿</div>
      <div class="comment-body">
        <div class="comment-user">@${c.username}</div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      </div>
    </div>`).join('');
}

window.addComment = async function () {
  const input = document.getElementById('commentInput');
  const text  = input.value.trim();
  if (!text || !currentPostId) return;

  const res = await apiFetch(`/api/feed/${currentPostId}/comment`, { method: 'POST', body: { text } });
  if (res?.ok) {
    input.value = '';
    const list = document.getElementById('commentsList');
    const div = document.createElement('div');
    div.className = 'comment-item animate-fade-in';
    div.innerHTML = `
      <div class="comment-avatar">🌿</div>
      <div class="comment-body">
        <div class="comment-user">Tu</div>
        <div class="comment-text">${escapeHtml(text)}</div>
      </div>`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  } else {
    showToast('Errore commento', 'error');
  }
};

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
