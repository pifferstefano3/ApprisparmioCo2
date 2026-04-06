requireAuth();

/* ─── State ───────────────────────────────────────────────────────────────────── */
let map, userMarker, routePolyline;
let selectedTransport  = null;
let selectedWeather    = 'unknown';
let selectedPassengers = 2;
let trackingActive     = false;
let watchId            = null;
let routeCoords        = [];
let startTime          = null;
let timerInterval      = null;
let totalDistance      = 0;
let isManualMode       = false;

const TRANSPORT_INFO = {
  walk:       { label:'A Piedi',    icon:'🚶' },
  bike:       { label:'Bici',       icon:'🚴' },
  bus:        { label:'Autobus',    icon:'🚌' },
  tram:       { label:'Tram',       icon:'🚃' },
  carpool:    { label:'Carpool',    icon:'🚗' },
  carpool_ai: { label:'Carpool AI', icon:'🤖' },
  car:        { label:'Auto',       icon:'🚙' },
  airplane:   { label:'Aereo',      icon:'✈️' },
};

/* ─── Map Init ───────────────────────────────────────────────────────────────── */
function initMap() {
  map = L.map('map', { zoomControl: false });

  // FIX 403: CartoDB Voyager — HTTPS, CORS aperto, nessuna chiave richiesta
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 19,
    crossOrigin: true,
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);
  map.setView([41.9, 12.5], 6);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      map.setView([lat, lng], 15);
      placeUserMarker(lat, lng);
    }, () => {}, { enableHighAccuracy: true, timeout: 8000 });
  }
}

function placeUserMarker(lat, lng) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;background:#2e8b57;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9],
  });
  if (userMarker) userMarker.setLatLng([lat, lng]);
  else userMarker = L.marker([lat, lng], { icon }).addTo(map);
}

/* ─── Haversine ──────────────────────────────────────────────────────────────── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ─── Transport Selector ─────────────────────────────────────────────────────── */
document.querySelectorAll('.transport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTransport = btn.dataset.transport;

    const paxPanel    = document.getElementById('passengersPanel');
    const airWarning  = document.getElementById('airplaneWarning');
    const manualPanel = document.getElementById('manualDistPanel');

    paxPanel.style.display    = selectedTransport === 'carpool_ai' ? 'block' : 'none';
    airWarning.style.display  = selectedTransport === 'airplane'   ? 'block' : 'none';
    manualPanel.style.display = selectedTransport === 'airplane'   ? 'block' : 'none';
    isManualMode = selectedTransport === 'airplane';

    document.getElementById('startBtn').disabled = false;
  });
});

/* ─── Passeggeri Carpool AI ──────────────────────────────────────────────────── */
window.changePax = function (delta) {
  selectedPassengers = Math.max(2, Math.min(8, selectedPassengers + delta));
  document.getElementById('paxValue').textContent = selectedPassengers;
  const co2 = Math.round(170 / selectedPassengers);
  const saving = Math.round((1 - 1/selectedPassengers) * 100);
  document.getElementById('paxCO2Hint').textContent =
    `Con ${selectedPassengers} persone emetti ~${co2}g CO₂/km a testa (risparmio ${saving}%)`;
};

/* ─── Weather Selector ───────────────────────────────────────────────────────── */
document.querySelectorAll('.weather-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.weather-btn').forEach(b => {
      b.style.background  = 'rgba(255,255,255,0.1)';
      b.style.borderColor = 'rgba(255,255,255,0.2)';
    });
    btn.style.background  = 'rgba(46,139,87,0.35)';
    btn.style.borderColor = 'rgba(74,222,128,0.5)';
    selectedWeather = btn.dataset.weather;
  });
});

/* ─── Start Tracking ─────────────────────────────────────────────────────────── */
document.getElementById('startBtn').addEventListener('click', () => {
  if (!selectedTransport) { showToast('Seleziona un mezzo di trasporto', 'error'); return; }

  if (isManualMode) {
    const manualKm = parseFloat(document.getElementById('manualDistInput').value);
    if (!manualKm || manualKm < 1) {
      showToast('Inserisci la distanza in km per il volo', 'error'); return;
    }
    saveManualActivity(manualKm);
    return;
  }

  if (!navigator.geolocation) {
    showToast('Geolocalizzazione non supportata dal browser', 'error'); return;
  }

  trackingActive = true;
  routeCoords    = [];
  totalDistance  = 0;
  startTime      = Date.now();

  document.getElementById('transportPanel').style.display = 'none';
  document.getElementById('trackingPanel').style.display  = 'block';

  const info = TRANSPORT_INFO[selectedTransport] || { icon:'🚶', label:selectedTransport };
  document.getElementById('trackingTransportLabel').textContent = `${info.icon} ${info.label}`;
  setStatus('tracking', 'Tracciamento attivo');

  document.getElementById('liveDistance').style.display = 'flex';
  document.getElementById('liveDuration').style.display = 'flex';
  timerInterval = setInterval(updateTimer, 1000);

  watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, {
    enableHighAccuracy: true, maximumAge: 0, timeout: 15000,
  });
});

/* ─── Aereo: salva senza GPS ──────────────────────────────────────────────────── */
async function saveManualActivity(distanceKm) {
  const btn = document.getElementById('startBtn');
  btn.disabled = true; btn.textContent = '✈️ Registrazione...';

  const aiRes = await apiFetch('/api/ai/score-trip', {
    method: 'POST', body: { transport: 'airplane', distanceKm, weather: selectedWeather },
  });

  const actRes = await apiFetch('/api/activities', {
    method: 'POST',
    body: { transport: 'airplane', distanceKm, weather: selectedWeather, aiBonus: 0 },
  });

  btn.disabled = false; btn.textContent = '🎯 Inizia Tracciamento';

  if (actRes?.ok) {
    showPointsOverlay(actRes.data.stats, aiRes?.data?.message || '', null);
  } else {
    showToast(actRes?.data?.error || 'Errore salvataggio', 'error');
  }
}

