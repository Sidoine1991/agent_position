// Variables globales
const apiBase = '/api';
let allAgents = [];
let filteredAgents = [];
let currentPage = 1;
const agentsPerPage = 10;
let agentToDelete = null;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initialisation de la page de gestion des agents');
    
    // Vérifier l'authentification
    const token = localStorage.getItem('jwt') || localStorage.getItem('token');
    if (!token) {
        alert('❌ Accès non autorisé. Veuillez vous connecter.');
        window.location.href = '/index.html';
        return;
    }

    // Vérifier le rôle admin
    try {
        const response = await fetch(apiBase + '/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await response.json();
        
        if (user.role !== 'admin' && user.role !== 'supervisor') {
            alert('❌ Accès refusé. Seuls les administrateurs et superviseurs peuvent accéder à cette page.');
            window.location.href = '/dashboard.html';
            return;
        }

        // Mettre à jour l'info utilisateur
        document.getElementById('user-info').textContent = `${user.name} (${user.role})`;
    } catch (error) {
        console.error('Erreur vérification auth:', error);
        alert('❌ Erreur de vérification. Veuillez vous reconnecter.');
        window.location.href = '/index.html';
        return;
    }

    // S'assurer que tous les modals sont fermés
    document.getElementById('agent-modal').classList.add('hidden');
    document.getElementById('delete-modal').classList.add('hidden');
    
    // Forcer la fermeture des modals avec des styles
    document.getElementById('agent-modal').style.display = 'none';
    document.getElementById('delete-modal').style.display = 'none';
    
    // Réinitialiser les variables
    agentToDelete = null;
    
    // Ajouter des gestionnaires d'événements pour les boutons
    setupModalEventListeners();
    
    // Charger les données
    await loadAgents();
    await loadDepartements();
    
    console.log('✅ Page de gestion des agents initialisée');
});

// Charger tous les agents
async function loadAgents() {
    try {
        console.log('📥 Chargement des agents...');
        const token = localStorage.getItem('jwt') || localStorage.getItem('token');
        const response = await fetch(apiBase + '/admin/agents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        allAgents = await response.json();
        filteredAgents = [...allAgents];
        
        console.log(`✅ ${allAgents.length} agents chargés`);
        
        updateStats();
        displayAgents();
        
    } catch (error) {
        console.error('❌ Erreur chargement agents:', error);
        alert('❌ Erreur lors du chargement des agents: ' + error.message);
    }
}

// Charger les départements pour les filtres
async function loadDepartements() {
    try {
        // Utiliser les données statiques de geo-data.js
        if (typeof geoData !== 'undefined' && geoData.departements) {
            const select = document.getElementById('filter-departement');
            select.innerHTML = '<option value="">Tous les départements</option>';
            
            geoData.departements.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.name;
                option.textContent = dept.name;
                select.appendChild(option);
            });
            
            console.log('✅ Départements chargés pour les filtres:', geoData.departements.length);
        } else {
            console.error('❌ geoData non disponible');
        }
        
    } catch (error) {
        console.error('❌ Erreur chargement départements:', error);
    }
}

// Mettre à jour les statistiques
function updateStats() {
    const total = allAgents.length;
    const active = allAgents.filter(a => a.status === 'active').length;
    const supervisors = allAgents.filter(a => a.role === 'supervisor').length;
    const admins = allAgents.filter(a => a.role === 'admin').length;

    document.getElementById('total-agents').textContent = total;
    document.getElementById('active-agents').textContent = active;
    document.getElementById('supervisors').textContent = supervisors;
    document.getElementById('admins').textContent = admins;
}

