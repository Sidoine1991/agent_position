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
let jwt = localStorage.getItem('jwt') || '';

// Vérification d'authentification (optionnelle pour la carte)
function checkAuth() {
    if (!jwt || jwt.length < 20) {
        console.log('⚠️ Pas de token d\'authentification, mode public activé');
        // Ne pas rediriger, permettre l'accès public à la carte
        return false;
    }
    return true;
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    // Restaurer jwt depuis localStorage si besoin
    jwt = localStorage.getItem('jwt') || jwt;
    
    // Initialiser la carte même sans authentification
    initMap();
    
    // Charger les données utilisateur seulement si authentifié
    if (checkAuth()) {
        loadUserData();
        checkCurrentMission();
        startLocationTracking();
    } else {
        // Mode public : afficher un message informatif
        console.log('🌍 Mode public : Carte accessible à tous');
        showPublicMode();
        loadPublicCheckins();
    }
});

// Fonction pour afficher le mode public
function showPublicMode() {
    // Afficher un message informatif dans la section des instructions
    const instructionsDiv = document.querySelector('.instructions');
    if (instructionsDiv) {
        instructionsDiv.innerHTML = `
            <h6><strong>🌍 Mode Public</strong></h6>
            <p>Cette carte est accessible à tous. Pour utiliser les fonctionnalités complètes, veuillez vous connecter.</p>
            <p><strong>Fonctionnalités disponibles :</strong></p>
            <ul>
                <li>📍 Visualisation de la carte</li>
                <li>🗺️ Navigation et zoom</li>
                <li>🌍 Changement de vue (satellite/standard)</li>
            </ul>
        `;
    }
}

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

