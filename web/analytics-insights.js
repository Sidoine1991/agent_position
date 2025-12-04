/**
 * Système d'analytics et insights pour l'application CCRB
 * Fournit des analyses avancées, des prédictions et des recommandations
 */

class AnalyticsInsights {
  constructor() {
    this.dataPoints = [];
    this.insights = [];
    this.predictions = {};
    this.recommendations = [];
    this.performanceMetrics = {};
    this.trends = {};
    
    this.init();
  }

  async init() {
    await this.loadHistoricalData();
    this.setupEventListeners();
    this.startAnalyticsEngine();
  }

  async loadHistoricalData() {
    try {
      // Charger les données historiques depuis l'API
      const [presenceData, missionData, performanceData] = await Promise.all([
        this.fetchPresenceData(),
        this.fetchMissionData(),
        this.fetchPerformanceData()
      ]);

      this.dataPoints = {
        presence: presenceData,
        missions: missionData,
        performance: performanceData
      };

      console.log('✅ Données historiques chargées pour l\'analytics');
    } catch (error) {
      console.error('❌ Erreur chargement données analytics:', error);
    }
  }

  async fetchPresenceData() {
    try {
      const token = localStorage.getItem('jwt') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/analytics/presence', { headers });
      if (response.ok) {
        return await response.json();
      } else if (response.status === 403) {
        // Accès refusé - réservé aux superviseurs/admins, ignorer silencieusement
        console.debug('Accès analytics/presence refusé (réservé superviseur/admin)');
        return [];
      }
    } catch (error) {
      console.debug('Impossible de charger les données de présence:', error.message);
    }
    return [];
  }

  async fetchMissionData() {
    try {
      const token = localStorage.getItem('jwt') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/analytics/missions', { headers });
      if (response.ok) {
        return await response.json();
      } else if (response.status === 403) {
        // Accès refusé - réservé aux superviseurs/admins, ignorer silencieusement
        console.debug('Accès analytics/missions refusé (réservé superviseur/admin)');
        return [];
      }
    } catch (error) {
      console.debug('Impossible de charger les données de missions:', error.message);
    }
    return [];
  }

  async fetchPerformanceData() {
    try {
      const token = localStorage.getItem('jwt') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/analytics/performance', { headers });
      if (response.ok) {
        return await response.json();
      } else if (response.status === 403) {
        // Accès refusé - réservé aux superviseurs/admins, ignorer silencieusement
        console.debug('Accès analytics/performance refusé (réservé superviseur/admin)');
        return [];
      }
    } catch (error) {
      console.debug('Impossible de charger les données de performance:', error.message);
    }
    return [];
  }

  setupEventListeners() {
    // Écouter les nouvelles données
    document.addEventListener('newPresenceData', (event) => {
      this.addDataPoint('presence', event.detail);
    });

    document.addEventListener('newMissionData', (event) => {
      this.addDataPoint('missions', event.detail);
    });

    document.addEventListener('newPerformanceData', (event) => {
      this.addDataPoint('performance', event.detail);
    });
  }

  startAnalyticsEngine() {
    // Analyser les données toutes les 10 minutes
    setInterval(() => {
      this.analyzeData();
    }, 600000);

    // Générer des insights toutes les heures
    setInterval(() => {
      this.generateInsights();
    }, 3600000);

    // Faire des prédictions toutes les 6 heures
    setInterval(() => {
      this.generatePredictions();
    }, 21600000);

    // Analyser immédiatement
    this.analyzeData();
  }

  addDataPoint(category, data) {
    if (!this.dataPoints[category]) {
      this.dataPoints[category] = [];
    }
    
    this.dataPoints[category].push({
      ...data,
      timestamp: new Date().toISOString()
    });

    // Déclencher une nouvelle analyse
    this.analyzeData();
  }

  analyzeData() {
    this.analyzePresencePatterns();
    this.analyzeMissionEfficiency();
    this.analyzePerformanceTrends();
    this.analyzeResourceUtilization();
    this.analyzeGeographicPatterns();
  }

