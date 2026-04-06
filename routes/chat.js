const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ─── Filtro bestemmie / parolacce (IT + EN) ────────────────────────────────
const BAD_WORDS = [
  'cazzo','caz','cazz','vaffanculo','vaffa','fanculo','fottiti','stronzo','stronza',
  'minchia','puttana','troia','bastardo','bastarda','coglione','cogliona','merda',
  'culo','figlio di puttana','porco dio','porco','gesù','madonnina','madonna puttana',
  'fuck','shit','bitch','asshole','bastard','cunt','dick','pussy','nigger',
];

const CONTAINS_BAD_WORD = (text) => {
  const lower = text.toLowerCase().replace(/[^a-zàáèéìíòóùú\s]/gi, '');
  return BAD_WORDS.some(w => lower.includes(w));
};

// ─── AI Eco-Tips Mock Engine ───────────────────────────────────────────────
const ECO_TIPS = {
  trasporti: [
    "Usare i mezzi pubblici invece dell'auto riduce le emissioni di CO2 fino all'80%. Considera l'abbonamento mensile!",
    "Il carpooling con 3 persone divide le emissioni per 3. Proponi ai colleghi un accordo settimanale.",
    "La bici è zero emissioni e fa bene alla salute. Per distanze fino a 10km è spesso più veloce dell'auto in città.",
    "Il treno emette circa 14g CO2/km vs 170g dell'auto. Per viaggi > 50km è la scelta migliore.",
    "Volare è il mezzo più inquinante: un volo Roma-Milano emette ~150kg CO2. Considera l'Italo o Frecciarossa.",
  ],
  casa: [
    "Abbassare il riscaldamento di 1°C riduce i consumi del 7%. 19°C in casa è la temperatura consigliata.",
    "Sostituire le lampadine con LED fa risparmiare fino all'80% di energia elettrica.",
    "Lavarsi a 30°C invece di 60°C riduce il consumo energetico della lavatrice del 40%.",
    "Un frigorifero vecchio consuma 3 volte di più di un modello A+++. Vale l'investimento.",
    "Schermare le finestre d'estate riduce il condizionamento del 25%.",
  ],
  alimentazione: [
    "Ridurre la carne rossa di 3 pasti a settimana equivale a non usare l'auto per 3 mesi.",
    "Comprare prodotti locali e di stagione riduce le emissioni di trasporto fino al 90%.",
    "Una dieta vegana emette circa 1.5 ton CO2/anno vs 2.5 ton di una dieta onnivora.",
    "Evitare lo spreco alimentare: il 30% del cibo prodotto viene buttato. Pianifica gli acquisti!",
  ],
  lavoro: [
    "1 giorno di smart working a settimana riduce le tue emissioni di pendolarismo del 20%.",
    "Le videoconferenze invece dei viaggi aziendali riducono le emissioni di punta del 90%.",
    "Spegnere il PC invece di lasciarlo in standby risparmia fino a 40W continui.",
    "Stampare fronte-retro e in bianco/nero riduce il consumo di carta e toner del 50%.",
  ],
  generale: [
    "Ogni persona produce in media 8 ton di CO2/anno. Con piccoli cambiamenti puoi ridurlo del 30%!",
    "Riparare invece di comprare nuovo è la pratica più ecologica. L'economia circolare salva il pianeta.",
    "Acquistare usato riduce le emissioni di produzione del 60-80% rispetto al nuovo.",
    "La compensazione CO2 (tree planting) è utile, ma la riduzione alla fonte è sempre meglio.",
  ],
};

function getEcoResponse(userMessage) {
  const msg = userMessage.toLowerCase();
  let category = 'generale';
  if (/auto|macchina|bici|treno|aereo|mezzo|trasport|carpooling|guida/.test(msg)) category = 'trasporti';
  else if (/casa|riscaldamento|luce|energia|lavatrice|elettrodomest/.test(msg)) category = 'casa';
  else if (/carne|cibo|alimenta|mangiare|vegan|verdura|frutta/.test(msg)) category = 'alimentazione';
  else if (/lavoro|ufficio|smart|remoto|meeting|riunione|stampa/.test(msg)) category = 'lavoro';

  const tips = ECO_TIPS[category];
  const tip = tips[Math.floor(Math.random() * tips.length)];

  const isEcoQuestion = /co2|carb|emiss|ecolo|sost|green|inquina|risparm|clim|ambie|pianeta|natura|ricicl/.test(msg);

  return { tip, category, isEcoQuestion };
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Messaggio vuoto' });
    }
    if (message.length > 500) {
      return res.status(400).json({ error: 'Messaggio troppo lungo (max 500 caratteri)' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    // ─── Moderazione ─────────────────────────────────────────────────────────
    if (CONTAINS_BAD_WORD(message)) {
      const penalty = 50;
      user.stars  = Math.max(0, (user.stars || 0) - penalty);
      user.points = user.stars;
      await user.save();

      return res.status(200).json({
        moderated: true,
        penalty,
        message: `⚠️ Linguaggio non consentito rilevato. Hai perso ${penalty} stelle. VERDENT promuove un ambiente rispettoso!`,
        remainingStars: user.stars,
      });
    }

    // ─── Risposta AI ──────────────────────────────────────────────────────────
    const { tip, category, isEcoQuestion } = getEcoResponse(message);

    // ─── Gamification ─────────────────────────────────────────────────────────
    let starsEarned = 0;
    let bonusMessage = '';
    if (isEcoQuestion) {
      starsEarned = Math.floor(Math.random() * 6) + 5; // 5–10 stelle
      user.stars  = (user.stars || 0) + starsEarned;
      user.points = user.stars;
      await user.save();
      bonusMessage = `+${starsEarned} stelle guadagnate per questa domanda ecologica! 🌿`;
    }

    res.json({
      reply: tip,
      category,
      isEcoQuestion,
      starsEarned,
      bonusMessage,
      totalStars: user.stars,
    });
  } catch (err) {
    console.error('[Chat/POST]', err);
    res.status(500).json({ error: 'Errore nella chat AI' });
  }
});

module.exports = router;
