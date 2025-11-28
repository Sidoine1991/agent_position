/**
 * Système de planification intelligente pour l'application CCRB
 * Optimise les itinéraires, suggère des planifications et gère les conflits
 */

class SmartPlanning {
  constructor() {
    this.agents = [];
    this.missions = [];
    this.locations = [];
    this.optimizedRoutes = new Map();
    this.conflicts = [];
    this.suggestions = [];
    
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.startOptimizationEngine();
  }

  async loadData() {
    // Initialiser les tableaux vides par défaut
    this.agents = [];
    this.missions = [];
    this.locations = [];
    this.conflicts = [];
    this.suggestions = [];
    
    try {
      // Charger les agents
      const agentsResponse = await fetch('/api/admin/agents');
      if (agentsResponse && agentsResponse.ok) {
        try {
          const agentsData = await agentsResponse.json();
          this.agents = Array.isArray(agentsData.agents) ? agentsData.agents : 
                       Array.isArray(agentsData.data) ? agentsData.data : 
                       [];
        } catch (e) {
          console.error('Erreur lors du parsing des agents:', e);
        }
      } else {
        console.warn('Échec du chargement des agents:', agentsResponse?.status);
      }

      // Charger les missions
      const missionsResponse = await fetch('/api/missions');
      if (missionsResponse && missionsResponse.ok) {
        try {
          const missionsData = await missionsResponse.json();
          this.missions = Array.isArray(missionsData.items) ? missionsData.items : 
                         Array.isArray(missionsData) ? missionsData : 
                         [];
        } catch (e) {
          console.error('Erreur lors du parsing des missions:', e);
        }
      } else {
        console.warn('Échec du chargement des missions:', missionsResponse?.status);
      }

      // Charger les localisations
      const locationsResponse = await fetch('/api/locations');
      if (locationsResponse && locationsResponse.ok) {
        try {
          const locationsData = await locationsResponse.json();
          this.locations = Array.isArray(locationsData.items) ? locationsData.items : 
                          Array.isArray(locationsData) ? locationsData : 
                          [];
        } catch (e) {
          console.error('Erreur lors du parsing des localisations:', e);
        }
      } else {
        console.warn('Échec du chargement des localisations:', locationsResponse?.status);
      }

      console.log('✅ Données de planification chargées:', {
        agents: this.agents.length,
        missions: this.missions.length,
        locations: this.locations.length
      });
      
      // Vérifier les conflits après le chargement
      this.checkConflicts();
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données de planification:', error);
      
      // Envoyer une notification d'erreur
      this.notifyError('Erreur de chargement des données', 
        'Impossible de charger les données de planification. Veuillez réessayer.');
    }
  }

  setupEventListeners() {
    // Écouter les changements de planification
    document.addEventListener('planningChanged', () => {
      this.optimizeAllRoutes();
    });

    // Écouter les nouvelles missions
    document.addEventListener('newMission', (event) => {
      this.addMissionToOptimization(event.detail.mission);
    });
  }

  startOptimizationEngine() {
    // Optimiser toutes les 5 minutes
    setInterval(() => {
      this.optimizeAllRoutes();
    }, 300000);

    // Vérifier les conflits toutes les minutes
    setInterval(() => {
      this.checkConflicts();
    }, 60000);
  }

  // Optimisation des itinéraires
  async optimizeAllRoutes() {
    console.log('🔄 Optimisation des itinéraires...');
    
    for (const agent of this.agents) {
      if (agent.role === 'agent') {
        await this.optimizeAgentRoute(agent);
      }
    }
    
    this.generateSuggestions();
    this.notifyOptimizationComplete();
  }

  async optimizeAgentRoute(agent) {
    const agentMissions = this.missions.filter(m => 
      m.agent_id === agent.id && 
      m.status === 'assigned' && 
      m.date >= new Date().toISOString().split('T')[0]
    );

    if (agentMissions.length === 0) return;

    // Trier les missions par priorité et distance
    const optimizedMissions = await this.optimizeMissionOrder(agent, agentMissions);
    
    this.optimizedRoutes.set(agent.id, {
      agent: agent,
      missions: optimizedMissions,
      totalDistance: this.calculateTotalDistance(optimizedMissions),
      estimatedDuration: this.calculateEstimatedDuration(optimizedMissions),
      efficiency: this.calculateEfficiency(optimizedMissions)
    });
  }

