/**
 * Tableau de bord personnalisé pour les agents CCRB
 * Affiche les objectifs, progression, badges et statistiques personnelles
 */

class AgentDashboard {
  constructor() {
    this.currentAgent = null;
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
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      this.currentAgent = userProfile;
      
      // Charger les objectifs personnels
      await this.loadPersonalGoals();
      
      // Charger les réalisations
      await this.loadAchievements();
      
      // Charger les statistiques personnelles
      await this.loadPersonalStats();
      
      // Charger les métriques de performance
      await this.loadPerformanceMetrics();
      
      // Charger les badges
      await this.loadBadges();
      
      // Charger le classement
      await this.loadLeaderboard();
      
      console.log('✅ Données du tableau de bord agent chargées');
    } catch (error) {
      console.error('❌ Erreur chargement tableau de bord:', error);
    }
  }

  async loadPersonalGoals() {
    try {
      const response = await fetch(`/api/agent/goals?agent_id=${this.currentAgent.id}`);
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
      const response = await fetch(`/api/agent/stats?agent_id=${this.currentAgent.id}`);
      if (response.ok) {
        const data = await response.json();
        this.personalStats = data.stats || {};
      } else {
        this.personalStats = this.getDefaultStats();
      }
    } catch (error) {
      this.personalStats = this.getDefaultStats();
    }
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
      const response = await fetch(`/api/agent/performance?agent_id=${this.currentAgent.id}`);
      if (response.ok) {
        const data = await response.json();
        this.performanceMetrics = data.metrics || {};
      } else {
        this.performanceMetrics = this.getDefaultPerformanceMetrics();
      }
    } catch (error) {
      this.performanceMetrics = this.getDefaultPerformanceMetrics();
    }
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
      const response = await fetch(`/api/agent/badges?agent_id=${this.currentAgent.id}`);
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
    this.renderBadges();
    this.renderAchievements();
    this.renderLeaderboard();
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

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${this.personalStats.totalMissions}</div>
          <div class="stat-label">Missions totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${this.personalStats.completedMissions}</div>
          <div class="stat-label">Missions complétées</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏰</div>
          <div class="stat-value">${this.personalStats.totalFieldTime}h</div>
          <div class="stat-label">Temps sur le terrain</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📈</div>
          <div class="stat-value">${this.personalStats.attendanceRate.toFixed(1)}%</div>
          <div class="stat-label">Taux de présence</div>
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
      <div class="leaderboard-item ${agent.name === this.currentAgent?.name ? 'current-agent' : ''}">
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
