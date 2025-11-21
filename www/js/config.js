// Configuration de l'API
const API_CONFIG = {
  // URL de base de l'API
  baseUrl: window.location.hostname === 'localhost' 
    ? 'http://localhost:3010/api' 
    : '/api',
  
  // Configuration pour le mode développement
  isDevelopment: window.location.hostname === 'localhost',
  
  // Configuration des en-têtes par défaut
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Fonction utilitaire pour les appels API
async function apiRequest(endpoint, options = {}) {
  const url = `${API_CONFIG.baseUrl}${endpoint}`;
  
  // Fusionner les en-têtes
  const headers = {
    ...API_CONFIG.headers,
    ...(options.headers || {})
  };
  
  // Ajouter le token JWT s'il existe
  const token = localStorage.getItem('jwt');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Configuration de la requête
  const config = {
    ...options,
    headers,
    credentials: 'include'
  };
  
  if (API_CONFIG.isDevelopment) {
    console.log(`API Request: ${url}`, config);
  }
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    // Essayer de parser la réponse en JSON
    try {
      const data = await response.json();
      if (API_CONFIG.isDevelopment) {
        console.log(`API Response (${url}):`, data);
      }
      return data;
    } catch (e) {
      // Si la réponse n'est pas du JSON, retourner le texte brut
      const text = await response.text();
      if (API_CONFIG.isDevelopment) {
        console.log(`API Response (${url} - text):`, text);
      }
      return text;
    }
  } catch (error) {
    if (API_CONFIG.isDevelopment) {
      console.error(`API Error (${url}):`, error);
    }
    throw error;
  }
}
