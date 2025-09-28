// ===== DASHBOARD MODERNE - GESTION COMPLÈTE =====

class DashboardManager {
    constructor() {
        this.currentMission = null;
        this.userProfile = null;
        this.presenceStats = null;
        this.init();
    }

    async init() {
        try {
            // Charger le profil utilisateur
            this.userProfile = await dataManager.getUserProfile();
            if (!this.userProfile) {
                window.location.href = 'index.html';
                return;
            }

            // Mettre à jour l'interface
            this.updateWelcomeMessage();
            this.updateClock();
            this.loadDashboardData();
            
            // Configurer les événements
            this.setupEventListeners();
            
            // Actualiser l'horloge toutes les secondes
            setInterval(() => this.updateClock(), 1000);
            
        } catch (error) {
            dataManager.handleError(error, 'Dashboard initialization');
        }
    }

    setupEventListeners() {
        // Gestion des fichiers photo
        const photoInput = document.getElementById('checkin-photo');
        if (photoInput) {
            photoInput.addEventListener('change', (e) => this.handlePhotoChange(e));
        }

        // Gestion des formulaires
        const noteInput = document.getElementById('checkin-note');
        if (noteInput) {
            noteInput.addEventListener('input', () => this.validateCheckinForm());
        }
    }

    updateWelcomeMessage() {
        if (!this.userProfile) return;

        const welcomeTitle = document.getElementById('welcome-title');
        const welcomeSubtitle = document.getElementById('welcome-subtitle');
        
        if (welcomeTitle) {
            welcomeTitle.textContent = `Bonjour ${this.userProfile.first_name}`;
        }
        
        if (welcomeSubtitle) {
            const role = this.getRoleDisplayName(this.userProfile.role);
            welcomeSubtitle.textContent = `${role} - ${this.userProfile.project_name || 'Projet non défini'}`;
        }
    }

    getRoleDisplayName(role) {
        const roles = {
            'admin': 'Administrateur',
            'supervisor': 'Superviseur',
            'agent': 'Agent'
        };
        return roles[role] || 'Utilisateur';
    }

