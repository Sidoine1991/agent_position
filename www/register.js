// Script pour l'inscription et validation par email
let currentEmail = '';

// Éléments du DOM
const registerForm = document.getElementById('registrationForm');
const verificationForm = document.getElementById('verificationForm');
const registerFormDiv = document.getElementById('register-form');
const verificationFormDiv = document.getElementById('verification-form');
const successContainer = document.getElementById('success-container');
const successMessage = document.getElementById('success-message');
const errorMessage = document.getElementById('error-message');
const submitBtn = document.getElementById('submitBtn');
const verifyBtn = document.getElementById('verifyBtn');
const btnText = document.getElementById('btnText');
const verifyBtnText = document.getElementById('verifyBtnText');
const resendBtn = document.getElementById('resendBtn');
const zonesContainer = document.getElementById('zones-container');
const addZoneBtn = document.getElementById('add-zone-btn');
let zoneTempId = 0;

// Fonction utilitaire pour les requêtes API
// Configuration de l'API - utiliser Render en production sur Vercel
const onVercel = /\.vercel\.app$/.test(window.location.hostname) || window.location.hostname.includes('vercel.app');
const apiBase = '/api';

async function api(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${apiBase}${endpoint}`, options);
  
  if (!response.ok) {
    console.error('Erreur HTTP:', response.status, response.statusText);
    const text = await response.text();
    console.error('Réponse serveur:', text);
    
    // Retourner l'erreur au lieu de lancer une exception
    try {
      const errorData = JSON.parse(text);
      return { success: false, message: errorData.error || `HTTP ${response.status}: ${response.statusText}` };
    } catch (parseError) {
      return { success: false, message: `HTTP ${response.status}: ${response.statusText}` };
    }
  }
  
  return await response.json();
}

// Fonction pour afficher les messages
function showMessage(message, type = 'success') {
  // Cacher tous les messages
  successMessage.style.display = 'none';
  errorMessage.style.display = 'none';
  
  if (type === 'success') {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
  } else {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }
  
  // Auto-masquer après 5 secondes
  setTimeout(() => {
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
  }, 5000);
}

// Fonction pour afficher les messages d'erreur améliorés
function showEnhancedErrorMessage(message, suggestions = []) {
  // Cacher tous les messages
  successMessage.style.display = 'none';
  errorMessage.style.display = 'none';
  
  // Construire le message d'erreur avec suggestions
  let errorText = message;
  if (suggestions && suggestions.length > 0) {
    errorText += '\n\nSuggestions :\n• ' + suggestions.join('\n• ');
  }
  
  errorMessage.textContent = errorText;
  errorMessage.style.display = 'block';
  
  // Auto-masquer après 8 secondes (plus long pour les messages détaillés)
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 8000);
}

// Fonction pour basculer entre les formulaires
function showForm(formType) {
  registerFormDiv.style.display = formType === 'register' ? 'block' : 'none';
  verificationFormDiv.style.display = formType === 'verification' ? 'block' : 'none';
  successContainer.style.display = formType === 'success' ? 'block' : 'none';
}

function buildZoneRow(zone = {}) {
  const id = ++zoneTempId;
  const row = document.createElement('div');
  row.className = 'zone-row';
  row.style.cssText = 'border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:8px 0;background:#f9fafb';
  row.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <label>Département</label>
        <input type="text" data-field="departement" placeholder="Département" value="${zone.departement || ''}">
      </div>
      <div>
        <label>Commune</label>
        <input type="text" data-field="commune" placeholder="Commune" value="${zone.commune || ''}">
      </div>
      <div>
        <label>Arrondissement</label>
        <input type="text" data-field="arrondissement" placeholder="Arrondissement" value="${zone.arrondissement || ''}">
      </div>
      <div>
        <label>Village</label>
        <input type="text" data-field="village" placeholder="Village" value="${zone.village || ''}">
      </div>
      <div>
        <label>Latitude de référence</label>
        <input type="number" step="0.000001" data-field="reference_lat" placeholder="Ex: 6.4969" value="${zone.reference_lat || ''}">
      </div>
      <div>
        <label>Longitude de référence</label>
        <input type="number" step="0.000001" data-field="reference_lon" placeholder="Ex: 2.6036" value="${zone.reference_lon || ''}">
      </div>
      <div>
        <label>Rayon de tolérance (m)</label>
        <input type="number" min="10" max="10000" data-field="tolerance_radius_meters" placeholder="Ex: 500" value="${zone.tolerance_radius_meters || 1000}">
      </div>
    </div>
    <div style="text-align:right;margin-top:8px">
      <button type="button" class="btn-register" data-action="remove" style="background:#ef4444">🗑️ Supprimer</button>
    </div>
  `;
  row.querySelector('[data-action="remove"]').addEventListener('click', ()=>{ row.remove(); });
  return row;
}

