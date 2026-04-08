const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Activity = require('../models/Activity');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// AI Eco-Tips Mock Engine
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
    "Riciclare una lattina risparmia energia sufficiente per guardare TV per 3 ore.",
    "Spegnere le luci quando esci da una stanza riduce il consumo annuale del 10%.",
    "Usare borracce riutilizzabili invece di bottiglie di plastica riduce i rifiuti di 150 bottiglie/anno.",
  ]
};

// POST /api/ai/chat - AI chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.userId;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Il messaggio è obbligatorio' });
    }

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Get recent activities for context
    const recentActivities = await Activity.getUserActivities(userId, 5);

    // Generate AI response
    const aiResponse = await generateAIResponse(message, user, recentActivities);

    // Award bonus points for eco-friendly questions
    const isEcoQuestion = /trasporti|auto|bike|bus|treno|co2|energia|ambiente|ecologico|sostenibile/i.test(message);
    if (isEcoQuestion) {
      user.points += 5;
      user.updateHonorTitle();
      await user.save();
    }

    res.json({
      response: aiResponse,
      bonusPointsAwarded: isEcoQuestion ? 5 : 0
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Errore nella risposta AI' });
  }
});

// Generate AI response based on message and context
async function generateAIResponse(message, user, recentActivities) {
  const lowerMessage = message.toLowerCase();

  // Check for specific topics
  if (lowerMessage.includes('trasporti') || lowerMessage.includes('auto') || lowerMessage.includes('bike')) {
    const randomTip = ECO_TIPS.trasporti[Math.floor(Math.random() * ECO_TIPS.trasporti.length)];
    return `🚗 ${randomTip}`;
  }

  if (lowerMessage.includes('casa') || lowerMessage.includes('energia') || lowerMessage.includes('luce')) {
    const randomTip = ECO_TIPS.casa[Math.floor(Math.random() * ECO_TIPS.casa.length)];
    return `🏠 ${randomTip}`;
  }

  if (lowerMessage.includes('cibo') || lowerMessage.includes('mangiare') || lowerMessage.includes('dieta')) {
    const randomTip = ECO_TIPS.alimentazione[Math.floor(Math.random() * ECO_TIPS.alimentazione.length)];
    return `🥗 ${randomTip}`;
  }

  if (lowerMessage.includes('lavoro') || lowerMessage.includes('ufficio')) {
    const randomTip = ECO_TIPS.lavoro[Math.floor(Math.random() * ECO_TIPS.lavoro.length)];
    return `💼 ${randomTip}`;
  }

  // Default response
  const randomTip = ECO_TIPS.generale[Math.floor(Math.random() * ECO_TIPS.generale.length)];
  return `🌱 ${randomTip}`;
}

module.exports = router;
