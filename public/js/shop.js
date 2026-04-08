requireAuth();

let allItems   = [];
let activeFilter = 'all';
let pendingBuyId = null;

/* ─── Init ───────────────────────────────────────────────────────────────────── */
async function init() {
  // Use fast 3s timeout for shop to prevent lag
  const res = await apiFetchFast('/api/shop/items');
  
  if (!res?.ok) {
    const grid = document.getElementById('shopGrid');
    if (res?.status === 408) {
      // Timeout error
      grid.innerHTML = `
        <div style="grid-column:span 2; text-align:center; padding:40px 20px; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:12px;">⏱️</div>
          <div style="margin-bottom:8px;">Il server sta impiegando troppo tempo</div>
          <button class="btn btn-primary btn-sm" onclick="init()">Riprova</button>
        </div>
      `;
    } else {
      showToast('Errore nel caricamento del catalogo: ' + (res?.data?.error || ''), 'error');
    }
    return;
  }

  allItems = res.data.items;
  document.getElementById('shopPoints').textContent = res.data.userPoints || 0;
  renderGrid(allItems);
}

/* ─── Render Grid ────────────────────────────────────────────────────────────── */
function renderGrid(items) {
  const grid = document.getElementById('shopGrid');
  const filtered = activeFilter === 'all' ? items : items.filter(i => i.type === activeFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:span 2; text-align:center; padding:40px 0; color:var(--text-muted); font-size:0.85rem;">Nessun articolo in questa categoria</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="glass-card shop-item-card${item.owned ? ' owned' : ''}">
      <span class="rarity-badge" style="color:${item.rarityColor};">${capitalize(item.rarity)}</span>
      <div class="shop-item-emoji">${item.emoji}</div>
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-desc">${item.description}</div>
      ${item.owned
        ? `<div class="owned-badge">✓ Posseduto</div>`
        : `<div class="shop-item-cost">⭐ ${item.cost}</div>
           <button class="btn btn-primary btn-sm" style="margin-top:4px;" onclick="openModal('${item.id}')" ${!item.canAfford ? 'disabled title="Punti insufficienti"' : ''}>
             ${item.canAfford ? 'Sblocca' : '🔒 ' + item.cost + ' pt'}
           </button>`
      }
    </div>
  `).join('');
}

/* ─── Filter Buttons ─────────────────────────────────────────────────────────── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.style.background   = 'rgba(255,255,255,0.1)';
      b.style.borderColor  = 'rgba(255,255,255,0.2)';
      b.style.color        = 'rgba(255,255,255,0.7)';
    });
    btn.style.background  = 'rgba(46,139,87,0.4)';
    btn.style.borderColor = 'rgba(74,222,128,0.4)';
    btn.style.color       = 'white';

    activeFilter = btn.dataset.filter;
    renderGrid(allItems);
  });
});

/* ─── Modal ──────────────────────────────────────────────────────────────────── */
window.openModal = function (itemId) {
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;

  pendingBuyId = itemId;
  document.getElementById('modalEmoji').textContent = item.emoji;
  document.getElementById('modalName').textContent  = item.name;
  document.getElementById('modalDesc').textContent  = item.description;
  document.getElementById('modalCost').textContent  = item.cost;

  const modal = document.getElementById('confirmModal');
  modal.style.display = 'flex';
};

window.closeModal = function () {
  document.getElementById('confirmModal').style.display = 'none';
  pendingBuyId = null;
};

document.getElementById('confirmBuyBtn').addEventListener('click', async () => {
  if (!pendingBuyId) return;

  const btn = document.getElementById('confirmBuyBtn');
  btn.disabled = true;
  btn.textContent = 'Acquisto...';

  const res = await apiFetch(`/api/shop/buy/${pendingBuyId}`, { method: 'POST' });

  btn.disabled = false;
  btn.textContent = 'Sblocca! 🎉';

  if (res?.ok) {
    showToast(res.data.message, 'success', 4000);
    closeModal();

    // Aggiorna punti e item
    document.getElementById('shopPoints').textContent = res.data.remainingPoints;
    const idx = allItems.findIndex(i => i.id === pendingBuyId);
    if (idx !== -1) {
      allItems[idx].owned    = true;
      allItems[idx].canAfford = false;
    }
    pendingBuyId = null;
    renderGrid(allItems);
  } else {
    showToast(res?.data?.error || 'Errore nell\'acquisto', 'error');
  }
});

// Chiudi modal cliccando fuori
document.getElementById('confirmModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function capitalize(str) { return str ? str[0].toUpperCase() + str.slice(1) : ''; }

init();