  analyzePresencePatterns() {
    const presenceData = this.dataPoints.presence || [];
    if (presenceData.length === 0) return;

    // Analyser les patterns de présence
    const patterns = {
      averageArrivalTime: this.calculateAverageArrivalTime(presenceData),
      averageDepartureTime: this.calculateAverageDepartureTime(presenceData),
      attendanceRate: this.calculateAttendanceRate(presenceData),
      punctualityRate: this.calculatePunctualityRate(presenceData),
      absencePatterns: this.identifyAbsencePatterns(presenceData)
    };

    this.performanceMetrics.presence = patterns;
  }

  analyzeMissionEfficiency() {
    const missionData = this.dataPoints.missions || [];
    if (missionData.length === 0) return;

    // Analyser l'efficacité des missions
    const efficiency = {
      averageCompletionTime: this.calculateAverageCompletionTime(missionData),
      successRate: this.calculateMissionSuccessRate(missionData),
      resourceUtilization: this.calculateResourceUtilization(missionData),
      geographicEfficiency: this.calculateGeographicEfficiency(missionData),
      timeOfDayPerformance: this.analyzeTimeOfDayPerformance(missionData)
    };

    this.performanceMetrics.missions = efficiency;
  }

  analyzePerformanceTrends() {
    const performanceData = this.dataPoints.performance || [];
    if (performanceData.length === 0) return;

    // Analyser les tendances de performance
    const trends = {
      weeklyTrend: this.calculateWeeklyTrend(performanceData),
      monthlyTrend: this.calculateMonthlyTrend(performanceData),
      seasonalPatterns: this.identifySeasonalPatterns(performanceData),
      improvementAreas: this.identifyImprovementAreas(performanceData)
    };

    this.trends = trends;
  }

  analyzeResourceUtilization() {
    // Analyser l'utilisation des ressources
    const resourceMetrics = {
      agentUtilization: this.calculateAgentUtilization(),
      equipmentUtilization: this.calculateEquipmentUtilization(),
      vehicleUtilization: this.calculateVehicleUtilization(),
      optimalAllocation: this.calculateOptimalAllocation()
    };

    this.performanceMetrics.resources = resourceMetrics;
  }

  analyzeGeographicPatterns() {
    // Analyser les patterns géographiques
    const geographicMetrics = {
      hotspotAnalysis: this.identifyHotspots(),
      coverageAnalysis: this.analyzeCoverage(),
      distanceOptimization: this.analyzeDistanceOptimization(),
      zoneEfficiency: this.analyzeZoneEfficiency()
    };

    this.performanceMetrics.geographic = geographicMetrics;
  }

  generateInsights() {
    this.insights = [];

    // Insights de présence
    this.generatePresenceInsights();
    
    // Insights de mission
    this.generateMissionInsights();
    
    // Insights de performance
    this.generatePerformanceInsights();
    
    // Insights de ressources
    this.generateResourceInsights();

    this.notifyInsightsGenerated();
  }

  generatePresenceInsights() {
    const presenceMetrics = this.performanceMetrics.presence;
    if (!presenceMetrics) return;

    // Insight sur la ponctualité
    if (presenceMetrics.punctualityRate < 80) {
      this.insights.push({
        type: 'warning',
        category: 'presence',
        title: 'Ponctualité à améliorer',
        description: `Le taux de ponctualité est de ${presenceMetrics.punctualityRate.toFixed(1)}%. Considérez des mesures pour améliorer la ponctualité.`,
        impact: 'medium',
        actionable: true,
        recommendations: [
          'Mettre en place des rappels automatiques',
          'Analyser les causes des retards',
          'Proposer des horaires plus flexibles'
        ]
      });
    }

    // Insight sur les patterns d'absence
    if (presenceMetrics.absencePatterns.length > 0) {
      this.insights.push({
        type: 'info',
        category: 'presence',
        title: 'Patterns d\'absence détectés',
        description: `Des patterns d'absence ont été identifiés: ${presenceMetrics.absencePatterns.join(', ')}.`,
        impact: 'low',
        actionable: true,
        recommendations: [
          'Analyser les causes des absences',
          'Mettre en place un système de remplacement',
          'Améliorer la communication avec les agents'
        ]
      });
    }
  }

