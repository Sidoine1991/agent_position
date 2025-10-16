// Configuration des rayons de tolérance par agent
// Basé sur les distances déclarées - 20% pour la marge de sécurité

const AGENT_TOLERANCE_CONFIG = {
  // Zone PDA4 (Nord)
  "DJIBRIL ABDEL-HAFIZ": {
    commune: "DJOUGOU",
    cep: 2,
    distanceDeclaree: 25, // km
    rayonTolerance: 20, // km (80% de 25km)
    zone: "PDA4"
  },
  "GOUKALODE CALIXTE": {
    commune: "DASSA-ZOUMÉ",
    cep: 2,
    distanceDeclaree: 22,
    rayonTolerance: 17.6,
    zone: "PDA4"
  },
  "EKPA Chabi Ogoudélé Aimé": {
    commune: "BASSILA",
    cep: 2,
    distanceDeclaree: 20,
    rayonTolerance: 16,
    zone: "PDA4"
  },
  "KALOA Moukimiou": {
    commune: "OUAKÉ",
    cep: 2,
    distanceDeclaree: 25,
    rayonTolerance: 20,
    zone: "PDA4"
  },
  "CHERIF FABADE DEKANDE LUC": {
    commune: "SAVALOU",
    cep: 2,
    distanceDeclaree: 30,
    rayonTolerance: 24,
    zone: "PDA4"
  },
  "FADO kami Macaire": {
    commune: "BANTÈ",
    cep: 2,
    distanceDeclaree: 15,
    rayonTolerance: 12,
    zone: "PDA4"
  },
  "TCHETAN PRUDENCE": {
    commune: "GLAZOUE",
    cep: 2,
    distanceDeclaree: 10,
    rayonTolerance: 8,
    zone: "PDA4"
  },
  "AKPO ANOS": {
    commune: "DASSA ZOUMÈ",
    cep: 2,
    distanceDeclaree: 21,
    rayonTolerance: 16.8,
    zone: "PDA4"
  },
  "DAGAN Bruno": {
    commune: "Glazoué",
    cep: 2,
    distanceDeclaree: 25,
    rayonTolerance: 20,
    zone: "PDA4"
  },
  "ADOHO D. THIBURCE": {
    commune: "SAVALOU",
    cep: 2,
    distanceDeclaree: 55,
    rayonTolerance: 30, // LIMITÉ POUR RAISONS MÉTIER (original: 44km)
    zone: "PDA4"
  },
  "SERIKI FATAI": {
    commune: "BANTÉ",
    cep: 2,
    distanceDeclaree: 22,
    rayonTolerance: 17.6,
    zone: "PDA4"
  },

  // Zone SUD - LIMITÉ À 20KM MAXIMUM
  "DAGNITO Mariano": {
    commune: "Zogbodomey",
    cep: 2,
    distanceDeclaree: 35,
    rayonTolerance: 20, // LIMITÉ POUR RAISONS MÉTIER (original: 28km)
    zone: "SUD"
  },
  "GOGAN Ida": {
    commune: "Zogbodomey",
    cep: 2,
    distanceDeclaree: 35,
    rayonTolerance: 20, // LIMITÉ POUR RAISONS MÉTIER (original: 28km)
    zone: "SUD"
  },
  "ADJOVI Sabeck": {
    commune: "Zogbodomey",
    cep: 3,
    distanceDeclaree: 35,
    rayonTolerance: 20, // LIMITÉ POUR RAISONS MÉTIER (original: 28km)
    zone: "SUD"
  },
  "TOGNON TCHEGNONSI Bernice": {
    commune: "Zogbodomey",
    cep: 1,
    distanceDeclaree: 35,
    rayonTolerance: 20, // LIMITÉ POUR RAISONS MÉTIER (original: 28km)
    zone: "SUD"
  }
};

// Rayon par défaut pour les agents sans déclaration
const DEFAULT_TOLERANCE_RADIUS = 6; // km

// Fonction pour obtenir le rayon de tolérance d'un agent
function getAgentToleranceRadius(agentName) {
  const config = AGENT_TOLERANCE_CONFIG[agentName];
  if (config) {
    return config.rayonTolerance * 1000; // Convertir en mètres
  }
  return DEFAULT_TOLERANCE_RADIUS * 1000; // 6km par défaut en mètres
}

// Fonction pour obtenir la configuration complète d'un agent
function getAgentConfig(agentName) {
  return AGENT_TOLERANCE_CONFIG[agentName] || {
    commune: "Non spécifié",
    cep: 0,
    distanceDeclaree: 0,
    rayonTolerance: DEFAULT_TOLERANCE_RADIUS,
    zone: "Non spécifié"
  };
}

// Fonction pour lister tous les agents avec leurs configurations
function getAllAgentConfigs() {
  return Object.entries(AGENT_TOLERANCE_CONFIG).map(([name, config]) => ({
    nom: name,
    ...config
  }));
}

// Fonction pour calculer automatiquement le rayon (distance déclarée - 20%)
function calculateToleranceRadius(distanceDeclaree) {
  return distanceDeclaree * 0.8; // 80% de la distance déclarée
}

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AGENT_TOLERANCE_CONFIG,
    DEFAULT_TOLERANCE_RADIUS,
    getAgentToleranceRadius,
    getAgentConfig,
    getAllAgentConfigs,
    calculateToleranceRadius
  };
}
