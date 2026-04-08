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
  
  // Eco-friendly responses
  if (lowerMessage.includes('co2') || lowerMessage.includes('carbonio')) {
    return `Ridurre le emissioni di CO2 è fondamentale! Ecco alcuni consigli pratici:
    
1. **Trasporti**: Usa la bicicletta o i mezzi pubblici quando possibile
2. **Energia**: Scegli fonti rinnovabili e riduci i consumi domestici
3. **Alimentazione**: Preferisci prodotti locali e di stagione
4. **Rifiuti**: Riduci, riutilizza e ricicla il più possibile

Il tuo impegno può fare la differenza! Hai risparmiato ${user.co2Saved || 0} kg di CO2 finora.`;
  }
  
  if (lowerMessage.includes('bicicletta') || lowerMessage.includes('bike')) {
    return `La bicicletta è un ottimo modo per ridurre l'impatto ambientale! 
    
Vantaggi:
- Zero emissioni di CO2
- Migliora la salute fisica
- Risparmia denaro su carburante e parcheggio
- Evita il traffico urbano
    
Consiglio: Inizia con piccoli tragitti e gradualmente aumenta la distanza. Ogni km in bicicletta risparmia circa 0.2 kg di CO2!`;
  }
  
  if (lowerMessage.includes('energia') || lowerMessage.includes('elettricità')) {
    return `L'efficienza energetica è cruciale per la sostenibilità:
    
**In casa:**
- Sostituisci le lampadine con LED
- Spegli gli apparecchi in standby
- Usa termostati programmabili
- Migliora l'isolamento termico
    
**Rinnovabili:**
- Pannelli solari per l'elettricità
- Collettori solari per l'acqua calda
- Pompe di calore per il riscaldamento
    
Piccoli cambiamenti possono portare a grandi risparmi energetici!`;
  }
  
  if (lowerMessage.includes('rifiuti') || lowerMessage.includes('ricicla')) {
    return `La gestione dei rifiuti segue la regola delle 5R:
    
1. **Rifiuta**: Di' no a prodotti non necessari
2. **Riduci**: Minimizza i consumi e gli imballaggi
3. **Riutilizza**: Dai nuova vita agli oggetti
4. **Ripara**: Invece di sostituire
5. **Ricicla**: Separa correttamente i materiali
    
Consiglio: Composta gli scarti organici per ridurre i rifiuti in discarica del 30%!`;
  }
  
  if (lowerMessage.includes('acqua')) {
    return `L'acqua è una risorsa preziosa, ecco come conservarla:
    
**In casa:**
- Ripara subito le perdite
- Installa rubinetti a basso flusso
- Raccogli l'acqua piovana per le piante
- Usa la lavatrice solo a pieno carico
    
**Personalmente:**
- Fai docce brevi (5 minuti)
- Spegni l'acqua mentre ti lavi i denti
- Bevi acqua dal rubinetto con filtro
    
Ogni goccia conta per il nostro pianeta!`;
  }
  
  // Personalized responses based on user data
  if (recentActivities && recentActivities.length > 0) {
    const lastActivity = recentActivities[0];
    return `Ho visto che di recente hai ${lastActivity.type}! Continua così con il tuo impegno ecologico. 
    
${generateGeneralEcoAdvice()}`;
  }
  
  // Default eco-friendly response
  return generateGeneralEcoAdvice();
}

function generateGeneralEcoAdvice() {
  const advices = [
    `Ottima domanda! Ecco un consiglio ecologico: prova a ridurre l'uso della plastica monouso portando sempre con te una borraccia riutilizzabile e borse di stoffa per la spesa.`,
    
    `La sostenibilità inizia dai piccoli gesti! Scegli prodotti locali e di stagione per ridurre l'impatto dei trasporti e supportare l'economia locale.`,
    
    `Ricorda che ogni azione conta! Anche spegnere le luci quando esci da una stanza aiuta a risparmiare energia e ridurre le emissioni.`,
    
    `Il compostaggio domestico può ridurre i rifiuti organici fino al 30%! È un ottimo modo per trasformare gli scarti in risorse.`,
    
    `Considera di partecipare a iniziative di pulizia locale o di piantare alberi. Ogni albero può assorbire circa 22 kg di CO2 all'anno!`
  ];
  
  return advices[Math.floor(Math.random() * advices.length)];
}

function isEcoFriendlyQuestion(message) {
  const ecoKeywords = [
    'co2', 'carbonio', 'emissioni', 'inquinamento',
    'bicicletta', 'bike', 'trasporti', 'passeggiata',
    'energia', 'elettricità', 'solare', 'rinnovabili',
    'rifiuti', 'ricicla', 'riciclaggio', 'compost',
    'acqua', 'sostenibilità', 'ambiente', 'ecologico',
    'verde', 'natura', 'clima', 'riscaldamento'
  ];
  
  const lowerMessage = message.toLowerCase();
  return ecoKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Get dashboard tips
router.get('/tips', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const tips = [
      "Oggi prova a usare i mezzi pubblici invece dell'auto",
      "Ricorda di spegnere le luci quando non le usi",
      "Porta con te una borraccia riutilizzabile",
      "Scegli prodotti con meno imballaggi",
      "Fai la raccolta differenziata correttamente"
    ];
    
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    res.json({
      tip: randomTip,
      userPoints: user.points || 0,
      co2Saved: user.co2Saved || 0
    });
    
  } catch (error) {
    console.error('Get tips error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei consigli' });
  }
});

module.exports = router;
