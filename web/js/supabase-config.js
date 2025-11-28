// Configuration de Supabase
const SUPABASE_URL = 'https://eoamsmtdspedumjmmeui.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjcyMzksImV4cCI6MjA3NDYwMzIzOX0.5F1uBbPfMYNlGgFJI20jexPf_XmPLiEOEtCTO_zZDcw';

// Initialisation du client Supabase
// Le SDK Supabase v2 expose 'supabase' comme variable globale
(function initSupabaseClient() {
  // Vérifier si le SDK est déjà chargé
  if (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function') {
    // SDK disponible, créer le client
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  } else {
    // Attendre que le SDK soit chargé (le script est chargé avant le SDK)
    const checkInterval = setInterval(function() {
      if (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function') {
        clearInterval(checkInterval);
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        });
      }
    }, 50);
    
    // Timeout de sécurité après 5 secondes
    setTimeout(function() {
      clearInterval(checkInterval);
      if (typeof window.supabase === 'undefined') {
        console.error('⚠️ Supabase SDK non chargé après 5 secondes');
      }
    }, 5000);
  }
})();
