// Interactive Map Initialization and Markers
let map;
let currentRoute = [];
let markers = [];
let isTracking = false;
let selectedTransport = null;
let trackingInterval = null;
let startTime = null;

// Initialize map after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeMap();
  setupTransportButtons();
  setupTrackingControls();
});

function initializeMap() {
  try {
    // Initialize Leaflet map
    map = L.map('map').setView([41.9028, 12.4964], 13); // Rome coordinates as default
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    
    // Add click event to map for adding custom markers
    map.on('click', function(e) {
      if (isTracking) {
        addRoutePoint(e.latlng);
      }
    });
    
    // Load existing markers from database
    loadExistingMarkers();
    
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          map.setView([userLat, userLng], 15);
          
          // Add user location marker
          L.marker([userLat, userLng], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="background: #2ecc71; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [16, 16]
            })
          }).addTo(map).bindPopup('La tua posizione');
        },
        error => {
          console.warn('Geolocation not available:', error);
          showToast('Geolocalizzazione non disponibile', 'warning');
        }
      );
    }
    
    showToast('Mappa caricata con successo', 'success');
  } catch (error) {
    console.error('Map initialization error:', error);
    showToast('Errore nell\'inizializzazione della mappa', 'error');
  }
}

async function loadExistingMarkers() {
  try {
    const response = await fetch('/api/activities/markers');
    const activities = await response.json();
    
    if (response.ok && activities.length > 0) {
      activities.forEach(activity => {
        if (activity.coordinates && activity.coordinates.length > 0) {
          activity.coordinates.forEach(coord => {
            addActivityMarker(coord, activity);
          });
        }
      });
    }
  } catch (error) {
    console.error('Error loading markers:', error);
  }
}

function addActivityMarker(coordinates, activity) {
  const marker = L.marker([coordinates.lat, coordinates.lng], {
    icon: L.divIcon({
      className: 'activity-marker',
      html: `<div style="background: ${getTransportColor(activity.transport)}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 10px;">${getTransportIcon(activity.transport)}</div>`,
      iconSize: [24, 24]
    })
  }).addTo(map);
  
  const popupContent = `
    <div style="min-width: 150px;">
      <strong>${getTransportLabel(activity.transport)}</strong><br>
      <small>Distanza: ${activity.distance || 0} km</small><br>
      <small>CO2: ${activity.co2Saved || 0} kg risparmiati</small><br>
      <small>Data: ${new Date(activity.createdAt).toLocaleDateString('it-IT')}</small>
    </div>
  `;
  
  marker.bindPopup(popupContent);
  markers.push(marker);
}

function addRoutePoint(latlng) {
  currentRoute.push(latlng);
  
  const marker = L.marker(latlng, {
    icon: L.divIcon({
      className: 'route-marker',
      html: '<div style="background: #e74c3c; width: 8px; height: 8px; border-radius: 50%; border: 1px solid white;"></div>',
      iconSize: [10, 10]
    })
  }).addTo(map);
  
  markers.push(marker);
  
  // Draw route line if we have at least 2 points
  if (currentRoute.length >= 2) {
    const polyline = L.polyline(currentRoute, {
      color: '#e74c3c',
      weight: 3,
      opacity: 0.7
    }).addTo(map);
    markers.push(polyline);
  }
}

function setupTransportButtons() {
  const transportButtons = document.querySelectorAll('.transport-btn');
  
  transportButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      // Remove active class from all buttons
      transportButtons.forEach(b => b.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      selectedTransport = this.dataset.transport;
      
      // Update UI based on transport selection
      updateTransportUI(selectedTransport);
      
      // Enable start button
      document.getElementById('startBtn').disabled = false;
    });
  });
}

function updateTransportUI(transport) {
  // Show/hide specific panels based on transport
  const passengersPanel = document.getElementById('passengersPanel');
  const airplaneWarning = document.getElementById('airplaneWarning');
  const manualDistPanel = document.getElementById('manualDistPanel');
  
  passengersPanel.style.display = transport === 'carpool_ai' ? 'block' : 'none';
  airplaneWarning.style.display = transport === 'airplane' ? 'block' : 'none';
  manualDistPanel.style.display = ['airplane', 'car'].includes(transport) ? 'block' : 'none';
}

function setupTrackingControls() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  
  startBtn.addEventListener('click', startTracking);
  stopBtn.addEventListener('click', stopTracking);
  cancelBtn.addEventListener('click', cancelTracking);
}

function startTracking() {
  if (!selectedTransport) {
    showToast('Seleziona un mezzo di trasporto', 'error');
    return;
  }
  
  isTracking = true;
  startTime = Date.now();
  currentRoute = [];
  
  // Update UI
  document.getElementById('transportPanel').style.display = 'none';
  document.getElementById('trackingPanel').style.display = 'block';
  document.getElementById('trackingTransportLabel').textContent = getTransportLabel(selectedTransport);
  
  // Start tracking updates
  trackingInterval = setInterval(updateTrackingStats, 1000);
  
  // Start GPS tracking if available
  if (navigator.geolocation && !['airplane', 'car'].includes(selectedTransport)) {
    startGPSTracking();
  }
  
  showToast('Tracciamento iniziato', 'success');
}

function stopTracking() {
  if (!isTracking) return;
  
  isTracking = false;
  clearInterval(trackingInterval);
  
  // Calculate final stats
  const distance = calculateTotalDistance();
  const duration = Math.floor((Date.now() - startTime) / 1000);
  
  // Save activity to database
  saveActivity(distance, duration);
  
  // Reset UI
  resetTrackingUI();
  
  // Show results overlay
  showResultsOverlay(distance, duration);
}

