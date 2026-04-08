const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Activity = require('../models/Activity');
const Track = require('../models/Track');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Check for API keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const USE_OPENAI = !!OPENAI_API_KEY;
const USE_GEMINI = !!GEMINI_API_KEY;
const USE_REAL_AI = USE_OPENAI || USE_GEMINI;

if (USE_OPENAI) {
  console.log('[AI] Configuration: Using OpenAI API');
} else if (USE_GEMINI) {
  console.log('[AI] Configuration: Using Google Gemini API');
} else {
  console.log('[AI] Configuration: Using fallback responses');
}

// AI Eco-Tips Fallback Engine (used when OpenAI is not available)
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

// OpenAI API call function
async function callOpenAI(message, userContext) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Sei l'assistente AI di VERDENT, un'app per tracciare viaggi ecologici. 
L'utente ha ${userContext.points} punti, ha risparmiato ${userContext.co2Saved}kg di CO2, e ha completato ${userContext.totalTracks} viaggi.
Il suo titolo è "${userContext.honorTitle}".
Rispondi in italiano, in modo conciso (max 2 frasi), con un tono amichevole e motivante.
Dai consigli pratici su mobilità sostenibile, risparmio energetico e stile di vita eco-friendly.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[AI] OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('[AI] OpenAI call failed:', error);
    throw error;
  }
}

// Gemini API call function
async function callGemini(message, userContext) {
  try {
    const prompt = `Sei l'assistente AI di VERDENT, un'app per tracciare viaggi ecologici. 
L'utente ha ${userContext.points} punti, ha risparmiato ${userContext.co2Saved}kg di CO2, e ha completato ${userContext.totalTracks} viaggi.
Il suo titolo è "${userContext.honorTitle}".
Rispondi in italiano, in modo conciso (max 2 frasi), con un tono amichevole e motivante.
Dai consigli pratici su mobilità sostenibile, risparmio energetico e stile di vita eco-friendly.

Domanda dell'utente: ${message}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[AI] Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('[AI] Gemini call failed:', error);
    throw error;
  }
}

// POST /api/ai/chat - AI chat endpoint with real OpenAI integration
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.userId;

    console.log('[AI] Chat request from user:', userId, 'Message:', message);

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Il messaggio è obbligatorio' });
    }

    // Get user info with track stats
    const user = await User.findById(userId);
    if (!user) {
      console.error('[AI] User not found:', userId);
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Get user track stats for context
    const trackStats = await Track.getUserStats(userId);

    // Build user context
    const userContext = {
      points: user.points || 0,
      co2Saved: user.co2Saved || 0,
      totalTracks: trackStats.totalTracks || 0,
      honorTitle: user.honorTitle || 'Eco Principiante'
    };

    let aiResponse;
    let usedFallback = false;
    let aiProvider = null;

    // Try AI APIs in order: OpenAI -> Gemini -> Fallback
    if (USE_OPENAI) {
      try {
        console.log('[AI] Calling OpenAI API...');
        aiResponse = await callOpenAI(message, userContext);
        aiProvider = 'openai';
        console.log('[AI] OpenAI response received');
      } catch (openaiError) {
        console.error('[AI] OpenAI failed:', openaiError.message);
        
        // Try Gemini as backup if available
        if (USE_GEMINI) {
          try {
            console.log('[AI] Trying Gemini API as backup...');
            aiResponse = await callGemini(message, userContext);
            aiProvider = 'gemini';
            console.log('[AI] Gemini response received');
          } catch (geminiError) {
            console.error('[AI] Gemini also failed, using fallback:', geminiError.message);
            usedFallback = true;
            aiResponse = await generateFallbackResponse(message);
          }
        } else {
          usedFallback = true;
          aiResponse = await generateFallbackResponse(message);
        }
      }
    } else if (USE_GEMINI) {
      // Use Gemini if OpenAI not available
      try {
        console.log('[AI] Calling Gemini API...');
        aiResponse = await callGemini(message, userContext);
        aiProvider = 'gemini';
        console.log('[AI] Gemini response received');
      } catch (geminiError) {
        console.error('[AI] Gemini failed, using fallback:', geminiError.message);
        usedFallback = true;
        aiResponse = await generateFallbackResponse(message);
      }
    } else {
      console.log('[AI] No AI API configured, using fallback');
      usedFallback = true;
      aiResponse = await generateFallbackResponse(message);
    }

    // Award bonus points for eco-friendly questions
    const isEcoQuestion = /trasporti|auto|bike|bus|treno|co2|energia|ambiente|ecologico|sostenibile|verde|natura|riciclo/i.test(message.toLowerCase());
    let bonusPoints = 0;
    if (isEcoQuestion) {
      bonusPoints = 5;
      user.points += bonusPoints;
      if (user.updateHonorTitle) {
        user.updateHonorTitle();
      }
      await user.save();
      console.log('[AI] Awarded', bonusPoints, 'bonus points to user', userId);
    }

    res.json({
      response: aiResponse,
      bonusPointsAwarded: bonusPoints,
      usedFallback,
      aiProvider,
      userContext
    });

  } catch (error) {
    console.error('[AI] Chat error:', error);
    // Return 500 with specific error message
    res.status(500).json({ 
      error: 'Errore nel servizio AI: ' + error.message,
      code: 'AI_SERVICE_ERROR'
    });
  }
});

// Fallback response generator when OpenAI is not available
async function generateFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();

  // Check for specific topics
  if (lowerMessage.includes('trasporti') || lowerMessage.includes('auto') || lowerMessage.includes('bike') || lowerMessage.includes('bus')) {
    const randomTip = ECO_TIPS.trasporti[Math.floor(Math.random() * ECO_TIPS.trasporti.length)];
    return `🚗 ${randomTip}\n\n💡 Suggerimento: usa la mappa per tracciare i tuoi spostamenti e guadagna punti!`;
  }

  if (lowerMessage.includes('casa') || lowerMessage.includes('energia') || lowerMessage.includes('luce') || lowerMessage.includes('riscaldamento')) {
    const randomTip = ECO_TIPS.casa[Math.floor(Math.random() * ECO_TIPS.casa.length)];
    return `🏠 ${randomTip}\n\n💡 Ogni piccolo gesto conta per ridurre l'impronta di carbonio!`;
  }

  if (lowerMessage.includes('cibo') || lowerMessage.includes('mangiare') || lowerMessage.includes('dieta') || lowerMessage.includes('spreco')) {
    const randomTip = ECO_TIPS.alimentazione[Math.floor(Math.random() * ECO_TIPS.alimentazione.length)];
    return `🥗 ${randomTip}\n\n💡 Un'alimentazione sostenibile fa bene a te e al pianeta!`;
  }

  if (lowerMessage.includes('lavoro') || lowerMessage.includes('ufficio') || lowerMessage.includes('smart working')) {
    const randomTip = ECO_TIPS.lavoro[Math.floor(Math.random() * ECO_TIPS.lavoro.length)];
    return `💼 ${randomTip}\n\n💡 Lo smart working è un ottimo modo per ridurre le emissioni da pendolarismo!`;
  }

  // Default response
  const randomTip = ECO_TIPS.generale[Math.floor(Math.random() * ECO_TIPS.generale.length)];
  return `🌱 ${randomTip}\n\n🤔 Per consigli più personalizzati, aggiungi OPENAI_API_KEY al file .env`;
}

module.exports = router;
