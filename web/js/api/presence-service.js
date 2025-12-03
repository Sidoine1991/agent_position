class PresenceService {
  static async fetchAgentPresence(agentId, startDate, endDate) {
    try {
      const response = await fetch(`/api/presence/agent/${agentId}?start=${startDate}&end=${endDate}`);
      if (!response.ok) throw new Error('Erreur lors de la récupération des données de présence');
      return await response.json();
    } catch (error) {
      console.error('Erreur API - fetchAgentPresence:', error);
      return null;
    }
  }
}

export default PresenceService;
