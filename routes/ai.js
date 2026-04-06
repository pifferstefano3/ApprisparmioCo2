const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ─── Mock AI Engine ───────────────────────────────────────────────────────────

const TRANSPORT_LABELS = {
  walk: 'a piedi', bike: 'in bici', bus: 'in autobus',
  tram: 'in tram', carpool: 'in carpooling', carpool_ai: 'in carpooling AI',
  car: 'in auto', airplane: 'in aereo',
};

const SUGGESTIONS = {
  noGreenRecently: [
    "Non vediamo attività green da un po'! Domani prova ad andare al lavoro in bici: guadagni il doppio delle stelle 🌿",
    "Questa settimana hai usato l'auto spesso. Un solo giorno a piedi farebbe una grande differenza per l'ambiente!",
    "Sei a un passo dall'interrompere la tua streak. Domani scegli un mezzo sostenibile e mantieni viva la serie!",
  ],
  goodStreak: [
    "Ottimo lavoro! Sei in streak da {streak} giorni consecutivi. Continua così per sbloccare il trofeo 'Guerriero Verde'!",
    "Impressionante! {streak} giorni di mobilità sostenibile. L'AI ha aumentato i tuoi bonus punti del 20%!",
    "La tua streak di {streak} giorni ti mette nella top 10% degli utenti più ecologici. Sei un esempio!",
  ],
  airplaneWarning: [
    "Hai preso l'aereo di recente. L'aereo emette ~255g CO2/km, 1.5x più dell'auto. Valuta il treno per le prossime tratte!",
    "Il tuo ultimo volo ha generato CO2 extra. Compensa prendendo mezzi green per le prossime settimane!",
    "Un volo Roma-Milano emette ~150kg CO2. Con il treno ne emetti solo 6kg. Considera l'alternativa ferroviaria!",
  ],
  carpoolingAdvice: [
    "Hai fatto {carTrips} viaggi in auto questa settimana. Usa il Carpooling AI con almeno 3 passeggeri per dimezzare le emissioni!",
    "Il carpooling con 4 persone riduce le emissioni a soli 42g/km a testa vs 170g in auto singola. Proponi ai colleghi!",
    "L'AI suggerisce: per i tuoi spostamenti abituali, organizza un carpooling settimanale. Risparmi CO2 e carburante!",
  ],
  favoritTransport: [
    "Usi spesso {transport}. Hai mai provato {alternative}? Potresti guadagnare fino a {points} stelle extra!",
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

function getRandomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
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
      return res.json({ tip: getRandomItem(SUGGESTIONS.firstActivity), type: 'welcome', confidence: 1.0 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentWeek   = recentActivities.filter(a => new Date(a.createdAt) >= sevenDaysAgo);
    const greenThisWeek = recentWeek.filter(a => !['car','airplane'].includes(a.transport));
    const carTrips      = recentWeek.filter(a => a.transport === 'car').length;
    const airplaneTrips = recentActivities.filter(a => a.transport === 'airplane').length;

    const transportCount = {};
    recentActivities.forEach(a => { transportCount[a.transport] = (transportCount[a.transport] || 0) + 1; });
    const favTransport = Object.entries(transportCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'car';

    const streak         = user?.streak?.current || 0;
    const co2Saved       = user?.co2Saved || 0;
    const kmSustainable  = user?.kmSustainable || 0;

    let tip, type;

    if (airplaneTrips > 0) {
      tip  = getRandomItem(SUGGESTIONS.airplaneWarning);
      type = 'airplane_warning';
    } else if (streak >= 5) {
      tip  = interpolate(getRandomItem(SUGGESTIONS.goodStreak), { streak });
      type = 'streak';
    } else if (carTrips >= 3) {
      tip  = interpolate(getRandomItem(SUGGESTIONS.carpoolingAdvice), { carTrips });
      type = 'carpool_suggestion';
    } else if (greenThisWeek.length === 0) {
      tip  = getRandomItem(SUGGESTIONS.noGreenRecently);
      type = 'motivation';
    } else if (co2Saved >= 5 || kmSustainable >= 50) {
      const trees = Math.round(co2Saved / 21);
      tip  = interpolate(getRandomItem(SUGGESTIONS.milestones), {
        co2: co2Saved.toFixed(1), trees: Math.max(1, trees), km: Math.round(kmSustainable),
      });
      type = 'milestone';
    } else {
      const alternatives = { walk:'bici', bike:'mezzi pubblici', bus:'bici', tram:'piedi', carpool:'tram', carpool_ai:'tram', car:'bici', airplane:'treno' };
      const altStars     = { walk:15, bike:8, bus:15, tram:20, carpool:10, carpool_ai:8, car:25, airplane:50 };
      tip  = interpolate(getRandomItem(SUGGESTIONS.favoritTransport), {
        transport:   TRANSPORT_LABELS[favTransport] || favTransport,
        alternative: alternatives[favTransport] || 'bici',
        points:      altStars[favTransport] || 15,
      });
      type = 'suggestion';
    }

    res.json({
      tip, type,
      stats: { greenTripsThisWeek: greenThisWeek.length, carTripsThisWeek: carTrips, airplaneTrips, streak, favoriteTransport: favTransport },
      confidence: 0.85,
    });
  } catch (err) {
    console.error('[AI/Analyze]', err);
    res.status(500).json({ error: 'Errore analisi AI' });
  }
});

// POST /api/ai/score-trip — Calcola bonus stelle AI per un viaggio
router.post('/score-trip', async (req, res) => {
  try {
    const { transport, distanceKm, weather = 'unknown', passengers = 1 } = req.body;

    if (!transport || !distanceKm) {
      return res.status(400).json({ error: 'transport e distanceKm obbligatori' });
    }

    // Aereo non genera bonus stelle
    if (transport === 'airplane') {
      return res.json({
        aiBonus: 0, reasons: [],
        message: '⚠️ L\'aereo emette molta CO2. Nessun bonus assegnato. Valuta alternative!',
        carpoolingAdvice: null,
      });
    }

    const user   = await User.findById(req.userId).lean();
    const streak = user?.streak?.current || 0;

    let bonus   = 0;
    let reasons = [];

    // Rarità mezzo
    const rarityBonus = { walk:1.5, bike:1.3, tram:1.1, bus:1.0, carpool:0.9, carpool_ai:1.2, car:0 };
    const rarityMult  = rarityBonus[transport] || 1.0;

    // Bonus distanza
    if (distanceKm > 2 && transport !== 'car') {
      const dBonus = Math.floor((distanceKm - 2) / 5) * 5;
      if (dBonus > 0) { bonus += dBonus; reasons.push(`+${dBonus} stelle distanza lunga`); }
    }

    // Bonus maltempo
    if (['rainy','snowy'].includes(weather) && transport !== 'car') {
      bonus += 15; reasons.push('+15 stelle maltempo');
    }

    // Bonus streak
    if (streak >= 3) {
      const sBonus = Math.min(30, streak * 2);
      bonus += sBonus; reasons.push(`+${sBonus} stelle streak ${streak} giorni`);
    }

    // Bonus carpooling AI (passeggeri)
    let carpoolingAdvice = null;
    if (transport === 'carpool_ai') {
      const pax = Math.max(1, parseInt(passengers) || 1);
      const carpoolBonus = Math.round((pax - 1) * 8);
      if (carpoolBonus > 0) { bonus += carpoolBonus; reasons.push(`+${carpoolBonus} stelle carpooling (${pax} passeggeri)`); }
      const co2PerPerson = (170 / pax).toFixed(0);
      carpoolingAdvice = `Con ${pax} passeggeri emetti solo ~${co2PerPerson}g CO2/km a testa (vs 170g in auto singola). Risparmio del ${Math.round((1 - 1/pax)*100)}%!`;
    }

    // Applica rarità
    if (transport !== 'car') bonus = Math.round(bonus * rarityMult);

    // Prima volta con questo mezzo
    const prev = await Activity.countDocuments({ userId: req.userId, transport });
    if (prev === 0 && transport !== 'car') { bonus += 25; reasons.push('+25 stelle primo viaggio con questo mezzo!'); }

    bonus = Math.min(bonus, 100);

    res.json({
      aiBonus: bonus, reasons, multiplier: rarityMult, carpoolingAdvice,
      message: bonus > 0
        ? `L'AI ti assegna ${bonus} stelle bonus! ${reasons.join(', ')}`
        : 'Stelle base assegnate.',
    });
  } catch (err) {
    console.error('[AI/ScoreTrip]', err);
    res.status(500).json({ error: 'Errore calcolo bonus AI' });
  }
});

module.exports = router;
