const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Shop items
const SHOP_ITEMS = [
  {
    id: '1',
    name: 'Badge Eco-Novice',
    description: 'Il tuo primo badge ecologico',
    price: 50,
    type: 'badge',
    image: '/assets/badges/novice.png'
  },
  {
    id: '2',
    name: 'Badge Eco-Warrior',
    description: 'Dimostra il tuo impegno per l\'ambiente',
    price: 200,
    type: 'badge',
    image: '/assets/badges/warrior.png'
  },
  {
    id: '3',
    name: 'Badge Eco-Master',
    description: 'Per i veri esperti di sostenibilità',
    price: 500,
    type: 'badge',
    image: '/assets/badges/master.png'
  },
  {
    id: '4',
    name: 'Badge Eco-Legend',
    description: 'Il massimo riconoscimento ecologico',
    price: 1000,
    type: 'badge',
    image: '/assets/badges/legend.png'
  },
  {
    id: '5',
    name: 'Avatar Verde',
    description: 'Sfondo avatar ecologico',
    price: 100,
    type: 'avatar',
    image: '/assets/avatars/green.png'
  },
  {
    id: '6',
    name: 'Avatar Blu',
    description: 'Sfondo avatar oceano',
    price: 100,
    type: 'avatar',
    image: '/assets/avatars/blue.png'
  },
  {
    id: '7',
    name: 'Avatar Oro',
    description: 'Sfondo avatar premium',
    price: 300,
    type: 'avatar',
    image: '/assets/avatars/gold.png'
  }
];

// GET /api/shop - Get all shop items
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json({
      items: SHOP_ITEMS,
      userPoints: user.points
    });
  } catch (error) {
    console.error('Get shop items error:', error);
    res.status(500).json({ error: 'Errore nel caricamento degli articoli' });
  }
});

// POST /api/shop/purchase - Purchase an item
router.post('/purchase', async (req, res) => {
  try {
    const { itemId } = req.body;
    const userId = req.userId;

    if (!itemId) {
      return res.status(400).json({ error: 'ID articolo obbligatorio' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const item = SHOP_ITEMS.find(item => item.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Articolo non trovato' });
    }

    if (user.points < item.price) {
      return res.status(400).json({ error: 'Punti insufficienti' });
    }

    // Check if user already owns this item
    if (user.inventory && user.inventory.some(inv => inv.itemId === itemId)) {
      return res.status(400).json({ error: 'Hai già questo articolo' });
    }

    // Deduct points and add item to inventory
    user.points -= item.price;
    user.inventory.push({
      itemId: item.id,
      equippedAt: new Date()
    });

    await user.save();

    res.json({
      message: 'Acquisto effettuato con successo',
      item: item,
      remainingPoints: user.points
    });
  } catch (error) {
    console.error('Purchase item error:', error);
    res.status(500).json({ error: 'Errore nell\'acquisto dell\'articolo' });
  }
});

// POST /api/shop/equip - Equip an item
router.post('/equip', async (req, res) => {
  try {
    const { itemId } = req.body;
    const userId = req.userId;

    if (!itemId) {
      return res.status(400).json({ error: 'ID articolo obbligatorio' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Check if user owns this item
    if (!user.inventory || !user.inventory.some(inv => inv.itemId === itemId)) {
      return res.status(400).json({ error: 'Non possiedi questo articolo' });
    }

    // Update equipped time
    user.inventory = user.inventory.map(inv => {
      if (inv.itemId === itemId) {
        inv.equippedAt = new Date();
      }
      return inv;
    });

    await user.save();

    res.json({
      message: 'Articolo equipaggiato con successo',
      itemId: itemId
    });
  } catch (error) {
    console.error('Equip item error:', error);
    res.status(500).json({ error: 'Errore nell\'equipaggiamento dell\'articolo' });
  }
});

// GET /api/shop/inventory - Get user's inventory
router.get('/inventory', async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const inventoryItems = user.inventory.map(inv => {
      const item = SHOP_ITEMS.find(shopItem => shopItem.id === inv.itemId);
      return {
        ...item,
        equippedAt: inv.equippedAt
      };
    });

    res.json({
      inventory: inventoryItems
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dell\'inventario' });
  }
});

module.exports = router;
