/**
 * Tableau de bord personnalisé pour les agents CCRB
 * Affiche les objectifs, progression, badges et statistiques personnelles
 */

class AgentDashboard {
  constructor() {
    this.currentAgent = null;
    this.currentUser = null;
    this.goals = [];
    this.achievements = [];
    this.personalStats = {};
    this.performanceMetrics = {};
    this.badges = [];
    this.leaderboard = [];
    
    this.init();
  }

  async init() {
    await this.loadAgentData();
    this.setupEventListeners();
    this.startRealTimeUpdates();
  }

  async loadAgentData() {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
        'Content-Type': 'application/json'
      };

      const response = await fetch('/api/profile', { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.currentAgent = data.user;
          this.currentUser = data.user;
        } else {
          throw new Error(data.error || 'Impossible de charger le profil utilisateur');
        }
        console.log('👤 Agent chargé:', this.currentAgent);
      } else {
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        this.currentAgent = userProfile;
        this.currentUser = userProfile;
      }
      
      await this.refreshAllData();
    } catch (error) {
      console.error('❌ Erreur chargement tableau de bord:', error);
    }
  }

  async refreshAllData() {
    if (!this.currentAgent || !this.currentAgent.id) {
      console.warn('Aucun agent actif pour le tableau de bord');
      return;
    }
    
    await Promise.all([
      this.loadPersonalStats(),
      this.loadPersonalGoals(),
      this.loadAchievements(),
      this.loadPerformanceMetrics(),
      this.loadBadges(),
      this.loadLeaderboard()
    ]);
    
    this.renderDashboard();
  }

  async setAgent(agent) {
    if (!agent || !agent.id) {
      console.warn('setAgent appelé sans agent valide');
      return;
    }
    this.currentAgent = { ...this.currentAgent, ...agent, id: Number(agent.id) };
    await this.refreshAllData();
  }

  buildScopedUrl(base, paramName) {
    const agentId = this.currentAgent?.id;
    if (!agentId) return base;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}${paramName}=${encodeURIComponent(agentId)}`;
  }

  async loadPersonalGoals() {
    try {
      const response = await fetch(`/api/goals`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        this.goals = data.goals || [];
      } else {
        // Objectifs par défaut
        this.goals = this.getDefaultGoals();
      }
    } catch (error) {
      console.warn('Impossible de charger les objectifs, utilisation des valeurs par défaut');
      this.goals = this.getDefaultGoals();
    }
  }

  getDefaultGoals() {
    return [
      {
        id: 1,
        title: 'Présence parfaite',
        description: 'Maintenir un taux de présence de 100%',
        target: 100,
        current: 0,
        unit: '%',
        type: 'attendance',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      },
      {
        id: 2,
        title: 'Missions complétées',
        description: 'Compléter 20 missions ce mois',
        target: 20,
        current: 0,
        unit: 'missions',
        type: 'missions',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      },
      {
        id: 3,
        title: 'Temps sur le terrain',
        description: 'Passer 150 heures sur le terrain ce mois',
        target: 150,
        current: 0,
        unit: 'heures',
        type: 'field_time',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      }
    ];
  }

  async loadAchievements() {
    try {
      const response = await fetch(`/api/agent/achievements?agent_id=${this.currentAgent.id}`);
      if (response.ok) {
        const data = await response.json();
        this.achievements = data.achievements || [];
      } else {
        this.achievements = this.getDefaultAchievements();
      }
    } catch (error) {
      this.achievements = this.getDefaultAchievements();
    }
  }

  getDefaultAchievements() {
    return [
      {
        id: 1,
        title: 'Premier jour',
        description: 'Première connexion à l\'application',
        icon: '🎯',
        date: new Date().toISOString(),
        type: 'milestone'
      },
      {
        id: 2,
        title: 'Mission accomplie',
        description: 'Première mission complétée avec succès',
        icon: '✅',
        date: new Date().toISOString(),
        type: 'mission'
      }
    ];
  }

  async loadPersonalStats() {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
        'Content-Type': 'application/json'
      };

      // Récupérer les missions et les check-ins en parallèle
      const missionsUrl = this.buildScopedUrl('/api/me/missions', 'agent_id');
      const checkinsUrl = this.buildScopedUrl('/api/checkins', 'user_id');

      const [missionsRes, checkinsRes] = await Promise.all([
        fetch(missionsUrl, { headers }),
        fetch(checkinsUrl, { headers })
      ]);

      let missions = [];
      if (missionsRes.ok) {
        const missionData = await missionsRes.json();
        missions = missionData.missions || [];
      }

      let checkins = [];
      if (checkinsRes.ok) {
        const checkinData = await checkinsRes.json();
        checkins = checkinData.items || checkinData.data?.items || checkinData.checkins || [];
      }

      // Calculer les statistiques réelles (presenceStats n'est plus nécessaire)
      this.personalStats = this.calculateRealStats({}, missions, checkins);
      
      console.log('📊 Statistiques personnelles chargées:', this.personalStats);
    } catch (error) {
      console.error('Erreur chargement stats personnelles:', error);
      this.personalStats = this.getDefaultStats();
    }
  }

  calculateRealStats(presenceStats, missions, checkins) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculer les heures travaillées ce mois
    const monthlyCheckins = checkins.filter(checkin => {
      const checkinDate = new Date(checkin.checkin_time);
      return checkinDate.getMonth() === currentMonth && checkinDate.getFullYear() === currentYear;
    });

    let totalHoursThisMonth = 0;
    monthlyCheckins.forEach(checkin => {
      if (checkin.checkin_time && checkin.checkout_time) {
        const start = new Date(checkin.checkin_time);
        const end = new Date(checkin.checkout_time);
        const hours = (end - start) / (1000 * 60 * 60);
        totalHoursThisMonth += hours;
      }
    });

    // Calculer le taux de présence
    const workingDaysThisMonth = this.getWorkingDaysInMonth(currentMonth, currentYear);
    const presentDays = new Set(monthlyCheckins.map(c => new Date(c.checkin_time).toDateString())).size;
    const attendanceRate = workingDaysThisMonth > 0 ? (presentDays / workingDaysThisMonth) * 100 : 0;

    // Missions complétées
    const completedMissions = missions.filter(m => m.status === 'completed').length;
    const totalMissions = missions.length;

    // Calculer les statistiques hebdomadaires
    const weeklyStats = this.calculateWeeklyStats(checkins);

    return {
      totalHoursThisMonth: Math.round(totalHoursThisMonth * 10) / 10,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      completedMissions,
      totalMissions,
      missionCompletionRate: totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0,
      totalCheckins: checkins.length,
      averageDailyHours: monthlyCheckins.length > 0 ? Math.round((totalHoursThisMonth / monthlyCheckins.length) * 10) / 10 : 0,
      weeklyStats,
      lastCheckin: checkins.length > 0 ? checkins[checkins.length - 1] : null,
      currentStreak: this.calculateCurrentStreak(checkins)
    };
  }

  getWorkingDaysInMonth(month, year) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      // Lundi à Vendredi (1-5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  calculateWeeklyStats(checkins) {
    const weeks = [];
    const now = new Date();
    
    // Calculer les 4 dernières semaines
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (now.getDay() + 7 * i));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekCheckins = checkins.filter(checkin => {
        const checkinDate = new Date(checkin.checkin_time);
        return checkinDate >= weekStart && checkinDate <= weekEnd;
      });
      
      let weekHours = 0;
      weekCheckins.forEach(checkin => {
        if (checkin.checkin_time && checkin.checkout_time) {
          const start = new Date(checkin.checkin_time);
          const end = new Date(checkin.checkout_time);
          const hours = (end - start) / (1000 * 60 * 60);
          weekHours += hours;
        }
      });
      
      weeks.push({
        week: `Semaine ${4 - i}`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        hours: Math.round(weekHours * 10) / 10,
        days: new Set(weekCheckins.map(c => new Date(c.checkin_time).toDateString())).size
      });
    }
    
    return weeks;
  }

  calculateCurrentStreak(checkins) {
    if (checkins.length === 0) return 0;
    
    const sortedCheckins = checkins.sort((a, b) => new Date(b.checkin_time) - new Date(a.checkin_time));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);
    
    for (let i = 0; i < 30; i++) { // Vérifier les 30 derniers jours
      const dateStr = currentDate.toDateString();
      const hasCheckin = sortedCheckins.some(checkin => 
        new Date(checkin.checkin_time).toDateString() === dateStr
      );
      
      if (hasCheckin) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  }

  getDefaultStats() {
    return {
      totalMissions: 0,
      completedMissions: 0,
      totalFieldTime: 0,
      averageMissionDuration: 0,
      attendanceRate: 0,
      punctualityRate: 0,
      efficiencyScore: 0,
      lastActivity: null
    };
  }

  async loadPerformanceMetrics() {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
        'Content-Type': 'application/json'
      };

      // Récupérer les données de performance depuis les check-ins et missions
      const missionsUrl = this.buildScopedUrl('/api/me/missions', 'agent_id');
      const checkinsUrl = this.buildScopedUrl('/api/checkins', 'user_id');

      const [checkinsRes, missionsRes] = await Promise.all([
        fetch(checkinsUrl, { headers }),
        fetch(missionsUrl, { headers })
      ]);

      let checkins = [];
      let missions = [];

      if (checkinsRes.ok) {
        const checkinData = await checkinsRes.json();
        checkins = checkinData.items || checkinData.data?.items || checkinData.checkins || [];
      }
      if (missionsRes.ok) {
        const missionData = await missionsRes.json();
        missions = missionData.missions || [];
      }

      // Calculer les métriques de performance réelles
      this.performanceMetrics = this.calculatePerformanceMetrics(checkins, missions);
      
      console.log('📈 Métriques de performance calculées:', this.performanceMetrics);
    } catch (error) {
      console.error('Erreur chargement métriques:', error);
      this.performanceMetrics = this.getDefaultPerformanceMetrics();
    }
  }

  calculatePerformanceMetrics(checkins, missions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculer les métriques mensuelles
    const monthlyCheckins = checkins.filter(checkin => {
      const checkinDate = new Date(checkin.checkin_time);
      return checkinDate.getMonth() === currentMonth && checkinDate.getFullYear() === currentYear;
    });

    const monthlyMissions = missions.filter(mission => {
      const missionDate = new Date(mission.created_at);
      return missionDate.getMonth() === currentMonth && missionDate.getFullYear() === currentYear;
    });

    // Calculer les heures totales ce mois
    let totalHours = 0;
    monthlyCheckins.forEach(checkin => {
      if (checkin.checkin_time && checkin.checkout_time) {
        const start = new Date(checkin.checkin_time);
        const end = new Date(checkin.checkout_time);
        const hours = (end - start) / (1000 * 60 * 60);
        totalHours += hours;
      }
    });

    // Calculer la moyenne quotidienne
    const workingDays = this.getWorkingDaysInMonth(currentMonth, currentYear);
    const averageDailyHours = workingDays > 0 ? totalHours / workingDays : 0;

    // Calculer le taux de ponctualité (arrivées à l'heure)
    const onTimeCheckins = monthlyCheckins.filter(checkin => {
      const checkinTime = new Date(checkin.checkin_time);
      const hour = checkinTime.getHours();
      return hour <= 8; // Arrivée avant 8h
    }).length;

    const punctualityRate = monthlyCheckins.length > 0 ? (onTimeCheckins / monthlyCheckins.length) * 100 : 0;

    // Missions complétées à temps
    const completedMissions = monthlyMissions.filter(m => m.status === 'completed');
    const onTimeMissions = completedMissions.filter(mission => {
      if (!mission.deadline) return true;
      const completionDate = new Date(mission.updated_at);
      const deadline = new Date(mission.deadline);
      return completionDate <= deadline;
    }).length;

    const missionOnTimeRate = completedMissions.length > 0 ? (onTimeMissions / completedMissions.length) * 100 : 0;

    return {
      totalHoursThisMonth: Math.round(totalHours * 10) / 10,
      averageDailyHours: Math.round(averageDailyHours * 10) / 10,
      punctualityRate: Math.round(punctualityRate * 10) / 10,
      missionOnTimeRate: Math.round(missionOnTimeRate * 10) / 10,
      totalCheckinsThisMonth: monthlyCheckins.length,
      completedMissionsThisMonth: completedMissions.length,
      efficiencyScore: this.calculateEfficiencyScore(totalHours, completedMissions.length, workingDays)
    };
  }

  calculateEfficiencyScore(totalHours, completedMissions, workingDays) {
    if (workingDays === 0) return 0;
    
    const averageHoursPerDay = totalHours / workingDays;
    const missionsPerDay = completedMissions / workingDays;
    
    // Score basé sur l'équilibre entre heures travaillées et missions accomplies
    const efficiencyScore = (missionsPerDay * 10) + (averageHoursPerDay * 0.5);
    return Math.min(Math.round(efficiencyScore), 100);
  }

  getDefaultPerformanceMetrics() {
    return {
      weekly: {
        missions: 0,
        fieldTime: 0,
        efficiency: 0
      },
      monthly: {
        missions: 0,
        fieldTime: 0,
        efficiency: 0
      },
      trends: {
        missions: 'stable',
        fieldTime: 'stable',
        efficiency: 'stable'
      }
    };
  }

  async loadBadges() {
    try {
      const response = await fetch(`/api/badges`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        this.badges = data.badges || [];
      } else {
        this.badges = this.getDefaultBadges();
      }
    } catch (error) {
      this.badges = this.getDefaultBadges();
    }
  }

  getDefaultBadges() {
    return [
      {
        id: 1,
        name: 'Débutant',
        description: 'Nouvel agent sur le terrain',
        icon: '🌱',
        earned: true,
        earnedDate: new Date().toISOString(),
        rarity: 'common'
      },
      {
        id: 2,
        name: 'Ponctuel',
        description: 'Arrivé à l\'heure 5 jours de suite',
        icon: '⏰',
        earned: false,
        earnedDate: null,
        rarity: 'uncommon'
      },
      {
        id: 3,
        name: 'Efficace',
        description: 'Efficacité supérieure à 90%',
        icon: '⚡',
        earned: false,
        earnedDate: null,
        rarity: 'rare'
      }
    ];
  }

  async loadLeaderboard() {
    try {
      const response = await fetch('/api/agent/leaderboard');
      if (response.ok) {
        const data = await response.json();
        this.leaderboard = data.leaderboard || [];
      } else {
        this.leaderboard = this.getDefaultLeaderboard();
      }
    } catch (error) {
      this.leaderboard = this.getDefaultLeaderboard();
    }
  }

  getDefaultLeaderboard() {
    return [
      { rank: 1, name: 'Agent Alpha', score: 95, missions: 25, fieldTime: 180 },
      { rank: 2, name: 'Agent Beta', score: 92, missions: 23, fieldTime: 175 },
      { rank: 3, name: 'Agent Gamma', score: 89, missions: 22, fieldTime: 170 },
      { rank: 4, name: this.currentAgent?.name || 'Vous', score: 85, missions: 20, fieldTime: 165 },
      { rank: 5, name: 'Agent Delta', score: 82, missions: 19, fieldTime: 160 }
    ];
  }

  setupEventListeners() {
    // Écouter les mises à jour de mission
    document.addEventListener('missionCompleted', (event) => {
      this.updateMissionStats(event.detail.mission);
    });

    // Écouter les mises à jour de présence
    document.addEventListener('presenceUpdated', (event) => {
      this.updateAttendanceStats(event.detail.presence);
    });

    // Écouter les nouvelles réalisations
    document.addEventListener('achievementEarned', (event) => {
      this.addAchievement(event.detail.achievement);
    });
  }

  startRealTimeUpdates() {
    // Mettre à jour les statistiques toutes les 5 minutes
    setInterval(() => {
      this.updateRealTimeStats();
    }, 300000);

    // Vérifier les nouveaux badges toutes les heures
    setInterval(() => {
      this.checkNewBadges();
    }, 3600000);
  }

  async updateRealTimeStats() {
    await this.loadPersonalStats();
    await this.loadPerformanceMetrics();
    this.notifyStatsUpdated();
  }

  updateMissionStats(mission) {
    this.personalStats.totalMissions++;
    if (mission.status === 'completed') {
      this.personalStats.completedMissions++;
    }
    
    // Mettre à jour les objectifs
    this.updateGoalsProgress('missions', 1);
    
    // Vérifier les nouveaux badges
    this.checkMissionBadges();
    
    this.notifyStatsUpdated();
  }

  updateAttendanceStats(presence) {
    // Mettre à jour le taux de présence
    this.calculateAttendanceRate();
    
    // Mettre à jour les objectifs
    this.updateGoalsProgress('attendance', 1);
    
    // Vérifier les nouveaux badges
    this.checkAttendanceBadges();
    
    this.notifyStatsUpdated();
  }

  calculateAttendanceRate() {
    // Calculer le taux de présence basé sur les données récentes
    const recentDays = 30;
    const presentDays = this.personalStats.presentDays || 0;
    this.personalStats.attendanceRate = (presentDays / recentDays) * 100;
  }

  updateGoalsProgress(type, increment) {
    for (const goal of this.goals) {
      if (goal.type === type && goal.status === 'active') {
        goal.current += increment;
        
        // Vérifier si l'objectif est atteint
        if (goal.current >= goal.target) {
          goal.status = 'completed';
          this.celebrateGoalCompletion(goal);
        }
      }
    }
  }

  celebrateGoalCompletion(goal) {
    // Afficher une notification de célébration
    if (window.notificationManager) {
      window.notificationManager.sendNotification('🎉 Objectif Atteint!', {
        body: `Félicitations! Vous avez atteint l'objectif: ${goal.title}`,
        tag: 'goal-completed',
        requireInteraction: true
      });
    }
    
    // Ajouter une réalisation
    this.addAchievement({
      title: `Objectif: ${goal.title}`,
      description: `Vous avez atteint votre objectif de ${goal.target} ${goal.unit}`,
      icon: '🎯',
      type: 'goal'
    });
  }

  checkMissionBadges() {
    const totalMissions = this.personalStats.totalMissions;
    
    // Badge "Première mission"
    if (totalMissions === 1) {
      this.earnBadge('premiere-mission');
    }
    
    // Badge "10 missions"
    if (totalMissions === 10) {
      this.earnBadge('10-missions');
    }
    
    // Badge "50 missions"
    if (totalMissions === 50) {
      this.earnBadge('50-missions');
    }
  }

  checkAttendanceBadges() {
    const attendanceRate = this.personalStats.attendanceRate;
    
    // Badge "Présence parfaite"
    if (attendanceRate >= 100) {
      this.earnBadge('presence-parfaite');
    }
    
    // Badge "Très ponctuel"
    if (attendanceRate >= 95) {
      this.earnBadge('tres-ponctuel');
    }
  }

  checkNewBadges() {
    // Vérifier tous les badges possibles
    this.checkMissionBadges();
    this.checkAttendanceBadges();
    this.checkEfficiencyBadges();
    this.checkTimeBadges();
  }

  checkEfficiencyBadges() {
    const efficiency = this.personalStats.efficiencyScore;
    
    if (efficiency >= 90) {
      this.earnBadge('efficace');
    }
    
    if (efficiency >= 95) {
      this.earnBadge('tres-efficace');
    }
  }

  checkTimeBadges() {
    const fieldTime = this.personalStats.totalFieldTime;
    
    if (fieldTime >= 100) {
      this.earnBadge('100-heures');
    }
    
    if (fieldTime >= 500) {
      this.earnBadge('500-heures');
    }
  }

  earnBadge(badgeId) {
    const badge = this.badges.find(b => b.id === badgeId);
    if (badge && !badge.earned) {
      badge.earned = true;
      badge.earnedDate = new Date().toISOString();
      
      // Afficher une notification
      if (window.notificationManager) {
        window.notificationManager.sendNotification('🏆 Nouveau Badge!', {
          body: `Vous avez gagné le badge: ${badge.name}`,
          tag: 'badge-earned',
          requireInteraction: true
        });
      }
      
      // Ajouter une réalisation
      this.addAchievement({
        title: `Badge: ${badge.name}`,
        description: badge.description,
        icon: badge.icon,
        type: 'badge'
      });
      
      this.notifyBadgeEarned(badge);
    }
  }

  addAchievement(achievement) {
    const newAchievement = {
      id: Date.now(),
      ...achievement,
      date: new Date().toISOString()
    };
    
    this.achievements.unshift(newAchievement);
    
    // Garder seulement les 50 dernières réalisations
    if (this.achievements.length > 50) {
      this.achievements = this.achievements.slice(0, 50);
    }
    
    this.notifyAchievementAdded(newAchievement);
  }

  // Méthodes de notification
  notifyStatsUpdated() {
    const event = new CustomEvent('agentStatsUpdated', {
      detail: {
        stats: this.personalStats,
        metrics: this.performanceMetrics
      }
    });
    document.dispatchEvent(event);
  }

  notifyBadgeEarned(badge) {
    const event = new CustomEvent('badgeEarned', {
      detail: { badge }
    });
    document.dispatchEvent(event);
  }

  notifyAchievementAdded(achievement) {
    const event = new CustomEvent('achievementAdded', {
      detail: { achievement }
    });
    document.dispatchEvent(event);
  }

  // Méthodes publiques
  getGoals() {
    return this.goals;
  }

  getAchievements() {
    return this.achievements;
  }

  getPersonalStats() {
    return this.personalStats;
  }

  getPerformanceMetrics() {
    return this.performanceMetrics;
  }

  getBadges() {
    return this.badges;
  }

  getLeaderboard() {
    return this.leaderboard;
  }

  getCurrentAgent() {
    return this.currentAgent;
  }

  // Méthodes d'affichage
  renderDashboard() {
    this.renderGoals();
    this.renderStats();
    this.renderPerformance();
    this.renderBadges();
    this.renderAchievements();
    this.renderLeaderboard();
  }

  renderPerformance() {
    const container = document.getElementById('performance-container');
    if (!container) return;

    const metrics = this.performanceMetrics;
    
    container.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-body text-center">
              <h5 class="card-title">⏰ Heures ce mois</h5>
              <h3 class="text-primary">${metrics.totalHoursThisMonth || 0}h</h3>
              <small class="text-muted">Moyenne: ${metrics.averageDailyHours || 0}h/jour</small>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card mb-3">
            <div class="card-body text-center">
              <h5 class="card-title">🎯 Score d'efficacité</h5>
              <h3 class="text-success">${metrics.efficiencyScore || 0}/100</h3>
              <div class="progress mt-2">
                <div class="progress-bar bg-success" style="width: ${metrics.efficiencyScore || 0}%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-md-4">
          <div class="card">
            <div class="card-body text-center">
              <h6 class="card-title">⏰ Ponctualité</h6>
              <h4 class="text-info">${metrics.punctualityRate || 0}%</h4>
              <small class="text-muted">Arrivées à l'heure</small>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card">
            <div class="card-body text-center">
              <h6 class="card-title">✅ Missions à temps</h6>
              <h4 class="text-warning">${metrics.missionOnTimeRate || 0}%</h4>
              <small class="text-muted">Respect des délais</small>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card">
            <div class="card-body text-center">
              <h6 class="card-title">📊 Activité mensuelle</h6>
              <h4 class="text-primary">${metrics.totalCheckinsThisMonth || 0}</h4>
              <small class="text-muted">Check-ins ce mois</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderGoals() {
    const container = document.getElementById('goals-container');
    if (!container) return;

    container.innerHTML = this.goals.map(goal => `
      <div class="goal-card">
        <div class="goal-header">
          <h6>${goal.title}</h6>
          <span class="goal-status ${goal.status}">${goal.status}</span>
        </div>
        <div class="goal-progress">
          <div class="progress">
            <div class="progress-bar" style="width: ${(goal.current / goal.target) * 100}%"></div>
          </div>
          <div class="goal-numbers">
            <span>${goal.current} / ${goal.target} ${goal.unit}</span>
            <span>${((goal.current / goal.target) * 100).toFixed(1)}%</span>
          </div>
        </div>
        <p class="goal-description">${goal.description}</p>
      </div>
    `).join('');
  }

  renderStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const stats = this.personalStats;
    
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">⏰</div>
          <div class="stat-value">${stats.totalHoursThisMonth || 0}h</div>
          <div class="stat-label">Heures ce mois</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${stats.attendanceRate || 0}%</div>
          <div class="stat-label">Taux de présence</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${stats.completedMissions || 0}/${stats.totalMissions || 0}</div>
          <div class="stat-label">Missions complétées</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔥</div>
          <div class="stat-value">${stats.currentStreak || 0}</div>
          <div class="stat-label">Série actuelle</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📈</div>
          <div class="stat-value">${stats.missionCompletionRate || 0}%</div>
          <div class="stat-label">Taux de réussite</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📍</div>
          <div class="stat-value">${stats.totalCheckins || 0}</div>
          <div class="stat-label">Total check-ins</div>
        </div>
      </div>
      
      <!-- Statistiques hebdomadaires -->
      <div class="mt-4">
        <h5 class="mb-3">📅 Évolution Hebdomadaire</h5>
        <div class="weekly-stats">
          ${this.renderWeeklyStats(stats.weeklyStats || [])}
        </div>
      </div>
      
      <!-- Dernière activité -->
      ${this.renderLastActivity(stats.lastCheckin)}
    `;
  }

  renderWeeklyStats(weeklyStats) {
    if (!weeklyStats || weeklyStats.length === 0) {
      return '<p class="text-muted">Aucune donnée hebdomadaire disponible</p>';
    }

    return `
      <div class="row">
        ${weeklyStats.map(week => `
          <div class="col-md-4 mb-3">
            <div class="card h-100">
              <div class="card-body text-center d-flex flex-column justify-content-between">
                <div>
                  <h6 class="card-title mb-1">${week.week}</h6>
                  <div class="mb-2">
                    <strong class="text-primary fs-5">${week.hours}h</strong>
                  </div>
                  <div class="text-muted small mb-1">
                    ${week.days} jour(s) travaillé(s)
                  </div>
                </div>
                <div class="text-muted small mt-2">
                  ${week.startDate} - ${week.endDate}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderLastActivity(lastCheckin) {
    if (!lastCheckin) {
      return `
        <div class="mt-4">
          <h5 class="mb-3">🕐 Dernière Activité</h5>
          <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> Aucune activité récente
          </div>
        </div>
      `;
    }

    const checkinDate = new Date(lastCheckin.checkin_time);
    const checkoutDate = lastCheckin.checkout_time ? new Date(lastCheckin.checkout_time) : null;
    const duration = checkoutDate ? Math.round((checkoutDate - checkinDate) / (1000 * 60 * 60) * 10) / 10 : null;

    return `
      <div class="mt-4">
        <h5 class="mb-3">🕐 Dernière Activité</h5>
        <div class="card">
          <div class="card-body">
            <div class="row">
              <div class="col-md-6">
                <strong>📍 Arrivée:</strong><br>
                <span class="text-muted">${checkinDate.toLocaleString('fr-FR')}</span>
              </div>
              <div class="col-md-6">
                <strong>🚪 Départ:</strong><br>
                <span class="text-muted">
                  ${checkoutDate ? checkoutDate.toLocaleString('fr-FR') : 'En cours...'}
                </span>
              </div>
            </div>
            ${duration ? `
              <div class="mt-2">
                <strong>⏱️ Durée:</strong> ${duration}h
              </div>
            ` : ''}
            ${lastCheckin.location ? `
              <div class="mt-2">
                <strong>🌍 Localisation:</strong> ${lastCheckin.location}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderBadges() {
    const container = document.getElementById('badges-container');
    if (!container) return;

    container.innerHTML = this.badges.map(badge => `
      <div class="badge-card ${badge.earned ? 'earned' : 'locked'}">
        <div class="badge-icon">${badge.icon}</div>
        <div class="badge-name">${badge.name}</div>
        <div class="badge-description">${badge.description}</div>
        ${badge.earned ? `<div class="badge-date">Gagné le ${new Date(badge.earnedDate).toLocaleDateString()}</div>` : ''}
      </div>
    `).join('');
  }

  renderAchievements() {
    const container = document.getElementById('achievements-container');
    if (!container) return;

    container.innerHTML = this.achievements.slice(0, 10).map(achievement => `
      <div class="achievement-item">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-content">
          <div class="achievement-title">${achievement.title}</div>
          <div class="achievement-description">${achievement.description}</div>
          <div class="achievement-date">${new Date(achievement.date).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');
  }

  renderLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;

    container.innerHTML = this.leaderboard.map(agent => `
      <div class="leaderboard-item ${agent.id === this.currentAgent?.id ? 'current-agent' : ''}">
        <div class="rank">#${agent.rank}</div>
        <div class="agent-name">${agent.name}</div>
        <div class="agent-score">${agent.score} pts</div>
        <div class="agent-details">
          <small>${agent.missions} missions • ${agent.fieldTime}h terrain</small>
        </div>
      </div>
    `).join('');
  }
}

// Initialiser le tableau de bord agent
window.agentDashboard = new AgentDashboard();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentDashboard;
}
