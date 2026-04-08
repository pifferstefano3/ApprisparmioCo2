const express = require('express');
const router = express.Router();
const Track = require('../models/Track');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBgDMhYd9kIkoi4z_kaY6siBas6feFH5K0';

// Calculate eco score using Gemini AI
async function calculateEcoScoreWithAI(distanceKm, transport) {
  if (!GEMINI_API_KEY) {
    console.log('[TRACKS AI] No Gemini API key, using fallback calculation');
    return calculateFallbackScore(distanceKm, transport);
  }

  const prompt = `L'utente ha viaggiato per ${distanceKm} chilometri usando il mezzo: ${transport}. 
Calcola un punteggio ecologico da 0 a 100 basato sul risparmio di CO2 rispetto a un'auto singola. 
Se ha usato l'Aereo o l'Auto da solo, dai 0 punti o punti negativi. 
Se ha usato mezzi molto ecologici (es. Piedi, Bici), dai il massimo. 
Rispondi ESCLUSIVAMENTE con un numero intero, senza testo aggiuntivo.`;

  try {
    console.log(`[TRACKS AI] Calling Gemini for ${transport}, ${distanceKm}km...`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
          maxOutputTokens: 10,
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text;
    
    // Extract number from AI response
    const scoreMatch = aiText.match(/-?\d+/);
    const score = scoreMatch ? parseInt(scoreMatch[0]) : 50;
    
    console.log(`[TRACKS AI] Gemini response: "${aiText}" -> Score: ${score}`);
    
    // Validate and clamp score
    const finalScore = Math.max(0, Math.min(100, score));
    
    // Calculate points based on distance and eco score
    const points = Math.round((finalScore / 100) * distanceKm * 10);
    
    return {
      points: Math.max(0, points),
      ecoScore: finalScore,
      aiRawResponse: aiText,
      aiCalculated: true
    };
    
  } catch (error) {
    console.error('[TRACKS AI] Gemini calculation failed:', error.message);
    return calculateFallbackScore(distanceKm, transport);
  }
}

// Fallback calculation if AI fails
function calculateFallbackScore(distanceKm, transport) {
  const transportMultipliers = {
    walk: 10,
    bike: 10,
    bus: 6,
    tram: 7,
    train: 8,
    carpool: 4,
    carpool_ai: 5,
    car: 1,
    airplane: -5
  };
  
  const multiplier = transportMultipliers[transport] || 1;
  const points = Math.round(distanceKm * multiplier);
  
  return {
    points: Math.max(0, points),
    ecoScore: multiplier * 10,
    aiRawResponse: 'Fallback calculation',
    aiCalculated: false
  };
}

router.use(authMiddleware);

// POST /api/tracks/calculate-score - Calculate score via AI (called before save)
router.post('/calculate-score', async (req, res) => {
  try {
    const { distanceKm, transport } = req.body;
    
    if (!distanceKm || !transport) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

    // Calculate via Gemini AI
    const result = await calculateEcoScoreWithAI(distanceKm, transport);
    
    res.json({
      processing: true,
      message: 'Elaborazione punteggio con AI...',
      ...result
    });
    
  } catch (error) {
    console.error('[TRACKS] Calculate score error:', error);
    res.status(500).json({ error: 'Errore nel calcolo punteggio AI' });
  }
});

// POST /api/tracks - Save a new track/GPS route with AI point calculation
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const {
      transport,
      coordinates,
      distanceKm,
      durationMinutes,
      weather = 'unknown',
      passengers = 1,
      startTime,
      endTime
    } = req.body;

    // Validation
    if (!transport || !Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({ error: 'Dati tracciamento incompleti' });
    }

    if (!distanceKm || distanceKm < 0.01) {
      return res.status(400).json({ error: 'Distanza troppo breve (minimo 10 metri)' });
    }

    // Calculate points via Gemini AI
    const aiResult = await calculateEcoScoreWithAI(distanceKm, transport);
    const pointsEarned = aiResult.points;
    const ecoScore = aiResult.ecoScore;
    
    // Calculate CO2 saved based on transport
    const co2PerKm = {
      walk: 0,
      bike: 0,
      bus: 0.05,
      tram: 0.03,
      train: 0.02,
      carpool: 0.12,
      carpool_ai: 0.10,
      car: 0.17,
      airplane: 0.25
    };
    
    const co2Saved = distanceKm * ((co2PerKm.car - (co2PerKm[transport] || 0)));

    // Create track document
    const track = new Track({
      userId,
      transport,
      coordinates: coordinates.map((coord, index) => ({
        lat: coord.lat,
        lng: coord.lng,
        timestamp: new Date(startTime).getTime() + (index * 1000)
      })),
      distanceKm,
      durationMinutes,
      weather,
      passengers,
      co2Saved: Math.max(0, co2Saved),
      pointsEarned,
      aiBonus: 0, // Points are now calculated by AI
      startTime: new Date(startTime),
      endTime: new Date(endTime)
    });

    await track.save();

    // Update user stats
    const user = await User.findById(userId);
    if (user) {
      user.points += pointsEarned;
      user.co2Saved += Math.max(0, co2Saved);
      user.kmSustainable = (user.kmSustainable || 0) + distanceKm;
      
      // Update streak
      const today = new Date();
      const lastActivity = user.lastActivityDate;
      if (lastActivity) {
        const daysDiff = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          user.streak.current += 1;
          user.streak.max = Math.max(user.streak.max, user.streak.current);
        } else if (daysDiff > 1) {
          user.streak.current = 1;
        }
      } else {
        user.streak.current = 1;
        user.streak.max = 1;
      }
      user.lastActivityDate = today;
      
      await user.save();
    }

    res.status(201).json({
      message: 'Tracciamento salvato con successo!',
      aiCalculated: aiResult.aiCalculated,
      aiResponse: aiResult.aiRawResponse,
      ecoScore,
      track: {
        id: track._id,
        distanceKm: track.distanceKm,
        durationMinutes: track.durationMinutes,
        co2Saved: track.co2Saved,
        pointsEarned: track.pointsEarned
      },
      userStats: {
        points: user.points,
        co2Saved: user.co2Saved,
        kmSustainable: user.kmSustainable
      }
    });

  } catch (error) {
    console.error('[TRACKS] Save track error:', error);
    res.status(500).json({ error: 'Errore nel salvataggio del tracciamento: ' + error.message });
  }
});

