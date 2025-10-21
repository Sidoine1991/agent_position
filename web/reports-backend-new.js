// Script pour la page de rapports - Version Backend uniquement
// Utilise /api/reports au lieu de Supabase directement

let jwt = localStorage.getItem('jwt') || '';
let currentUser = null;
let presenceLineChart = null;
let rolePieChart = null;

// ... (le reste du contenu existant du fichier) ...

/**
 * Charge les utilisateurs et leurs planifications pour la date sélectionnée
 */
async function loadUsersPlanning() {
  try {
    const date = $('date').value || new Date().toISOString().split('T')[0];
    const headers = await authHeaders();
    
    // Afficher l'indicateur de chargement
    const tbody = document.getElementById('users-planning-body');
    if (!tbody) return; // Si le tableau n'existe pas, on sort
    
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Chargement des données...</td></tr>';
    
    // Récupérer tous les utilisateurs
    const usersRes = await fetch(`${apiBase}/users`, { headers });
    if (!usersRes.ok) {
      throw new Error('Erreur lors du chargement des utilisateurs');
    }
    
    const users = await usersRes.json();
    
    // Récupérer les planifications pour la date sélectionnée
    const planningRes = await fetch(`${apiBase}/planifications?date=${date}`, { headers });
    const planningData = planningRes.ok ? await planningRes.json() : { items: [] };
    
    // Créer un Set des IDs des utilisateurs ayant une planification
    const usersWithPlanning = new Set(planningData.items.map(p => p.user_id));
    
    // Compter les utilisateurs avec/sans planification
    let withPlanning = 0;
    let withoutPlanning = 0;
    
    // Générer les lignes du tableau
    const rows = users.map((user, index) => {
      const hasPlanning = usersWithPlanning.has(user.id);
      if (hasPlanning) withPlanning++;
      else withoutPlanning++;
      
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${user.name || user.full_name || 'Non renseigné'}</td>
          <td>${user.email || '-'}</td>
          <td>${user.role || 'agent'}</td>
          <td class="text-center">
            ${hasPlanning 
              ? '<span class="badge bg-success">Oui</span>' 
              : '<span class="badge bg-danger">Non</span>'}
          </td>
          <td>
            ${hasPlanning 
              ? `<a href="#" class="btn btn-sm btn-outline-primary" onclick="viewPlanningDetails('${user.id}', '${date}')">Voir détails</a>`
              : '<span class="text-muted">Aucune planification</span>'}
          </td>
        </tr>
      `;
    });
    
    // Mettre à jour le tableau
    tbody.innerHTML = rows.join('') || '<tr><td colspan="6" class="text-center">Aucun utilisateur trouvé</td></tr>';
    
    // Mettre à jour le compteur
    const countElement = document.getElementById('planning-count');
    if (countElement) {
      countElement.innerHTML = `
        <span class="text-success">${withPlanning} avec</span> / 
        <span class="text-danger">${withoutPlanning} sans</span>
      `;
    }
    
  } catch (error) {
    console.error('Erreur lors du chargement des planifications:', error);
    const tbody = document.getElementById('users-planning-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-danger">
            Erreur lors du chargement des données: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Affiche les détails de la planification d'un utilisateur
 */
function viewPlanningDetails(userId, date) {
  // Implémentez cette fonction pour afficher une modale avec les détails de la planification
  alert(`Détails de la planification pour l'utilisateur ${userId} à la date ${date}`);
  // Vous pouvez implémenter une modale ou une autre vue détaillée ici
}

// Mettre à jour les planifications quand la date change
const dateInput = document.getElementById('date');
if (dateInput) {
  dateInput.addEventListener('change', loadUsersPlanning);
}

// Charger les planifications au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  loadUsersPlanning();
});
