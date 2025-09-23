// Configuration de l'API
const API_BASE = window.location.hostname === 'agent-position.vercel.app' 
    ? 'https://presence-ccrb-v2.onrender.com/api'
    : '/api';

// Variables globales
let map;
let userMarker;
let checkinMarkers = [];
let currentMission = null;
let isSatelliteView = false;
let watchId = null;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadUserData();
    checkCurrentMission();
    startLocationTracking();
});

// Initialiser la carte Leaflet
function initMap() {
    // Position par défaut (Bénin)
    const defaultLat = 9.3077;
    const defaultLng = 2.3158;
    
    map = L.map('map').setView([defaultLat, defaultLng], 8);
    
    // Ajouter les tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Marqueur de l'utilisateur
    userMarker = L.marker([defaultLat, defaultLng], {
        icon: L.divIcon({
            className: 'user-marker',
            html: '<div style="background: #007bff; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    }).addTo(map);
    
    // Popup du marqueur utilisateur
    userMarker.bindPopup('<b>Votre position</b><br>Cliquez pour mettre à jour');
    
    // Gestion des clics sur la carte
    map.on('click', function(e) {
        updateUserPosition(e.latlng.lat, e.latlng.lng);
    });
}

// Charger les données utilisateur
async function loadUserData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        
        const response = await api('/profile');
        if (response.success && response.user) {
            const user = response.user;
            document.getElementById('current-location').textContent = 
                `${user.commune || 'Non défini'}, ${user.departement || 'Non défini'}`;
        }
    } catch (error) {
        console.error('Erreur chargement profil:', error);
    }
}

// Vérifier la mission actuelle
async function checkCurrentMission() {
    try {
        const response = await api('/me/missions');
        if (response.success && response.missions) {
            const activeMission = response.missions.find(m => m.status === 'active');
            if (activeMission) {
                currentMission = activeMission;
                updateMissionUI(activeMission);
                loadCheckins(activeMission.id);
            } else {
                updateMissionUI(null);
            }
        }
    } catch (error) {
        console.error('Erreur vérification mission:', error);
    }
}

// Mettre à jour l'interface de mission
function updateMissionUI(mission) {
    const missionInfo = document.getElementById('mission-info');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const startBtn = document.getElementById('start-btn');
    const checkinBtn = document.getElementById('checkin-btn');
    const endBtn = document.getElementById('end-btn');
    
    if (mission) {
        missionInfo.style.display = 'block';
        document.getElementById('mission-details').innerHTML = `
            <strong>Mission #${mission.id}</strong><br>
            <small>Début: ${new Date(mission.start_time).toLocaleString()}</small><br>
            <small>Position: ${mission.start_lat?.toFixed(4)}, ${mission.start_lon?.toFixed(4)}</small>
        `;
        
        statusIndicator.className = 'status-indicator status-active';
        statusText.textContent = 'Mission active';
        
        startBtn.style.display = 'none';
        checkinBtn.style.display = 'inline-block';
        endBtn.style.display = 'inline-block';
    } else {
        missionInfo.style.display = 'none';
        statusIndicator.className = 'status-indicator status-inactive';
        statusText.textContent = 'Aucune mission active';
        
        startBtn.style.display = 'inline-block';
        checkinBtn.style.display = 'none';
        endBtn.style.display = 'none';
    }
}

// Charger les check-ins d'une mission
async function loadCheckins(missionId) {
    try {
        const response = await api(`/missions/${missionId}/checkins`);
        if (response.success && response.checkins) {
            // Supprimer les anciens marqueurs
            checkinMarkers.forEach(marker => map.removeLayer(marker));
            checkinMarkers = [];
            
            // Ajouter les nouveaux marqueurs
            response.checkins.forEach(checkin => {
                if (checkin.lat && checkin.lon) {
                    const marker = L.marker([checkin.lat, checkin.lon], {
                        icon: L.divIcon({
                            className: 'checkin-marker',
                            html: '<div style="background: #28a745; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>',
                            iconSize: [15, 15],
                            iconAnchor: [7, 7]
                        })
                    }).addTo(map);
                    
                    marker.bindPopup(`
                        <b>Check-in</b><br>
                        ${new Date(checkin.checkin_time).toLocaleString()}<br>
                        <small>Précision: ${checkin.accuracy}m</small>
                    `);
                    
                    checkinMarkers.push(marker);
                }
            });
        }
    } catch (error) {
        console.error('Erreur chargement check-ins:', error);
    }
}

// Démarrer le suivi de position
function startLocationTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                updateUserPosition(lat, lng, accuracy);
            },
            function(error) {
                console.error('Erreur géolocalisation:', error);
                showToast('Erreur de géolocalisation: ' + error.message, 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    } else {
        showToast('Géolocalisation non supportée par ce navigateur', 'error');
    }
}

// Mettre à jour la position de l'utilisateur
function updateUserPosition(lat, lng, accuracy = null) {
    userMarker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom());
    
    if (accuracy) {
        document.getElementById('location-accuracy').textContent = 
            `Précision: ${Math.round(accuracy)}m`;
    }
}