  generateMissionInsights() {
    const missionMetrics = this.performanceMetrics.missions;
    if (!missionMetrics) return;

    // Insight sur l'efficacité des missions
    if (missionMetrics.successRate < 90) {
      this.insights.push({
        type: 'warning',
        category: 'missions',
        title: 'Taux de réussite des missions',
        description: `Le taux de réussite des missions est de ${missionMetrics.successRate.toFixed(1)}%. Des améliorations sont nécessaires.`,
        impact: 'high',
        actionable: true,
        recommendations: [
          'Analyser les causes d\'échec',
          'Améliorer la formation des agents',
          'Optimiser les processus de mission'
        ]
      });
    }

    // Insight sur l'optimisation géographique
    if (missionMetrics.geographicEfficiency < 0.7) {
      this.insights.push({
        type: 'info',
        category: 'missions',
        title: 'Optimisation géographique possible',
        description: `L'efficacité géographique est de ${(missionMetrics.geographicEfficiency * 100).toFixed(1)}%. Une optimisation des itinéraires pourrait améliorer les performances.`,
        impact: 'medium',
        actionable: true,
        recommendations: [
          'Utiliser un système de planification intelligente',
          'Optimiser les itinéraires',
          'Regrouper les missions par zone'
        ]
      });
    }
  }

  generatePerformanceInsights() {
    const trends = this.trends;
    if (!trends) return;

    // Insight sur les tendances
    if (trends.weeklyTrend && trends.weeklyTrend.slope < -0.1) {
      this.insights.push({
        type: 'warning',
        category: 'performance',
        title: 'Tendance de performance en baisse',
        description: 'Une tendance à la baisse de la performance a été détectée sur la semaine.',
        impact: 'high',
        actionable: true,
        recommendations: [
          'Identifier les causes de la baisse',
          'Mettre en place des mesures correctives',
          'Renforcer la motivation des équipes'
        ]
      });
    }

    // Insight sur les zones d'amélioration
    if (trends.improvementAreas && trends.improvementAreas.length > 0) {
      this.insights.push({
        type: 'info',
        category: 'performance',
        title: 'Zones d\'amélioration identifiées',
        description: `Les domaines suivants peuvent être améliorés: ${trends.improvementAreas.join(', ')}.`,
        impact: 'medium',
        actionable: true,
        recommendations: [
          'Mettre en place des plans d\'amélioration',
          'Fournir une formation ciblée',
          'Établir des objectifs spécifiques'
        ]
      });
    }
  }

  generateResourceInsights() {
    const resourceMetrics = this.performanceMetrics.resources;
    if (!resourceMetrics) return;

    // Insight sur l'utilisation des agents
    if (resourceMetrics.agentUtilization < 0.8) {
      this.insights.push({
        type: 'info',
        category: 'resources',
        title: 'Sous-utilisation des agents',
        description: `L'utilisation des agents est de ${(resourceMetrics.agentUtilization * 100).toFixed(1)}%. Une réallocation pourrait améliorer l'efficacité.`,
        impact: 'medium',
        actionable: true,
        recommendations: [
          'Réallouer les agents sous-utilisés',
          'Optimiser la planification',
          'Développer de nouvelles missions'
        ]
      });
    }

    // Insight sur l'allocation optimale
    if (resourceMetrics.optimalAllocation) {
      this.insights.push({
        type: 'success',
        category: 'resources',
        title: 'Opportunité d\'optimisation',
        description: 'Une allocation optimale des ressources a été identifiée.',
        impact: 'high',
        actionable: true,
        recommendations: [
          'Implémenter l\'allocation optimale',
          'Surveiller les résultats',
          'Ajuster selon les besoins'
        ]
      });
    }
  }

  generatePredictions() {
    this.predictions = {
      attendance: this.predictAttendance(),
      missionSuccess: this.predictMissionSuccess(),
      resourceNeeds: this.predictResourceNeeds(),
      performance: this.predictPerformance()
    };

    this.notifyPredictionsGenerated();
  }

