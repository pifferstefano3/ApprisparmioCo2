const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Activity = require('../models/Activity');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ─── Sfide mensili generate dall'AI mock ─────────────────────────────────────
const MONTHLY_CHALLENGES = [
  {
    id: 'bike_50km',
    title: 'Ciclista Urbano',
    description: 'Percorri 50km in bici durante questo mese.',
    metric: 'bike_km',
    target: 50,
    unit: 'km',
    reward: 'Giorno libero extra + 500 stelle',
    rewardStars: 500,
    icon: '🚴',
  },
  {
    id: 'walk_30km',
    title: 'Camminatore Verde',
    description: 'Percorri 30km a piedi questo mese.',
    metric: 'walk_km',
    target: 30,
    unit: 'km',
    reward: 'Buono pasto ecologico + 300 stelle',
    rewardStars: 300,
    icon: '🚶',
  },
  {
    id: 'no_car_5days',
    title: 'Settimana senza auto',
    description: 'Registra 5 spostamenti senza usare l\'auto.',
    metric: 'green_trips',
    target: 5,
    unit: 'viaggi',
    reward: 'Badge "Eco Warrior" + 400 stelle',
    rewardStars: 400,
    icon: '🌿',
  },
  {
    id: 'co2_save_5kg',
    title: 'Risparmia 5kg CO2',
    description: 'Risparmia almeno 5kg di CO2 con i tuoi spostamenti.',
    metric: 'co2_saved',
    target: 5,
    unit: 'kg CO2',
    reward: 'Trofeo digitale "Green Champion" + 600 stelle',
    rewardStars: 600,
    icon: '🌍',
  },
  {
    id: 'streak_7days',
    title: '7 giorni consecutivi',
    description: 'Mantieni una streak di 7 giorni consecutivi.',
    metric: 'streak',
    target: 7,
    unit: 'giorni',
    reward: 'Skin profilo esclusiva + 750 stelle',
    rewardStars: 750,
    icon: '🔥',
  },
  {
    id: 'public_transit_10trips',
    title: 'Pendolare Eco',
    description: 'Usa i mezzi pubblici 10 volte questo mese.',
    metric: 'transit_trips',
    target: 10,
    unit: 'viaggi',
    reward: 'Abbonamento mensile rimborsato (50€) + 400 stelle',
    rewardStars: 400,
    icon: '🚌',
  },
  {
    id: 'carpool_3trips',
    title: 'Re del Carpooling',
    description: 'Condividi l\'auto 3 volte con altri utenti.',
    metric: 'carpool_trips',
    target: 3,
    unit: 'viaggi',
    reward: 'Sconto carburante 30% + 250 stelle',
    rewardStars: 250,
    icon: '🚗',
  },
  {
    id: 'feed_3posts',
    title: 'EcoInfluencer',
    description: 'Pubblica 3 post nel feed ecologico.',
    metric: 'posts',
    target: 3,
    unit: 'post',
    reward: 'Titolo "EcoInfluencer" + 200 stelle',
    rewardStars: 200,
    icon: '📸',
  },
  {
    id: 'chat_eco',
    title: 'Curioso Ecologico',
    description: 'Fai 10 domande ecologiche alla EcoChat AI.',
    metric: 'eco_questions',
    target: 10,
    unit: 'domande',
    reward: 'Cornice profilo esclusiva + 150 stelle',
    rewardStars: 150,
    icon: '🤖',
  },
  {
    id: 'multi_transport',
    title: 'Esploratore Multimodale',
    description: 'Usa almeno 4 mezzi di trasporto diversi nel mese.',
    metric: 'transport_types',
    target: 4,
    unit: 'mezzi diversi',
    reward: 'Avatar "Esploratore" + 350 stelle',
    rewardStars: 350,
    icon: '🗺️',
  },
  {
    id: 'km_total_100',
    title: 'Centenario Verde',
    description: 'Percorri 100km totali in modo sostenibile.',
    metric: 'total_km',
    target: 100,
    unit: 'km',
    reward: 'Trofeo "Centenario Verde" + 1000 stelle',
    rewardStars: 1000,
    icon: '💯',
  },
  {
    id: 'no_airplane',
    title: 'Terra Ferma',
    description: 'Non prendere aerei per tutto il mese.',
    metric: 'no_airplane',
    target: 1,
    unit: 'mese',
    reward: 'Badge "Piedi per Terra" + 300 stelle',
    rewardStars: 300,
    icon: '✈️',
  },
];

// Seleziona sfida del mese deterministicamente (cambia ogni mese)
function getCurrentChallenge() {
  const now = new Date();
  const monthIndex = now.getFullYear() * 12 + now.getMonth();
  const challenge = MONTHLY_CHALLENGES[monthIndex % MONTHLY_CHALLENGES.length];

  // Calcola scadenza (ultimo giorno del mese)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const msLeft = lastDay - now;
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  return { ...challenge, deadline: lastDay.toISOString(), daysLeft };
}

// Calcola progresso utente per la sfida corrente
async function calcProgress(userId, challenge) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const activities = await Activity.find({
      userId,
      createdAt: { $gte: startOfMonth },
    }).lean();

    switch (challenge.metric) {
      case 'bike_km':
        return activities.filter(a => a.transport === 'bike').reduce((s, a) => s + a.distanceKm, 0);
      case 'walk_km':
        return activities.filter(a => a.transport === 'walk').reduce((s, a) => s + a.distanceKm, 0);
      case 'green_trips':
        return activities.filter(a => a.transport !== 'car' && a.transport !== 'airplane').length;
      case 'co2_saved':
        return activities.reduce((s, a) => s + Math.max(0, a.co2Saved || 0), 0);
      case 'streak': {
        const user = await User.findById(userId).select('streak').lean();
        return user?.streak?.current || 0;
      }
      case 'transit_trips':
        return activities.filter(a => ['bus','tram'].includes(a.transport)).length;
      case 'carpool_trips':
        return activities.filter(a => ['carpool','carpool_ai'].includes(a.transport)).length;
      case 'posts': {
        const Post = require('../models/Post');
        return Post.countDocuments({ userId, createdAt: { $gte: startOfMonth } });
      }
      case 'transport_types': {
        const types = new Set(activities.map(a => a.transport));
        types.delete('car');
        types.delete('airplane');
        return types.size;
      }
      case 'total_km':
        return activities.filter(a => a.transport !== 'car' && a.transport !== 'airplane').reduce((s, a) => s + a.distanceKm, 0);
      case 'no_airplane':
        return activities.some(a => a.transport === 'airplane') ? 0 : 1;
      case 'eco_questions':
        return 0; // non tracciato nel DB, ritorna 0
      default:
        return 0;
    }
  } catch { return 0; }
}

// GET /api/challenges
router.get('/', async (req, res) => {
  try {
    const challenge = getCurrentChallenge();
    const progress = await calcProgress(req.userId, challenge);
    const progressPct = Math.min(100, Math.round((progress / challenge.target) * 100));
    const completed = progress >= challenge.target;

    res.json({
      challenge,
      progress: parseFloat(progress.toFixed(2)),
      progressPct,
      completed,
    });
  } catch (err) {
    console.error('[Challenges/GET]', err);
    res.status(500).json({ error: 'Errore sfide' });
  }
});

module.exports = router;
