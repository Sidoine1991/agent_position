
// Script de correction pour l'API des planifications
// Ce script montre comment corriger l'endpoint /api/planifications

// Dans api/index.js, remplacez la requête Supabase par :

const { data: planifications, error } = await supabaseClient
  .from('planifications')
  .select('*')  // Récupérer toutes les colonnes sans embedding
  .order('date', { ascending: false });

if (error) throw error;

// Enrichir avec les données utilisateurs séparément
const userIds = [...new Set(planifications.map(p => p.user_id).filter(Boolean))];
const { data: users } = await supabaseClient
  .from('users')
  .select('id, name, email, role, project_name')
  .in('id', userIds);

// Créer un map pour l'enrichissement
const usersMap = new Map(users.map(u => [u.id, u]));

// Enrichir les planifications
const enrichedPlanifications = planifications.map(plan => ({
  ...plan,
  user: usersMap.get(plan.user_id) || null
}));

// Appliquer les filtres
let filteredPlanifications = enrichedPlanifications;

if (agent_id) {
  filteredPlanifications = filteredPlanifications.filter(p => p.user_id == agent_id);
}

if (project_id) {
  filteredPlanifications = filteredPlanifications.filter(p => p.project_name === project_id);
}

if (from) {
  filteredPlanifications = filteredPlanifications.filter(p => p.date >= from);
}

if (to) {
  filteredPlanifications = filteredPlanifications.filter(p => p.date <= to);
}

return res.json({
  success: true,
  items: filteredPlanifications
});
