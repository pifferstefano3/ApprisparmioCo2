const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ─── Mock AI Engine ───────────────────────────────────────────────────────────

const TRANSPORT_LABELS = {
  walk: 'a piedi', bike: 'in bici', bus: 'in autobus',
  tram: 'in tram', carpool: 'in carpooling', car: 'in auto',
};

const SUGGESTIONS = {
  noGreenRecently: [
    "Non vediamo attività green da un po'! Domani prova ad andare al lavoro in bici: guadagni il doppio dei punti 🌿",
    "Questa settimana hai usato l'auto spesso. Un solo giorno a piedi farebbe una grande differenza per l'ambiente!",
    "Sei a un passo dall'interrompere la tua streak. Domani scegli un mezzo sostenibile e mantieni viva la serie!",
  ],
  goodStreak: [
    "Ottimo lavoro! Sei in streak da {streak} giorni consecutivi. Continua così per sbloccare il trofeo 'Guerriero Verde'!",
    "Impressionante! {streak} giorni di mobilità sostenibile. L'AI ha aumentato i tuoi bonus punti del 20%!",
    "La tua streak di {streak} giorni ti mette nella top 10% degli utenti più ecologici. Sei un esempio!",
  ],
  favoritTransport: [
    "Usi spesso {transport}. Hai mai provato {alternative}? Potresti guadagnare fino a {points} punti extra!",
    "Il tuo mezzo preferito è {transport}. Ottima scelta! Prova a combinarlo con {alternative} per i percorsi brevi.",
  ],
  firstActivity: [
    "Benvenuto in VERDENT! Hai appena iniziato il tuo viaggio ecologico. Ogni passo conta per il pianeta 🌍",
    "Prima attività registrata! L'AI sta già analizzando i tuoi pattern per darti suggerimenti personalizzati.",
  ],
  milestones: [
    "Hai risparmiato più di {co2}kg di CO2! È come aver piantato {trees} alberi. Straordinario!",
    "Hai percorso {km}km in modo sostenibile. Stai davvero facendo la differenza!",
  ],
};

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// GET /api/ai/analyze — Analizza pattern e genera suggerimento
router.get('/analyze', async (req, res) => {
  try {
    const [recentActivities, user] = await Promise.all([
      Activity.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(14).lean(),
      User.findById(req.userId).lean(),
    ]);

    if (!recentActivities.length) {
      return res.json({
        tip: getRandomItem(SUGGESTIONS.firstActivity),
        type: 'welcome',
        confidence: 1.0,
      });
    }

    // Analisi pattern ultimi 7 giorni
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentWeek = recentActivities.filter(a => new Date(a.createdAt) >= sevenDaysAgo);
    const greenThisWeek = recentWeek.filter(a => a.transport !== 'car');
    const carTrips = recentWeek.filter(a => a.transport === 'car').length;

    // Conta frequenza mezzi
    const transportCount = {};
    recentActivities.forEach(a => {
      transportCount[a.transport] = (transportCount[a.transport] || 0) + 1;
    });
    const favTransport = Object.entries(transportCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'car';

    const streak = user?.streak?.current || 0;
    const co2Saved = user?.co2Saved || 0;
    const kmSustainable = user?.kmSustainable || 0;

    let tip, type;

    // Logica priorità suggerimenti
    if (streak >= 5) {
      tip = interpolate(getRandomItem(SUGGESTIONS.goodStreak), { streak });
      type = 'streak';
    } else if (carTrips >= 3 || greenThisWeek.length === 0) {
      tip = getRandomItem(SUGGESTIONS.noGreenRecently);
      type = 'motivation';
    } else if (co2Saved >= 5 || kmSustainable >= 50) {
      const trees = Math.round(co2Saved / 21);
      tip = interpolate(getRandomItem(SUGGESTIONS.milestones), {
        co2: co2Saved.toFixed(1),
        trees: Math.max(1, trees),
        km: Math.round(kmSustainable),
      });
      type = 'milestone';
    } else {
      const alternatives = { walk: 'bici', bike: 'mezzi pubblici', bus: 'bici', tram: 'piedi', carpool: 'tram', car: 'bici' };
      const altPoints = { walk: 15, bike: 8, bus: 15, tram: 20, carpool: 10, car: 25 };
      tip = interpolate(getRandomItem(SUGGESTIONS.favoritTransport), {
        transport: TRANSPORT_LABELS[favTransport] || favTransport,
        alternative: alternatives[favTransport] || 'bici',
        points: altPoints[favTransport] || 15,
      });
      type = 'suggestion';
    }

    res.json({
      tip,
      type,
      stats: {
        greenTripsThisWeek: greenThisWeek.length,
        carTripsThisWeek: carTrips,
        streak,
        favoriteTransport: favTransport,
      },
      confidence: 0.85,
    });
  } catch (err) {
    console.error('[AI/Analyze]', err);
    res.status(500).json({ error: 'Errore analisi AI' });
  }
});

// POST /api/ai/score-trip — Calcola bonus punti AI per un viaggio
router.post('/score-trip', async (req, res) => {
  try {
    const { transport, distanceKm, weather = 'unknown' } = req.body;

    if (!transport || !distanceKm) {
      return res.status(400).json({ error: 'transport e distanceKm obbligatori' });
    }

    const user = await User.findById(req.userId).lean();
    const streak = user?.streak?.current || 0;

    let bonus = 0;
    let reasons = [];

    // Moltiplicatore mezzo raro
    const rarityBonus = { walk: 1.5, bike: 1.3, tram: 1.1, bus: 1.0, carpool: 0.9, car: 0 };
    const rarityMult = rarityBonus[transport] || 1.0;

    // Bonus distanza (ogni 5km aggiuntivi oltre 2km)
    if (distanceKm > 2 && transport !== 'car') {
      const distanceBonus = Math.floor((distanceKm - 2) / 5) * 5;
      bonus += distanceBonus;
      if (distanceBonus > 0) reasons.push(`+${distanceBonus}pt distanza lunga`);
    }

    // Bonus meteo avverso
    if (['rainy', 'snowy'].includes(weather) && transport !== 'car') {
      bonus += 15;
      reasons.push('+15pt maltempo');
    }

    // Bonus streak
    if (streak >= 3) {
      const streakBonus = Math.min(30, streak * 2);
      bonus += streakBonus;
      reasons.push(`+${streakBonus}pt streak ${streak} giorni`);
    }

    // Applica rarità
    if (transport !== 'car') {
      bonus = Math.round(bonus * rarityMult);
    }

    // Bonus prima volta con questo mezzo
    const prevActivities = await Activity.countDocuments({ userId: req.userId, transport });
    if (prevActivities === 0 && transport !== 'car') {
      bonus += 25;
      reasons.push('+25pt primo viaggio con questo mezzo!');
    }

    // Clamp max bonus
    bonus = Math.min(bonus, 100);

    res.json({
      aiBonus: bonus,
      reasons,
      multiplier: rarityMult,
      message: bonus > 0
        ? `L'AI ti assegna ${bonus} punti bonus! ${reasons.join(', ')}`
        : transport === 'car' ? 'Nessun bonus per i viaggi in auto privata.' : 'Punti base assegnati.',
    });
  } catch (err) {
    console.error('[AI/ScoreTrip]', err);
    res.status(500).json({ error: 'Errore calcolo bonus AI' });
  }
});

module.exports = router;
