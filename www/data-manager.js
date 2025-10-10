// ===== GESTIONNAIRE DE DONNÉES UNIFIÉ =====
class DataManager {
    constructor() {
        this.apiBase = '/api';
        this.jwt = localStorage.getItem('jwt') || '';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.init();
    }

    init() {
        // Setup periodic data refresh
        setInterval(() => this.refreshCache(), 60000); // Every minute
    }

    async request(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.jwt}`,
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Cache management
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    refreshCache() {
        // Clear expired cache entries
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp >= this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    // User management
    async getUserProfile() {
        const cached = this.getCached('userProfile');
        if (cached) return cached;

        try {
            const profile = await this.request('/profile');
            this.setCache('userProfile', profile);
            return profile;
        } catch (error) {
            console.error('Failed to load user profile:', error);
            return null;
        }
    }

    async updateUserProfile(profileData) {
        try {
            const updatedProfile = await this.request('/profile', {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });
            this.setCache('userProfile', updatedProfile);
            return updatedProfile;
        } catch (error) {
            console.error('Failed to update user profile:', error);
            throw error;
        }
    }

    // Mission management
    async getCurrentMission() {
        const cached = this.getCached('currentMission');
        if (cached) return cached;

        try {
            const missions = await this.request('/me/missions');
            const currentMission = missions.find(m => m.status === 'active');
            this.setCache('currentMission', currentMission);
            return currentMission;
        } catch (error) {
            console.error('Failed to load current mission:', error);
            return null;
        }
    }

    async startMission() {
        try {
            const mission = await this.request('/presence/start', {
                method: 'POST'
            });
            this.clearCache(); // Clear cache to force refresh
            return mission;
        } catch (error) {
            console.error('Failed to start mission:', error);
            throw error;
        }
    }

    async endMission() {
        try {
            const result = await this.request('/presence/end', {
                method: 'POST'
            });
            this.clearCache(); // Clear cache to force refresh
            return result;
        } catch (error) {
            console.error('Failed to end mission:', error);
            throw error;
        }
    }

    async submitCheckin(checkinData) {
        try {
            const result = await this.request('/mission/checkin', {
                method: 'POST',
                body: JSON.stringify(checkinData)
            });
            this.clearCache(); // Clear cache to force refresh
            return result;
        } catch (error) {
            console.error('Failed to submit checkin:', error);
            throw error;
        }
    }

    // Presence data
    async getPresenceStats(month = null) {
        const cacheKey = `presenceStats_${month || 'current'}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const endpoint = month ? `/presence/stats?month=${month}` : '/presence/stats';
            const stats = await this.request(endpoint);
            this.setCache(cacheKey, stats);
            return stats;
        } catch (error) {
            console.error('Failed to load presence stats:', error);
            return null;
        }
    }

    async getPresenceHistory(agentId = null, month = null) {
        const cacheKey = `presenceHistory_${agentId || 'all'}_${month || 'current'}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            let endpoint = '/presence/history';
            const params = new URLSearchParams();
            if (agentId) params.append('agent_id', agentId);
            if (month) params.append('month', month);
            if (params.toString()) endpoint += `?${params.toString()}`;

            const history = await this.request(endpoint);
            this.setCache(cacheKey, history);
            return history;
        } catch (error) {
            console.error('Failed to load presence history:', error);
            return null;
        }
    }

    // Agents management (for supervisors and admins)
    async getAgents() {
        const cached = this.getCached('agents');
        if (cached) return cached;

        try {
            const agents = await this.request('/agents');
            this.setCache('agents', agents);
            return agents;
        } catch (error) {
            console.error('Failed to load agents:', error);
            return [];
        }
    }

    async createAgent(agentData) {
        try {
            const agent = await this.request('/agents', {
                method: 'POST',
                body: JSON.stringify(agentData)
            });
            this.clearCache(); // Clear cache to force refresh
            return agent;
        } catch (error) {
            console.error('Failed to create agent:', error);
            throw error;
        }
    }

    async updateAgent(agentId, agentData) {
        try {
            const agent = await this.request(`/agents/${agentId}`, {
                method: 'PUT',
                body: JSON.stringify(agentData)
            });
            this.clearCache(); // Clear cache to force refresh
            return agent;
        } catch (error) {
            console.error('Failed to update agent:', error);
            throw error;
        }
    }

    async deleteAgent(agentId) {
        try {
            await this.request(`/agents/${agentId}`, {
                method: 'DELETE'
            });
            this.clearCache(); // Clear cache to force refresh
        } catch (error) {
            console.error('Failed to delete agent:', error);
            throw error;
        }
    }

    // Reports
    async getReports(filters = {}) {
        const cacheKey = `reports_${JSON.stringify(filters)}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;

        try {
            const params = new URLSearchParams(filters);
            const reports = await this.request(`/reports?${params.toString()}`);
            this.setCache(cacheKey, reports);
            return reports;
        } catch (error) {
            console.error('Failed to load reports:', error);
            return [];
        }
    }

    async generateReport(reportData) {
        try {
            const report = await this.request('/reports/generate', {
                method: 'POST',
                body: JSON.stringify(reportData)
            });
            this.clearCache(); // Clear cache to force refresh
            return report;
        } catch (error) {
            console.error('Failed to generate report:', error);
            throw error;
        }
    }

    // Admin functions
    async getAdminStats() {
        const cached = this.getCached('adminStats');
        if (cached) return cached;

        try {
            const stats = await this.request('/admin/stats');
            this.setCache('adminStats', stats);
            return stats;
        } catch (error) {
            console.error('Failed to load admin stats:', error);
            return null;
        }
    }

    async updateAppSettings(settings) {
        try {
            const updatedSettings = await this.request('/admin/settings', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });
            this.clearCache(); // Clear cache to force refresh
            return updatedSettings;
        } catch (error) {
            console.error('Failed to update app settings:', error);
            throw error;
        }
    }

    // Utility methods
    formatDate(date) {
        return new Date(date).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatDateTime(date) {
        return new Date(date).toLocaleString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatTime(date) {
        return new Date(date).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Error handling
    handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        
        let message = 'Une erreur est survenue';
        if (error.message.includes('401')) {
            message = 'Session expirée. Veuillez vous reconnecter.';
            this.logout();
        } else if (error.message.includes('403')) {
            message = 'Accès refusé. Permissions insuffisantes.';
        } else if (error.message.includes('404')) {
            message = 'Ressource non trouvée.';
        } else if (error.message.includes('500')) {
            message = 'Erreur serveur. Veuillez réessayer plus tard.';
        }

        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    logout() {
        localStorage.removeItem('jwt');
        localStorage.removeItem('userProfile');
        this.clearCache();
        window.location.href = 'index.html';
    }
}

// Initialize data manager
const dataManager = new DataManager();

// Export for global access
window.dataManager = dataManager;