// Afficher les agents dans le tableau
function displayAgents() {
    const tbody = document.getElementById('agents-table-body');
    
    if (filteredAgents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">Aucun agent trouvé</td></tr>';
        return;
    }

    // Calculer la pagination
    const startIndex = (currentPage - 1) * agentsPerPage;
    const endIndex = Math.min(startIndex + agentsPerPage, filteredAgents.length);
    const pageAgents = filteredAgents.slice(startIndex, endIndex);

    tbody.innerHTML = pageAgents.map(agent => `
        <tr>
            <td class="agent-photo">
                <img src="${agent.photo_path || '/Media/default-avatar.svg'}" 
                     alt="Photo ${agent.name}" 
                     class="agent-avatar" />
            </td>
            <td class="agent-name">
                <div class="agent-name-main">${agent.name}</div>
                <div class="agent-name-sub">${agent.first_name || ''} ${agent.last_name || ''}</div>
            </td>
            <td class="agent-email">${agent.email}</td>
            <td class="agent-role">
                <span class="role-badge role-${agent.role}">${getRoleLabel(agent.role)}</span>
            </td>
            <td class="agent-phone">${agent.phone || '-'}</td>
            <td class="agent-location">${agent.departement || '-'}</td>
            <td class="agent-project">${agent.project_name || '-'}</td>
            <td class="agent-status">
                <span class="status-badge status-${agent.status || 'active'}">${getStatusLabel(agent.status)}</span>
            </td>
            <td class="agent-actions">
                <button onclick="editAgent(${agent.id})" class="btn-edit" title="Modifier">
                    ✏️
                </button>
                <button onclick="deleteAgent(${agent.id})" class="btn-delete" title="Supprimer">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');

    // Mettre à jour la pagination
    updatePagination();
}

// Obtenir le libellé du rôle
function getRoleLabel(role) {
    const labels = {
        'agent': 'Agent',
        'supervisor': 'Superviseur',
        'admin': 'Administrateur'
    };
    return labels[role] || role;
}

// Obtenir le libellé du statut
function getStatusLabel(status) {
    const labels = {
        'active': 'Actif',
        'inactive': 'Inactif',
        'suspended': 'Suspendu'
    };
    return labels[status] || 'Actif';
}

// Filtrer les agents
function filterAgents() {
    const search = document.getElementById('search-agent').value.toLowerCase();
    const role = document.getElementById('filter-role').value;
    const departement = document.getElementById('filter-departement').value;

    filteredAgents = allAgents.filter(agent => {
        const matchesSearch = !search || 
            agent.name.toLowerCase().includes(search) ||
            agent.email.toLowerCase().includes(search) ||
            (agent.phone && agent.phone.includes(search)) ||
            (agent.first_name && agent.first_name.toLowerCase().includes(search)) ||
            (agent.last_name && agent.last_name.toLowerCase().includes(search));

        const matchesRole = !role || agent.role === role;
        const matchesDept = !departement || agent.departement === departement;

        return matchesSearch && matchesRole && matchesDept;
    });

    currentPage = 1;
    displayAgents();
}

// Mettre à jour la pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredAgents.length / agentsPerPage);
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    pageInfo.textContent = `Page ${currentPage} sur ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
}

// Page précédente
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayAgents();
    }
}

// Page suivante
function nextPage() {
    const totalPages = Math.ceil(filteredAgents.length / agentsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayAgents();
    }
}

// Ouvrir le modal d'agent (nouveau)
function openAgentModal() {
    console.log('📝 Ouverture modal nouveau agent');
    document.getElementById('agent-modal').classList.remove('hidden');
    document.getElementById('agent-modal-title').textContent = 'Créer un Nouvel Agent';
    document.getElementById('agent-form').reset();
    document.getElementById('af_id').value = '';
    
    // Réinitialiser la photo
    updatePhotoPreview(null);
    
    // Charger les départements
    loadAfDepartements();
}

// Modifier un agent
async function editAgent(agentId) {
    try {
        console.log(`✏️ Modification agent ID: ${agentId}`);
        
        const agent = allAgents.find(a => a.id === agentId);
        if (!agent) {
            alert('❌ Agent non trouvé');
            return;
        }

        // Ouvrir le modal
        document.getElementById('agent-modal').classList.remove('hidden');
        document.getElementById('agent-modal-title').textContent = 'Modifier l\'Agent';
        
        // Remplir le formulaire
        document.getElementById('af_id').value = agent.id;
        document.getElementById('af_name').value = agent.name || '';
        document.getElementById('af_email').value = agent.email || '';
        document.getElementById('af_first_name').value = agent.first_name || '';
        document.getElementById('af_last_name').value = agent.last_name || '';
        document.getElementById('af_phone').value = agent.phone || '';
        document.getElementById('af_role').value = agent.role || 'agent';
        document.getElementById('af_project').value = agent.project_name || '';
        document.getElementById('af_project_description').value = agent.project_description || '';
        document.getElementById('af_plan_start').value = agent.planning_start_date || '';
        document.getElementById('af_plan_end').value = agent.planning_end_date || '';
        document.getElementById('af_expected_days').value = agent.expected_days_per_month || '';
        document.getElementById('af_expected_hours').value = agent.expected_hours_per_month || '';
        document.getElementById('af_work_schedule').value = agent.work_schedule || '';
        document.getElementById('af_contract_type').value = agent.contract_type || '';
        document.getElementById('af_ref_lat').value = agent.reference_lat || '';
        document.getElementById('af_ref_lon').value = agent.reference_lon || '';
        document.getElementById('af_tolerance').value = agent.tolerance_radius_meters || '';
        document.getElementById('af_gps_accuracy').value = agent.gps_accuracy || 'medium';
        document.getElementById('af_observations').value = agent.observations || '';
        
        // Mettre à jour la photo
        updatePhotoPreview(agent.photo_path);
        
        // Charger les départements et sélectionner celui de l'agent
        await loadAfDepartements(agent.village_path);
        
    } catch (error) {
        console.error('❌ Erreur modification agent:', error);
        alert('❌ Erreur lors de la modification: ' + error.message);
    }
}

