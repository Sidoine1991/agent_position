// Gestion des demandes de permission
let currentUser = null;
let userRole = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserInfo();
  await loadPermissions();
  setupFormHandlers();
  setupFilterHandlers();
});

// Configuration des gestionnaires de filtres
function setupFilterHandlers() {
  // Filtres pour superviseurs
  const filterProject = document.getElementById('filter-project');
  const filterAgent = document.getElementById('filter-agent');
  const filterSupervisor = document.getElementById('filter-supervisor');
  const filterStatus = document.getElementById('filter-status');
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');

  if (filterProject) filterProject.addEventListener('change', applyFilters);
  if (filterAgent) filterAgent.addEventListener('change', applyFilters);
  if (filterSupervisor) filterSupervisor.addEventListener('change', applyFilters);
  if (filterStatus) filterStatus.addEventListener('change', applyFilters);
  if (filterStartDate) filterStartDate.addEventListener('change', applyFilters);
  if (filterEndDate) filterEndDate.addEventListener('change', applyFilters);

  // Filtres pour agents
  const filterMyStatus = document.getElementById('filter-my-status');
  const filterMyStartDate = document.getElementById('filter-my-start-date');
  const filterMyEndDate = document.getElementById('filter-my-end-date');

  if (filterMyStatus) filterMyStatus.addEventListener('change', applyMyFilters);
  if (filterMyStartDate) filterMyStartDate.addEventListener('change', applyMyFilters);
  if (filterMyEndDate) filterMyEndDate.addEventListener('change', applyMyFilters);
}