// Fonction API
async function api(endpoint, options = {}) {
    const token = localStorage.getItem('jwt');
    const url = `${API_BASE}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : undefined
        },
        ...options
    };
    
    try {
        const response = await fetch(url, config);
        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            if (response.status === 404 && endpoint.startsWith('/profile')) {
                return { success: false };
            }
            throw new Error((data && (data.error || data.message)) || 'Erreur API');
        }
        
        return data;
    } catch (error) {
        if (!(endpoint.startsWith('/profile'))) {
            console.error('API Error:', error);
        }
        throw error;
    }
}

// Charger les données utilisateur
async function loadUserData() {
    try {
        if (!jwt) {
            document.getElementById('current-location').textContent = 'Mode public - Carte accessible';
            return;
        }
        
        const response = await api('/me');
        const user = response?.data?.user || response?.user;
        if (user) {
            document.getElementById('current-location').textContent = 
                `${user.commune || 'Non défini'}, ${user.departement || 'Non défini'}`;
        } else {
            document.getElementById('current-location').textContent = 'Mode public - Carte accessible';
        }
    } catch (error) {
        document.getElementById('current-location').textContent = 'Mode public - Carte accessible';
    }
}

// Vérifier la mission actuelle
async function checkCurrentMission() {
    if (!jwt || jwt.length < 20) {
        updateMissionUI(null);
        return;
    }
    try {
        const response = await api('/me/missions');
        const missions = response?.data?.missions || response?.missions || [];
        const activeMission = missions.find(m => m.status === 'active');
        if (activeMission) {
            currentMission = activeMission;
            updateMissionUI(activeMission);
            loadCheckins(activeMission.id);
        } else {
            updateMissionUI(null);
        }
    } catch (error) {}
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
        const latNum = Number(mission.start_lat);
        const lonNum = Number(mission.start_lon);
        const latLonText = Number.isFinite(latNum) && Number.isFinite(lonNum)
          ? `${latNum.toFixed(4)}, ${lonNum.toFixed(4)}`
          : 'N/A';
        document.getElementById('mission-details').innerHTML = `
            <strong>Mission #${mission.id}</strong><br>
            <small>Début: ${new Date(mission.start_time).toLocaleString()}</small><br>
            <small>Position: ${latLonText}</small>
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
        const list = response?.data?.checkins || response?.checkins || [];
        checkinMarkers.forEach(marker => map.removeLayer(marker));
        checkinMarkers = [];
        list.forEach(checkin => {
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
                    ${new Date(checkin.timestamp || checkin.checkin_time).toLocaleString('fr-FR')}<br>
                    ${checkin.accuracy ? `<small>Précision: ${checkin.accuracy}m</small>` : ''}
                `);
                checkinMarkers.push(marker);
            }
        });
    } catch (error) {}
}

// Démarrer le suivi de position
function startLocationTracking() {
    // En mode public, ne pas démarrer le tracking de localisation
    if (!jwt || jwt.length < 20) {
        console.log('🌍 Mode public : Pas de tracking de localisation');
        return;
    }
    
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
    if (!navigator.geolocation) {
        showToast('Géolocalisation non supportée par ce navigateur', 'error');
        return;
    }
    
    showToast('Recherche de votre position...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setView([lat, lng], 15);
            updateUserPosition(lat, lng, position.coords.accuracy);
            showToast('Position trouvée!', 'success');
        },
        function(error) {
            let errorMessage = 'Impossible d\'obtenir la position';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Permission de géolocalisation refusée';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Position indisponible';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Délai d\'attente dépassé';
                    break;
            }
            showToast(errorMessage + '. Utilisez la correction GPS manuelle.', 'warning');
        },
        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 30000
        }
    );
}

// Basculer entre vue normale et satellite
function toggleSatellite() {
    if (!map) {
        console.error('Carte non initialisée');
        return;
    }
    
    // Supprimer toutes les couches de tuiles existantes
    map.eachLayer(function(layer) {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });
    
    if (isSatelliteView) {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        showToast('Vue standard activée', 'info');
    } else {
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri'
        }).addTo(map);
        showToast('Vue satellite activée', 'info');
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
        
        let position;
        try {
            position = await getCurrentPosition();
        } catch (geoErr) {
            showToast('GPS indisponible (timeout). Entrez des coordonnées dans "Correction GPS" puis réessayez.', 'warning');
            return;
        }
        
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
        showToast('Erreur lors de l\'enregistrement de la position', 'error');
    } finally {
        showLoading(false);
    }
}

// Terminer une mission
async function endMission(missionId, button, status) {
    try {
        showLoading(true);
        
        const position = await getCurrentPosition();
        if (!position) {
            showToast('Impossible d\'obtenir la position GPS. Utilisez le bouton de secours.', 'warning');
            showForceEndButton(missionId, status);
            return;
        }
        
        const response = await api('/presence/end', {
            method: 'POST',
            body: JSON.stringify({
                mission_id: missionId || currentMission.id,
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
            hideForceEndButton();
        } else {
            showToast('Erreur: ' + response.message, 'error');
            showForceEndButton(missionId, status);
        }
    } catch (error) {
        console.error('Erreur fin mission:', error);
        showToast('Erreur lors de la fin de la mission. Utilisez le bouton de secours.', 'warning');
        showForceEndButton(missionId, status);
    } finally {
        showLoading(false);
    }
}

// Forcer la fin de mission sans GPS
async function forceEndMission(missionId, button, status) {
    try {
        console.log('🔧 Début de la fin forcée de mission:', { missionId, currentMission: currentMission?.id });
        showLoading(true);
        
        const targetMissionId = missionId || currentMission?.id;
        if (!targetMissionId) {
            throw new Error('Aucune mission active trouvée');
        }
        
        console.log('🔧 Envoi de la requête de fin forcée pour mission:', targetMissionId);
        const response = await api('/presence/force-end', {
            method: 'POST',
            body: JSON.stringify({
                mission_id: targetMissionId,
                note: 'Fin de mission (sans GPS)'
            })
        });
        
        console.log('🔧 Réponse reçue:', response);
        
        if (response.success) {
            showToast('Mission terminée (sans GPS)!', 'success');
            currentMission = null;
            updateMissionUI(null);
            // Supprimer les marqueurs de check-in
            checkinMarkers.forEach(marker => map.removeLayer(marker));
            checkinMarkers = [];
            hideForceEndButton();
        } else {
            console.error('❌ Erreur dans la réponse:', response);
            showToast('Erreur: ' + response.message, 'error');
        }
    } catch (error) {
        console.error('❌ Erreur fin forcée mission:', error);
        showToast('Erreur lors de la fin forcée de la mission: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Afficher le bouton de secours
function showForceEndButton(missionId, status) {
    console.log('🔧 Affichage du bouton de secours pour mission:', missionId);
    
    let forceBtn = document.getElementById('force-end-mission');
    if (!forceBtn) {
        console.log('🔧 Création du bouton de secours...');
        forceBtn = document.createElement('button');
        forceBtn.id = 'force-end-mission';
        forceBtn.className = 'btn btn-warning mt-2';
        forceBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Finir sans GPS (Secours)';
        
        // Ajouter le bouton après le bouton de fin normal
        const endBtn = document.getElementById('end-btn');
        if (endBtn && endBtn.parentNode) {
            endBtn.parentNode.insertBefore(forceBtn, endBtn.nextSibling);
            console.log('✅ Bouton de secours ajouté après le bouton de fin');
        } else {
            console.warn('⚠️ Bouton de fin non trouvé, ajout du bouton de secours au body');
            document.body.appendChild(forceBtn);
        }
    }
    
    // Configurer l'événement avec les paramètres
    forceBtn.onclick = () => {
        console.log('🔧 Clic sur le bouton de secours pour mission:', missionId);
        forceEndMission(missionId, forceBtn, status);
    };
    forceBtn.style.display = 'block';
    console.log('✅ Bouton de secours affiché');
}

// Masquer le bouton de secours
function hideForceEndButton() {
    const forceBtn = document.getElementById('force-end-mission');
    if (forceBtn) {
        forceBtn.style.display = 'none';
    }
}

// Obtenir la position actuelle (GPS ou corrigée)
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        // Si une position a été corrigée manuellement, l'utiliser
        if (correctedPosition) {
            resolve({
                lat: Number(correctedPosition.lat),
                lon: Number(correctedPosition.lng ?? correctedPosition.lon),
                accuracy: null
            });
            return;
        }
        
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
                // Fallback doux: si utilisateur a entré une correction après coup
                if (correctedPosition) {
                    resolve({
                        lat: Number(correctedPosition.lat),
                        lon: Number(correctedPosition.lng ?? correctedPosition.lon),
                        accuracy: null
                    });
                    return;
                }
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 5000
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

// Déconnexion
function logout() {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Nettoyage à la fermeture
window.addEventListener('beforeunload', function() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
});

// Variables pour la correction GPS
let correctedPosition = null;
let gpsCorrectionPanelVisible = true;

// Fonction pour corriger la position GPS manuellement
function correctGPSPosition() {
    const latInput = document.getElementById('manual-lat');
    const lngInput = document.getElementById('manual-lng');
    
    if (!latInput || !lngInput) {
        showToast('Erreur: Champs de coordonnées non trouvés', 'error');
        return;
    }
    
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    
    if (isNaN(lat) || isNaN(lng)) {
        showToast('Veuillez entrer des coordonnées valides', 'error');
        return;
    }
    
    if (lat < -90 || lat > 90) {
        showToast('La latitude doit être entre -90 et 90', 'error');
        return;
    }
    
    if (lng < -180 || lng > 180) {
        showToast('La longitude doit être entre -180 et 180', 'error');
        return;
    }
    
    // Sauvegarder la position corrigée
    correctedPosition = { lat, lng };
    
    // Mettre à jour le marqueur utilisateur
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'user-marker',
            html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    }).addTo(map);
    
    // Mettre à jour l'affichage
    updatePositionDisplay(lat, lng, 'Position corrigée manuellement');
    
    // Centrer la carte sur la position corrigée
    map.setView([lat, lng], 15);
    
    showToast('Position GPS corrigée avec succès!', 'success');
    console.log('✅ Position GPS corrigée:', lat, lng);
}

// Fonction pour centrer sur la position corrigée
function centerOnCorrectedPosition() {
    if (correctedPosition) {
        map.setView([correctedPosition.lat, correctedPosition.lng], 15);
        showToast('Centrage sur position corrigée', 'info');
        console.log('🎯 Centrage sur position corrigée');
    } else {
        showToast('Aucune position corrigée disponible. Veuillez d\'abord corriger votre position.', 'warning');
    }
}

// Fonction pour basculer la visibilité du panneau
function toggleGPSCorrection() {
    const panel = document.getElementById('gps-correction-panel');
    const button = event.target;
    
    if (!panel || !button) {
        console.error('Éléments du panneau GPS non trouvés');
        return;
    }
    
    if (gpsCorrectionPanelVisible) {
        panel.style.display = 'none';
        button.innerHTML = '<i class="fas fa-eye me-1"></i>Afficher';
        gpsCorrectionPanelVisible = false;
    } else {
        panel.style.display = 'block';
        button.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Masquer';
        gpsCorrectionPanelVisible = true;
    }
}

// Fonction pour mettre à jour l'affichage de la position
function updatePositionDisplay(lat, lng, source = 'GPS') {
    const currentPositionSpan = document.getElementById('current-position');
    const gpsAccuracySpan = document.getElementById('gps-accuracy');
    
    if (currentPositionSpan) {
        currentPositionSpan.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)} (${source})`;
    }
    
    if (gpsAccuracySpan && source === 'GPS') {
        // La précision sera mise à jour par la fonction de géolocalisation
    } else if (gpsAccuracySpan && source === 'Position corrigée manuellement') {
        gpsAccuracySpan.textContent = 'Corrigée manuellement';
    }
}

// Fonction pour obtenir la position actuelle (GPS ou corrigée) - Version UI
function getCurrentPositionUI() {
    if (correctedPosition) {
        return correctedPosition;
    }
    
    // Essayer d'obtenir la position GPS
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                updatePositionDisplay(lat, lng, 'GPS');
                document.getElementById('gps-accuracy').textContent = `${Math.round(accuracy)}m`;
                
                // Mettre à jour le marqueur
                if (userMarker) {
                    map.removeLayer(userMarker);
                }
                
                userMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'user-marker',
                        html: '<div style="background: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(map);
                
                // Centrer sur la position GPS
                map.setView([lat, lng], 15);
            },
            function(error) {
                console.error('Erreur GPS:', error);
                updatePositionDisplay(0, 0, 'Erreur GPS');
                document.getElementById('gps-accuracy').textContent = 'Erreur';
            }
        );
    }
}

