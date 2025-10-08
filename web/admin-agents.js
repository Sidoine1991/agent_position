// Variables globales
// Configuration de l'API - utiliser Render en production sur Vercel
const adminOnVercel = /\.vercel\.app$/.test(window.location.hostname) || window.location.hostname.includes('vercel.app');
const apiBase = '/api';

let allAgents = [];
let filteredAgents = [];
let currentPage = 1;
const agentsPerPage = 10;
let agentToDelete = null;

// --- Supabase helpers ---
function getSupabaseConfig() {
    try {
        const metaUrl = document.querySelector('meta[name="supabase-url"]')?.content || '';
        const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.content || '';
        const lsUrl = localStorage.getItem('SUPABASE_URL') || '';
        const lsKey = localStorage.getItem('SUPABASE_ANON_KEY') || '';
        const url = (window.SUPABASE_URL || metaUrl || lsUrl || '').trim().replace(/\/+$/,'');
        const key = (window.SUPABASE_ANON_KEY || metaKey || lsKey || '').trim();
        if (url && key) return { url, key };
    } catch {}
    return null;
}

async function fetchUsersFromSupabase() {
    const cfg = getSupabaseConfig();
    if (!cfg) return null;
    const { url, key } = cfg;
    const p = new URLSearchParams();
    p.set('select', [
        'id,name,first_name,last_name,email,role,phone,status,photo_path',
        'departement,commune,arrondissement,village,project_name,project_description',
        'expected_days_per_month,expected_hours_per_month,planning_start_date,planning_end_date',
        'reference_lat,reference_lon,tolerance_radius_meters,gps_accuracy,observations,created_at'
    ].join(','));
    p.set('order', 'created_at.desc');
    const res = await fetch(`${url}/rest/v1/users?${p.toString()}`, {
        headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows : null;
}

function getQueryParam(name){ try{ return new URLSearchParams(window.location.search).get(name) || ''; } catch { return ''; } }
function getEmailHint(){ return getQueryParam('email') || localStorage.getItem('userEmail') || localStorage.getItem('email') || ''; }

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initialisation de la page de gestion des agents');
    
    // Vérifier l'authentification (souple)
    const token = localStorage.getItem('jwt') || localStorage.getItem('token') || '';

    // Vérifier l'authentification et le rôle
    if (!token) {
        alert('❌ Accès refusé. Vous devez être connecté pour accéder à cette page.');
        window.location.href = '/index.html';
        return;
    }

    try {
        const response = await fetch(apiBase + '/profile', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!response.ok) {
            console.warn('⚠️ Profil indisponible, poursuite en mode lecture');
        }
        
        const profile = response.ok ? await response.json() : { name: 'Utilisateur', role: 'admin' };
        
        // Si rôle non admin/supervisor, continuer en lecture seule au lieu de rediriger
        if (profile.role !== 'admin' && profile.role !== 'supervisor') {
            console.warn('⚠️ Rôle non admin/supervisor, mode lecture');
        }

        // Mettre à jour l'info utilisateur
        document.getElementById('user-info').textContent = `${profile.name} (${profile.role})`;
        
    } catch (error) {
        console.warn('⚠️ Profil indisponible, poursuite en mode lecture:', error?.message || error);
    }

    // S'assurer que tous les modals sont fermés (tolérant si absent)
    const agentModalEl = document.getElementById('agent-modal');
    if (agentModalEl) {
        agentModalEl.classList.add('hidden');
        agentModalEl.style.display = 'none';
    }
    const deleteModalEl = document.getElementById('delete-modal');
    if (deleteModalEl) {
        deleteModalEl.classList.add('hidden');
        deleteModalEl.style.display = 'none';
    }
    
    // Ajouter des gestionnaires d'événements pour les boutons
    try { setupModalEventListeners(); } catch (e) { console.warn('⚠️ setupModalEventListeners ignoré:', e?.message || e); }
    
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
        
        if (!token) {
            throw new Error('Token d\'authentification manquant');
        }

        const response = await fetch(apiBase + '/admin/agents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Erreur ${response.status}: ${errorData.message || response.statusText}`);
        }

        const result = await response.json();
        // Supporte plusieurs formats: {success, data}, {data: {items}}, tableau direct
        const extracted = Array.isArray(result)
          ? result
          : (result?.data?.items || result?.data || result?.agents || []);
        allAgents = Array.isArray(extracted) ? extracted : [];
        filteredAgents = [...allAgents];
        
        console.log(`✅ ${allAgents.length} agents chargés:`, allAgents);
        
        updateStats();
        displayAgents();
        
    } catch (error) {
        console.warn('⚠️ API backend indisponible, tentative Supabase directe...', error?.message || error);
        try {
            const rows = await fetchUsersFromSupabase();
            if (Array.isArray(rows)) {
                allAgents = rows;
                filteredAgents = [...allAgents];
                console.log(`✅ ${allAgents.length} agents chargés via Supabase`);
                updateStats();
                displayAgents();
                return;
            }
        } catch (e2) {
            console.error('❌ Échec chargement via Supabase:', e2);
        }

        // Afficher un message d'erreur dans le tableau si tout a échoué
        const tbody = document.getElementById('agents-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="error">❌ Erreur: ${error.message}</td></tr>`;
        // Mettre les stats à zéro visiblement
        try { document.getElementById('total-agents').textContent = '0'; } catch {}
        try { document.getElementById('active-agents').textContent = '0'; } catch {}
        try { document.getElementById('supervisors').textContent = '0'; } catch {}
        try { document.getElementById('admins').textContent = '0'; } catch {}
        if (error.message.includes('Token') || error.message.includes('401')) alert('❌ Erreur d\'authentification. Veuillez vous reconnecter.');
    }
}

// Charger les départements pour les filtres
async function loadDepartements() {
    try {
        // Utiliser les données locales depuis geo-data.js
        if (window.geoData && window.geoData.departements) {
            const departements = window.geoData.departements;
            
            const select = document.getElementById('filter-departement');
            select.innerHTML = '<option value="">Tous les départements</option>';
            
            departements.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.name;
                option.textContent = dept.name;
                select.appendChild(option);
            });
            
            console.log(`✅ ${departements.length} départements chargés pour les filtres`);
        } else {
            console.warn('⚠️ Données géographiques non disponibles');
        }
        
    } catch (error) {
        console.error('❌ Erreur chargement départements:', error);
    }
}