// GET /api/tracks - Get user's tracks
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;

    const tracks = await Track.getUserTracks(userId, limit);
    const stats = await Track.getUserStats(userId);

    res.json({
      tracks: tracks.map(t => ({
        id: t._id,
        transport: t.transport,
        distanceKm: t.distanceKm,
        durationMinutes: t.durationMinutes,
        co2Saved: t.co2Saved,
        pointsEarned: t.pointsEarned,
        startTime: t.startTime,
        endTime: t.endTime,
        coordinates: t.coordinates
      })),
      stats,
      pagination: {
        page,
        limit,
        total: tracks.length
      }
    });

  } catch (error) {
    console.error('[TRACKS] Get tracks error:', error);
    res.status(500).json({ error: 'Errore nel recupero dei tracciamenti' });
  }
});

// GET /api/tracks/:id - Get single track details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const track = await Track.findOne({ _id: id, userId });
    
    if (!track) {
      return res.status(404).json({ error: 'Tracciamento non trovato' });
    }

    res.json({
      track: {
        id: track._id,
        transport: track.transport,
        coordinates: track.coordinates,
        distanceKm: track.distanceKm,
        durationMinutes: track.durationMinutes,
        weather: track.weather,
        passengers: track.passengers,
        co2Saved: track.co2Saved,
        pointsEarned: track.pointsEarned,
        aiBonus: track.aiBonus,
        startTime: track.startTime,
        endTime: track.endTime
      }
    });

  } catch (error) {
    console.error('[TRACKS] Get track error:', error);
    res.status(500).json({ error: 'Errore nel recupero del tracciamento' });
  }
});

module.exports = router;