// Supprimer un agent
function deleteAgent(agentId) {
    const agent = allAgents.find(a => a.id === agentId);
    if (!agent) {
        alert('❌ Agent non trouvé');
        return;
    }

    agentToDelete = agentId;
    document.getElementById('delete-message').textContent = 
        `Êtes-vous sûr de vouloir supprimer l'agent "${agent.name}" ?\n\nCette action est irréversible.`;
    document.getElementById('delete-modal').classList.remove('hidden');
}

// Confirmer la suppression
async function confirmDelete() {
    if (!agentToDelete) return;

    try {
        console.log(`🗑️ Suppression agent ID: ${agentToDelete}`);
        
        const token = localStorage.getItem('jwt') || localStorage.getItem('token');
        const response = await fetch(`${apiBase}/admin/agents/${agentToDelete}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la suppression');
        }

        alert('✅ Agent supprimé avec succès');
        closeDeleteModal();
        await loadAgents(); // Recharger la liste
        
    } catch (error) {
        console.error('❌ Erreur suppression agent:', error);
        alert('❌ Erreur lors de la suppression: ' + error.message);
    }
}

// Fermer le modal de suppression
function closeDeleteModal() {
    console.log('🔄 Fermeture du modal de suppression...');
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        console.log('✅ Modal de suppression fermé');
    } else {
        console.error('❌ Modal de suppression non trouvé');
    }
    agentToDelete = null;
}

// Annuler la suppression
function cancelDelete() {
    closeDeleteModal();
}

// Actualiser la liste
async function refreshAgents() {
    console.log('🔄 Actualisation des agents...');
    await loadAgents();
    alert('✅ Liste des agents actualisée');
}

// Exporter les agents (désactivé en mode accès libre)
async function exportAgents() {
    try {
        console.log('📊 Export des agents...');
        
        // Préparer les données pour l'export
        const exportData = filteredAgents.map(agent => ({
            'ID': agent.id,
            'Nom': agent.name,
            'Email': agent.email,
            'Prénom': agent.first_name || '',
            'Nom de famille': agent.last_name || '',
            'Téléphone': agent.phone || '',
            'Rôle': agent.role,
            'Projet': agent.project_name || '',
            'Description projet': agent.project_description || '',
            'Date début': agent.planning_start_date || '',
            'Date fin': agent.planning_end_date || '',
            'Jours/mois': agent.expected_days_per_month || '',
            'Heures/mois': agent.expected_hours_per_month || '',
            'Horaire': agent.work_schedule || '',
            'Type contrat': agent.contract_type || '',
            'Latitude': agent.reference_lat || '',
            'Longitude': agent.reference_lon || '',
            'Tolérance (m)': agent.tolerance_radius_meters || '',
            'Précision GPS': agent.gps_accuracy || '',
            'Observations': agent.observations || '',
            'Créé le': agent.created_at || ''
        }));

        // Convertir en CSV
        const headers = Object.keys(exportData[0] || {});
        const csvContent = [
            headers.join(','),
            ...exportData.map(row => 
                headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(',')
            )
        ].join('\n');

        // Télécharger le fichier
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `agents_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ Export terminé');
        alert(`✅ ${exportData.length} agents exportés avec succès`);
        
    } catch (error) {
        console.error('❌ Erreur export:', error);
        alert('❌ Erreur lors de l\'export: ' + error.message);
    }
}

// Gestion du formulaire d'agent (réutilise les fonctions du dashboard.js)
document.getElementById('agent-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    console.log('📝 Soumission formulaire agent');
    
    try {
        const formData = new FormData(ev.target);
        const agentId = document.getElementById('af_id').value;
        
        // Validation du mot de passe
        const password = document.getElementById('af_password').value;
        const passwordConfirm = document.getElementById('af_password_confirm').value;
        
        if (password && password !== passwordConfirm) {
            alert('❌ Les mots de passe ne correspondent pas');
            return;
        }

        // Préparer les données
        const payload = {
            name: document.getElementById('af_name').value,
            email: document.getElementById('af_email').value,
            first_name: document.getElementById('af_first_name').value,
            last_name: document.getElementById('af_last_name').value,
            phone: document.getElementById('af_phone').value,
            role: document.getElementById('af_role').value,
            project_name: document.getElementById('af_project').value,
            project_description: document.getElementById('af_project_description').value,
            planning_start_date: document.getElementById('af_plan_start').value,
            planning_end_date: document.getElementById('af_plan_end').value,
            expected_days_per_month: parseInt(document.getElementById('af_expected_days').value) || null,
            expected_hours_per_month: parseInt(document.getElementById('af_expected_hours').value) || null,
            work_schedule: document.getElementById('af_work_schedule').value,
            contract_type: document.getElementById('af_contract_type').value,
            ref_lat: parseFloat(document.getElementById('af_ref_lat').value) || null,
            ref_lon: parseFloat(document.getElementById('af_ref_lon').value) || null,
            tolerance: parseInt(document.getElementById('af_tolerance').value) || null,
            gps_accuracy: document.getElementById('af_gps_accuracy').value,
            observations: document.getElementById('af_observations').value,
            departement: document.getElementById('af_departement').value,
            commune: document.getElementById('af_commune').value,
            arrondissement: document.getElementById('af_arrondissement').value,
            village: document.getElementById('af_village').value
        };

        // Ajouter le mot de passe seulement s'il est fourni
        if (password) {
            payload.password = password;
        }

        const token = localStorage.getItem('token');
        const url = agentId ? `${apiBase}/admin/agents/${agentId}` : `${apiBase}/admin/agents`;
        const method = agentId ? 'PUT' : 'POST';

        console.log(`📤 Envoi ${method} vers ${url}:`, payload);

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Erreur ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Agent enregistré:', result);

        alert(agentId ? '✅ Agent modifié avec succès' : '✅ Agent créé avec succès');
        closeAgentModal();
        await loadAgents(); // Recharger la liste
        
    } catch (error) {
        console.error('❌ Erreur enregistrement agent:', error);
        alert('❌ Erreur lors de l\'enregistrement: ' + error.message);
    }
});

