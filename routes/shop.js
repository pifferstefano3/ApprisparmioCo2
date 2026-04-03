const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ─── Catalogo Item ────────────────────────────────────────────────────────────
const SHOP_ITEMS = [
  // Skin Profilo
  { id: 'skin_forest', type: 'skin', name: 'Guardiano della Foresta', emoji: '🌲', description: 'Sfondo profilo verde foresta', cost: 200, rarity: 'common' },
  { id: 'skin_ocean', type: 'skin', name: 'Esploratore Marino', emoji: '🌊', description: 'Sfondo profilo oceano', cost: 300, rarity: 'rare' },
  { id: 'skin_mountain', type: 'skin', name: 'Alpinista Eco', emoji: '🏔️', description: 'Sfondo profilo montagna', cost: 400, rarity: 'rare' },
  { id: 'skin_galaxy', type: 'skin', name: 'Cosmo Verde', emoji: '🌌', description: 'Sfondo profilo galattico ecologico', cost: 800, rarity: 'epic' },
  { id: 'skin_aurora', type: 'skin', name: 'Aurora Boreale', emoji: '🌠', description: 'Sfondo con aurora boreale animata', cost: 1200, rarity: 'legendary' },

  // Avatar Title
  { id: 'title_eco_ninja', type: 'title', name: 'Eco Ninja', emoji: '🥷', description: 'Titolo profilo esclusivo', cost: 150, rarity: 'common' },
  { id: 'title_walker', type: 'title', name: 'Il Camminatore', emoji: '🚶', description: 'Per chi ama spostarsi a piedi', cost: 100, rarity: 'common' },
  { id: 'title_cyclist', type: 'title', name: 'Re della Bici', emoji: '🚴', description: 'Per i ciclisti urbani', cost: 150, rarity: 'common' },
  { id: 'title_co2_warrior', type: 'title', name: 'Guerriero CO2', emoji: '⚔️', description: 'Combatti il cambiamento climatico', cost: 500, rarity: 'epic' },
  { id: 'title_planet_savior', type: 'title', name: 'Salvatore del Pianeta', emoji: '🌍', description: 'Il massimo riconoscimento ecologico', cost: 2000, rarity: 'legendary' },

  // Trofei
  { id: 'trophy_first_step', type: 'trophy', name: 'Primo Passo', emoji: '🥉', description: 'Il trofeo di inizio viaggio', cost: 50, rarity: 'common' },
  { id: 'trophy_green_week', type: 'trophy', name: 'Settimana Verde', emoji: '🥈', description: '7 giorni di mobilità sostenibile', cost: 350, rarity: 'rare' },
  { id: 'trophy_eco_master', type: 'trophy', name: 'Eco Master', emoji: '🥇', description: 'Maestro dell\'ecologia urbana', cost: 750, rarity: 'epic' },
  { id: 'trophy_legend', type: 'trophy', name: 'Leggenda Verde', emoji: '👑', description: 'Solo per i veri campioni del pianeta', cost: 3000, rarity: 'legendary' },
];

const RARITY_COLORS = {
  common: '#6ee7b7',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fbbf24',
};

// GET /api/shop/items
router.get('/items', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('points inventory avatarSkin trophies').lean();
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    const ownedIds = user.inventory.map(i => i.itemId);

    const items = SHOP_ITEMS.map(item => ({
      ...item,
      rarityColor: RARITY_COLORS[item.rarity],
      owned: ownedIds.includes(item.id),
      canAfford: user.points >= item.cost,
    }));

    res.json({ items, userPoints: user.points });
  } catch (err) {
    console.error('[Shop/Items]', err);
    res.status(500).json({ error: 'Errore recupero catalogo' });
  }
});

// POST /api/shop/buy/:itemId
router.post('/buy/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = SHOP_ITEMS.find(i => i.id === itemId);

    if (!item) return res.status(404).json({ error: 'Articolo non trovato' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    const alreadyOwned = user.inventory.some(i => i.itemId === itemId);
    if (alreadyOwned) return res.status(409).json({ error: 'Hai già questo articolo' });

    if (user.points < item.cost) {
      return res.status(402).json({
        error: `Punti insufficienti. Ti mancano ${item.cost - user.points} punti.`,
        required: item.cost,
        current: user.points,
      });
    }

    user.points -= item.cost;
    user.inventory.push({ itemId, equippedAt: new Date() });

    // Auto-equip skin
    if (item.type === 'skin') user.avatarSkin = itemId;
    // Auto-add trophy
    if (item.type === 'trophy' && !user.trophies.includes(itemId)) {
      user.trophies.push(itemId);
    }

    await user.save();

    res.json({
      success: true,
      message: `Hai sbloccato "${item.name}"! 🎉`,
      item,
      remainingPoints: user.points,
    });
  } catch (err) {
    console.error('[Shop/Buy]', err);
    res.status(500).json({ error: 'Errore acquisto' });
  }
});

module.exports = router;