    updateClock() {
        const now = new Date();
        const timeElement = document.getElementById('current-time');
        const dateElement = document.getElementById('current-date');
        
        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    async loadDashboardData() {
        try {
            // Charger les données en parallèle
            await Promise.all([
                this.loadMissionStatus(),
                this.loadPresenceStats(),
                this.loadRecentActivity(),
                this.loadMissionHistory()
            ]);
        } catch (error) {
            dataManager.handleError(error, 'Dashboard data loading');
        }
    }

    async loadMissionStatus() {
        try {
            const mission = await dataManager.getCurrentMission();
            this.currentMission = mission;
            this.updateMissionStatus(mission);
        } catch (error) {
            this.showMissionStatusError();
        }
    }

    updateMissionStatus(mission) {
        const statusElement = document.getElementById('mission-status');
        const startBtn = document.getElementById('start-mission-btn');
        const endBtn = document.getElementById('end-mission-btn');
        const checkinBtn = document.getElementById('checkin-btn');

        if (!statusElement) return;

        if (mission) {
            statusElement.innerHTML = `
                <div class="flex items-center justify-between p-4 bg-success bg-opacity-10 rounded-lg border border-success">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">🚀</span>
                        <div>
                            <div class="font-semibold text-success">Mission Active</div>
                            <div class="text-sm text-muted">Démarrée le ${dataManager.formatDateTime(mission.start_time)}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm text-muted">Durée</div>
                        <div class="font-semibold" id="mission-duration">Calcul...</div>
                    </div>
                </div>
            `;
            
            if (startBtn) startBtn.disabled = true;
            if (endBtn) endBtn.disabled = false;
            if (checkinBtn) checkinBtn.disabled = false;
            
            this.startMissionTimer();
        } else {
            statusElement.innerHTML = `
                <div class="flex items-center justify-center p-4 bg-warning bg-opacity-10 rounded-lg border border-warning">
                    <span class="text-2xl mr-3">⏸️</span>
                    <div class="text-center">
                        <div class="font-semibold text-warning">Aucune Mission Active</div>
                        <div class="text-sm text-muted">Démarrez une nouvelle mission pour commencer</div>
                    </div>
                </div>
            `;
            
            if (startBtn) startBtn.disabled = false;
            if (endBtn) endBtn.disabled = true;
            if (checkinBtn) checkinBtn.disabled = true;
        }
    }

    showMissionStatusError() {
        const statusElement = document.getElementById('mission-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="flex items-center justify-center p-4 bg-danger bg-opacity-10 rounded-lg border border-danger">
                    <span class="text-2xl mr-3">❌</span>
                    <div class="text-center">
                        <div class="font-semibold text-danger">Erreur de Chargement</div>
                        <div class="text-sm text-muted">Impossible de charger le statut de la mission</div>
                    </div>
                </div>
            `;
        }
    }

    startMissionTimer() {
        if (!this.currentMission) return;
        
        const updateDuration = () => {
            const durationElement = document.getElementById('mission-duration');
            if (!durationElement) return;
            
            const startTime = new Date(this.currentMission.start_time);
            const now = new Date();
            const diff = now - startTime;
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            durationElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };
        
        updateDuration();
        setInterval(updateDuration, 1000);
    }

    async loadPresenceStats() {
        try {
            const stats = await dataManager.getPresenceStats();
            this.presenceStats = stats;
            this.updatePresenceStats(stats);
        } catch (error) {
            console.error('Failed to load presence stats:', error);
        }
    }

    updatePresenceStats(stats) {
        if (!stats) return;

        const todayElement = document.getElementById('today-presence');
        const monthElement = document.getElementById('month-presence');
        const totalElement = document.getElementById('total-missions');

        if (todayElement) {
            todayElement.textContent = stats.today_presences || 0;
        }
        
        if (monthElement) {
            monthElement.textContent = stats.month_presences || 0;
        }
        
        if (totalElement) {
            totalElement.textContent = stats.total_missions || 0;
        }
    }

    async loadRecentActivity() {
        try {
            const history = await dataManager.getPresenceHistory(null, null);
            this.updateRecentActivity(history);
        } catch (error) {
            this.showRecentActivityError();
        }
    }

    updateRecentActivity(history) {
        const activityElement = document.getElementById('recent-activity');
        if (!activityElement) return;

        if (!history || history.length === 0) {
            activityElement.innerHTML = `
                <div class="text-center text-muted py-4">
                    <span class="text-2xl">📝</span>
                    <div class="mt-2">Aucune activité récente</div>
                </div>
            `;
            return;
        }

        const recentItems = history.slice(0, 5);
        activityElement.innerHTML = recentItems.map(item => `
            <div class="flex items-center justify-between p-3 border-b border-light last:border-b-0">
                <div class="flex items-center">
                    <span class="text-lg mr-3">📍</span>
                    <div>
                        <div class="font-medium">Présence enregistrée</div>
                        <div class="text-sm text-muted">${dataManager.formatDateTime(item.created_at)}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm text-muted">Précision</div>
                    <div class="font-medium">${item.accuracy ? Math.round(item.accuracy) + 'm' : 'N/A'}</div>
                </div>
            </div>
        `).join('');
    }

    showRecentActivityError() {
        const activityElement = document.getElementById('recent-activity');
        if (activityElement) {
            activityElement.innerHTML = `
                <div class="text-center text-danger py-4">
                    <span class="text-2xl">❌</span>
                    <div class="mt-2">Erreur de chargement de l'activité</div>
                </div>
            `;
        }
    }

    async loadMissionHistory() {
        try {
            const missions = await dataManager.request('/me/missions');
            this.updateMissionHistory(missions);
        } catch (error) {
            this.showMissionHistoryError();
        }
    }

    updateMissionHistory(missions) {
        const historyElement = document.getElementById('mission-history');
        if (!historyElement) return;

        if (!missions || missions.length === 0) {
            historyElement.innerHTML = `
                <div class="text-center text-muted py-4">
                    <span class="text-2xl">📋</span>
                    <div class="mt-2">Aucune mission trouvée</div>
                </div>
            `;
            return;
        }

        historyElement.innerHTML = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Statut</th>
                            <th>Durée</th>
                            <th>Présences</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${missions.map(mission => `
                            <tr>
                                <td>${dataManager.formatDate(mission.start_time)}</td>
                                <td>
                                    <span class="badge ${mission.status === 'completed' ? 'badge-success' : 'badge-warning'}">
                                        ${mission.status === 'completed' ? 'Terminée' : 'Active'}
                                    </span>
                                </td>
                                <td>${this.calculateMissionDuration(mission)}</td>
                                <td>${mission.presence_count || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    calculateMissionDuration(mission) {
        const startTime = new Date(mission.start_time);
        const endTime = mission.end_time ? new Date(mission.end_time) : new Date();
        const diff = endTime - startTime;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}h ${minutes}m`;
    }

    showMissionHistoryError() {
        const historyElement = document.getElementById('mission-history');
        if (historyElement) {
            historyElement.innerHTML = `
                <div class="text-center text-danger py-4">
                    <span class="text-2xl">❌</span>
                    <div class="mt-2">Erreur de chargement de l'historique</div>
                </div>
            `;
        }
    }

    handlePhotoChange(event) {
        const file = event.target.files[0];
        if (file) {
            // Vérifier la taille du fichier (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                dataManager.showNotification('La photo doit faire moins de 5MB', 'error');
                event.target.value = '';
                return;
            }
            
            // Vérifier le type de fichier
            if (!file.type.startsWith('image/')) {
                dataManager.showNotification('Veuillez sélectionner une image', 'error');
                event.target.value = '';
                return;
            }
            
            dataManager.showNotification('Photo sélectionnée avec succès', 'success');
        }
    }

    validateCheckinForm() {
        const checkinBtn = document.getElementById('checkin-btn');
        if (checkinBtn) {
            checkinBtn.disabled = !this.currentMission;
        }
    }
}

// ===== FONCTIONS GLOBALES =====

async function startMission() {
    try {
        const startBtn = document.getElementById('start-mission-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<div class="spinner"></div> Démarrage...';
        }

        const mission = await dataManager.startMission();
        dashboardManager.currentMission = mission;
        dashboardManager.updateMissionStatus(mission);
        
        dataManager.showNotification('Mission démarrée avec succès', 'success');
        
        // Recharger les données
        await dashboardManager.loadDashboardData();
        
    } catch (error) {
        dataManager.handleError(error, 'Start mission');
        
        const startBtn = document.getElementById('start-mission-btn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<span class="navbar-icon">🚀</span> Démarrer Mission';
        }
    }
}

async function endMission() {
    try {
        const endBtn = document.getElementById('end-mission-btn');
        if (endBtn) {
            endBtn.disabled = true;
            endBtn.innerHTML = '<div class="spinner"></div> Finalisation...';
        }

        await dataManager.endMission();
        dashboardManager.currentMission = null;
        dashboardManager.updateMissionStatus(null);
        
        dataManager.showNotification('Mission terminée avec succès', 'success');
        
        // Recharger les données
        await dashboardManager.loadDashboardData();
        
    } catch (error) {
        dataManager.handleError(error, 'End mission');
        
        const endBtn = document.getElementById('end-mission-btn');
        if (endBtn) {
            endBtn.disabled = false;
            endBtn.innerHTML = '<span class="navbar-icon">🏁</span> Terminer Mission';
        }
    }
}

async function submitCheckin() {
    try {
        const checkinBtn = document.getElementById('checkin-btn');
        const noteInput = document.getElementById('checkin-note');
        const photoInput = document.getElementById('checkin-photo');
        
        if (checkinBtn) {
            checkinBtn.disabled = true;
            checkinBtn.innerHTML = '<div class="spinner"></div> Envoi...';
        }

        // Obtenir la position GPS
        const position = await getCurrentLocationWithValidation();
        
        // Préparer les données
        const checkinData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            note: noteInput ? noteInput.value.trim() : '',
            timestamp: new Date().toISOString()
        };

        // Ajouter la photo si présente
        if (photoInput && photoInput.files[0]) {
            const photoFile = photoInput.files[0];
            const base64 = await fileToBase64(photoFile);
            checkinData.photo = base64;
        }

        // Envoyer les données
        await dataManager.submitCheckin(checkinData);
        
        dataManager.showNotification('Présence enregistrée avec succès', 'success');
        
        // Vider le formulaire
        if (noteInput) noteInput.value = '';
        if (photoInput) photoInput.value = '';
        
        // Recharger les données
        await dashboardManager.loadDashboardData();
        
    } catch (error) {
        dataManager.handleError(error, 'Submit checkin');
    } finally {
        const checkinBtn = document.getElementById('checkin-btn');
        if (checkinBtn) {
            checkinBtn.disabled = !dashboardManager.currentMission;
            checkinBtn.innerHTML = '<span class="navbar-icon">📍</span> Envoyer votre présence sur le serveur';
        }
    }
}

async function getCurrentLocationWithValidation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Géolocalisation non supportée'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Vérifier la précision
                if (position.coords.accuracy > 500) {
                    const confirmLowAccuracy = confirm(
                        `Précision GPS faible (${Math.round(position.coords.accuracy)}m). ` +
                        'Voulez-vous continuer quand même ?'
                    );
                    
                    if (!confirmLowAccuracy) {
                        reject(new Error('Précision GPS insuffisante'));
                        return;
                    }
                }
                
                resolve(position);
            },
            (error) => {
                let message = 'Erreur de géolocalisation';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Permission de géolocalisation refusée';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Position non disponible';
                        break;
                    case error.TIMEOUT:
                        message = 'Timeout de géolocalisation';
                        break;
                }
                reject(new Error(message));
            },
            options
        );
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ===== FONCTIONS DE CHARGEMENT DES PAGES =====

async function loadDashboard() {
    if (window.dashboardManager) {
        await dashboardManager.loadDashboardData();
    }
}

async function loadProfile() {
    const content = document.getElementById('profile-content');
    if (!content) return;

    try {
        const profile = await dataManager.getUserProfile();
        if (!profile) return;

        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title">Informations Personnelles</h4>
                    </div>
                    <div class="card-body">
                        <div class="space-y-4">
                            <div>
                                <label class="form-label">Nom complet</label>
                                <div class="text-lg font-medium">${profile.first_name} ${profile.last_name}</div>
                            </div>
                            <div>
                                <label class="form-label">Email</label>
                                <div class="text-lg">${profile.email}</div>
                            </div>
                            <div>
                                <label class="form-label">Téléphone</label>
                                <div class="text-lg">${profile.phone || 'Non défini'}</div>
                            </div>
                            <div>
                                <label class="form-label">Rôle</label>
                                <span class="badge badge-primary">${dashboardManager.getRoleDisplayName(profile.role)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title">Informations Projet</h4>
                    </div>
                    <div class="card-body">
                        <div class="space-y-4">
                            <div>
                                <label class="form-label">Nom du projet</label>
                                <div class="text-lg">${profile.project_name || 'Non défini'}</div>
                            </div>
                            <div>
                                <label class="form-label">Date de début</label>
                                <div class="text-lg">${profile.planning_start_date ? dataManager.formatDate(profile.planning_start_date) : 'Non définie'}</div>
                            </div>
                            <div>
                                <label class="form-label">Date de fin</label>
                                <div class="text-lg">${profile.planning_end_date ? dataManager.formatDate(profile.planning_end_date) : 'Non définie'}</div>
                            </div>
                            <div>
                                <label class="form-label">Jours attendus par mois</label>
                                <div class="text-lg">${profile.expected_days_per_month || 'Non défini'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `
            <div class="text-center text-danger py-4">
                <span class="text-2xl">❌</span>
                <div class="mt-2">Erreur de chargement du profil</div>
            </div>
        `;
    }
}

async function loadAgents() {
    const content = document.getElementById('agents-content');
    if (!content) return;

    try {
        const agents = await dataManager.getAgents();
        
        if (agents.length === 0) {
            content.innerHTML = `
                <div class="text-center text-muted py-4">
                    <span class="text-2xl">👥</span>
                    <div class="mt-2">Aucun agent trouvé</div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Email</th>
                            <th>Téléphone</th>
                            <th>Rôle</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${agents.map(agent => `
                            <tr>
                                <td>
                                    <div class="font-medium">${agent.first_name} ${agent.last_name}</div>
                                </td>
                                <td>${agent.email}</td>
                                <td>${agent.phone || 'N/A'}</td>
                                <td>
                                    <span class="badge badge-primary">${dashboardManager.getRoleDisplayName(agent.role)}</span>
                                </td>
                                <td>
                                    <span class="badge ${agent.is_active ? 'badge-success' : 'badge-danger'}">
                                        ${agent.is_active ? 'Actif' : 'Inactif'}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-outline" onclick="editAgent(${agent.id})">
                                        Modifier
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `
            <div class="text-center text-danger py-4">
                <span class="text-2xl">❌</span>
                <div class="mt-2">Erreur de chargement des agents</div>
            </div>
        `;
    }
}

async function loadReports() {
    const content = document.getElementById('reports-content');
    if (!content) return;

    try {
        const reports = await dataManager.getReports();
        
        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title">Rapports Disponibles</h4>
                    </div>
                    <div class="card-body">
                        <div class="space-y-4">
                            <button class="btn btn-primary w-full" onclick="generateReport('daily')">
                                📊 Rapport Quotidien
                            </button>
                            <button class="btn btn-primary w-full" onclick="generateReport('monthly')">
                                📈 Rapport Mensuel
                            </button>
                            <button class="btn btn-primary w-full" onclick="generateReport('agents')">
                                👥 Rapport par Agent
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title">Rapports Récents</h4>
                    </div>
                    <div class="card-body">
                        <div class="text-center text-muted py-4">
                            <span class="text-2xl">📋</span>
                            <div class="mt-2">Aucun rapport récent</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `
            <div class="text-center text-danger py-4">
                <span class="text-2xl">❌</span>
                <div class="mt-2">Erreur de chargement des rapports</div>
            </div>
        `;
    }
}

async function loadAdmin() {
    const content = document.getElementById('admin-content');
    if (!content) return;

    try {
        const stats = await dataManager.getAdminStats();
        
        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-3xl font-bold text-primary mb-2">${stats?.total_agents || 0}</div>
                        <div class="text-sm text-secondary">Agents Total</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-3xl font-bold text-success mb-2">${stats?.active_agents || 0}</div>
                        <div class="text-sm text-secondary">Agents Actifs</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-3xl font-bold text-warning mb-2">${stats?.total_presences || 0}</div>
                        <div class="text-sm text-secondary">Présences Total</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h4 class="card-title">Actions d'Administration</h4>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button class="btn btn-primary" onclick="manageAgents()">
                            👥 Gérer les Agents
                        </button>
                        <button class="btn btn-secondary" onclick="viewReports()">
                            📊 Voir les Rapports
                        </button>
                        <button class="btn btn-warning" onclick="systemSettings()">
                            ⚙️ Paramètres Système
                        </button>
                        <button class="btn btn-danger" onclick="systemMaintenance()">
                            🔧 Maintenance
                        </button>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `
            <div class="text-center text-danger py-4">
                <span class="text-2xl">❌</span>
                <div class="mt-2">Erreur de chargement de l'administration</div>
            </div>
        `;
    }
}

// ===== FONCTIONS UTILITAIRES =====

function editAgent(agentId) {
    dataManager.showNotification('Fonctionnalité en développement', 'info');
}

function generateReport(type) {
    dataManager.showNotification('Génération de rapport en cours...', 'info');
    // Implémentation de la génération de rapports
}

function manageAgents() {
    navigation.navigateTo('agents');
}

function viewReports() {
    navigation.navigateTo('reports');
}

function systemSettings() {
    dataManager.showNotification('Paramètres système en développement', 'info');
}

function systemMaintenance() {
    dataManager.showNotification('Maintenance système en développement', 'info');
}

// ===== INITIALISATION =====

// Initialiser le dashboard quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

// Exporter les fonctions globales
window.loadDashboard = loadDashboard;
window.loadProfile = loadProfile;
window.loadAgents = loadAgents;
window.loadReports = loadReports;
window.loadAdmin = loadAdmin;
window.startMission = startMission;
window.endMission = endMission;
window.submitCheckin = submitCheckin;