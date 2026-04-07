const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// EcoChat AI Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Il messaggio è obbligatorio' });
    }
    
    // Get user data for personalized responses
    const user = await User.findById(req.userId);
    const recentActivities = await Activity.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Generate AI response
    const aiResponse = await generateAIResponse(message, user, recentActivities);
    
    // Update user points for eco-friendly questions
    const isEcoQuestion = isEcoFriendlyQuestion(message);
    if (isEcoQuestion) {
      const bonusPoints = Math.floor(Math.random() * 6) + 5; // 5-10 points
      user.points = (user.points || 0) + bonusPoints;
      await user.save();
      
      return res.json({
        response: aiResponse,
        pointsEarned: bonusPoints,
        totalPoints: user.points
      });
    }
    
    res.json({ response: aiResponse });
    
  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ error: 'Errore nella risposta AI' });
  }
});

// AI Response Generator
async function generateAIResponse(message, user, recentActivities) {
  const lowerMessage = message.toLowerCase();
  
  // Check for specific eco topics
  if (lowerMessage.includes('trasport') || lowerMessage.includes('spost')) {
    return getTransportAdvice(user, recentActivities);
  }
  
  if (lowerMessage.includes('energia') || lowerMessage.includes('casa')) {
    return getEnergyAdvice(user);
  }
  
  if (lowerMessage.includes('cibo') || lowerMessage.includes('aliment')) {
    return getFoodAdvice(user);
  }
  
  if (lowerMessage.includes('lavoro') || lowerMessage.includes('ufficio')) {
    return getWorkAdvice(user);
  }
  
  if (lowerMessage.includes('rifiut') || lowerMessage.includes('riciclag')) {
    return getWasteAdvice(user);
  }
  
  if (lowerMessage.includes('acqua')) {
    return getWaterAdvice(user);
  }
  
  if (lowerMessage.includes('ciao') || lowerMessage.includes('salve')) {
    return getGreeting(user, recentActivities);
  }
  
  if (lowerMessage.includes('aiuto') || lowerMessage.includes('consiglio')) {
    return getGeneralAdvice(user, recentActivities);
  }
  
  // Default response
  return getDefaultResponse(user, recentActivities);
}

function getTransportAdvice(user, activities) {
  const transportCounts = {};
  activities.forEach(activity => {
    if (activity.transport) {
      transportCounts[activity.transport] = (transportCounts[activity.transport] || 0) + 1;
    }
  });
  
  const mostUsed = Object.keys(transportCounts).reduce((a, b) => 
    transportCounts[a] > transportCounts[b] ? a : b, Object.keys(transportCounts)[0]
  );
  
  const responses = {
    walk: "Ottimo! Camminare è il modo più ecologico per spostarsi. Continua così e mantieni la tua streak! Ogni km a piedi risparmia circa 0.2 kg di CO2.",
    bike: "Perfetto! La bici è un'ottima alternativa all'auto. Risparmi circa 0.15 kg di CO2 per km e mantieni la forma fisica. Hai considerato di usarla per il tragitto casa-lavoro?",
    bus: "Bene! L'autobus è più sostenibile dell'auto. Prova a combinare i mezzi pubblici con una breve passeggiata per massimizzare l'impatto positivo!",
    car: "Notiamo che usi spesso l'auto. Anche piccoli cambiamenti fanno la differenza: prova il carpooling o sostituisci qualche viaggio con i mezzi pubblici. Ogni km risparmiato conta!",
    default: "Per i trasporti, privilegia mezzi come bici, trasporti pubblici o carpooling. Ogni scelta sostenibile aiuta a ridurre l'impatto ambientale!"
  };
  
  return responses[mostUsed] || responses.default;
}

function getEnergyAdvice(user) {
  return "Per risparmiare energia in casa: usa lampadine LED, spegli gli apparecchi in standby, imposta il termostato a 19°C in inverno e 26°C in estate. Questi piccoli gesti possono ridurre i consumi fino al 30%!";
}

function getFoodAdvice(user) {
  return "Per un'alimentazione sostenibile: privilegia prodotti locali e di stagione, riduci il consumo di carne (soprattutto rossa), evita gli sprechi pianificando i pasti e compostando gli scarti organici. Ogni pasto consapevole aiuta il pianeta!";
}

function getWorkAdvice(user) {
  return "In ufficio: spegni computer e luci quando non servono, usa stampanti solo se necessario, porta una borraccia riutilizzabile, organizza carpooling con i colleghi. L'ufficio sostenibile inizia da piccoli gesti quotidiani!";
}

function getWasteAdvice(user) {
  return "Per i rifiuti: ricicla correttamente carta, plastica, vetro e metallo. Composta gli scarti organici. Riduci gli imballaggi scegliendo prodotti sfusi o con imballaggi minimi. Ricorda: la migliore gestione dei rifiuti è non produrli!";
}

function getWaterAdvice(user) {
  return "Per risparmiare acqua: fai docce brevi (5 minuti), ripara subito le perdite, usa lavatrici e lavastoviglie solo a pieno carico, raccogli l'acqua piovana per le piante. Ogni goccia conta per il nostro pianeta!";
}

function getGreeting(user, activities) {
  const streak = user.streak || 0;
  const points = user.points || 0;
  
  if (streak > 7) {
    return `Ciao ${user.name}! Sono l'assistente AI di VERDENT. Complimenti per la tua streak di ${streak} giorni! Sei un vero guerriero verde con ${points} stelle! In cosa posso aiutarti oggi?`;
  }
  
  return `Ciao ${user.name}! Sono l'assistente AI di VERDENT. Hai ${points} stelle e una streak di ${streak} giorni. Chiedimi qualsiasi cosa su sostenibilità, ecologia o come ridurre la tua impronta di CO2!`;
}

function getGeneralAdvice(user, activities) {
  const recentGreen = activities.filter(a => 
    ['walk', 'bike', 'bus', 'tram'].includes(a.transport)
  ).length;
  
  if (recentGreen === 0) {
    return "Non vediamo attività green da un po'! Domani prova ad andare al lavoro in bici o usare i mezzi pubblici. Ogni piccolo gesto fa la differenza e ti farà guadagnare stelle bonus! ";
  }
  
  if (recentGreen < 3) {
    return "Buon inizio! Continua a scegliere mezzi sostenibili. Prova ad aumentare gradualmente le attività green: ogni trasporto eco-friendly ti fa guadagnare punti e aiuta l'ambiente!";
  }
  
  return "Ottimo lavoro! Stai facendo bene con i trasporti sostenibili. Per migliorare ancora, prova a ridurre i consumi energetici a casa o a fare scelte alimentari più consapevoli!";
}

function getDefaultResponse(user, activities) {
  return "Sono qui per aiutarti a vivere in modo più sostenibile! Posso darti consigli su trasporti, energia, alimentazione, riciclaggio e molto altro. Chiedimi pure qualsiasi cosa su ecologia e ambiente! ";
}

function isEcoFriendlyQuestion(message) {
  const ecoKeywords = [
    'eco', 'sostenibile', 'ambiente', 'verde', 'co2', 'carbonio',
    'inquinamento', 'riciclo', 'energia', 'trasport', 'cibo', 'rifiut',
    'acqua', 'clima', 'emission', 'impatto', 'pianeta'
  ];
  
  const lowerMessage = message.toLowerCase();
  return ecoKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Get AI tip for dashboard
router.get('/tip', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const recentActivities = await Activity.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(5);
    
    const tip = await generateAIResponse("dammi un consiglio", user, recentActivities);
    
    res.json({ tip });
  } catch (error) {
    console.error('AI Tip error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del suggerimento' });
  }
});

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
