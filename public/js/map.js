requireAuth();

/* ─── State ───────────────────────────────────────────────────────────────────── */
let map, userMarker, routePolyline;
let selectedTransport = null;
let selectedWeather   = 'unknown';
let trackingActive    = false;
let watchId           = null;
let routeCoords       = [];
let startTime         = null;
let timerInterval     = null;
let totalDistance     = 0; // km

/* ─── Map Init ───────────────────────────────────────────────────────────────── */
function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // Centramento iniziale (Italia)
  map.setView([41.9, 12.5], 6);

  // Prova a ottenere posizione subito
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      map.setView([lat, lng], 15);
      placeUserMarker(lat, lng);
    }, () => {}, { enableHighAccuracy: true });
  }
}

/* ─── Marker Utente ─────────────────────────────────────────────────────────── */
function placeUserMarker(lat, lng) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;background:#2e8b57;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    userMarker = L.marker([lat, lng], { icon }).addTo(map);
  }
}

/* ─── Haversine Distance ─────────────────────────────────────────────────────── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── Transport Selector ─────────────────────────────────────────────────────── */
document.querySelectorAll('.transport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTransport = btn.dataset.transport;
    document.getElementById('startBtn').disabled = false;
  });
});

/* ─── Weather Selector ───────────────────────────────────────────────────────── */
document.querySelectorAll('.weather-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.weather-btn').forEach(b => {
      b.style.background = 'rgba(255,255,255,0.1)';
      b.style.borderColor = 'rgba(255,255,255,0.2)';
    });
    btn.style.background   = 'rgba(46,139,87,0.35)';
    btn.style.borderColor  = 'rgba(74,222,128,0.5)';
    selectedWeather = btn.dataset.weather;
  });
});