  predictAttendance() {
    const presenceData = this.dataPoints.presence || [];
    if (presenceData.length < 7) return null;

    // Prédiction basée sur les patterns historiques
    const recentData = presenceData.slice(-30); // 30 derniers jours
    const attendanceRate = this.calculateAttendanceRate(recentData);
    
    // Prédiction pour les 7 prochains jours
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Ajuster selon le jour de la semaine
      const dayOfWeek = date.getDay();
      const dayAdjustment = this.getDayOfWeekAdjustment(dayOfWeek);
      
      predictions.push({
        date: date.toISOString().split('T')[0],
        predictedAttendance: Math.min(100, attendanceRate + dayAdjustment),
        confidence: this.calculatePredictionConfidence(recentData)
      });
    }

    return predictions;
  }

  predictMissionSuccess() {
    const missionData = this.dataPoints.missions || [];
    if (missionData.length < 10) return null;

    // Prédiction basée sur les performances récentes
    const recentMissions = missionData.slice(-20);
    const successRate = this.calculateMissionSuccessRate(recentMissions);
    
    return {
      predictedSuccessRate: successRate,
      confidence: this.calculatePredictionConfidence(recentMissions),
      factors: this.identifySuccessFactors(recentMissions)
    };
  }

  predictResourceNeeds() {
    const resourceMetrics = this.performanceMetrics.resources;
    if (!resourceMetrics) return null;

    // Prédiction des besoins en ressources
    return {
      agents: this.predictAgentNeeds(),
      equipment: this.predictEquipmentNeeds(),
      vehicles: this.predictVehicleNeeds(),
      timeframe: '7 jours'
    };
  }

  predictPerformance() {
    const trends = this.trends;
    if (!trends) return null;

    // Prédiction de la performance future
    const currentPerformance = this.calculateCurrentPerformance();
    const trend = trends.weeklyTrend || { slope: 0 };
    
    return {
      current: currentPerformance,
      predicted: currentPerformance + (trend.slope * 7), // 7 jours
      confidence: this.calculatePredictionConfidence(this.dataPoints.performance || []),
      factors: this.identifyPerformanceFactors()
    };
  }

  // Méthodes de calcul
  calculateAverageArrivalTime(presenceData) {
    const arrivals = presenceData
      .filter(p => p.type === 'arrival')
      .map(p => new Date(p.timestamp).getHours() + new Date(p.timestamp).getMinutes() / 60);
    
    return arrivals.length > 0 ? arrivals.reduce((a, b) => a + b, 0) / arrivals.length : 0;
  }

  calculateAverageDepartureTime(presenceData) {
    const departures = presenceData
      .filter(p => p.type === 'departure')
      .map(p => new Date(p.timestamp).getHours() + new Date(p.timestamp).getMinutes() / 60);
    
    return departures.length > 0 ? departures.reduce((a, b) => a + b, 0) / departures.length : 0;
  }

  calculateAttendanceRate(presenceData) {
    const totalDays = new Set(presenceData.map(p => p.date)).size;
    const presentDays = new Set(presenceData.filter(p => p.present).map(p => p.date)).size;
    
    return totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
  }

  calculatePunctualityRate(presenceData) {
    const arrivals = presenceData.filter(p => p.type === 'arrival');
    const onTime = arrivals.filter(p => this.isOnTime(p.timestamp)).length;
    
    return arrivals.length > 0 ? (onTime / arrivals.length) * 100 : 0;
  }

  identifyAbsencePatterns(presenceData) {
    const patterns = [];
    const absences = presenceData.filter(p => !p.present);
    
    // Analyser les patterns par jour de la semaine
    const dayPatterns = {};
    absences.forEach(absence => {
      const day = new Date(absence.date).getDay();
      dayPatterns[day] = (dayPatterns[day] || 0) + 1;
    });
    
    // Identifier les jours avec plus d'absences
    Object.entries(dayPatterns).forEach(([day, count]) => {
      if (count > absences.length * 0.3) {
        patterns.push(`Plus d'absences le ${this.getDayName(day)}`);
      }
    });
    
    return patterns;
  }

  calculateAverageCompletionTime(missionData) {
    const completedMissions = missionData.filter(m => m.status === 'completed');
    const durations = completedMissions.map(m => {
      const start = new Date(m.start_time);
      const end = new Date(m.end_time);
      return (end - start) / (1000 * 60 * 60); // en heures
    });
    
    return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  }

  calculateMissionSuccessRate(missionData) {
    const totalMissions = missionData.length;
    const successfulMissions = missionData.filter(m => m.status === 'completed').length;
    
    return totalMissions > 0 ? (successfulMissions / totalMissions) * 100 : 0;
  }

  calculateResourceUtilization(missionData) {
    // Calculer l'utilisation des ressources
    const totalCapacity = missionData.reduce((sum, m) => sum + (m.resource_capacity || 1), 0);
    const usedCapacity = missionData.reduce((sum, m) => sum + (m.resource_used || 1), 0);
    
    return totalCapacity > 0 ? usedCapacity / totalCapacity : 0;
  }

  calculateGeographicEfficiency(missionData) {
    // Calculer l'efficacité géographique basée sur les distances
    const missions = missionData.filter(m => m.latitude && m.longitude);
    if (missions.length < 2) return 1;
    
    let totalDistance = 0;
    let optimalDistance = 0;
    
    for (let i = 0; i < missions.length - 1; i++) {
      const distance = this.calculateDistance(
        { latitude: missions[i].latitude, longitude: missions[i].longitude },
        { latitude: missions[i + 1].latitude, longitude: missions[i + 1].longitude }
      );
      totalDistance += distance;
    }
    
    // Distance optimale (plus courte possible)
    optimalDistance = totalDistance * 0.8; // 20% de marge
    
    return optimalDistance / totalDistance;
  }

  analyzeTimeOfDayPerformance(missionData) {
    const timePerformance = {};
    
    missionData.forEach(mission => {
      const hour = new Date(mission.start_time).getHours();
      const timeSlot = this.getTimeSlot(hour);
      
      if (!timePerformance[timeSlot]) {
        timePerformance[timeSlot] = { total: 0, successful: 0 };
      }
      
      timePerformance[timeSlot].total++;
      if (mission.status === 'completed') {
        timePerformance[timeSlot].successful++;
      }
    });
    
    // Calculer les taux de réussite par créneau
    Object.keys(timePerformance).forEach(slot => {
      const data = timePerformance[slot];
      data.successRate = data.total > 0 ? (data.successful / data.total) * 100 : 0;
    });
    
    return timePerformance;
  }

  calculateWeeklyTrend(performanceData) {
    if (performanceData.length < 7) return null;
    
    const weeklyData = performanceData.slice(-7);
    const values = weeklyData.map(d => d.value || 0);
    
    // Calculer la pente de la tendance
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return { slope, direction: slope > 0 ? 'up' : slope < 0 ? 'down' : 'stable' };
  }

  calculateMonthlyTrend(performanceData) {
    if (performanceData.length < 30) return null;
    
    const monthlyData = performanceData.slice(-30);
    const weeklyAverages = [];
    
    for (let i = 0; i < monthlyData.length; i += 7) {
      const week = monthlyData.slice(i, i + 7);
      const average = week.reduce((sum, d) => sum + (d.value || 0), 0) / week.length;
      weeklyAverages.push(average);
    }
    
    return this.calculateWeeklyTrend(weeklyAverages.map((val, i) => ({ value: val, timestamp: new Date(Date.now() - (weeklyAverages.length - i) * 7 * 24 * 60 * 60 * 1000) })));
  }

  identifySeasonalPatterns(performanceData) {
    const patterns = [];
    const monthlyData = {};
    
    performanceData.forEach(data => {
      const month = new Date(data.timestamp).getMonth();
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(data.value || 0);
    });
    
    // Analyser les variations saisonnières
    Object.entries(monthlyData).forEach(([month, values]) => {
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const monthName = this.getMonthName(month);
      
      if (average > 100) {
        patterns.push(`Performance élevée en ${monthName}`);
      } else if (average < 80) {
        patterns.push(`Performance faible en ${monthName}`);
      }
    });
    
    return patterns;
  }

  identifyImprovementAreas(performanceData) {
    const areas = [];
    const metrics = this.performanceMetrics;
    
    if (metrics.presence && metrics.presence.attendanceRate < 90) {
      areas.push('Taux de présence');
    }
    
    if (metrics.missions && metrics.missions.successRate < 90) {
      areas.push('Taux de réussite des missions');
    }
    
    if (metrics.missions && metrics.missions.averageCompletionTime > 8) {
      areas.push('Temps de completion des missions');
    }
    
    if (metrics.resources && metrics.resources.agentUtilization < 0.8) {
      areas.push('Utilisation des agents');
    }
    
    return areas;
  }

  calculateAgentUtilization() {
    // Calculer l'utilisation des agents
    const missionData = this.dataPoints.missions || [];
    const totalAgentHours = missionData.reduce((sum, m) => sum + (m.duration || 0), 0);
    const availableAgentHours = missionData.length * 8; // 8 heures par jour
    
    return availableAgentHours > 0 ? totalAgentHours / availableAgentHours : 0;
  }

  calculateEquipmentUtilization() {
    // Calculer l'utilisation de l'équipement
    const missionData = this.dataPoints.missions || [];
    const equipmentUsage = missionData.reduce((sum, m) => sum + (m.equipment_used || 0), 0);
    const equipmentCapacity = missionData.reduce((sum, m) => sum + (m.equipment_capacity || 1), 0);
    
    return equipmentCapacity > 0 ? equipmentUsage / equipmentCapacity : 0;
  }

  calculateVehicleUtilization() {
    // Calculer l'utilisation des véhicules
    const missionData = this.dataPoints.missions || [];
    const vehicleUsage = missionData.reduce((sum, m) => sum + (m.vehicle_used || 0), 0);
    const vehicleCapacity = missionData.reduce((sum, m) => sum + (m.vehicle_capacity || 1), 0);
    
    return vehicleCapacity > 0 ? vehicleUsage / vehicleCapacity : 0;
  }

  calculateOptimalAllocation() {
    // Calculer l'allocation optimale des ressources
    const resourceMetrics = this.performanceMetrics.resources;
    if (!resourceMetrics) return null;
    
    const agentUtilization = resourceMetrics.agentUtilization || 0;
    const equipmentUtilization = resourceMetrics.equipmentUtilization || 0;
    const vehicleUtilization = resourceMetrics.vehicleUtilization || 0;
    
    // Identifier les déséquilibres
    const imbalances = [];
    if (agentUtilization < 0.8) imbalances.push('agents');
    if (equipmentUtilization < 0.8) imbalances.push('équipement');
    if (vehicleUtilization < 0.8) imbalances.push('véhicules');
    
    return imbalances.length > 0 ? {
      type: 'reallocation',
      resources: imbalances,
      potentialImprovement: (0.9 - Math.min(agentUtilization, equipmentUtilization, vehicleUtilization)) * 100
    } : null;
  }

  identifyHotspots() {
    const missionData = this.dataPoints.missions || [];
    const locationCounts = {};
    
    missionData.forEach(mission => {
      if (mission.latitude && mission.longitude) {
        const key = `${mission.latitude.toFixed(3)},${mission.longitude.toFixed(3)}`;
        locationCounts[key] = (locationCounts[key] || 0) + 1;
      }
    });
    
    // Identifier les hotspots (plus de 5 missions)
    const hotspots = Object.entries(locationCounts)
      .filter(([key, count]) => count >= 5)
      .map(([key, count]) => {
        const [lat, lon] = key.split(',').map(Number);
        return { latitude: lat, longitude: lon, count };
      });
    
    return hotspots;
  }

  analyzeCoverage() {
    const missionData = this.dataPoints.missions || [];
    const locations = missionData.filter(m => m.latitude && m.longitude);
    
    if (locations.length === 0) return null;
    
    // Calculer la zone de couverture
    const latitudes = locations.map(l => l.latitude);
    const longitudes = locations.map(l => l.longitude);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    
    return {
      area: this.calculateArea(minLat, maxLat, minLon, maxLon),
      density: locations.length / this.calculateArea(minLat, maxLat, minLon, maxLon),
      coverage: 'good' // À améliorer avec une logique plus sophistiquée
    };
  }

  analyzeDistanceOptimization() {
    const missionData = this.dataPoints.missions || [];
    const locations = missionData.filter(m => m.latitude && m.longitude);
    
    if (locations.length < 2) return null;
    
    let totalDistance = 0;
    for (let i = 0; i < locations.length - 1; i++) {
      const distance = this.calculateDistance(
        { latitude: locations[i].latitude, longitude: locations[i].longitude },
        { latitude: locations[i + 1].latitude, longitude: locations[i + 1].longitude }
      );
      totalDistance += distance;
    }
    
    // Calculer la distance optimale
    const optimalDistance = this.calculateOptimalDistance(locations);
    
    return {
      currentDistance: totalDistance,
      optimalDistance: optimalDistance,
      potentialSavings: totalDistance - optimalDistance,
      efficiency: optimalDistance / totalDistance
    };
  }

  analyzeZoneEfficiency() {
    const missionData = this.dataPoints.missions || [];
    const zoneData = {};
    
    missionData.forEach(mission => {
      const zone = mission.zone || 'default';
      if (!zoneData[zone]) {
        zoneData[zone] = { missions: 0, successful: 0, totalTime: 0 };
      }
      
      zoneData[zone].missions++;
      if (mission.status === 'completed') {
        zoneData[zone].successful++;
      }
      zoneData[zone].totalTime += mission.duration || 0;
    });
    
    // Calculer l'efficacité par zone
    Object.keys(zoneData).forEach(zone => {
      const data = zoneData[zone];
      data.successRate = data.missions > 0 ? (data.successful / data.missions) * 100 : 0;
      data.averageTime = data.missions > 0 ? data.totalTime / data.missions : 0;
      data.efficiency = data.successRate / data.averageTime; // Taux de réussite par heure
    });
    
    return zoneData;
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

  calculateArea(minLat, maxLat, minLon, maxLon) {
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;
    return latDiff * lonDiff;
  }

  calculateOptimalDistance(locations) {
    // Algorithme simplifié pour calculer la distance optimale
    // En réalité, ce serait un problème de voyageur de commerce
    let optimalDistance = 0;
    for (let i = 0; i < locations.length - 1; i++) {
      const distance = this.calculateDistance(
        { latitude: locations[i].latitude, longitude: locations[i].longitude },
        { latitude: locations[i + 1].latitude, longitude: locations[i + 1].longitude }
      );
      optimalDistance += distance;
    }
    return optimalDistance * 0.8; // 20% de marge pour l'optimal
  }

  isOnTime(timestamp) {
    const hour = new Date(timestamp).getHours();
    return hour >= 8 && hour <= 9; // Arrivée entre 8h et 9h
  }

  getDayName(dayNumber) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayNumber];
  }

  getMonthName(monthNumber) {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return months[monthNumber];
  }

  getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'Matin';
    if (hour >= 12 && hour < 18) return 'Après-midi';
    if (hour >= 18 && hour < 22) return 'Soir';
    return 'Nuit';
  }

  getDayOfWeekAdjustment(dayOfWeek) {
    // Ajustements basés sur le jour de la semaine
    const adjustments = {
      0: -5, // Dimanche
      1: 0,  // Lundi
      2: 0,  // Mardi
      3: 0,  // Mercredi
      4: 0,  // Jeudi
      5: -2, // Vendredi
      6: -3  // Samedi
    };
    return adjustments[dayOfWeek] || 0;
  }

  calculatePredictionConfidence(data) {
    // Calculer la confiance basée sur la quantité et la cohérence des données
    const dataPoints = data.length;
    const variance = this.calculateVariance(data.map(d => d.value || 0));
    
    // Plus de données et moins de variance = plus de confiance
    const confidence = Math.min(100, (dataPoints / 30) * 100 - (variance / 100));
    return Math.max(0, confidence);
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  identifySuccessFactors(missionData) {
    const factors = [];
    
    // Analyser les facteurs de succès
    const successfulMissions = missionData.filter(m => m.status === 'completed');
    const failedMissions = missionData.filter(m => m.status === 'failed');
    
    if (successfulMissions.length > 0) {
      const avgSuccessTime = successfulMissions.reduce((sum, m) => sum + (m.duration || 0), 0) / successfulMissions.length;
      const avgFailureTime = failedMissions.length > 0 ? 
        failedMissions.reduce((sum, m) => sum + (m.duration || 0), 0) / failedMissions.length : 0;
      
      if (avgSuccessTime < avgFailureTime) {
        factors.push('Durée de mission appropriée');
      }
    }
    
    return factors;
  }

  predictAgentNeeds() {
    const currentUtilization = this.performanceMetrics.resources?.agentUtilization || 0;
    const predictedDemand = this.predictions.attendance?.[0]?.predictedAttendance || 100;
    
    return {
      current: Math.round(currentUtilization * 100),
      predicted: Math.round(predictedDemand),
      recommendation: predictedDemand > 100 ? 'Augmenter le nombre d\'agents' : 'Maintenir le niveau actuel'
    };
  }

  predictEquipmentNeeds() {
    const currentUtilization = this.performanceMetrics.resources?.equipmentUtilization || 0;
    
    return {
      current: Math.round(currentUtilization * 100),
      predicted: Math.round(currentUtilization * 100 * 1.1), // 10% d'augmentation
      recommendation: currentUtilization > 0.9 ? 'Ajouter de l\'équipement' : 'Maintenir le niveau actuel'
    };
  }

  predictVehicleNeeds() {
    const currentUtilization = this.performanceMetrics.resources?.vehicleUtilization || 0;
    
    return {
      current: Math.round(currentUtilization * 100),
      predicted: Math.round(currentUtilization * 100 * 1.05), // 5% d'augmentation
      recommendation: currentUtilization > 0.85 ? 'Ajouter des véhicules' : 'Maintenir le niveau actuel'
    };
  }

  calculateCurrentPerformance() {
    const metrics = this.performanceMetrics;
    let totalScore = 0;
    let count = 0;
    
    if (metrics.presence) {
      totalScore += metrics.presence.attendanceRate || 0;
      count++;
    }
    
    if (metrics.missions) {
      totalScore += metrics.missions.successRate || 0;
      count++;
    }
    
    if (metrics.resources) {
      totalScore += (metrics.resources.agentUtilization || 0) * 100;
      count++;
    }
    
    return count > 0 ? totalScore / count : 0;
  }

  identifyPerformanceFactors() {
    const factors = [];
    const metrics = this.performanceMetrics;
    
    if (metrics.presence?.punctualityRate > 90) {
      factors.push('Ponctualité élevée');
    }
    
    if (metrics.missions?.successRate > 90) {
      factors.push('Taux de réussite élevé');
    }
    
    if (metrics.resources?.agentUtilization > 0.8) {
      factors.push('Utilisation efficace des agents');
    }
    
    return factors;
  }

  // Notifications
  notifyInsightsGenerated() {
    const event = new CustomEvent('insightsGenerated', {
      detail: {
        insights: this.insights,
        metrics: this.performanceMetrics
      }
    });
    document.dispatchEvent(event);
  }

  notifyPredictionsGenerated() {
    const event = new CustomEvent('predictionsGenerated', {
      detail: {
        predictions: this.predictions
      }
    });
    document.dispatchEvent(event);
  }

  // Méthodes publiques
  getInsights() {
    return this.insights;
  }

  getPredictions() {
    return this.predictions;
  }

  getPerformanceMetrics() {
    return this.performanceMetrics;
  }

  getTrends() {
    return this.trends;
  }

  getDataPoints() {
    return this.dataPoints;
  }
}

// Initialiser le système d'analytics et insights
window.analyticsInsights = new AnalyticsInsights();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsInsights;
}