// Initialiser la correction GPS au chargement
document.addEventListener('DOMContentLoaded', function() {
    // Ajouter un bouton pour obtenir la position GPS
    const gpsButtons = document.querySelector('.gps-buttons');
    if (gpsButtons) {
        const gpsButton = document.createElement('button');
        gpsButton.className = 'btn-center';
        gpsButton.innerHTML = '<i class="fas fa-location-arrow me-1"></i>GPS';
        gpsButton.onclick = getCurrentPositionUI;
        gpsButtons.appendChild(gpsButton);
    }
    // Initialiser la gestion du long-press sur la carte
    setupLongPressToDropMarker();

    // Rendre les panneaux draggable (simple implémentation)
    makeDraggable(document.getElementById('gps-correction-panel'));
    makeDraggable(document.querySelector('.search-container'));
});

function makeDraggable(el) {
    if (!el) return;
    let isDown = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    el.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.clientX; startY = e.clientY;
        const rect = el.getBoundingClientRect();
        origX = rect.left; origY = rect.top;
        document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = `${origX + dx}px`;
        el.style.top = `${origY + dy}px`;
        el.style.right = 'auto';
        el.style.transform = 'none';
        el.style.position = 'fixed';
    });
    window.addEventListener('mouseup', () => {
        isDown = false;
        document.body.style.userSelect = '';
    });
}

