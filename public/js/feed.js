requireAuth();

let currentPage = 1;
let totalPages  = 1;
let currentPostId = null;
let myUserId = null;

async function init() {
  const me = await apiFetch('/api/auth/me');
  if (me?.ok) myUserId = me.data._id;
  await loadFeed(1, true);
}

async function loadFeed(page = 1, replace = false) {
  const res = await apiFetch(`/api/feed?page=${page}&limit=10`);
  if (!res?.ok) { showToast('Errore caricamento feed', 'error'); return; }

  currentPage = res.data.pagination.page;
  totalPages  = res.data.pagination.pages;

  const container = document.getElementById('feedContainer');
  if (replace) container.innerHTML = '';

  if (!res.data.posts.length && replace) {
    container.innerHTML = `
      <div class="glass-card" style="text-align:center; padding:40px 20px;">
        <div style="font-size:2.5rem; margin-bottom:12px;">📸</div>
        <div style="color:white; font-weight:600; margin-bottom:6px;">Il feed è vuoto</div>
        <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:16px;">Sii il primo a condividere il tuo viaggio ecologico!</div>
        <button class="btn btn-primary btn-sm" style="width:auto;" onclick="openPostModal()">+ Crea il primo post</button>
      </div>`;
    return;
  }

  res.data.posts.forEach(post => {
    container.appendChild(buildPostCard(post));
  });

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
