// Script pour l'inscription et validation par email
let currentEmail = '';

// Éléments du DOM
const registerForm = document.getElementById('registrationForm');
const verificationForm = document.getElementById('verificationForm');
const registerFormDiv = document.getElementById('register-form');
const verificationFormDiv = document.getElementById('verification-form');
const successMessageDiv = document.getElementById('success-message');
const userEmailSpan = document.getElementById('user-email');
const resendCodeBtn = document.getElementById('resend-code');
const changeEmailBtn = document.getElementById('change-email');

// Fonction utilitaire pour les requêtes API
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
  
  const response = await fetch(`/api${endpoint}`, options);
  return await response.json();
}

// Gestion de l'inscription
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(registerForm);
  const data = Object.fromEntries(formData);
  
  // Validation côté client
  if (data.password !== data.confirmPassword) {
    alert('Les mots de passe ne correspondent pas');
    return;
  }
  
  if (data.password.length < 6) {
    alert('Le mot de passe doit contenir au moins 6 caractères');
    return;
  }
  
  try {
    // Afficher un indicateur de chargement
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Envoi en cours...';
    submitBtn.disabled = true;
    
    // Envoyer la requête d'inscription
    const result = await api('/register', 'POST', {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      password: data.password
    });
    
    if (result.success) {
      // Afficher le formulaire de validation
      currentEmail = data.email;
      userEmailSpan.textContent = data.email;
      registerFormDiv.style.display = 'none';
      verificationFormDiv.style.display = 'block';
    } else {
      alert(result.message || 'Erreur lors de l\'inscription');
    }
    
  } catch (error) {
    console.error('Erreur inscription:', error);
    alert('Erreur lors de l\'inscription. Veuillez réessayer.');
  } finally {
    // Restaurer le bouton
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Gestion de la validation du code
verificationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(verificationForm);
  const code = formData.get('code');
  
  try {
    // Afficher un indicateur de chargement
    const submitBtn = verificationForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Validation...';
    submitBtn.disabled = true;
    
    // Envoyer la requête de validation
    const result = await api('/verify', 'POST', {
      email: currentEmail,
      code: code
    });
    
    if (result.success) {
      // Afficher le message de succès
      verificationFormDiv.style.display = 'none';
      successMessageDiv.style.display = 'block';
    } else {
      alert(result.message || 'Code invalide ou expiré');
    }
    
  } catch (error) {
    console.error('Erreur validation:', error);
    alert('Erreur lors de la validation. Veuillez réessayer.');
  } finally {
    // Restaurer le bouton
    const submitBtn = verificationForm.querySelector('button[type="submit"]');
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Renvoyer le code
resendCodeBtn.addEventListener('click', async () => {
  try {
    resendCodeBtn.textContent = '⏳ Renvoi...';
    resendCodeBtn.disabled = true;
    
    // Renvoyer le code (même endpoint que l'inscription)
    const result = await api('/register', 'POST', {
      email: currentEmail,
      resend: true
    });
    
    if (result.success) {
      alert('Code renvoyé par email');
    } else {
      alert(result.message || 'Erreur lors du renvoi');
    }
    
  } catch (error) {
    console.error('Erreur renvoi:', error);
    alert('Erreur lors du renvoi. Veuillez réessayer.');
  } finally {
    resendCodeBtn.textContent = '🔄 Renvoyer le code';
    resendCodeBtn.disabled = false;
  }
});

// Changer l'email
changeEmailBtn.addEventListener('click', () => {
  verificationFormDiv.style.display = 'none';
  registerFormDiv.style.display = 'block';
  registerForm.reset();
  currentEmail = '';
});

// Auto-format du code de validation
document.getElementById('verification-code').addEventListener('input', (e) => {
  // Ne garder que les chiffres
  e.target.value = e.target.value.replace(/\D/g, '');
  
  // Limiter à 6 chiffres
  if (e.target.value.length > 6) {
    e.target.value = e.target.value.slice(0, 6);
  }
});

// Validation en temps réel du mot de passe
document.getElementById('confirmPassword').addEventListener('input', (e) => {
  const password = document.getElementById('password').value;
  const confirmPassword = e.target.value;
  
  if (confirmPassword && password !== confirmPassword) {
    e.target.setCustomValidity('Les mots de passe ne correspondent pas');
  } else {
    e.target.setCustomValidity('');
  }
});