  async optimizeMissionOrder(agent, missions) {
    // Algorithme de voyageur de commerce simplifié
    const startLocation = await this.getAgentLocation(agent);
    const optimizedMissions = [];
    const remainingMissions = [...missions];

    let currentLocation = startLocation;

    while (remainingMissions.length > 0) {
      // Trouver la mission la plus proche
      let nearestMission = null;
      let shortestDistance = Infinity;

      for (const mission of remainingMissions) {
        const distance = this.calculateDistance(
          currentLocation,
          { latitude: mission.latitude, longitude: mission.longitude }
        );

        // Prendre en compte la priorité
        const priority = this.getMissionPriority(mission);
        const adjustedDistance = distance / priority;

        if (adjustedDistance < shortestDistance) {
          shortestDistance = adjustedDistance;
          nearestMission = mission;
        }
      }

      if (nearestMission) {
        optimizedMissions.push(nearestMission);
        currentLocation = {
          latitude: nearestMission.latitude,
          longitude: nearestMission.longitude
        };
        remainingMissions.splice(remainingMissions.indexOf(nearestMission), 1);
      }
    }

    return optimizedMissions;
  }

  // Vérification des conflits
  checkConflicts() {
    this.conflicts = [];
    
    // Vérifier les conflits de planning
    this.checkPlanningConflicts();
    
    // Vérifier les conflits de ressources
    this.checkResourceConflicts();
    
    // Vérifier les conflits de localisation
    this.checkLocationConflicts();
    
    if (this.conflicts.length > 0) {
      this.notifyConflicts();
    }
  }