// Mettre à jour les statistiques
function updateStats() {
    const total = Array.isArray(allAgents) ? allAgents.length : 0;
    const active = Array.isArray(allAgents) ? allAgents.filter(a => (a.status || 'active') === 'active').length : 0;
    const supervisors = Array.isArray(allAgents) ? allAgents.filter(a => a.role === 'supervisor').length : 0;
    const admins = Array.isArray(allAgents) ? allAgents.filter(a => a.role === 'admin').length : 0;

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
            <td class="agent-departement">${agent.departement || '-'}</td>
            <td class="agent-commune">${agent.commune || '-'}</td>
            <td class="agent-arrondissement">${agent.arrondissement || '-'}</td>
            <td class="agent-village">${agent.village || '-'}</td>
            <td class="agent-project">${agent.project_name || '-'}</td>
            <td class="agent-status">
                <span class="status-badge status-${agent.status || 'active'}">${getStatusLabel(agent.status)}</span>
            </td>
            <td class="agent-last-activity">${formatDate(agent.last_activity)}</td>
            <td class="agent-actions">
                <button onclick="editAgent('${String(agent.id)}')" class="btn-edit" title="Modifier">
                    ✏️
                </button>
                <button onclick="deleteAgent('${String(agent.id)}')" class="btn-delete" title="Supprimer">
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

// Formater une date
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return '-';
    }
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
    // Activer la bascule saisie/select
    setupManualGeoInputsAdmin();
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
async function deleteAgent(agentId) {
    console.log('🔍 Recherche agent ID:', agentId, 'dans allAgents:', allAgents);
    const agent = allAgents.find(a => a.id == agentId);
    if (!agent) {
        console.error('❌ Agent non trouvé. allAgents:', allAgents);
        alert('❌ Agent non trouvé');
        return;
    }

    // Suppression directe sans confirmation
    try {
        console.log(`🗑️ Suppression agent ID: ${agentId}`);
        
        const token = localStorage.getItem('jwt') || localStorage.getItem('token');
        const response = await fetch(`${apiBase}/admin/agents/${agentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success) {
            console.log('✅ Agent supprimé avec succès');
            alert(`✅ Agent "${agent.name}" supprimé avec succès`);
            await loadAgents(); // Recharger la liste
        } else {
            throw new Error(result.message || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('❌ Erreur suppression agent:', error);
        alert('❌ Erreur lors de la suppression: ' + error.message);
    }
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

        const token = localStorage.getItem('jwt') || localStorage.getItem('token');
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

// Bascule saisie manuelle/select pour l'admin (même logique que dashboard)
function setupManualGeoInputsAdmin() {
    const fields = ['af_departement','af_commune','af_arrondissement','af_village'];
    fields.forEach(field => {
        const select = document.getElementById(field);
        const input = document.getElementById(field + '-manual');
        const toggle = document.getElementById('toggle-' + field);
        if (!select || !input || !toggle) return;
        toggle.onclick = () => {
            const manual = input.style.display !== 'none';
            if (manual) {
                // switch to select
                select.style.display = 'block';
                input.style.display = 'none';
                toggle.textContent = '✏️';
                select.disabled = false;
            } else {
                // switch to manual
                select.style.display = 'none';
                input.style.display = 'block';
                toggle.textContent = '📋';
                select.disabled = true;
                input.focus();
            }
        };
        // sync select -> input
        select.onchange = () => {
            if (input.style.display === 'none') return;
            input.value = select.options[select.selectedIndex]?.text || '';
        };
        // sync input -> select (meilleur-effort)
        input.oninput = () => {
            if (select.style.display === 'none') return;
            const opts = Array.from(select.options);
            const m = opts.find(o => o.text.toLowerCase().includes(input.value.toLowerCase()));
            if (m) select.value = m.value;
        };
    });
}

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

// Exposer les fonctions globalement pour les boutons HTML
window.loadAgents = loadAgents;
window.filterAgents = filterAgents;
window.openCreateAgentModal = openCreateAgentModal;
window.closeAgentModal = closeAgentModal;
window.editAgent = editAgent;
window.deleteAgent = deleteAgent;
window.viewAgent = viewAgent;
window.refreshAgents = refreshAgents;
window.previousPage = previousPage;
window.nextPage = nextPage;

// Test de la fonction closeAgentModal
console.log('🔧 Fonction closeAgentModal exposée:', typeof window.closeAgentModal);