function onPosition(pos) {
  const { latitude: lat, longitude: lng } = pos.coords;
  placeUserMarker(lat, lng);
  map.panTo([lat, lng]);

  if (routeCoords.length > 0) {
    const last = routeCoords[routeCoords.length - 1];
    const d = haversine(last.lat, last.lng, lat, lng);
    if (d > 0.005) { totalDistance += d; updateLiveStats(); }
  }
  routeCoords.push({ lat, lng });

  if (routePolyline) {
    routePolyline.addLatLng([lat, lng]);
  } else {
    routePolyline = L.polyline([[lat, lng]], {
      color: '#2e8b57', weight: 5, opacity: 0.85, lineJoin: 'round', lineCap: 'round',
    }).addTo(map);
  }
}

function onGeoError(err) { showToast(`Errore GPS: ${err.message}`, 'error'); }

function updateLiveStats() {
  document.getElementById('distanceVal').textContent = totalDistance.toFixed(2);
  document.getElementById('trackDist').textContent   = totalDistance.toFixed(2);
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const f = `${m}:${s.toString().padStart(2,'0')}`;
  document.getElementById('durationVal').textContent = f;
  document.getElementById('trackTime').textContent   = f;
}

function setStatus(state, text) {
  document.getElementById('statusDot').className = `status-dot${state === 'tracking' ? ' tracking' : ''}`;
  document.getElementById('statusText').textContent = text;
}

/* ─── Stop Tracking ──────────────────────────────────────────────────────────── */
document.getElementById('stopBtn').addEventListener('click', async () => {
  stopTracking();
  const durationMinutes = Math.floor((Date.now() - startTime) / 60000);
  const distanceKm = parseFloat(totalDistance.toFixed(4));

  if (distanceKm < 0.01) {
    showToast('Percorso troppo breve. Riprova.', 'error'); resetUI(); return;
  }

  document.getElementById('stopBtn').disabled = true;
  document.getElementById('stopBtn').textContent = '💾 Salvataggio...';

  const aiRes = await apiFetch('/api/ai/score-trip', {
    method: 'POST',
    body: { transport: selectedTransport, distanceKm, weather: selectedWeather, passengers: selectedPassengers },
  });

  const aiBonus = aiRes?.ok ? (aiRes.data.aiBonus || 0) : 0;

  const actRes = await apiFetch('/api/activities', {
    method: 'POST',
    body: {
      transport: selectedTransport, distanceKm,
      routeCoords: routeCoords.slice(-200),
      weather: selectedWeather, durationMinutes, aiBonus,
      passengers: selectedPassengers,
    },
  });

  if (actRes?.ok) {
    showPointsOverlay(actRes.data.stats, aiRes?.data?.message || '', aiRes?.data?.carpoolingAdvice);
  } else {
    showToast(actRes?.data?.error || 'Errore nel salvataggio', 'error');
    resetUI();
  }
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  stopTracking(); resetUI(); showToast('Percorso annullato', 'info');
});

function stopTracking() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  trackingActive = false;
  setStatus('idle', 'Tracciamento fermato');
}

function resetUI() {
  document.getElementById('transportPanel').style.display = 'block';
  document.getElementById('trackingPanel').style.display  = 'none';
  document.getElementById('stopBtn').disabled  = false;
  document.getElementById('stopBtn').textContent = '⏹ Ferma e Salva';
  document.getElementById('liveDistance').style.display = 'none';
  document.getElementById('liveDuration').style.display = 'none';
  setStatus('idle', 'Pronto al tracciamento');
  if (routePolyline) { routePolyline.remove(); routePolyline = null; }
  totalDistance = 0; routeCoords = [];
  selectedTransport = null; selectedPassengers = 2;
  document.querySelectorAll('.transport-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('startBtn').disabled = true;
  document.getElementById('passengersPanel').style.display = 'none';
  document.getElementById('airplaneWarning').style.display = 'none';
  document.getElementById('manualDistPanel').style.display = 'none';
}

/* ─── Points Overlay ─────────────────────────────────────────────────────────── */
function showPointsOverlay(stats, aiMessage = '', carpoolingAdvice = null) {
  const overlay = document.getElementById('pointsOverlay');
  document.getElementById('overlayPoints').textContent = `+${stats.starsEarned ?? stats.pointsEarned ?? 0}`;

  const info = TRANSPORT_INFO[selectedTransport] || { icon:'🎉' };
  document.getElementById('overlayEmoji').textContent = info.icon;

  const co2 = parseFloat(stats.co2Saved || 0);
  const co2El = document.getElementById('overlayCO2');
  co2El.style.color = co2 >= 0 ? 'rgba(255,255,255,0.5)' : '#fca5a5';
  co2El.textContent = co2 >= 0
    ? `${co2.toFixed(3)} kg CO₂ risparmiati`
    : `${Math.abs(co2).toFixed(3)} kg CO₂ emessi extra`;

  const bonusEl = document.getElementById('overlayBonus');
  if (aiMessage) { bonusEl.textContent = aiMessage; bonusEl.style.display = 'block'; }
  else bonusEl.style.display = 'none';

  const carpoolEl = document.getElementById('overlayCarpooling');
  if (carpoolingAdvice) { carpoolEl.textContent = carpoolingAdvice; carpoolEl.style.display = 'block'; }
  else carpoolEl.style.display = 'none';

  overlay.style.display = 'flex';
  resetUI();
}

window.closeOverlay = function () {
  document.getElementById('pointsOverlay').style.display = 'none';
  window.location.href = '/dashboard.html';
};

initMap();