// Centrer sur la position de l'utilisateur
function centerOnUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 15);
                updateUserPosition(lat, lng, position.coords.accuracy);
            },
            function(error) {
                showToast('Impossible d\'obtenir la position', 'error');
            }
        );
    }
}

// Basculer entre vue normale et satellite
function toggleSatellite() {
    if (isSatelliteView) {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    } else {
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri'
        }).addTo(map);
    }
    isSatelliteView = !isSatelliteView;
}

// Démarrer une mission
async function startMission() {
    try {
        showLoading(true);
        
        const position = await getCurrentPosition();
        if (!position) {
            showToast('Impossible d\'obtenir la position GPS', 'error');
            return;
        }
        
        const response = await api('/presence/start', {
            method: 'POST',
            body: JSON.stringify({
                lat: position.lat,
                lon: position.lon,
                accuracy: position.accuracy
            })
        });
        
        if (response.success) {
            showToast('Mission démarrée avec succès!', 'success');
            await checkCurrentMission();
        } else {
            showToast('Erreur: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('Erreur démarrage mission:', error);
        showToast('Erreur lors du démarrage de la mission', 'error');
    } finally {
        showLoading(false);
    }
}

// Marquer un check-in
async function checkIn() {
    try {
        showLoading(true);
        
        const position = await getCurrentPosition();
        if (!position) {
            showToast('Impossible d\'obtenir la position GPS', 'error');
            return;
        }
        
        const response = await api('/mission/checkin', {
            method: 'POST',
            body: JSON.stringify({
                mission_id: currentMission.id,
                lat: position.lat,
                lon: position.lon,
                accuracy: position.accuracy
            })
        });
        
        if (response.success) {
            showToast('Position enregistrée!', 'success');
            await loadCheckins(currentMission.id);
        } else {
            showToast('Erreur: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('Erreur check-in:', error);
        showToast('Erreur lors de l\'enregistrement de la position', 'error');
    } finally {
        showLoading(false);
    }
}

// Terminer une mission
async function endMission() {
    try {
        showLoading(true);
        
        const position = await getCurrentPosition();
        if (!position) {
            showToast('Impossible d\'obtenir la position GPS', 'error');
            return;
        }
        
        const response = await api('/presence/end', {
            method: 'POST',
            body: JSON.stringify({
                mission_id: currentMission.id,
                lat: position.lat,
                lon: position.lon,
                accuracy: position.accuracy
            })
        });
        
        if (response.success) {
            showToast('Mission terminée avec succès!', 'success');
            currentMission = null;
            updateMissionUI(null);
            // Supprimer les marqueurs de check-in
            checkinMarkers.forEach(marker => map.removeLayer(marker));
            checkinMarkers = [];
        } else {
            showToast('Erreur: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('Erreur fin mission:', error);
        showToast('Erreur lors de la fin de la mission', 'error');
    } finally {
        showLoading(false);
    }
}

// Obtenir la position actuelle
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Géolocalisation non supportée'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            function(error) {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// Afficher/masquer le loading
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Afficher une notification toast
function showToast(message, type = 'info') {
    // Créer un toast Bootstrap
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Supprimer le toast après fermeture
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Créer le conteneur de toasts
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

// Fonction API
async function api(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const url = `${API_BASE}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        ...options
    };
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erreur API');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Déconnexion
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Nettoyage à la fermeture
window.addEventListener('beforeunload', function() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
});