if (addZoneBtn && zonesContainer) {
  addZoneBtn.addEventListener('click', () => {
    zonesContainer.appendChild(buildZoneRow());
  });
  // Ajouter une zone par défaut
  zonesContainer.appendChild(buildZoneRow());
}

// Gestion de l'inscription
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(registerForm);
  const data = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    role: formData.get('role'),
    password: formData.get('password')
  };

  // Champs supplémentaires mappés à la table `users` (si présents dans le formulaire)
  const extraFields = {
    // Sauvegarder les LIBELLÉS visibles (pas les ids numériques)
    departement: (() => { const el = document.getElementById('departement'); return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : ''; })(),
    commune: (() => { const el = document.getElementById('commune'); return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : ''; })(),
    arrondissement: (() => { const el = document.getElementById('arrondissement'); return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : ''; })(),
    village: (() => { const el = document.getElementById('village'); return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : ''; })(),
    project_name: (formData.get('project_name') || '').trim(),
    expected_days_per_month: formData.get('expected_days_per_month'),
    expected_hours_per_month: formData.get('expected_hours_per_month'),
    contract_start_date: formData.get('contract_start_date'),
    contract_end_date: formData.get('contract_end_date'),
    years_of_service: formData.get('years_of_service'),
    // Multi-zones: collecter depuis zonesContainer
  };

  Object.entries(extraFields).forEach(([k, v]) => {
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      if (k === 'expected_days_per_month' || k === 'expected_hours_per_month') {
        const num = parseInt(String(v), 10);
        if (!Number.isNaN(num)) data[k] = num;
      } else if (k === 'years_of_service') {
        const num = parseFloat(String(v).replace(',', '.'));
        if (!Number.isNaN(num)) data[k] = num;
      } else {
        data[k] = v;
      }
    }
  });

  // Construire zones depuis le conteneur
  try {
    const rows = Array.from(zonesContainer.querySelectorAll('.zone-row'));
    const zones = rows.map(r => {
      const get = sel => r.querySelector(`[data-field="${sel}"]`)?.value || '';
      const lat = parseFloat(String(get('reference_lat')).replace(',', '.'));
      const lon = parseFloat(String(get('reference_lon')).replace(',', '.'));
      const tol = parseFloat(String(get('tolerance_radius_meters')).replace(',', '.'));
      return {
        id: undefined,
        departement: get('departement').trim(),
        commune: get('commune').trim(),
        arrondissement: get('arrondissement').trim(),
        village: get('village').trim(),
        reference_lat: Number.isFinite(lat) ? lat : null,
        reference_lon: Number.isFinite(lon) ? lon : null,
        tolerance_radius_meters: Number.isFinite(tol) ? tol : 1000
      };
    }).filter(z => z.departement || z.commune || z.village || (z.reference_lat != null && z.reference_lon != null));
    if (zones.length) data.zones = zones;
  } catch {}
  
  // Validation côté client
  if (data.password !== formData.get('confirmPassword')) {
    showMessage('Les mots de passe ne correspondent pas', 'error');
    return;
  }
  
  if (data.password.length < 6) {
    showMessage('Le mot de passe doit contenir au moins 6 caractères', 'error');
    return;
  }
  
  try {
    // Afficher un indicateur de chargement
    btnText.innerHTML = '<span class="loading"></span> Création en cours...';
    submitBtn.disabled = true;
    
    // Envoyer la requête d'inscription
    const result = await api('/register', 'POST', data);
    
    if (result.success) {
      if (result.admin_created) {
        // Admin principal créé
        showMessage('Administrateur principal créé avec succès ! Vous pouvez maintenant vous connecter.', 'success');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } else if (result.admin_exists) {
        // Admin existe déjà
        showMessage('Administrateur principal existe déjà. Vous pouvez vous connecter.', 'success');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } else {
        // Utilisateur normal - validation par email requise
        currentEmail = data.email;
        if (result.admin_flow) {
          showForm('verification');
          showMessage("Inscription Administrateur: le code a été envoyé au Super Admin. Veuillez vous rapprocher de l'Équipe de développeur pour obtenir votre code au +2290196911346.", 'success');
        } else {
          showForm('verification');
          showMessage('Code de validation envoyé par email. Vérifiez votre boîte mail.', 'success');
        }
      }
    } else {
      // Gestion intelligente des erreurs d'inscription
      let errorMessage = result.message || 'Erreur lors de l\'inscription';
      let suggestions = [];
      
      if (result.message && result.message.includes('déjà')) {
        errorMessage = 'Email déjà utilisé.';
        suggestions = [
          'Si vous avez déjà un compte, essayez de vous connecter',
          'Si vous avez oublié votre mot de passe, cliquez sur "Mot de passe oublié"',
          'Vérifiez que l\'email est correct'
        ];
      } else if (result.message && result.message.includes('email')) {
        errorMessage = 'Adresse email invalide.';
        suggestions = [
          'Vérifiez que l\'email est correct',
          'Assurez-vous que l\'email contient @ et un domaine valide'
        ];
      } else if (result.message && result.message.includes('mot de passe')) {
        errorMessage = 'Mot de passe invalide.';
        suggestions = [
          'Le mot de passe doit contenir au moins 6 caractères',
          'Choisissez un mot de passe sécurisé'
        ];
      } else {
        suggestions = [
          'Vérifiez tous les champs du formulaire',
          'Assurez-vous d\'avoir une connexion internet stable',
          'Réessayez dans quelques instants'
        ];
      }
      
      showEnhancedErrorMessage(errorMessage, suggestions);
    }
    
  } catch (error) {
    console.error('Erreur inscription:', error);
    console.error('URL appelée:', `${apiBase}/register`);
    console.error('Données envoyées:', data);
    
    showEnhancedErrorMessage('Erreur lors de l\'inscription.', [
      'Vérifiez votre connexion internet',
      'Assurez-vous que tous les champs sont remplis correctement',
      'Réessayez dans quelques instants',
      'Contactez votre administrateur si le problème persiste'
    ]);
  } finally {
    // Restaurer le bouton
    btnText.textContent = '📝 Créer mon compte';
    submitBtn.disabled = false;
  }
});