// Recherche de lieux via Nominatim (OpenStreetMap)
let searchAbortController = null;
async function searchPlace(e) {
    const query = e.target.value.trim();
    const resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;
    if (query.length < 3) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }

    try {
        if (searchAbortController) searchAbortController.abort();
        searchAbortController = new AbortController();

        let itemsHtml = '';
        // Essayer SerpApi (proxy backend) si dispo
        try {
            const resSerp = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}`, { signal: searchAbortController.signal });
            const js = await resSerp.json();
            if (js && js.success && Array.isArray(js.results) && js.results.length) {
                itemsHtml = js.results.map(r => {
                    const label = r.label || `${r.lat}, ${r.lon}`;
                    return `<div class=\"search-item\" onclick=\"selectSearchResult(${r.lat}, ${r.lon}, ${JSON.stringify(label).replace(/\\\"/g,'&quot;')})\">${label}</div>`;
                }).join('');
            }
        } catch {}

        // Fallback Nominatim
        if (!itemsHtml) {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'fr' }, signal: searchAbortController.signal });
            const data = await res.json();
            itemsHtml = (data || []).map(item => {
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                const label = item.display_name;
                return `<div class=\"search-item\" onclick=\"selectSearchResult(${lat}, ${lon}, ${JSON.stringify(label).replace(/\\\"/g,'&quot;')})\">${label}</div>`;
            }).join('');
        }

        resultsEl.innerHTML = itemsHtml || '<div class="search-item">Aucun résultat</div>';
        resultsEl.style.display = 'block';
    } catch (err) {
        console.error('Recherche lieu échouée:', err);
    }
}