// Fermer le modal d'agent
function closeAgentModal() {
    console.log('🔄 Fermeture du modal d\'agent...');
    const modal = document.getElementById('agent-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        console.log('✅ Modal d\'agent fermé');
    } else {
        console.error('❌ Modal d\'agent non trouvé');
    }
    
    // Réinitialiser le formulaire
    const form = document.getElementById('agent-form');
    if (form) {
        form.reset();
    }
    
    // Réinitialiser la photo
    updatePhotoPreview(null);
}

// Fonction de déconnexion
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
}

// Fonction pour gérer le bouton Annuler du modal de suppression
function cancelDelete() {
    closeDeleteModal();
}

// Exposer les fonctions globalement
window.editAgent = editAgent;
window.deleteAgent = deleteAgent;
window.openAgentModal = openAgentModal;
window.closeAgentModal = closeAgentModal;
window.refreshAgents = refreshAgents;
window.exportAgents = exportAgents;
window.filterAgents = filterAgents;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.cancelDelete = cancelDelete;

// Configuration des gestionnaires d'événements pour les modals
function setupModalEventListeners() {
    console.log('🔧 Configuration des gestionnaires d\'événements...');
    
    // Gestionnaire pour le bouton Annuler du modal d'agent
    const agentCancelBtn = document.querySelector('#agent-modal .btn-cancel');
    if (agentCancelBtn) {
        agentCancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 Clic sur Annuler (modal agent)');
            closeAgentModal();
        });
    }
    
    // Gestionnaire pour le bouton Annuler du modal de suppression
    const deleteCancelBtn = document.querySelector('#delete-modal .btn-cancel');
    if (deleteCancelBtn) {
        deleteCancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 Clic sur Annuler (modal suppression)');
            closeDeleteModal();
        });
    }
    
    // Gestionnaire pour le bouton Supprimer du modal de suppression
    const deleteConfirmBtn = document.querySelector('#delete-modal .btn-danger');
    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 Clic sur Supprimer');
            confirmDelete();
        });
    }
    
    // Fermer les modals en cliquant sur l'arrière-plan
    document.getElementById('agent-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAgentModal();
        }
    });
    
    document.getElementById('delete-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeDeleteModal();
        }
    });
    
    console.log('✅ Gestionnaires d\'événements configurés');
}

// Test de la fonction closeAgentModal
console.log('🔧 Fonction closeAgentModal exposée:', typeof window.closeAgentModal);