function cancelTracking() {
  isTracking = false;
  clearInterval(trackingInterval);
  
  // Clear route
  clearRoute();
  
  // Reset UI
  resetTrackingUI();
  
  showToast('Tracciamento annullato', 'info');
}

function startGPSTracking() {
  if (!navigator.geolocation) return;
  
  const watchId = navigator.geolocation.watchPosition(
    position => {
      const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
      addRoutePoint(latlng);
    },
    error => {
      console.warn('GPS tracking error:', error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  );
  
  // Store watch ID for cleanup
  window.currentWatchId = watchId;
}

function updateTrackingStats() {
  if (!isTracking) return;
  
  const distance = calculateTotalDistance();
  const duration = Math.floor((Date.now() - startTime) / 1000);
  
  // Update UI
  document.getElementById('trackDist').textContent = distance.toFixed(2);
  document.getElementById('trackTime').textContent = formatDuration(duration);
  
  // Update live stats
  document.getElementById('distanceVal').textContent = distance.toFixed(2);
  document.getElementById('durationVal').textContent = formatDuration(duration);
  document.getElementById('liveDistance').style.display = 'inline-block';
  document.getElementById('liveDuration').style.display = 'inline-block';
}

function calculateTotalDistance() {
  if (currentRoute.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < currentRoute.length; i++) {
    totalDistance += currentRoute[i-1].distanceTo(currentRoute[i]);
  }
  
  // Convert meters to kilometers
  return totalDistance / 1000;
}

async function saveActivity(distance, duration) {
  try {
    const activityData = {
      transport: selectedTransport,
      distance: distance,
      duration: duration,
      coordinates: currentRoute.map(point => ({
        lat: point.lat,
        lng: point.lng
      })),
      weather: getSelectedWeather(),
      passengers: selectedTransport === 'carpool_ai' ? parseInt(document.getElementById('paxValue').textContent) : 1
    };
    
    const response = await fetch('/api/activities/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(activityData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('Attività salvata con successo!', 'success');
      // Reload markers to show new activity
      loadExistingMarkers();
    } else {
      showToast(result.error || 'Errore nel salvataggio', 'error');
    }
  } catch (error) {
    console.error('Save activity error:', error);
    showToast('Errore di connessione', 'error');
  }
}

function clearRoute() {
  // Remove all route markers and polylines
  markers.forEach(marker => {
    if (marker instanceof L.Marker || marker instanceof L.Polyline) {
      map.removeLayer(marker);
    }
  });
  markers = [];
  currentRoute = [];
}

function resetTrackingUI() {
  document.getElementById('transportPanel').style.display = 'block';
  document.getElementById('trackingPanel').style.display = 'none';
  document.getElementById('liveDistance').style.display = 'none';
  document.getElementById('liveDuration').style.display = 'none';
  
  // Clear GPS tracking
  if (window.currentWatchId) {
    navigator.geolocation.clearWatch(window.currentWatchId);
  }
  
  // Reset transport selection
  selectedTransport = null;
  document.querySelectorAll('.transport-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById('startBtn').disabled = true;
}

function getTransportColor(transport) {
  const colors = {
    walk: '#2ecc71',
    bike: '#3498db',
    bus: '#f39c12',
    tram: '#9b59b6',
    carpool: '#e67e22',
    carpool_ai: '#16a085',
    car: '#e74c3c',
    airplane: '#95a5a6'
  };
  return colors[transport] || '#95a5a6';
}

function getTransportIcon(transport) {
  const icons = {
    walk: 'P',
    bike: 'B',
    bus: 'S',
    tram: 'T',
    carpool: 'C',
    carpool_ai: 'A',
    car: 'A',
    airplane: 'V'
  };
  return icons[transport] || '?';
}

function getTransportLabel(transport) {
  const labels = {
    walk: 'A Piedi',
    bike: 'Bici',
    bus: 'Bus',
    tram: 'Tram',
    carpool: 'Carpool',
    carpool_ai: 'Carpool AI',
    car: 'Auto',
    airplane: 'Aereo'
  };
  return labels[transport] || transport;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getSelectedWeather() {
  const activeWeatherBtn = document.querySelector('.weather-btn.active');
  return activeWeatherBtn ? activeWeatherBtn.dataset.weather : null;
}

function showResultsOverlay(distance, duration) {
  // Calculate points and CO2 savings
  const points = calculatePoints(distance, selectedTransport);
  const co2Saved = calculateCO2Saved(distance, selectedTransport);
  
  // Update overlay
  document.getElementById('overlayPoints').textContent = `+${points}`;
  document.getElementById('overlayCO2').textContent = `${co2Saved.toFixed(1)} kg CO2 risparmiati`;
  document.getElementById('pointsOverlay').style.display = 'flex';
}

function calculatePoints(distance, transport) {
  const basePoints = {
    walk: 10,
    bike: 8,
    bus: 6,
    tram: 7,
    carpool: 4,
    carpool_ai: 5,
    car: 1,
    airplane: 0
  };
  
  return Math.floor((basePoints[transport] || 1) * distance);
}

function calculateCO2Saved(distance, transport) {
  const emissionFactors = {
    walk: 0,
    bike: 0,
    bus: 0.08,
    tram: 0.05,
    carpool: 0.12,
    carpool_ai: 0.08,
    car: 0.17,
    airplane: 0.255
  };
  
  const carEmission = 0.17; // kg CO2 per km for single car
  const transportEmission = emissionFactors[transport] || 0;
  
  return Math.max(0, (carEmission - transportEmission) * distance);
}

function closeOverlay() {
  document.getElementById('pointsOverlay').style.display = 'none';
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}