function clearSearch() {
    const input = document.getElementById('place-search');
    const resultsEl = document.getElementById('search-results');
    if (input) input.value = '';
    if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; }
}

window.selectSearchResult = function(lat, lon, label) {
    try {
        // Centrer la carte
        map.setView([lat, lon], 15);
        
        // Définir la position corrigée pour que startMission() l'utilise
        correctedPosition = { lat: Number(lat), lng: Number(lon), lon: Number(lon) };
        updatePositionDisplay(Number(lat), Number(lon), 'Position sélectionnée');
        
        // Déposer un marqueur de départ par défaut
        dropMissionStartMarker({ lat: Number(lat), lng: Number(lon) });
        
        // Mise à jour des champs manuels
        const latEl = document.getElementById('manual-lat');
        const lngEl = document.getElementById('manual-lng');
        if (latEl && lngEl) { latEl.value = Number(lat).toFixed(6); lngEl.value = Number(lon).toFixed(6); }
        
        // Fermer les résultats
        clearSearch();
        
        // Indication à l'utilisateur
        showToast('Lieu sélectionné. Vous pouvez démarrer la mission ici.', 'info');
    } catch {}
}

// Long-press / tap prolongé pour déposer le marqueur de départ de mission
let longPressTimeout = null;
let missionStartMarker = null;
let missionEndMarker = null;
function setupLongPressToDropMarker() {
    if (!map) return;
    const pressDurationMs = 600;
    let pressed = false;

    function startPress(e) {
        pressed = true;
        const latlng = e.latlng || map.mouseEventToLatLng(e.originalEvent || e);
        longPressTimeout = setTimeout(() => {
            if (pressed) {
                dropMissionStartMarker(latlng);
            }
        }, pressDurationMs);
    }
    function endPress() {
        pressed = false;
        if (longPressTimeout) { clearTimeout(longPressTimeout); longPressTimeout = null; }
    }

    map.on('mousedown', startPress);
    map.on('touchstart', startPress);
    map.on('mouseup', endPress);
    map.on('touchend', endPress);
}

function dropMissionStartMarker(latlng) {
    try {
        if (missionStartMarker) map.removeLayer(missionStartMarker);
        missionStartMarker = L.marker([latlng.lat, latlng.lng], {
            draggable: true,
            title: 'Départ de mission'
        }).addTo(map).bindPopup('Départ de mission').openPopup();

        // Mettre aussi dans le panneau de correction pour cohérence
        const latEl = document.getElementById('manual-lat');
        const lngEl = document.getElementById('manual-lng');
        if (latEl && lngEl) { latEl.value = latlng.lat.toFixed(6); lngEl.value = latlng.lng.toFixed(6); }

        missionStartMarker.on('dragend', function(ev){
            const p = ev.target.getLatLng();
            if (latEl && lngEl) { latEl.value = p.lat.toFixed(6); lngEl.value = p.lng.toFixed(6); }
        });
    } catch (e) { console.error('Erreur dépôt marqueur mission:', e); }
}

