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

// Fonction utilitaire pour les requêtes API
// Configuration de l'API - utiliser Render en production sur Vercel
const apiBase = window.location.hostname === 'agent-position.vercel.app' 
    ? 'https://presence-ccrb-v2.onrender.com/api'
    : '/api';

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

// Fonction pour basculer entre les formulaires
function showForm(formType) {
  registerFormDiv.style.display = formType === 'register' ? 'block' : 'none';
  verificationFormDiv.style.display = formType === 'verification' ? 'block' : 'none';
  successContainer.style.display = formType === 'success' ? 'block' : 'none';
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
      showMessage(result.message || 'Erreur lors de l\'inscription', 'error');
    }
    
  } catch (error) {
    console.error('Erreur inscription:', error);
    showMessage('Erreur lors de l\'inscription. Veuillez réessayer.', 'error');
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