  checkPlanningConflicts() {
    // Vérifier que this.missions est un tableau
    if (!Array.isArray(this.missions)) {
      console.warn('Aucune mission à analyser ou format invalide');
      this.missions = []; // Initialiser avec un tableau vide
      return;
    }

    const agentSchedules = new Map();
    
    for (const mission of this.missions) {
      // Sauter les missions invalides
      if (!mission || typeof mission !== 'object' || mission.status !== 'assigned') {
        continue;
      }
      
      try {
        const agentId = mission.agent_id;
        if (!agentId) continue;
        
        // Vérifier et parser les dates
        if (!mission.start_time || !mission.end_time) continue;
        
        const startTime = new Date(mission.start_time);
        const endTime = new Date(mission.end_time);
        
        // Vérifier la validité des dates
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          console.warn('Date invalide pour la mission:', mission.id);
          continue;
        }
        
        if (!agentSchedules.has(agentId)) {
          agentSchedules.set(agentId, []);
        }
        
        const schedule = agentSchedules.get(agentId);
        
        // Vérifier les chevauchements
        for (const existingMission of schedule) {
          this.conflicts.push({
            type: 'planning_conflict',
            severity: 'high',
            message: `Conflit de planning pour l'agent ${this.getAgentName(agentId)}`,
            details: {
              agentId: agentId,
              mission1: existingMission.mission,
              mission2: mission,
              overlapTime: this.getOverlapTime(startTime, endTime, existingMission.start, existingMission.end)
            }
          });
        }
        
        schedule.push({
          mission: mission,
          start: startTime,
          end: endTime
        });
      } catch (error) {
        console.error('Erreur lors de la vérification des conflits de planning:', error);
      }
    }
  }

  checkResourceConflicts() {
    const resourceUsage = new Map();
    
    for (const mission of this.missions) {
      if (mission.status === 'assigned' && mission.resources) {
        for (const resource of mission.resources) {
          const resourceId = resource.id;
          const startTime = new Date(mission.start_time);
          const endTime = new Date(mission.end_time);
          
          if (!resourceUsage.has(resourceId)) {
            resourceUsage.set(resourceId, []);
          }
          
          const usage = resourceUsage.get(resourceId);
          
          // Vérifier les conflits de ressources
          for (const existingUsage of usage) {
            if (this.isTimeOverlap(startTime, endTime, existingUsage.start, existingUsage.end)) {
              this.conflicts.push({
                type: 'resource_conflict',
                severity: 'medium',
                message: `Conflit de ressource: ${resource.name}`,
                details: {
                  resourceId: resourceId,
                  resourceName: resource.name,
                  mission1: existingUsage.mission,
                  mission2: mission
                }
              });
            }
          }
          
          usage.push({
            mission: mission,
            start: startTime,
            end: endTime
          });
        }
      }
    }
  }

  checkLocationConflicts() {
    const locationBookings = new Map();
    
    for (const mission of this.missions) {
      if (mission.status === 'assigned' && mission.location_id) {
        const locationId = mission.location_id;
        const startTime = new Date(mission.start_time);
        const endTime = new Date(mission.end_time);
        
        if (!locationBookings.has(locationId)) {
          locationBookings.set(locationId, []);
        }
        
        const bookings = locationBookings.get(locationId);
        
        // Vérifier les conflits de localisation
        for (const existingBooking of bookings) {
          if (this.isTimeOverlap(startTime, endTime, existingBooking.start, existingBooking.end)) {
            this.conflicts.push({
              type: 'location_conflict',
              severity: 'medium',
              message: `Conflit de localisation: ${this.getLocationName(locationId)}`,
              details: {
                locationId: locationId,
                locationName: this.getLocationName(locationId),
                mission1: existingBooking.mission,
                mission2: mission
              }
            });
          }
        }
        
        bookings.push({
          mission: mission,
          start: startTime,
          end: endTime
        });
      }
    }
  }

  // Génération de suggestions
  generateSuggestions() {
    this.suggestions = [];
    
    // Suggestions d'optimisation d'itinéraires
    this.generateRouteSuggestions();
    
    // Suggestions de répartition de charge
    this.generateWorkloadSuggestions();
    
    // Suggestions de planification
    this.generatePlanningSuggestions();
    
    this.notifySuggestions();
  }

  generateRouteSuggestions() {
    for (const [agentId, route] of this.optimizedRoutes) {
      const agent = route.agent;
      const currentEfficiency = route.efficiency;
      
      if (currentEfficiency < 0.7) {
        this.suggestions.push({
          type: 'route_optimization',
          priority: 'high',
          title: `Optimisation d'itinéraire pour ${agent.name}`,
          description: `L'itinéraire actuel a une efficacité de ${(currentEfficiency * 100).toFixed(1)}%. Considérez réorganiser les missions.`,
          action: () => this.showRouteOptimization(agentId),
          estimatedSavings: this.calculateRouteSavings(route)
        });
      }
    }
  }

  generateWorkloadSuggestions() {
    const agentWorkloads = new Map();
    
    for (const [agentId, route] of this.optimizedRoutes) {
      const workload = route.missions.length;
      agentWorkloads.set(agentId, workload);
    }
    
    const workloads = Array.from(agentWorkloads.values());
    const averageWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length;
    
    for (const [agentId, workload] of agentWorkloads) {
      if (workload > averageWorkload * 1.5) {
        const agent = this.agents.find(a => a.id === agentId);
        this.suggestions.push({
          type: 'workload_balance',
          priority: 'medium',
          title: `Répartition de charge pour ${agent.name}`,
          description: `${agent.name} a ${workload} missions assignées, ce qui est ${((workload / averageWorkload - 1) * 100).toFixed(1)}% au-dessus de la moyenne.`,
          action: () => this.showWorkloadRedistribution(agentId),
          estimatedSavings: this.calculateWorkloadSavings(workload, averageWorkload)
        });
      }
    }
  }

  generatePlanningSuggestions() {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const upcomingMissions = this.missions.filter(m => 
      m.status === 'assigned' && 
      new Date(m.date) >= today && 
      new Date(m.date) <= nextWeek
    );
    
    if (upcomingMissions.length === 0) {
      this.suggestions.push({
        type: 'planning_gap',
        priority: 'low',
        title: 'Période de faible activité',
        description: 'Aucune mission planifiée pour la semaine prochaine. Considérez planifier de nouvelles activités.',
        action: () => this.showPlanningGap(),
        estimatedSavings: 0
      });
    }
  }

  // Méthodes utilitaires
  calculateDistance(point1, point2) {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  calculateTotalDistance(missions) {
    let totalDistance = 0;
    for (let i = 0; i < missions.length - 1; i++) {
      const distance = this.calculateDistance(
        { latitude: missions[i].latitude, longitude: missions[i].longitude },
        { latitude: missions[i + 1].latitude, longitude: missions[i + 1].longitude }
      );
      totalDistance += distance;
    }
    return totalDistance;
  }

  calculateEstimatedDuration(missions) {
    let totalDuration = 0;
    for (const mission of missions) {
      const startTime = new Date(mission.start_time);
      const endTime = new Date(mission.end_time);
      totalDuration += (endTime - startTime) / (1000 * 60 * 60); // en heures
    }
    return totalDuration;
  }

  calculateEfficiency(missions) {
    if (missions.length === 0) return 1;
    
    const totalDistance = this.calculateTotalDistance(missions);
    const estimatedDuration = this.calculateEstimatedDuration(missions);
    
    // Efficacité basée sur la distance et la durée
    const optimalDistance = this.calculateOptimalDistance(missions);
    const optimalDuration = this.calculateOptimalDuration(missions);
    
    const distanceEfficiency = optimalDistance / totalDistance;
    const durationEfficiency = optimalDuration / estimatedDuration;
    
    return (distanceEfficiency + durationEfficiency) / 2;
  }

  calculateOptimalDistance(missions) {
    // Distance optimale théorique (plus courte possible)
    let optimalDistance = 0;
    for (let i = 0; i < missions.length - 1; i++) {
      const distance = this.calculateDistance(
        { latitude: missions[i].latitude, longitude: missions[i].longitude },
        { latitude: missions[i + 1].latitude, longitude: missions[i + 1].longitude }
      );
      optimalDistance += distance;
    }
    return optimalDistance * 0.8; // 20% de marge pour l'optimal
  }

  calculateOptimalDuration(missions) {
    // Durée optimale théorique
    let optimalDuration = 0;
    for (const mission of missions) {
      const startTime = new Date(mission.start_time);
      const endTime = new Date(mission.end_time);
      optimalDuration += (endTime - startTime) / (1000 * 60 * 60);
    }
    return optimalDuration * 0.9; // 10% de marge pour l'optimal
  }

  getMissionPriority(mission) {
    // Priorité basée sur la date, l'urgence et l'importance
    const datePriority = this.getDatePriority(mission.date);
    const urgencyPriority = mission.urgency || 1;
    const importancePriority = mission.importance || 1;
    
    return datePriority * urgencyPriority * importancePriority;
  }

  getDatePriority(date) {
    const missionDate = new Date(date);
    const today = new Date();
    const daysDiff = (missionDate - today) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 0) return 3; // En retard
    if (daysDiff === 0) return 2; // Aujourd'hui
    if (daysDiff <= 3) return 1.5; // Cette semaine
    return 1; // Plus tard
  }

  async getAgentLocation(agent) {
    // Récupérer la position actuelle de l'agent
    if (window.gpsTracker) {
      const position = window.gpsTracker.getCurrentPosition();
      if (position) {
        return position;
      }
    }
    
    // Fallback: position par défaut ou dernière position connue
    return {
      latitude: 7.188506, // Position par défaut CCRB
      longitude: 2.079116
    };
  }

  isTimeOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
  }

  getOverlapTime(start1, end1, start2, end2) {
    const overlapStart = new Date(Math.max(start1, start2));
    const overlapEnd = new Date(Math.min(end1, end2));
    return (overlapEnd - overlapStart) / (1000 * 60 * 60); // en heures
  }

  getAgentName(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    return agent ? agent.name : `Agent ${agentId}`;
  }

  getLocationName(locationId) {
    const location = this.locations.find(l => l.id === locationId);
    return location ? location.name : `Localisation ${locationId}`;
  }

  calculateRouteSavings(route) {
    const currentEfficiency = route.efficiency;
    const potentialEfficiency = Math.min(currentEfficiency * 1.3, 1);
    const savings = (potentialEfficiency - currentEfficiency) * 100;
    return Math.max(savings, 0);
  }

  calculateWorkloadSavings(workload, averageWorkload) {
    const reduction = (workload - averageWorkload) * 0.5; // 50% de réduction possible
    return Math.max(reduction, 0);
  }

  // Actions des suggestions
  showRouteOptimization(agentId) {
    const route = this.optimizedRoutes.get(agentId);
    if (route) {
      this.displayRouteOptimization(route);
    }
  }

  showWorkloadRedistribution(agentId) {
    this.displayWorkloadRedistribution(agentId);
  }

  showPlanningGap() {
    this.displayPlanningGap();
  }

  displayRouteOptimization(route) {
    // Afficher les suggestions d'optimisation d'itinéraire
    console.log('Optimisation d\'itinéraire pour:', route.agent.name);
    // Implémenter l'affichage de l'interface d'optimisation
  }

  displayWorkloadRedistribution(agentId) {
    // Afficher les suggestions de redistribution de charge
    console.log('Redistribution de charge pour l\'agent:', agentId);
    // Implémenter l'affichage de l'interface de redistribution
  }

  displayPlanningGap() {
    // Afficher les suggestions de planification
    console.log('Période de faible activité détectée');
    // Implémenter l'affichage de l'interface de planification
  }

  // Notifications
  notifyOptimizationComplete() {
    const event = new CustomEvent('planningOptimized', {
      detail: {
        routes: this.optimizedRoutes,
        suggestions: this.suggestions
      }
    });
    document.dispatchEvent(event);
  }

  notifyConflicts() {
    const event = new CustomEvent('planningConflicts', {
      detail: {
        conflicts: this.conflicts
      }
    });
    document.dispatchEvent(event);
  }

  notifySuggestions() {
    const event = new CustomEvent('planningSuggestions', {
      detail: {
        suggestions: this.suggestions
      }
    });
    document.dispatchEvent(event);
  }

  // Méthodes publiques
  getOptimizedRoute(agentId) {
    return this.optimizedRoutes.get(agentId);
  }

  getConflicts() {
    return this.conflicts;
  }

  getSuggestions() {
    return this.suggestions;
  }

  async addMissionToOptimization(mission) {
    this.missions.push(mission);
    await this.optimizeAllRoutes();
  }

  async removeMissionFromOptimization(missionId) {
    this.missions = this.missions.filter(m => m.id !== missionId);
    await this.optimizeAllRoutes();
  }
  
  /**
   * Affiche une notification d'erreur à l'utilisateur
   * @param {string} title - Titre de l'erreur
   * @param {string} message - Message détaillé
   * @param {string} [type='error'] - Type de notification (error, warning, info, success)
   */
  notifyError(title, message, type = 'error') {
    console.error(`[${type.toUpperCase()}] ${title}: ${message}`);
    
    // Créer une notification visuelle
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '1060'; // Au-dessus des modaux Bootstrap
    notification.role = 'alert';
    notification.innerHTML = `
      <strong>${title}</strong> ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
    `;
    
    // Ajouter la notification au conteneur de notifications
    let container = document.getElementById('notifications-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notifications-container';
      container.className = 'position-fixed top-0 end-0 p-3';
      container.style.zIndex = '1060';
      document.body.appendChild(container);
    }
    
    container.appendChild(notification);
    
    // Supprimer automatiquement après 10 secondes
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 150);
    }, 10000);
    
    // Retourner un objet avec une méthode pour fermer manuellement
    return {
      close: () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 150);
      }
    };
  }
}

// Initialiser le système de planification intelligente
window.smartPlanning = new SmartPlanning();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartPlanning;
}