// Gestion de la validation du code
verificationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(verificationForm);
  const code = formData.get('code');
  
  if (!code || code.length !== 6) {
    showMessage('Veuillez entrer un code à 6 chiffres', 'error');
    return;
  }
  
  try {
    // Afficher un indicateur de chargement
    verifyBtnText.innerHTML = '<span class="loading"></span> Validation...';
    verifyBtn.disabled = true;
    
    // Envoyer la requête de validation
    const result = await api('/verify', 'POST', {
      email: currentEmail,
      code: code
    });
    
    if (result.success) {
      showForm('success');
    } else {
      showMessage(result.message || 'Code invalide ou expiré', 'error');
    }
    
  } catch (error) {
    console.error('Erreur validation:', error);
    showMessage('Erreur lors de la validation. Veuillez réessayer.', 'error');
  } finally {
    // Restaurer le bouton
    verifyBtnText.textContent = '✅ Valider mon compte';
    verifyBtn.disabled = false;
  }
});

// Gestion du renvoi de code
resendBtn.addEventListener('click', async () => {
  try {
    resendBtn.textContent = '⏳ Envoi...';
    resendBtn.disabled = true;
    
    // Renvoyer le code via endpoint dédié
    const result = await api('/resend-code', 'POST', { email: currentEmail });
    
    if (result.success) {
      showMessage('Nouveau code envoyé par email', 'success');
    } else {
      showMessage('Erreur lors du renvoi du code', 'error');
    }
    
  } catch (error) {
    console.error('Erreur renvoi:', error);
    showMessage('Erreur lors du renvoi du code', 'error');
  } finally {
    resendBtn.textContent = 'Renvoyer le code';
    resendBtn.disabled = false;
  }
});

// Validation en temps réel du code
document.getElementById('code').addEventListener('input', function(e) {
  // Ne garder que les chiffres
  e.target.value = e.target.value.replace(/\D/g, '');
  
  // Limiter à 6 caractères
  if (e.target.value.length > 6) {
    e.target.value = e.target.value.slice(0, 6);
  }
});

// Validation en temps réel du mot de passe
document.getElementById('confirmPassword').addEventListener('input', function(e) {
  const password = document.getElementById('password').value;
  const confirmPassword = e.target.value;
  
  if (confirmPassword && password !== confirmPassword) {
    e.target.style.borderColor = '#ef4444';
  } else {
    e.target.style.borderColor = '#e5e7eb';
  }
});

// Animation d'entrée
document.addEventListener('DOMContentLoaded', function() {
  const container = document.querySelector('.register-container');
  container.style.opacity = '0';
  container.style.transform = 'translateY(20px)';
  
  setTimeout(() => {
    container.style.transition = 'all 0.6s ease';
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  }, 100);
});