function dropMissionEndMarker(latlng) {
    try {
        if (missionEndMarker) map.removeLayer(missionEndMarker);
        missionEndMarker = L.marker([latlng.lat, latlng.lng], {
            draggable: true,
            title: 'Fin de mission',
            icon: L.divIcon({
                className: 'end-marker',
                html: '<div style="background: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(map).bindPopup('Fin de mission').openPopup();

        const latEl = document.getElementById('manual-lat');
        const lngEl = document.getElementById('manual-lng');
        if (latEl && lngEl) { latEl.value = latlng.lat.toFixed(6); lngEl.value = latlng.lng.toFixed(6); }

        missionEndMarker.on('dragend', function(ev){
            const p = ev.target.getLatLng();
            if (latEl && lngEl) { latEl.value = p.lat.toFixed(6); lngEl.value = p.lng.toFixed(6); }
        });
    } catch (e) { console.error('Erreur dépôt marqueur fin:', e); }
}

// Charger des points publics si non authentifié
async function loadPublicCheckins() {
    try {
        const res = await fetch(`${API_BASE}/public/checkins/latest?limit=150`);
        const data = await res.json().catch(() => ({}));
        const list = data?.data?.checkins || data?.checkins || [];
        checkinMarkers.forEach(m => { try { map.removeLayer(m); } catch {} });
        checkinMarkers = [];
        const latlngs = [];
        for (const r of list) {
            if (typeof r.lat !== 'number' || typeof r.lon !== 'number') continue;
            const marker = L.circleMarker([r.lat, r.lon], {
                radius: 6,
                color: '#2563eb',
                fillColor: '#60a5fa',
                fillOpacity: 0.6,
                weight: 1
            }).addTo(map);
            marker.bindPopup(`<b>${r.agent_name || 'Agent'}</b><br>${new Date(r.timestamp).toLocaleString('fr-FR')}<br>${r.commune || ''}`);
            checkinMarkers.push(marker);
            latlngs.push([r.lat, r.lon]);
        }
        if (latlngs.length) map.fitBounds(latlngs, { padding: [20, 20] });
    } catch (e) {}
}

function renderStatusBar() {
    try {
        const bar = document.getElementById('status-bar-content');
        if (!bar) return;
        const loc = (document.getElementById('current-location')?.textContent || '').trim();
        const statusTxt = (document.getElementById('status-text')?.textContent || '').trim();
        const missionBlock = document.getElementById('mission-details');
        const missionHtml = missionBlock && missionBlock.innerHTML ? missionBlock.innerHTML : '';

        const missionPieces = [];
        if (currentMission) {
            missionPieces.push(`🆔 #${currentMission.id}`);
            const dt = new Date(currentMission.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            missionPieces.push(`⏱️ ${dt}`);
            const latNum = Number(currentMission.start_lat);
            const lonNum = Number(currentMission.start_lon);
            if (Number.isFinite(latNum) && Number.isFinite(lonNum)) missionPieces.push(`📍 ${latNum.toFixed(4)}, ${lonNum.toFixed(4)}`);
        }

        bar.innerHTML = `
          <span title="Position">📌 ${loc || 'Position inconnue'}</span>
          <span class="text-muted">|</span>
          <span title="Statut">${statusTxt.includes('active') ? '✅ Active' : statusTxt.includes('Aucune') ? '⏸️ Inactive' : 'ℹ️ ' + statusTxt}</span>
          ${currentMission ? `<span class="text-muted">|</span><span title="Mission">🧭 ${missionPieces.join(' · ')}</span>` : ''}
          <span class="text-muted">|</span>
          <span title="Astuce">💡 Cherchez un lieu, cliquez, puis Démarrer</span>
        `;
    } catch {}
}

// Appels pour garder la barre à jour
(function hookStatusBar(){
    const origUpdateMissionUI = updateMissionUI;
    updateMissionUI = function(m){ origUpdateMissionUI(m); renderStatusBar(); };
    const origUpdateUserPosition = updateUserPosition;
    updateUserPosition = function(a,b,c){ origUpdateUserPosition(a,b,c); renderStatusBar(); };
    document.addEventListener('DOMContentLoaded', () => setTimeout(renderStatusBar, 300));
})();