// Charger les informations de l'utilisateur
async function loadUserInfo() {
  try {
    const token = localStorage.getItem('jwt');
    if (!token) {
      window.location.href = '/index.html';
      return;
    }

    // Décoder le token pour obtenir le rôle
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userRole = payload.role?.toUpperCase();
      currentUser = { id: payload.id || payload.userId };
    } catch (e) {
      console.error('Erreur lors du décodage du token:', e);
    }

    // Afficher/masquer les sections selon le rôle
    const createSection = document.getElementById('create-permission-section');
    const supervisorSection = document.getElementById('supervisor-section');
    const myPermissionsSection = document.getElementById('my-permissions-section');
    const agentsPermissionsSection = document.getElementById('agents-permissions-section');
    const agentFiltersSection = document.getElementById('agent-filters-section');
    const newPermissionBtn = document.getElementById('new-permission-btn');

    const isSupervisor =
      userRole === 'SUPERVISEUR' || userRole === 'ADMIN' || userRole === 'SUPERADMIN';

    // Tous les rôles connectés peuvent créer et suivre leurs propres demandes
    if (createSection) {
      createSection.style.display = 'block';
      createSection.style.visibility = 'visible';
      createSection.style.opacity = '1';
    }
    if (myPermissionsSection) myPermissionsSection.style.display = 'block';
    if (newPermissionBtn) newPermissionBtn.style.display = 'block';

    // Filtres spécifiques "mes demandes" uniquement utiles pour les agents
    if (agentFiltersSection) {
      agentFiltersSection.style.display = userRole === 'AGENT' ? 'block' : 'none';
    }

    // Remplir le sélecteur d'agent :
    // - pour un AGENT: son propre profil (/api/me)
    // - pour un SUPERVISEUR/ADMIN: la liste de tous les agents sera chargée via loadAgents()
    const agentSelect = document.getElementById('agent-select');
    if (!isSupervisor) {
      try {
        const token = localStorage.getItem('jwt');
        if (agentSelect && token) {
          const meRes = await fetch('/api/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            const u = meData.user || {};
            const displayName =
              u.name ||
              `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
              u.email ||
              `Agent ${u.id || ''}`;

            agentSelect.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = String(u.id || '');
            opt.textContent = displayName;
            agentSelect.appendChild(opt);
            agentSelect.value = String(u.id || '');
            agentSelect.disabled = false;
          } else if (agentSelect) {
            agentSelect.innerHTML = '<option>Profil non disponible</option>';
          }
        }
      } catch (e) {
        console.error('Erreur lors du chargement du profil pour le sélecteur agent:', e);
      }
    }

    // Section de traitement / liste des agents permissionnaires réservée aux superviseurs & admins
    if (isSupervisor) {
      if (supervisorSection) supervisorSection.style.display = 'block';
      if (agentsPermissionsSection) agentsPermissionsSection.style.display = 'block';

      await loadProjects();
      await loadAgents();
      await loadSupervisors();
      await loadPendingPermissions();
      await loadAgentsPermissionsList();
      setupAgentsPermissionsFilters();
    } else {
      if (supervisorSection) supervisorSection.style.display = 'none';
      if (agentsPermissionsSection) agentsPermissionsSection.style.display = 'none';
    }

    // S'assurer que les boutons du formulaire sont visibles
    if (createSection) {
      setTimeout(() => {
        const buttons = createSection.querySelectorAll('button');
        buttons.forEach(btn => {
          btn.style.display = '';
          btn.style.visibility = 'visible';
          btn.style.opacity = '1';
        });
      }, 100);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des informations utilisateur:', error);
    showMessage('Erreur lors du chargement des informations', 'error');
  }
}

// Configuration des gestionnaires de formulaire
function setupFormHandlers() {
  const form = document.getElementById('permission-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Validation Bootstrap
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }

      const permissionId = document.getElementById('permission-id').value;
      if (permissionId) {
        await updatePermission(permissionId, 'pending');
      } else {
        await createPermission('pending');
      }
    });
  }

  // Validation et calcul de durée des dates
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');

  if (startDateInput && endDateInput) {
    const updateDuration = () => {
      if (startDateInput.value && endDateInput.value) {
        const duration = calculateDuration(startDateInput.value, endDateInput.value);
        const durationInfo = document.getElementById('duration-info');
        const durationDays = document.getElementById('duration-days');
        if (durationInfo && durationDays) {
          durationDays.textContent = duration;
          durationInfo.style.display = 'block';
        }
      } else {
        const durationInfo = document.getElementById('duration-info');
        if (durationInfo) {
          durationInfo.style.display = 'none';
        }
      }
    };

    startDateInput.addEventListener('change', () => {
      if (startDateInput.value) {
        endDateInput.min = startDateInput.value;
        if (endDateInput.value && endDateInput.value < startDateInput.value) {
          endDateInput.value = startDateInput.value;
        }
        updateDuration();
      }
    });

    endDateInput.addEventListener('change', () => {
      if (endDateInput.value && startDateInput.value && endDateInput.value < startDateInput.value) {
        alert('La date de fin doit être supérieure ou égale à la date de début');
        endDateInput.value = startDateInput.value;
      }
      updateDuration();
    });
  }
}

// Créer une nouvelle demande de permission
async function createPermission(status = 'pending') {
  try {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const reason = document.getElementById('reason')?.value?.trim() || '';
    const agentSelect = document.getElementById('agent-select');
    const selectedAgentId = agentSelect ? agentSelect.value : null;
    const fileInput = document.getElementById('justification-file');
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

    if (!startDate || !endDate || !reason) {
      showMessage('Veuillez remplir la date de début, la date de fin et la raison de la demande.', 'error');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      showMessage('La date de fin doit être supérieure ou égale à la date de début', 'error');
      return;
    }

    const token = localStorage.getItem('jwt');

    const formData = new FormData();
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);
    formData.append('status', status);
    formData.append('reason', reason);
    // Pour les superviseurs/admins, permettre de créer une demande pour un agent sélectionné
    if (selectedAgentId && (userRole === 'SUPERVISEUR' || userRole === 'ADMIN' || userRole === 'SUPERADMIN')) {
      formData.append('agent_id', selectedAgentId);
    }
    if (file) {
      formData.append('justification', file);
    }

    const response = await fetch('/api/permissions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const message = status === 'draft'
        ? 'Demande sauvegardée en brouillon'
        : 'Demande de permission soumise avec succès';
      showMessage(message, 'success');
      const form = document.getElementById('permission-form');
      form.classList.remove('was-validated');
      cancelEdit();
      if (userRole === 'AGENT') {
        await loadPermissions();
      }
      if (userRole === 'SUPERVISEUR' || userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
        await loadPendingPermissions();
      }
    } else {
      showMessage(data.error || 'Erreur lors de la création de la demande', 'error');
    }
  } catch (error) {
    console.error('Erreur lors de la création de la demande:', error);
    showMessage('Erreur lors de la création de la demande', 'error');
  }
}

// Sauvegarder en brouillon
window.savePermissionAsDraft = async function savePermissionAsDraft() {
  const permissionId = document.getElementById('permission-id').value;
  if (permissionId) {
    await updatePermission(permissionId, 'draft');
  } else {
    await createPermission('draft');
  }
}

// Afficher le formulaire de nouvelle demande
window.showNewPermissionForm = function showNewPermissionForm() {
  const createSection = document.getElementById('create-permission-section');
  if (createSection) {
    const form = document.getElementById('permission-form');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('permission-id').value = '';
    document.getElementById('form-title').innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Nouvelle demande de permission';
    document.getElementById('duration-info').style.display = 'none';
    createSection.style.display = 'block';
    createSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Focus sur le premier champ
    setTimeout(() => {
      const startDateInput = document.getElementById('start-date');
      if (startDateInput) startDateInput.focus();
    }, 300);
  }
}

// Annuler l'édition
window.cancelEdit = function cancelEdit() {
  const form = document.getElementById('permission-form');
  form.reset();
  form.classList.remove('was-validated');
  document.getElementById('permission-id').value = '';
  document.getElementById('form-title').innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Nouvelle demande de permission';
  document.getElementById('duration-info').style.display = 'none';
  const createSection = document.getElementById('create-permission-section');
  if (createSection) {
    createSection.style.display = 'none';
  }
}

// Modifier une permission
window.editPermission = function editPermission(permissionId) {
  // Trouver la permission dans la liste
  const permission = allMyPermissions.find(p => p.id == permissionId);
  if (!permission) {
    showMessage('Permission non trouvée', 'error');
    return;
  }

  // Remplir le formulaire
  const form = document.getElementById('permission-form');
  form.classList.remove('was-validated');
  document.getElementById('permission-id').value = permissionId;
  document.getElementById('start-date').value = permission.start_date;
  document.getElementById('end-date').value = permission.end_date;
  document.getElementById('form-title').innerHTML = '<i class="bi bi-pencil me-2"></i>Modifier la demande de permission';

  // Calculer et afficher la durée
  const duration = calculateDuration(permission.start_date, permission.end_date);
  const durationInfo = document.getElementById('duration-info');
  const durationDays = document.getElementById('duration-days');
  if (durationInfo && durationDays) {
    durationDays.textContent = duration;
    durationInfo.style.display = 'block';
  }

  // Afficher la section et scroller vers elle
  const createSection = document.getElementById('create-permission-section');
  if (createSection) {
    createSection.style.display = 'block';
    createSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Focus sur le premier champ
    setTimeout(() => {
      const startDateInput = document.getElementById('start-date');
      if (startDateInput) startDateInput.focus();
    }, 300);
  }
}

// Mettre à jour une permission
async function updatePermission(permissionId, status = null) {
  try {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
      showMessage('Veuillez remplir tous les champs', 'error');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      showMessage('La date de fin doit être supérieure ou égale à la date de début', 'error');
      return;
    }

    const token = localStorage.getItem('jwt');
    const body = {
      start_date: startDate,
      end_date: endDate
    };

    if (status) {
      body.status = status;
    }

    const response = await fetch(`/api/permissions/${permissionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const message = status === 'draft'
        ? 'Demande sauvegardée en brouillon'
        : status === 'pending'
          ? 'Demande modifiée et soumise avec succès'
          : 'Demande modifiée avec succès';
      showMessage(message, 'success');
      const form = document.getElementById('permission-form');
      form.classList.remove('was-validated');
      cancelEdit();
      if (userRole === 'AGENT') {
        await loadPermissions();
      }
      if (userRole === 'SUPERVISEUR' || userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
        await loadPendingPermissions();
      }
    } else {
      showMessage(data.error || 'Erreur lors de la modification de la demande', 'error');
    }
  } catch (error) {
    console.error('Erreur lors de la modification de la demande:', error);
    showMessage('Erreur lors de la modification de la demande', 'error');
  }
}

// Supprimer une permission
window.deletePermission = async function deletePermission(permissionId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette demande de permission ? Cette action est irréversible.')) {
    return;
  }

  try {
    const token = localStorage.getItem('jwt');
    const response = await fetch(`/api/permissions/${permissionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage('Demande supprimée avec succès', 'success');
      if (userRole === 'AGENT') {
        await loadPermissions();
      }
      if (userRole === 'SUPERVISEUR' || userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
        await loadPendingPermissions();
      }
    } else {
      showMessage(data.error || 'Erreur lors de la suppression', 'error');
    }
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    showMessage('Erreur lors de la suppression', 'error');
  }
}

// Charger les demandes de l'utilisateur
// Fonction supprimée - doublon avec celle ci-dessous

// Charger les projets depuis la table users
async function loadProjects() {
  try {
    const token = localStorage.getItem('jwt');
    if (!token) {
      console.warn('⚠️ Aucun token JWT trouvé');
      return;
    }

    const response = await fetch('/api/users?role=agent', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur inconnue');
      console.error('Erreur lors du chargement des projets:', response.status, errorText);
      return;
    }

    const data = await response.json();
    const projectSelect = document.getElementById('filter-project');

    // L'API peut retourner un tableau directement ou un objet avec items/users
    let users = [];
    if (Array.isArray(data)) {
      users = data;
    } else if (data.items && Array.isArray(data.items)) {
      users = data.items;
    } else if (data.users && Array.isArray(data.users)) {
      users = data.users;
    }

    if (response.ok && users.length > 0) {
      // Extraire les projets uniques depuis les utilisateurs
      const projectsSet = new Set();
      users.forEach(user => {
        if (user.project_name && user.project_name.trim()) {
          projectsSet.add(user.project_name.trim());
        }
      });

      // Vider et ajouter l'option "Tous"
      if (projectSelect) {
        projectSelect.innerHTML = '<option value="all">Tous les projets</option>';

        // Trier et ajouter les projets
        const sortedProjects = Array.from(projectsSet).sort();
        sortedProjects.forEach(projectName => {
          const option = document.createElement('option');
          option.value = projectName;
          option.textContent = projectName;
          projectSelect.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des projets:', error);
    // Vérifier si c'est une erreur réseau
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('ERR_FAILED'))) {
      console.error('❌ Le serveur ne semble pas être accessible. Vérifiez que le serveur est en cours d\'exécution.');
    }
  }
}

// Charger les agents
async function loadAgents() {
  try {
    const token = localStorage.getItem('jwt');
    if (!token) {
      console.warn('⚠️ Aucun token JWT trouvé');
      return;
    }

    const response = await fetch('/api/users?role=agent,superviseur', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur inconnue');
      console.error('Erreur lors du chargement des agents:', response.status, errorText);
      return;
    }

    const data = await response.json();
    const agentSelect = document.getElementById('filter-agent');
    const formAgentSelect = document.getElementById('agent-select');

    // L'API peut retourner un tableau directement ou un objet avec items/users
    let users = [];
    if (Array.isArray(data)) {
      users = data;
    } else if (data.items && Array.isArray(data.items)) {
      users = data.items;
    } else if (data.users && Array.isArray(data.users)) {
      users = data.users;
    }

    if (response.ok && users.length > 0) {
      // Trier par nom
      const sortedAgents = users.sort((a, b) => {
        const nameA = (a.name || a.email || '').toLowerCase();
        const nameB = (b.name || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Remplir le filtre agent (superviseur)
      if (agentSelect) {
        agentSelect.innerHTML = '<option value="all">Tous les agents et superviseurs</option>';
        sortedAgents.forEach(agent => {
          const option = document.createElement('option');
          option.value = agent.id;
          const displayName = agent.name ||
            `${agent.first_name || ''} ${agent.last_name || ''}`.trim() ||
            agent.email || `Agent ${agent.id}`;
          const roleLabel = agent.role === 'superviseur' ? ' (Superviseur)' : '';
          option.textContent = displayName + roleLabel;
          agentSelect.appendChild(option);
        });
      }

      // Remplir le sélecteur du formulaire pour les rôles superviseur/admin
      if (formAgentSelect && (userRole === 'SUPERVISEUR' || userRole === 'ADMIN' || userRole === 'SUPERADMIN')) {
        formAgentSelect.innerHTML = '';
        sortedAgents.forEach(agent => {
          const opt = document.createElement('option');
          opt.value = String(agent.id);
          const displayName = agent.name ||
            `${agent.first_name || ''} ${agent.last_name || ''}`.trim() ||
            agent.email || `Agent ${agent.id}`;
          const roleLabel = agent.role === 'superviseur' ? ' (Superviseur)' : '';
          opt.textContent = displayName + roleLabel;
          formAgentSelect.appendChild(opt);
        });
        formAgentSelect.disabled = false;
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des agents:', error);
    // Vérifier si c'est une erreur réseau
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('ERR_FAILED'))) {
      console.error('❌ Le serveur ne semble pas être accessible. Vérifiez que le serveur est en cours d\'exécution.');
    }
  }
}

// Charger les superviseurs
async function loadSupervisors() {
  try {
    const token = localStorage.getItem('jwt');
    const response = await fetch('/api/users?role=superviseur', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur inconnue');
      console.error('Erreur lors du chargement des superviseurs:', response.status, errorText);
      return;
    }

    const data = await response.json();
    const supervisorSelect = document.getElementById('filter-supervisor');

    // L'API peut retourner un tableau directement ou un objet avec items/users
    let users = [];
    if (Array.isArray(data)) {
      users = data;
    } else if (data.items && Array.isArray(data.items)) {
      users = data.items;
    } else if (data.users && Array.isArray(data.users)) {
      users = data.users;
    }

    if (response.ok && users.length > 0) {
      if (supervisorSelect) {
        supervisorSelect.innerHTML = '<option value="all">Tous les superviseurs</option>';

        // Trier par nom
        const sortedSupervisors = users.sort((a, b) => {
          const nameA = (a.name || a.email || '').toLowerCase();
          const nameB = (b.name || b.email || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        sortedSupervisors.forEach(supervisor => {
          const option = document.createElement('option');
          option.value = supervisor.id;
          const displayName = supervisor.name ||
            `${supervisor.first_name || ''} ${supervisor.last_name || ''}`.trim() ||
            supervisor.email || `Superviseur ${supervisor.id}`;
          option.textContent = displayName;
          supervisorSelect.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des superviseurs:', error);
    // Vérifier si c'est une erreur réseau
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('ERR_FAILED'))) {
      console.error('❌ Le serveur ne semble pas être accessible. Vérifiez que le serveur est en cours d\'exécution.');
    }
  }
}

// Charger les demandes en attente (pour superviseurs)
let allPendingPermissions = [];

async function loadPendingPermissions() {
  try {
    const token = localStorage.getItem('jwt');
    console.log('🔍 Chargement des permissions en attente...');

    // Pour les superviseurs, charger toutes les permissions (pas seulement pending)
    // Le filtre par statut sera appliqué côté client
    const response = await fetch('/api/permissions', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    const tbody = document.querySelector('#pending-permissions-list');

    console.log('📊 Réponse API:', {
      ok: response.ok,
      success: data.success,
      count: data.permissions?.length || 0,
      permissions: data.permissions
    });

    if (response.ok && data.success) {
      allPendingPermissions = data.permissions || [];
      console.log(`✅ ${allPendingPermissions.length} permission(s) chargée(s)`);
      console.log('📋 Exemple de permission:', allPendingPermissions[0]);

      if (allPendingPermissions.length === 0) {
        console.warn('⚠️ Aucune permission trouvée. Vérifiez:');
        console.warn('   1. Les permissions existent-elles dans la base de données?');
        console.warn('   2. Les agents ont-ils un supervisor_id assigné?');
        console.warn('   3. Êtes-vous connecté en tant que superviseur?');
        console.warn('   4. Le filtre de statut est-il correct?');
      }

      // Vérifier que les données ont la bonne structure
      if (allPendingPermissions.length > 0) {
        const firstPerm = allPendingPermissions[0];
        console.log('🔍 Structure de la première permission:', {
          id: firstPerm.id,
          agent_id: firstPerm.agent_id,
          agent: firstPerm.agent,
          status: firstPerm.status,
          start_date: firstPerm.start_date,
          end_date: firstPerm.end_date
        });
      }

      updateSupervisorStats();
      applyFilters();
    } else {
      console.error('❌ Erreur API:', data.error);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger">
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Erreur: ${data.error || 'Erreur inconnue'}
              <br><small>Vérifiez la console pour plus de détails</small>
            </div>
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des demandes en attente:', error);
    const tbody = document.querySelector('#pending-permissions-list');

    // Vérifier si c'est une erreur réseau
    let errorMessage = error.message || 'Erreur inconnue';
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('ERR_FAILED'))) {
      errorMessage = 'Le serveur ne semble pas être accessible. Vérifiez que le serveur est en cours d\'exécution sur le port 3010.';
      console.error('❌ Le serveur ne semble pas être accessible. Vérifiez que le serveur est en cours d\'exécution.');
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger">
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Erreur lors du chargement des demandes
              <br><small>${errorMessage}</small>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// Mettre à jour les statistiques pour les superviseurs
function updateSupervisorStats() {
  const stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    draft: 0
  };

  allPendingPermissions.forEach(perm => {
    const status = perm.status || 'pending';
    if (stats.hasOwnProperty(status)) {
      stats[status]++;
    }
  });

  // Mettre à jour les éléments
  const statPending = document.getElementById('stat-pending');
  const statApproved = document.getElementById('stat-approved');
  const statRejected = document.getElementById('stat-rejected');
  const statDraft = document.getElementById('stat-draft');
  const pendingCount = document.getElementById('pending-count');

  if (statPending) statPending.textContent = stats.pending;
  if (statApproved) statApproved.textContent = stats.approved;
  if (statRejected) statRejected.textContent = stats.rejected;
  if (statDraft) statDraft.textContent = stats.draft;
  if (pendingCount) pendingCount.textContent = stats.pending;
}

// Appliquer les filtres pour les superviseurs
window.applyFilters = function applyFilters() {
  const projectFilter = document.getElementById('filter-project')?.value || 'all';
  const agentFilter = document.getElementById('filter-agent')?.value || 'all';
  const supervisorFilter = document.getElementById('filter-supervisor')?.value || 'all';
  const statusFilter = document.getElementById('filter-status')?.value || 'all';
  const startDateFilter = document.getElementById('filter-start-date')?.value || '';
  const endDateFilter = document.getElementById('filter-end-date')?.value || '';

  let filtered = [...allPendingPermissions];

  // Filtrer par projet
  if (projectFilter !== 'all') {
    filtered = filtered.filter(perm => {
      const agentProject = perm.agent?.project_name || perm.agent?.project || '';
      return agentProject.toLowerCase() === projectFilter.toLowerCase();
    });
  }

  // Filtrer par agent
  if (agentFilter !== 'all') {
    const agentId = parseInt(agentFilter, 10);
    filtered = filtered.filter(perm => {
      const permAgentId = perm.agent_id || perm.agent?.id;
      return permAgentId === agentId;
    });
  }

  // Filtrer par superviseur
  if (supervisorFilter !== 'all') {
    const supervisorId = parseInt(supervisorFilter, 10);
    filtered = filtered.filter(perm => {
      // Vérifier si le superviseur est assigné à l'agent de cette permission
      const agentSupervisorId = perm.agent?.supervisor_id;
      return agentSupervisorId === supervisorId;
    });
  }

  // Filtrer par statut
  if (statusFilter !== 'all') {
    filtered = filtered.filter(perm => perm.status === statusFilter);
  }

  // Filtrer par date de début
  if (startDateFilter) {
    filtered = filtered.filter(perm => perm.start_date >= startDateFilter);
  }

  // Filtrer par date de fin
  if (endDateFilter) {
    filtered = filtered.filter(perm => perm.end_date <= endDateFilter);
  }

  const tbody = document.querySelector('#pending-permissions-list');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5">
          <div class="empty-state">
            <i class="bi bi-inbox fs-1 text-muted mb-3" style="opacity: 0.5;"></i>
            <h5 class="text-muted">Aucune demande trouvée</h5>
            <p class="text-muted">Aucune demande ne correspond aux filtres sélectionnés.</p>
            <button class="btn btn-outline-primary btn-sm mt-2" onclick="resetFilters()">
              <i class="bi bi-arrow-counterclockwise me-1"></i>Réinitialiser les filtres
            </button>
          </div>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtered.map(permission => renderPermissionRow(permission, true)).join('');
  }
}

// Réinitialiser les filtres (fonction gardée pour compatibilité, mais plus de bouton)
window.resetFilters = function resetFilters() {
  const projectFilter = document.getElementById('filter-project');
  const agentFilter = document.getElementById('filter-agent');
  const supervisorFilter = document.getElementById('filter-supervisor');
  const statusFilter = document.getElementById('filter-status');
  const startDateFilter = document.getElementById('filter-start-date');
  const endDateFilter = document.getElementById('filter-end-date');

  if (projectFilter) projectFilter.value = 'all';
  if (agentFilter) agentFilter.value = 'all';
  if (supervisorFilter) supervisorFilter.value = 'all';
  if (statusFilter) statusFilter.value = 'pending';
  if (startDateFilter) startDateFilter.value = '';
  if (endDateFilter) endDateFilter.value = '';
  applyFilters();
}

// Appliquer les filtres pour les agents
let allMyPermissions = [];

async function loadPermissions() {
  try {
    const token = localStorage.getItem('jwt');
    const response = await fetch('/api/permissions', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur réponse API permissions:', response.status, errorText);
      throw new Error(`Erreur ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    const tbody = document.querySelector('#my-permissions-list');

    if (data.success) {
      allMyPermissions = data.permissions || [];
      console.log(`✅ ${allMyPermissions.length} permission(s) chargée(s) pour l'agent`);
      if (allMyPermissions.length > 0) {
        console.log('📋 Exemple de permission agent:', allMyPermissions[0]);
      }
      applyMyFilters();
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-danger">
            Erreur lors du chargement des demandes: ${data.error || 'Erreur inconnue'}
          </td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des demandes:', error);
    const tbody = document.querySelector('#my-permissions-list');

    // Vérifier si c'est une erreur réseau
    let errorMessage = error.message || 'Erreur inconnue';
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('ERR_FAILED'))) {
      errorMessage = 'Le serveur ne semble pas être accessible. Vérifiez que le serveur est en cours d\'exécution sur le port 3010.';
      console.error('❌ Le serveur ne semble pas être accessible. Vérifiez que le serveur est en cours d\'exécution.');
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-danger">
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Erreur lors du chargement des demandes
              <br><small>${errorMessage}</small>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// Appliquer les filtres pour les agents
window.applyMyFilters = function applyMyFilters() {
  const statusFilter = document.getElementById('filter-my-status')?.value || 'all';
  const startDateFilter = document.getElementById('filter-my-start-date')?.value || '';
  const endDateFilter = document.getElementById('filter-my-end-date')?.value || '';

  let filtered = [...allMyPermissions];

  // Filtrer par statut
  if (statusFilter !== 'all') {
    filtered = filtered.filter(perm => perm.status === statusFilter);
  }

  // Filtrer par date de début
  if (startDateFilter) {
    filtered = filtered.filter(perm => perm.start_date >= startDateFilter);
  }

  // Filtrer par date de fin
  if (endDateFilter) {
    filtered = filtered.filter(perm => perm.end_date <= endDateFilter);
  }

  const tbody = document.querySelector('#my-permissions-list');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <h4>Aucune demande trouvée</h4>
            <p>Aucune demande ne correspond aux filtres sélectionnés.</p>
          </div>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtered.map(permission => renderPermissionRow(permission, false)).join('');
  }
}

// Réinitialiser les filtres pour les agents (fonction gardée pour compatibilité, mais plus de bouton)
function resetMyFilters() {
  const statusFilter = document.getElementById('filter-my-status');
  const startDateFilter = document.getElementById('filter-my-start-date');
  const endDateFilter = document.getElementById('filter-my-end-date');

  if (statusFilter) statusFilter.value = 'all';
  if (startDateFilter) startDateFilter.value = '';
  if (endDateFilter) endDateFilter.value = '';
  applyMyFilters();
}

// Calculer la durée en jours
function calculateDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour de fin
  return diffDays;
}

// Rendre une ligne de tableau pour une permission
function renderPermissionRow(permission, isSupervisorView = false) {
  const startDate = new Date(permission.start_date).toLocaleDateString('fr-FR');
  const endDate = new Date(permission.end_date).toLocaleDateString('fr-FR');
  const requestDate = new Date(permission.created_at).toLocaleDateString('fr-FR');
  const duration = calculateDuration(permission.start_date, permission.end_date);
  const status = permission.status || 'pending';
  const statusLabels = {
    'draft': 'Brouillon',
    'pending': 'En attente',
    'approved': 'Approuvée',
    'rejected': 'Rejetée'
  };

  let agentCell = '';
  let projectCell = '';
  if (isSupervisorView && permission.agent) {
    const agentName = permission.agent.name ||
      `${permission.agent.first_name || ''} ${permission.agent.last_name || ''}`.trim() ||
      permission.agent.email || 'Agent';
    agentCell = `
      <td>
        <div class="d-flex align-items-center">
          <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 35px; height: 35px; font-weight: bold;">
            ${agentName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="fw-bold">${escapeHtml(agentName)}</div>
            <small class="text-muted">${escapeHtml(permission.agent.email || '')}</small>
          </div>
        </div>
      </td>
    `;

    // Récupérer le projet de l'agent depuis les données de l'agent
    const agentProject = permission.agent.project_name || permission.agent.project || '-';
    projectCell = `
      <td>
        <span class="badge bg-info text-dark">
          <i class="bi bi-folder me-1"></i>${escapeHtml(agentProject)}
        </span>
      </td>
    `;
  }

  let statusCell = '';
  if (!isSupervisorView) {
    statusCell = `
      <td>
        <span class="status-badge ${status}">${statusLabels[status]}</span>
      </td>
    `;
  }

  let rejectionCell = '';
  if (status === 'rejected' && permission.rejection_reason) {
    rejectionCell = `<td><small class="text-danger fw-bold">${escapeHtml(permission.rejection_reason)}</small></td>`;
  } else if (isSupervisorView && status === 'pending') {
    // Charger le motif sauvegardé s'il existe
    const savedReason = localStorage.getItem(`rejection_reason_${permission.id}`) || '';
    rejectionCell = `
      <td>
        <textarea 
          class="form-control form-control-sm rejection-reason-input" 
          id="rejection-reason-${permission.id}" 
          rows="2" 
          placeholder="Motif du rejet (obligatoire pour rejeter)"
          style="min-width: 200px; font-size: 0.875rem;">${escapeHtml(savedReason)}</textarea>
      </td>
    `;
  } else if (isSupervisorView && status !== 'pending' && status !== 'rejected') {
    rejectionCell = `<td class="text-muted">-</td>`;
  } else {
    rejectionCell = `<td class="text-muted">-</td>`;
  }

  let actionCell = '';
  if (isSupervisorView && status === 'pending') {
    actionCell = `
      <td class="table-actions">
        <div class="d-flex gap-2 flex-wrap align-items-center">
          <button class="btn btn-success btn-sm" onclick="approvePermission('${permission.id}')" title="Approuver cette demande de permission">
            <i class="bi bi-check-circle me-1"></i>Approuver
          </button>
          <button class="btn btn-warning btn-sm" onclick="saveRejection('${permission.id}')" title="Sauvegarder temporairement le motif de rejet">
            <i class="bi bi-save me-1"></i>Sauvegarder
          </button>
          <button class="btn btn-danger btn-sm" onclick="rejectPermission('${permission.id}')" title="Rejeter cette demande (motif obligatoire)">
            <i class="bi bi-x-circle me-1"></i>Rejeter
          </button>
        </div>
      </td>
    `;
  } else if (isSupervisorView && status !== 'pending') {
    // Pour les superviseurs, pas d'action si ce n'est pas en attente
    actionCell = `<td class="text-muted">-</td>`;
  } else if (!isSupervisorView) {
    // Actions pour l'agent : éditer, modifier, supprimer (seulement si draft ou pending)
    if (status === 'draft' || status === 'pending') {
      actionCell = `
        <td class="table-actions">
          <div class="d-flex gap-1 flex-wrap align-items-center">
            <button class="btn btn-primary btn-sm" onclick="editPermission('${permission.id}')" title="Modifier cette demande">
              <i class="bi bi-pencil me-1"></i>Modifier
            </button>
            <button class="btn btn-danger btn-sm" onclick="deletePermission('${permission.id}')" title="Supprimer cette demande">
              <i class="bi bi-trash me-1"></i>Supprimer
            </button>
          </div>
        </td>
      `;
    } else {
      actionCell = `<td class="text-muted">-</td>`;
    }
  }

  if (isSupervisorView) {
    return `
      <tr class="permission-row-${permission.id}" data-project="${escapeHtml(permission.agent?.project_name || '')}" data-status="${status}">
        ${agentCell}
        ${projectCell}
        <td>
          <div class="fw-bold">${startDate}</div>
          <small class="text-muted">${new Date(permission.start_date).toLocaleDateString('fr-FR', { weekday: 'short' })}</small>
        </td>
        <td>
          <div class="fw-bold">${endDate}</div>
          <small class="text-muted">${new Date(permission.end_date).toLocaleDateString('fr-FR', { weekday: 'short' })}</small>
        </td>
        <td>
          <span class="badge bg-primary fs-6">${duration} jour(s)</span>
        </td>
        <td>
          <div>${requestDate}</div>
          <small class="text-muted">${new Date(permission.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small>
        </td>
        ${rejectionCell}
        ${actionCell}
      </tr>
    `;
  } else {
    return `
      <tr class="permission-row-${permission.id}" data-status="${status}">
        <td><strong>${startDate}</strong></td>
        <td><strong>${endDate}</strong></td>
        <td><span class="badge bg-info">${duration} jour(s)</span></td>
        ${statusCell}
        <td>${requestDate}</td>
        ${rejectionCell}
        ${actionCell}
      </tr>
    `;
  }
}

// Approuver une permission
async function approvePermission(permissionId) {
  if (!confirm('Êtes-vous sûr de vouloir approuver cette demande de permission ?')) {
    return;
  }

  try {
    const token = localStorage.getItem('jwt');
    const response = await fetch(`/api/permissions/${permissionId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage('Demande approuvée avec succès', 'success');
      await loadPendingPermissions();
    } else {
      showMessage(data.error || 'Erreur lors de l\'approbation', 'error');
    }
  } catch (error) {
    console.error('Erreur lors de l\'approbation:', error);
    showMessage('Erreur lors de l\'approbation', 'error');
  }
}

// Rejeter une permission
async function rejectPermission(permissionId) {
  const reasonInput = document.getElementById(`rejection-reason-${permissionId}`);
  const reason = reasonInput ? reasonInput.value.trim() : '';

  if (!reason) {
    alert('Veuillez indiquer le motif du rejet dans le champ prévu à cet effet');
    if (reasonInput) {
      reasonInput.focus();
    }
    return;
  }

  if (!confirm('Êtes-vous sûr de vouloir rejeter cette demande de permission ?')) {
    return;
  }

  try {
    const token = localStorage.getItem('jwt');
    const response = await fetch(`/api/permissions/${permissionId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        rejection_reason: reason
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showMessage('Demande rejetée avec succès', 'success');
      // Nettoyer le localStorage après rejet
      localStorage.removeItem(`rejection_reason_${permissionId}`);
      await loadPendingPermissions();
    } else {
      showMessage(data.error || 'Erreur lors du rejet', 'error');
    }
  } catch (error) {
    console.error('Erreur lors du rejet:', error);
    showMessage('Erreur lors du rejet', 'error');
  }
}

// Sauvegarder le motif de rejet (sans rejeter encore)
function saveRejection(permissionId) {
  const reasonInput = document.getElementById(`rejection-reason-${permissionId}`);
  const reason = reasonInput ? reasonInput.value.trim() : '';

  if (!reason) {
    alert('Veuillez indiquer le motif du rejet');
    if (reasonInput) {
      reasonInput.focus();
    }
    return;
  }

  // Sauvegarder le motif dans localStorage pour le garder même après rechargement
  localStorage.setItem(`rejection_reason_${permissionId}`, reason);
  showMessage('Motif de rejet sauvegardé. Vous pouvez le modifier ou cliquer sur "Rejeter" pour confirmer.', 'success');
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Fonction pour afficher les messages
function showMessage(message, type = 'info') {
  // Créer un élément de message
  const messageDiv = document.createElement('div');
  messageDiv.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
  messageDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  messageDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  document.body.appendChild(messageDiv);

  // Supprimer automatiquement après 5 secondes
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}

// Charger la liste des agents permissionnaires
async function loadAgentsPermissionsList() {
  const tbody = document.getElementById('agents-permissions-list');
  if (!tbody) return;

  try {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement...</span>
          </div>
        </td>
      </tr>
    `;

    const monthFilter = document.getElementById('agents-permissions-month-filter');
    const selectedMonth = monthFilter?.value || '';

    const token = localStorage.getItem('jwt');

    // Utiliser l'API /api/permissions pour récupérer toutes les permissions
    const response = await fetch('/api/permissions', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }

    const result = await response.json();
    const allPermissions = Array.isArray(result?.permissions) ? result.permissions : [];

    // Filtrer uniquement les permissions approuvées
    const approvedPermissions = allPermissions.filter(perm => perm.status === 'approved');

    if (approvedPermissions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-info-circle me-2"></i>Aucun agent permissionnaire trouvé
          </td>
        </tr>
      `;
      return;
    }

    // Récupérer les informations des agents
    const agentIds = [...new Set(approvedPermissions.map(p => p.agent_id || p.agent?.id).filter(Boolean))];
    const agentsMap = new Map();

    if (agentIds.length > 0) {
      try {
        const agentsResponse = await fetch('/api/admin/agents', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json();
          const agents = Array.isArray(agentsData) ? agentsData : (agentsData.data || []);
          agents.forEach(agent => {
            agentsMap.set(agent.id, agent);
          });
        }
      } catch (error) {
        console.warn('Erreur lors de la récupération des agents:', error);
      }
    }

    // Fonction pour obtenir le mois au format YYYY-MM à partir d'une date
    function getMonthKey(dateString) {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }

    // Grouper par agent et mois
    const grouped = new Map();
    approvedPermissions.forEach(perm => {
      const agentId = perm.agent_id || perm.agent?.id;
      if (!agentId) return;

      // Calculer la durée en jours
      const startDate = new Date(perm.start_date);
      const endDate = new Date(perm.end_date);
      const days = calculateDuration(perm.start_date, perm.end_date);

      // Obtenir le mois de début
      const monthKey = getMonthKey(perm.start_date);

      // Filtrer par mois si un filtre est sélectionné
      if (selectedMonth && monthKey !== selectedMonth) {
        return;
      }

      const key = `${agentId}_${monthKey}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          agentId,
          month: monthKey,
          days: 0,
          status: 'approved'
        });
      }

      const entry = grouped.get(key);
      entry.days += days;
    });

    // Générer le HTML
    const rows = Array.from(grouped.values())
      .sort((a, b) => {
        const agentA = agentsMap.get(a.agentId);
        const agentB = agentsMap.get(b.agentId);
        const nameA = agentA ? (agentA.name || `${agentA.first_name || ''} ${agentA.last_name || ''}`.trim() || agentA.email) : '';
        const nameB = agentB ? (agentB.name || `${agentB.first_name || ''} ${agentB.last_name || ''}`.trim() || agentB.email) : '';
        return nameA.localeCompare(nameB);
      })
      .map(entry => {
        const agent = agentsMap.get(entry.agentId);
        const agentName = agent
          ? (agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email || 'Agent inconnu')
          : 'Agent inconnu';
        const projectName = agent?.project_name || '-';

        const monthLabel = entry.month
          ? new Date(entry.month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
          : '-';

        const statusBadge = getStatusBadgeForPermission(entry.status);

        return `
          <tr>
            <td><strong>${escapeHtml(agentName)}</strong></td>
            <td>${escapeHtml(projectName)}</td>
            <td>${escapeHtml(monthLabel)}</td>
            <td>
              <span class="badge bg-primary fs-6">${entry.days} jour${entry.days > 1 ? 's' : ''}</span>
            </td>
            <td>${statusBadge}</td>
          </tr>
        `;
      })
      .join('');

    tbody.innerHTML = rows;
  } catch (error) {
    console.error('Erreur lors du chargement des agents permissionnaires:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>Erreur lors du chargement des données
        </td>
      </tr>
    `;
  }
}

// Obtenir le badge de statut pour les permissions
function getStatusBadgeForPermission(status) {
  const statusMap = {
    'approved': { text: 'Accordé', class: 'success' },
    'rejected': { text: 'Rejeté', class: 'danger' },
    'pending': { text: 'En attente', class: 'warning' },
    'draft': { text: 'Brouillon', class: 'secondary' }
  };
  const statusInfo = statusMap[status] || { text: 'Inconnu', class: 'secondary' };
  return `<span class="badge bg-${statusInfo.class}">${statusInfo.text}</span>`;
}

// Configurer les filtres pour la liste des agents permissionnaires
function setupAgentsPermissionsFilters() {
  const monthFilter = document.getElementById('agents-permissions-month-filter');
  if (!monthFilter) return;

  // Générer les options de mois (12 derniers mois)
  const now = new Date();
  const options = ['<option value="">Tous les mois</option>'];

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    options.push(`<option value="${monthValue}">${monthLabel}</option>`);
  }

  monthFilter.innerHTML = options.join('');

  monthFilter.addEventListener('change', () => {
    loadAgentsPermissionsList();
  });
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