/* ─── Start Tracking ─────────────────────────────────────────────────────────── */
document.getElementById('startBtn').addEventListener('click', () => {
  if (!selectedTransport) { showToast('Seleziona un mezzo di trasporto', 'error'); return; }

  if (!navigator.geolocation) {
    showToast('Geolocalizzazione non supportata dal browser', 'error');
    return;
  }

  trackingActive = true;
  routeCoords    = [];
  totalDistance  = 0;
  startTime      = Date.now();

  // UI switch
  document.getElementById('transportPanel').style.display = 'none';
  document.getElementById('trackingPanel').style.display  = 'block';

  const info = TRANSPORT_INFO[selectedTransport] || { icon: '🚶', label: selectedTransport };
  document.getElementById('trackingTransportLabel').textContent = `${info.icon} ${info.label}`;

  // Status
  setStatus('tracking', 'Tracciamento attivo');

  // Show live stats
  document.getElementById('liveDistance').style.display = 'flex';
  document.getElementById('liveDuration').style.display = 'flex';

  // Timer
  timerInterval = setInterval(updateTimer, 1000);

  // Inizia il tracciamento GPS
  watchId = navigator.geolocation.watchPosition(
    onPosition,
    onGeoError,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
});

function onPosition(pos) {
  const { latitude: lat, longitude: lng, accuracy } = pos.coords;

  placeUserMarker(lat, lng);
  map.panTo([lat, lng]);

  // Calcola distanza incrementale
  if (routeCoords.length > 0) {
    const last = routeCoords[routeCoords.length - 1];
    const d = haversine(last.lat, last.lng, lat, lng);
    if (d > 0.005) { // minimo 5m per filtrare rumore GPS
      totalDistance += d;
      updateLiveStats();
    }
  }

  routeCoords.push({ lat, lng });

  // Aggiorna polyline
  if (routePolyline) {
    routePolyline.addLatLng([lat, lng]);
  } else {
    routePolyline = L.polyline([[lat, lng]], {
      color: '#2e8b57',
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
  }
}

function onGeoError(err) {
  showToast(`Errore GPS: ${err.message}`, 'error');
}

function updateLiveStats() {
  document.getElementById('distanceVal').textContent = totalDistance.toFixed(2);
  document.getElementById('trackDist').textContent   = totalDistance.toFixed(2);
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const formatted = `${m}:${s.toString().padStart(2, '0')}`;
  document.getElementById('durationVal').textContent = formatted;
  document.getElementById('trackTime').textContent   = formatted;
}

/* ─── Status Helper ──────────────────────────────────────────────────────────── */
function setStatus(state, text) {
  const dot  = document.getElementById('statusDot');
  const txt  = document.getElementById('statusText');
  dot.className = `status-dot${state === 'tracking' ? ' tracking' : ''}`;
  txt.textContent = text;
}

/* ─── Stop Tracking ──────────────────────────────────────────────────────────── */
document.getElementById('stopBtn').addEventListener('click', async () => {
  stopTracking();

  const durationMinutes = Math.floor((Date.now() - startTime) / 60000);
  const distanceKm = parseFloat(totalDistance.toFixed(4));

  if (distanceKm < 0.01) {
    showToast('Percorso troppo breve (< 10m). Riprova.', 'error');
    resetUI();
    return;
  }

  document.getElementById('stopBtn').disabled = true;
  document.getElementById('stopBtn').textContent = '💾 Salvataggio...';

  // Chiedi bonus AI
  const aiRes = await apiFetch('/api/ai/score-trip', {
    method: 'POST',
    body: { transport: selectedTransport, distanceKm, weather: selectedWeather },
  });

  const aiBonus = aiRes?.ok ? (aiRes.data.aiBonus || 0) : 0;
  const aiMessage = aiRes?.ok ? aiRes.data.message : '';

  // Salva attività
  const actRes = await apiFetch('/api/activities', {
    method: 'POST',
    body: {
      transport: selectedTransport,
      distanceKm,
      routeCoords: routeCoords.slice(-200), // max 200 punti
      weather: selectedWeather,
      durationMinutes,
      aiBonus,
    },
  });

  if (actRes?.ok) {
    const stats = actRes.data.stats;
    showPointsOverlay(stats, aiMessage);
  } else {
    showToast(actRes?.data?.error || 'Errore nel salvataggio', 'error');
    resetUI();
  }
});

/* ─── Cancel ─────────────────────────────────────────────────────────────────── */
document.getElementById('cancelBtn').addEventListener('click', () => {
  stopTracking();
  resetUI();
  showToast('Percorso annullato', 'info');
});

function stopTracking() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (timerInterval)    { clearInterval(timerInterval); timerInterval = null; }
  trackingActive = false;
  setStatus('idle', 'Tracciamento fermato');
}

function resetUI() {
  document.getElementById('transportPanel').style.display = 'block';
  document.getElementById('trackingPanel').style.display  = 'none';
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('stopBtn').textContent = '⏹ Ferma e Salva';
  document.getElementById('liveDistance').style.display = 'none';
  document.getElementById('liveDuration').style.display = 'none';
  setStatus('idle', 'Pronto al tracciamento');

  // Reset mappa
  if (routePolyline) { routePolyline.remove(); routePolyline = null; }
  totalDistance  = 0;
  routeCoords    = [];
  selectedTransport = null;
  document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('startBtn').disabled = true;
}

/* ─── Points Overlay ─────────────────────────────────────────────────────────── */
function showPointsOverlay(stats, aiMessage) {
  const overlay = document.getElementById('pointsOverlay');
  document.getElementById('overlayPoints').textContent = `+${stats.pointsEarned}`;

  const info = TRANSPORT_INFO[selectedTransport] || { icon: '🎉' };
  document.getElementById('overlayEmoji').textContent = info.icon;

  const co2El = document.getElementById('overlayCO2');
  co2El.textContent = `${(stats.co2Saved || 0).toFixed(3)} kg CO₂ risparmiati`;

  const bonusEl = document.getElementById('overlayBonus');
  if (aiMessage) { bonusEl.textContent = aiMessage; bonusEl.style.display = 'block'; }
  else bonusEl.style.display = 'none';

  overlay.style.display = 'flex';
  resetUI();
}

window.closeOverlay = function () {
  document.getElementById('pointsOverlay').style.display = 'none';
  window.location.href = '/dashboard.html';
};

/* ─── Start ──────────────────────────────────────────────────────────────────── */
initMap();
