const apiBase = '/api';
let jwt = localStorage.getItem('jwt') || '';
let currentMissionId = null;
let currentCalendarDate = new Date();
let presenceData = {};

function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// Fonctions d'animation et d'effets visuels
function addLoadingState(element, text = 'Chargement...') {
  if (!element) return;
  
  element.classList.add('btn-loading');
  element.disabled = true;
  element.setAttribute('data-original-text', element.textContent);
  element.textContent = text;
}

function removeLoadingState(element) {
  if (!element) return;
  
  element.classList.remove('btn-loading');
  element.disabled = false;
  const originalText = element.getAttribute('data-original-text');
  if (originalText) {
    element.textContent = originalText;
    element.removeAttribute('data-original-text');
  }
}

function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function createRippleEffect(event) {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  const ripple = document.createElement('span');
  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    transform: scale(0);
    animation: ripple 0.6s linear;
    pointer-events: none;
  `;
  
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

function animateElement(element, animation, duration = 300) {
  element.style.animation = `${animation} ${duration}ms ease-out`;
  setTimeout(() => {
    element.style.animation = '';
  }, duration);
}

function addScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeIn 0.6s ease-out';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.card, .form-group, .list-item').forEach(el => {
    observer.observe(el);
  });
}

// Variables globales pour le carousel
let currentSlideIndex = 0;
let slideInterval;
const totalSlides = 5;

// Fonctions du carousel
function showSlide(index) {
  const slides = document.querySelectorAll('.carousel-slide');
  const indicators = document.querySelectorAll('.indicator');
  const slidesContainer = document.querySelector('.carousel-slides');
  
  // Ajouter la classe de transition
  if (slidesContainer) {
    slidesContainer.classList.add('transitioning');
  }
  
  // Masquer toutes les slides
  slides.forEach(slide => slide.classList.remove('active'));
  indicators.forEach(indicator => indicator.classList.remove('active'));
  
  // Afficher la slide courante
  if (slides[index]) {
    slides[index].classList.add('active');
  }
  if (indicators[index]) {
    indicators[index].classList.add('active');
  }
  
  // Animer la transition
  if (slidesContainer) {
    slidesContainer.style.transform = `translateX(-${index * 20}%)`;
    
    // Retirer la classe de transition après l'animation
    setTimeout(() => {
      slidesContainer.classList.remove('transitioning');
    }, 800);
  }
  
  // Ajouter un effet de particules pour la slide active
  if (slides[index]) {
    animateElement(slides[index], 'scaleIn', 300);
  }
}

function changeSlide(direction) {
  currentSlideIndex += direction;
  
  if (currentSlideIndex >= totalSlides) {
    currentSlideIndex = 0;
  } else if (currentSlideIndex < 0) {
    currentSlideIndex = totalSlides - 1;
  }
  
  showSlide(currentSlideIndex);
  resetSlideInterval();
}

function currentSlide(index) {
  currentSlideIndex = index - 1;
  showSlide(currentSlideIndex);
  resetSlideInterval();
}

function nextSlide() {
  changeSlide(1);
}

function resetSlideInterval() {
  clearInterval(slideInterval);
  slideInterval = setInterval(nextSlide, 5000); // Change de slide toutes les 5 secondes
}

function preloadCarouselImages() {
  const imageUrls = [
    '/Media/PP CCRB.png',
    '/Media/siege_CCRB.png',
    '/Media/parcelle_riz.jpg',
    '/Media/paarce2_riz.png',
    '/Media/riz.png'
  ];
  
  let loadedImages = 0;
  const totalImages = imageUrls.length;
  
  // Afficher l'indicateur de chargement
  const carousel = document.getElementById('hero-carousel');
  if (carousel) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'carousel-loading';
    loadingIndicator.innerHTML = `
      <div class="carousel-loading-spinner"></div>
      <div class="carousel-loading-text">Chargement des images...</div>
    `;
    carousel.appendChild(loadingIndicator);
  }
  
  imageUrls.forEach((url, index) => {
    const img = new Image();
    img.onload = () => {
      loadedImages++;
      console.log(`Image ${index + 1} chargée: ${url}`);
      
      // Marquer l'image comme chargée dans le DOM
      const carouselImages = document.querySelectorAll('.carousel-image');
      if (carouselImages[index]) {
        carouselImages[index].classList.add('loaded');
      }
      
      // Masquer l'indicateur de chargement quand toutes les images sont chargées
      if (loadedImages === totalImages) {
        setTimeout(() => {
          const loadingIndicator = carousel?.querySelector('.carousel-loading');
          if (loadingIndicator) {
            loadingIndicator.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => loadingIndicator.remove(), 500);
          }
        }, 500);
      }
    };
    img.onerror = () => {
      console.warn(`Erreur de chargement de l'image: ${url}`);
      loadedImages++;
      
      // Masquer l'indicateur même en cas d'erreur
      if (loadedImages === totalImages) {
        const loadingIndicator = carousel?.querySelector('.carousel-loading');
        if (loadingIndicator) {
          loadingIndicator.remove();
        }
      }
    };
    img.src = url;
  });
}

function initCarousel() {
  // Précharger les images
  preloadCarouselImages();
  
  // Initialiser le carousel
  showSlide(0);
  resetSlideInterval();
  
  // Pause au survol
  const carousel = document.getElementById('hero-carousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', () => {
      clearInterval(slideInterval);
    });
    
    carousel.addEventListener('mouseleave', () => {
      resetSlideInterval();
    });
  }
  
  // Navigation au clavier
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      changeSlide(-1);
    } else if (e.key === 'ArrowRight') {
      changeSlide(1);
    }
  });
  
  // Swipe pour mobile
  let startX = 0;
  let endX = 0;
  
  carousel.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });
  
  carousel.addEventListener('touchend', (e) => {
    endX = e.changedTouches[0].clientX;
    handleSwipe();
  });
  
  function handleSwipe() {
    const threshold = 50;
    const diff = startX - endX;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        changeSlide(1); // Swipe gauche - slide suivante
      } else {
        changeSlide(-1); // Swipe droite - slide précédente
      }
    }
  }
}

async function api(path, opts={}) {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
  
  console.log('API call:', apiBase + path, { method: opts.method || 'GET', headers, body: opts.body });
  
  const res = await fetch(apiBase + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  
  console.log('API response:', res.status, res.statusText);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('API error:', errorText);
    throw new Error(errorText || res.statusText);
  }
  
  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json') ? await res.json() : await res.text();
  console.log('API result:', result);
  return result;
}

function geoPromise() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve(p.coords), 
      e => {
        console.warn('Erreur GPS:', e);
        // En cas d'erreur, essayer avec des paramètres plus permissifs
        navigator.geolocation.getCurrentPosition(
          p => resolve(p.coords),
          e2 => reject(new Error(`GPS indisponible: ${e2.message}`)),
          { 
            enableHighAccuracy: false,
            timeout: 60000, // 60 secondes
            maximumAge: 300000 // 5 minutes de cache
          }
        );
      }, 
      { 
        enableHighAccuracy: true, // Essayer d'abord avec haute précision
        timeout: 45000, // 45 secondes
        maximumAge: 300000 // 5 minutes de cache
      }
    );
  });
}

async function init() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/service-worker.js'); } catch {}
  }
  
  // Initialiser les notifications
  await initializeNotifications();
  
  // Gérer la navbar selon l'état de connexion
  await updateNavbar();
  
  const authSection = $('auth-section');
  const appSection = $('app-section');
  if (jwt) { 
    hide(authSection); 
    show(appSection); 
    await loadAgentProfile();
    
    // Initialiser les sélecteurs géographiques
    setTimeout(() => {
      console.log('🌍 Initialisation des sélecteurs géographiques après connexion...');
      initGeoSelectorsLocal();
    }, 100);
  } else { 
    show(authSection); 
    hide(appSection); 
  }

  $('login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const email = $('email').value.trim();
      const password = $('password').value.trim();
      
      console.log('Tentative de connexion avec:', { email, password: password ? '***' : 'missing' });
      
      const data = await api('/login', { method: 'POST', body: { email, password } });
      
      console.log('Réponse de l\'API:', data);
      
      jwt = data.token; 
      localStorage.setItem('jwt', jwt);
      localStorage.setItem('loginData', JSON.stringify(data.user));
      localStorage.setItem('userProfile', JSON.stringify(data.user));
      
      hide(authSection); show(appSection);
      await loadAgentProfile();
      
      // Initialiser les sélecteurs géographiques après connexion
      setTimeout(() => {
        if (typeof initGeoSelectors === 'function') {
          console.log('🌍 Initialisation des sélecteurs géographiques après connexion...');
          initGeoSelectors();
        } else {
          console.error('❌ initGeoSelectors non disponible');
        }
      }, 100);
      
      await updateNavbar(); // Mettre à jour la navbar après connexion
    } catch (e) { 
      console.error('Erreur de connexion:', e);
      alert('Connexion échouée: ' + e.message); 
    }
  });

  // Gestion des onglets d'authentification
  window.showLoginForm = () => {
    $('login-form-container').style.display = 'block';
    $('register-form-container').style.display = 'none';
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.auth-tab[onclick="showLoginForm()"]').classList.add('active');
  };

  // Fonction showRegisterForm supprimée - redirection directe vers /register.html

  // Gestion du formulaire d'inscription
  const registerForm = $('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = $('reg-name').value.trim();
    const email = $('reg-email').value.trim();
    const password = $('reg-password').value.trim();
    const confirmPassword = $('reg-confirm-password').value.trim();
    
    if (password !== confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (password.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    try {
      const data = await api('/register', { method: 'POST', body: { name, email, password, role: 'agent' } });
      
      if (data.success) {
        alert('Code de validation envoyé par email. Veuillez vérifier votre boîte mail et utiliser le code pour activer votre compte.');
        // Rediriger vers la page de validation
        window.location.href = '/register.html';
      } else {
        alert(data.message || 'Erreur lors de l\'inscription');
      }
      await loadAgentProfile();
      await updateNavbar();
    } catch (e) { 
      alert('Échec de la création du compte: ' + (e.message || 'Erreur inconnue'));
    }
    });
  }

  $('start-mission').onclick = async () => {
    const status = $('status');
    const startBtn = $('start-mission');
    
    // Ajouter l'effet ripple
    createRippleEffect({ currentTarget: startBtn, clientX: 0, clientY: 0 });
    
    // État de chargement
    addLoadingState(startBtn, 'Récupération GPS...');
    
    try {
      // Valider les champs géographiques requis
      if (!validateGeoFields()) {
        removeLoadingState(startBtn);
        return;
      }
      
      status.textContent = 'Récupération GPS...';
      const coords = await getCurrentLocationWithValidation();
      
      // Obtenir les valeurs géographiques (select ou manuel)
      let departement = getGeoValue('departement');
      let commune = getGeoValue('commune');
      let arrondissement = getGeoValue('arrondissement');
      let village = getGeoValue('village');
      
      // Valeurs par défaut si les sélections sont vides
      if (!departement) departement = 'Littoral';
      if (!commune) commune = 'Douala';
      if (!arrondissement) arrondissement = 'Douala I';
      if (!village) village = 'Akwa';
      
      console.log('Valeurs géographiques récupérées:', { departement, commune, arrondissement, village });
      console.log('Coordonnées GPS:', coords);
      
      const startTime = $('start-time').value;
      const note = $('note').value || '';
      const file = $('photo').files[0];

      const fd = new FormData();
      fd.set('departement', departement);
      fd.set('commune', commune);
      if (arrondissement) fd.set('arrondissement', arrondissement);
      if (village) fd.set('village', village);
      fd.set('lat', String(coords.latitude));
      fd.set('lon', String(coords.longitude));
      fd.set('note', startTime ? `[DEBUT ${startTime}] ${note}` : `DEBUT ${note}`);
      if (file) fd.set('photo', file);
      
      console.log('FormData préparé:', {
        departement: fd.get('departement'),
        commune: fd.get('commune'),
        arrondissement: fd.get('arrondissement'),
        village: fd.get('village'),
        lat: fd.get('lat'),
        lon: fd.get('lon')
      });

      status.textContent = 'Envoi...';
      addLoadingState(startBtn, 'Envoi...');
      
      // Logs de diagnostic
      console.log('🔍 Diagnostic API présence:');
      console.log('- JWT disponible:', !!jwt);
      console.log('- JWT longueur:', jwt ? jwt.length : 0);
      
      // Vérifier si c'est un ancien token simple (moins de 50 caractères)
      if (jwt && jwt.length < 50) {
        console.warn('⚠️ Ancien token détecté (longueur:', jwt.length, '). Suppression du token.');
        localStorage.removeItem('jwt');
        localStorage.removeItem('loginData');
        localStorage.removeItem('userProfile');
        alert('Session expirée. Veuillez vous reconnecter.');
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        return;
      }
      
      console.log('- FormData contenu:', {
        departement: fd.get('departement'),
        commune: fd.get('commune'),
        arrondissement: fd.get('arrondissement'),
        village: fd.get('village'),
        lat: fd.get('lat'),
        lon: fd.get('lon'),
        note: fd.get('note'),
        photo: fd.get('photo') ? 'Fichier présent' : 'Aucun fichier'
      });
      
      const data = await api('/presence/start', { method: 'POST', body: fd });

      currentMissionId = data.mission_id;
      $('end-mission').disabled = false;
      $('checkin-btn').disabled = false;
      status.textContent = 'Présence (début) enregistrée';
      
      // Animation de succès
      animateElement(status, 'bounce');
      showNotification('Mission démarrée avec succès !', 'success');
      
      await refreshCheckins();
      await loadPresenceData(); // Mettre à jour le calendrier
    } catch (e) {
      console.error('Presence start error:', e);
      status.textContent = 'Erreur début présence';
      
      // Gestion d'erreur plus robuste
      let errorMessage = 'Erreur inconnue';
      if (e.message) {
        if (e.message.includes('Token d\'authentification invalide') || e.message.includes('Token d\'authentification requis')) {
          errorMessage = 'Session expirée. Veuillez vous reconnecter.';
          // Rediriger vers la page de connexion
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else if (e.message.includes('timeout')) {
          errorMessage = 'Timeout GPS: Veuillez vous déplacer vers un endroit plus ouvert';
        } else if (e.message.includes('denied')) {
          errorMessage = 'Accès GPS refusé: Autorisez la géolocalisation';
        } else if (e.message.includes('unavailable')) {
          errorMessage = 'GPS indisponible: Vérifiez vos paramètres';
        } else if (e.message.includes('<!DOCTYPE html>')) {
          errorMessage = 'Erreur serveur: Veuillez réessayer plus tard';
        } else {
          errorMessage = e.message;
        }
      }
      
      showNotification('Échec début présence: ' + errorMessage, 'error');
    } finally {
      removeLoadingState(startBtn);
    }
  };

  $('end-mission').onclick = async () => {
    const status = $('status');
    const endBtn = $('end-mission');
    
    // Ajouter l'effet ripple
    createRippleEffect({ currentTarget: endBtn, clientX: 0, clientY: 0 });
    addLoadingState(endBtn, 'Récupération GPS...');
    
    try {
      status.textContent = 'Récupération GPS...';
      const coords = await getCurrentLocationWithValidation();
      const endTime = $('end-time').value;
      const note = $('note').value || '';
      const file = $('photo').files[0];

      const fd = new FormData();
      fd.set('lat', String(coords.latitude));
      fd.set('lon', String(coords.longitude));
      fd.set('note', endTime ? `[FIN ${endTime}] ${note}` : `FIN ${note}`);
      if (file) fd.set('photo', file);

      status.textContent = 'Envoi...';
      addLoadingState(endBtn, 'Envoi...');
      
      // Logs de diagnostic
      console.log('🔍 Diagnostic API fin présence:');
      console.log('- JWT disponible:', !!jwt);
      console.log('- Mission ID:', currentMissionId);
      console.log('- FormData contenu:', {
        lat: fd.get('lat'),
        lon: fd.get('lon'),
        note: fd.get('note'),
        photo: fd.get('photo') ? 'Fichier présent' : 'Aucun fichier'
      });
      
      await api('/presence/end', { method: 'POST', body: fd });

      $('end-mission').disabled = true;
      $('checkin-btn').disabled = true;
      currentMissionId = null;
      $('checkins').innerHTML = '';
      status.textContent = 'Présence (fin) enregistrée';
      
      // Animation de succès
      animateElement(status, 'bounce');
      showNotification('Mission terminée avec succès !', 'success');
      
      await loadPresenceData(); // Mettre à jour le calendrier
    } catch (e) {
      console.error('Presence end error:', e);
      
      // Gestion d'erreur pour la fin de mission
      let errorMessage = 'Erreur inconnue';
      if (e.message) {
        if (e.message.includes('Token d\'authentification invalide') || e.message.includes('Token d\'authentification requis')) {
          errorMessage = 'Session expirée. Veuillez vous reconnecter.';
          // Rediriger vers la page de connexion
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          errorMessage = e.message;
        }
      }
      
      showNotification('Échec fin présence: ' + errorMessage, 'error');
    } finally {
      removeLoadingState(endBtn);
    }
  };

  $('checkin-btn').onclick = async () => {
    if (!currentMissionId) { 
      showNotification('Démarrer une mission d\'abord', 'error');
      return; 
    }
    
    const status = $('status');
    const checkinBtn = $('checkin-btn');
    
    // Ajouter l'effet ripple
    createRippleEffect({ currentTarget: checkinBtn, clientX: 0, clientY: 0 });
    addLoadingState(checkinBtn, 'Récupération GPS...');
    
    try {
      status.textContent = 'Récupération GPS...';
      const coords = await getCurrentLocationWithValidation();
      const fd = new FormData();
      fd.set('mission_id', String(currentMissionId));
      fd.set('lat', String(coords.latitude));
      fd.set('lon', String(coords.longitude));
      fd.set('note', $('note').value || '');
      const file = $('photo').files[0];
      if (file) fd.set('photo', file);
      
      status.textContent = 'Envoi...';
      addLoadingState(checkinBtn, 'Envoi...');
      await api('/mission/checkin', { method: 'POST', body: fd });
      
      status.textContent = 'Check-in envoyé';
      animateElement(status, 'bounce');
      showNotification('Check-in enregistré avec succès !', 'success');
      
      await refreshCheckins();
    } catch (e) { 
      status.textContent = 'Erreur check-in';
      showNotification('Erreur lors du check-in: ' + e.message, 'error');
    } finally {
      removeLoadingState(checkinBtn);
    }
  };

  // Restore current mission
  try {
    const missions = await api('/me/missions');
    const active = missions.find(m => m.status === 'active');
    if (active) {
      currentMissionId = active.id;
      $('end-mission').disabled = false;
      $('checkin-btn').disabled = false;
      await refreshCheckins();
    }
  } catch {}

  // Load geo cascade
  await loadDepartements();
  $('departement').onchange = async () => {
    const id = Number($('departement').value);
    await loadCommunes(id);
  };
  $('commune').onchange = async () => {
    const id = Number($('commune').value);
    await loadArrondissements(id);
  };
  $('arrondissement').onchange = async () => {
    const id = Number($('arrondissement').value);
    await loadVillages(id);
  };

  // Initialize calendar
  await initializeCalendar();
  await loadPresenceData();
  
  // Initialize dashboard metrics
  await loadDashboardMetrics();
  
  // Initialiser les animations de scroll
  addScrollAnimations();
  
  // Ajouter les effets ripple aux boutons
  document.querySelectorAll('button, .btn-primary, .btn-secondary').forEach(btn => {
    btn.addEventListener('click', createRippleEffect);
  });
  
  // Initialiser le carousel
  initCarousel();
}

async function refreshCheckins() {
  if (!currentMissionId) return;
  const list = $('checkins');
  list.innerHTML = '';
  const response = await api(`/missions/${currentMissionId}/checkins`);
  const items = response.checkins || [];
  
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    const li = document.createElement('li');
    li.className = 'list-item';
    li.style.animationDelay = `${i * 0.1}s`;
    
    const when = new Date(c.timestamp + 'Z').toLocaleString();
    li.innerHTML = `
      <div class="checkin-item">
        <div class="checkin-time">${when}</div>
        <div class="checkin-coords">(${c.lat.toFixed(5)}, ${c.lon.toFixed(5)})</div>
        <div class="checkin-note">${c.note || ''}</div>
      </div>
    `;
    
    if (c.photo_path) {
      const img = document.createElement('img');
      img.src = c.photo_path; 
      img.style.cssText = 'max-width: 120px; display: block; margin-top: 8px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
      li.appendChild(img);
    }
    
    list.appendChild(li);
  }
  
  // Mettre à jour le calendrier après avoir chargé les check-ins
  await loadPresenceData();
}

init();

async function loadAgentProfile() {
  try {
    const profile = await api('/profile');
    if (profile) {
      $('agent-name').textContent = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.name;
      $('agent-phone').textContent = profile.phone || '-';
      $('agent-role').textContent = profile.role || '-';
      $('agent-project').textContent = profile.project_name || '-';
      $('agent-planning').textContent = profile.planning_start_date && profile.planning_end_date 
        ? `${profile.planning_start_date} - ${profile.planning_end_date}` 
        : '-';
      $('agent-zone').textContent = profile.zone_name || '-';
      $('agent-expected-days').textContent = profile.expected_days_per_month || '-';
      
      if (profile.photo_path) {
        $('agent-avatar').src = profile.photo_path;
      }
      
      $('agent-profile').classList.remove('hidden');
    }
  } catch (e) {
    console.error('Error loading agent profile:', e);
  }
}

// Les fonctions de chargement géographique sont maintenant dans geo-data.js

// Fonction de déconnexion
function logout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    localStorage.removeItem('jwt');
    jwt = '';
    location.reload();
  }
}

// Exposer la fonction de déconnexion
if (typeof window !== 'undefined') {
  window.logout = logout;
}

// ===== FONCTIONS DU CALENDRIER =====

async function initializeCalendar() {
  const prevBtn = $('prev-month');
  const nextBtn = $('next-month');
  
  if (prevBtn) {
    prevBtn.onclick = () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendar();
    };
  }
  
  if (nextBtn) {
    nextBtn.onclick = () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendar();
    };
  }
  
  renderCalendar();
}

function renderCalendar() {
  const calendarGrid = $('calendar-grid');
  const monthYearHeader = $('current-month-year');
  
  if (!calendarGrid || !monthYearHeader) return;
  
  // Mettre à jour l'en-tête
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  
  monthYearHeader.textContent = `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
  
  // Vider la grille
  calendarGrid.innerHTML = '';
  
  // Ajouter les en-têtes des jours
  const dayHeaders = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  dayHeaders.forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'calendar-day-header';
    dayHeader.textContent = day;
    calendarGrid.appendChild(dayHeader);
  });
  
  // Obtenir le premier jour du mois et le nombre de jours
  const firstDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
  const lastDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  // Ajouter les jours du mois précédent
  const prevMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 0);
  const daysInPrevMonth = prevMonth.getDate();
  
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayElement = createDayElement(daysInPrevMonth - i, true);
    calendarGrid.appendChild(dayElement);
  }
  
  // Ajouter les jours du mois actuel
  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = createDayElement(day, false);
    calendarGrid.appendChild(dayElement);
  }
  
  // Ajouter les jours du mois suivant pour compléter la grille
  const totalCells = calendarGrid.children.length - 7; // -7 pour les en-têtes
  const remainingCells = 42 - totalCells; // 6 semaines * 7 jours = 42 cellules
  
  for (let day = 1; day <= remainingCells; day++) {
    const dayElement = createDayElement(day, true);
    calendarGrid.appendChild(dayElement);
  }
}

function createDayElement(day, isOtherMonth) {
  const dayElement = document.createElement('div');
  dayElement.className = 'calendar-day';
  dayElement.textContent = day;
  
  if (isOtherMonth) {
    dayElement.classList.add('other-month');
    return dayElement;
  }
  
  // Vérifier si c'est aujourd'hui
  const today = new Date();
  const isToday = currentCalendarDate.getFullYear() === today.getFullYear() &&
                  currentCalendarDate.getMonth() === today.getMonth() &&
                  day === today.getDate();
  
  if (isToday) {
    dayElement.classList.add('today');
  }
  
  // Vérifier le statut de présence
  const dateKey = formatDateKey(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day);
  const presenceStatus = presenceData[dateKey];
  
  if (presenceStatus) {
    switch (presenceStatus.status) {
      case 'present':
        dayElement.classList.add('present');
        break;
      case 'absent':
        dayElement.classList.add('absent');
        break;
      case 'partial':
        dayElement.classList.add('partial');
        break;
    }
  }
  
  // Ajouter l'événement de clic
  dayElement.onclick = () => handleDayClick(day, isOtherMonth);
  
  return dayElement;
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function handleDayClick(day, isOtherMonth) {
  if (isOtherMonth) return;
  
  const today = new Date();
  const clickedDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day);
  
  // Vérifier si la date est dans le futur
  if (clickedDate > today) {
    alert('Vous ne pouvez pas marquer votre présence pour une date future.');
    return;
  }
  
  // Vérifier si c'est aujourd'hui et qu'il n'y a pas de mission active
  if (clickedDate.getTime() === today.setHours(0, 0, 0, 0) && !currentMissionId) {
    alert('Pour marquer votre présence aujourd\'hui, utilisez le bouton "Marquer présence (début)" ci-dessous.');
    return;
  }
  
  // Afficher les détails de présence pour cette date
  showPresenceDetails(clickedDate);
}

function showPresenceDetails(date) {
  const dateKey = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
  const presenceInfo = presenceData[dateKey];
  
  let message = `Détails de présence pour le ${date.toLocaleDateString('fr-FR')}:\n\n`;
  
  if (presenceInfo) {
    message += `Statut: ${presenceInfo.status}\n`;
    message += `Heure de début: ${presenceInfo.startTime || 'Non définie'}\n`;
    message += `Heure de fin: ${presenceInfo.endTime || 'Non définie'}\n`;
    message += `Note: ${presenceInfo.note || 'Aucune note'}\n`;
    message += `Lieu: ${presenceInfo.location || 'Non défini'}`;
  } else {
    message += 'Aucune donnée de présence pour cette date.';
  }
  
  alert(message);
}

async function loadPresenceData() {
  try {
    // Charger les données de présence pour le mois actuel
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    
    // Simuler des données de présence (à remplacer par un appel API réel)
    // Pour l'instant, on va charger les missions existantes
    const missionsResponse = await api('/me/missions');
    const missions = missionsResponse.missions || [];
    
    // Traiter les données de présence
    presenceData = {};
    
    missions.forEach(mission => {
      if (mission.status === 'completed' && mission.start_time) {
        const startDate = new Date(mission.start_time);
        const dateKey = formatDateKey(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        
        presenceData[dateKey] = {
          status: 'present',
          startTime: mission.start_time ? new Date(mission.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
          endTime: mission.end_time ? new Date(mission.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
          note: mission.notes || '',
          location: mission.location || ''
        };
      }
    });
    
    // Re-rendre le calendrier avec les nouvelles données
    renderCalendar();
    
  } catch (error) {
    console.error('Erreur lors du chargement des données de présence:', error);
  }
}

// ===== SYSTÈME DE NOTIFICATIONS =====

async function initializeNotifications() {
  // Vérifier si les notifications sont supportées
  if (!('Notification' in window)) {
    console.log('Ce navigateur ne supporte pas les notifications');
    return;
  }

  // Demander la permission pour les notifications
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permission de notification refusée');
      return;
    }
  }

  // Programmer les rappels de présence
  schedulePresenceReminders();
}

function schedulePresenceReminders() {
  // Rappel matinal (8h00)
  scheduleReminder(8, 0, 'Rappel de présence', 'N\'oubliez pas de marquer votre présence ce matin !');
  
  // Rappel de fin de journée (17h00)
  scheduleReminder(17, 0, 'Fin de journée', 'Pensez à marquer la fin de votre présence si vous terminez votre journée.');
  
  // Rappel de check-in (12h00)
  scheduleReminder(12, 0, 'Check-in', 'N\'oubliez pas de faire un check-in si vous êtes en mission.');
}

function scheduleReminder(hour, minute, title, message) {
  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(hour, minute, 0, 0);
  
  // Si l'heure est déjà passée aujourd'hui, programmer pour demain
  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }
  
  const timeUntilReminder = reminderTime.getTime() - now.getTime();
  
  setTimeout(() => {
    showNotification(title, message);
    // Reprogrammer pour le lendemain
    scheduleReminder(hour, minute, title, message);
  }, timeUntilReminder);
}

function showNotification(title, message) {
  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body: message,
        icon: '/Media/default-avatar.png',
        tag: 'presence-reminder'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        // Scroll vers le formulaire de présence
        const presenceCard = document.querySelector('.card h2');
        if (presenceCard && presenceCard.textContent.includes('Présence terrain')) {
          presenceCard.scrollIntoView({ behavior: 'smooth' });
        }
      };

      // Auto-fermer après 5 secondes
      setTimeout(() => {
        if (notification && notification.close) {
          notification.close();
        }
      }, 5000);
    } catch (error) {
      console.warn('Erreur notification:', error);
      // Fallback: afficher une alerte simple
      alert(`${title}: ${message}`);
    }
  } else {
    // Fallback: afficher une alerte simple
    alert(`${title}: ${message}`);
  }
}

// ===== AMÉLIORATION DE LA GÉOLOCALISATION =====

async function getCurrentLocationWithValidation() {
  try {
    // Vérifier d'abord que le serveur répond
    try {
      const healthCheck = await fetch(apiBase + '/health', { 
        method: 'GET',
        timeout: 5000 
      });
      if (!healthCheck.ok) {
        throw new Error('Serveur indisponible');
      }
    } catch (serverError) {
      console.warn('Serveur non accessible:', serverError);
      // Continuer quand même pour le GPS local
    }
    
    const coords = await geoPromise();
    
    // Vérifier la précision GPS selon le paramètre choisi
    const gpsPrecision = document.getElementById('gps-precision')?.value || 'medium';
    let maxAccuracy = 1000; // Par défaut
    
    switch (gpsPrecision) {
      case 'high': maxAccuracy = 100; break;
      case 'medium': maxAccuracy = 500; break;
      case 'low': maxAccuracy = 1000; break;
      case 'any': maxAccuracy = Infinity; break;
    }
    
    if (coords.accuracy > maxAccuracy) {
      // Afficher un avertissement mais permettre la présence
      console.warn(`Précision GPS faible: ${Math.round(coords.accuracy)}m`);
      showNotification('Avertissement GPS', `Précision faible (${Math.round(coords.accuracy)}m). La présence sera enregistrée.`);
    }
    
    // Afficher les informations de localisation
    showLocationInfo(coords);
    
    // Stocker les coordonnées localement en cas de problème serveur
    localStorage.setItem('lastGPS', JSON.stringify({
      lat: coords.latitude,
      lon: coords.longitude,
      accuracy: coords.accuracy,
      timestamp: Date.now()
    }));
    
    return coords;
  } catch (error) {
    console.error('Erreur de géolocalisation:', error);
    
    // Messages d'erreur plus clairs
    let errorMessage = 'Erreur de géolocalisation';
    if (error.message.includes('timeout')) {
      errorMessage = 'Timeout GPS: Veuillez vous déplacer vers un endroit plus ouvert et réessayer';
    } else if (error.message.includes('denied')) {
      errorMessage = 'Accès GPS refusé: Veuillez autoriser la géolocalisation dans les paramètres du navigateur';
    } else if (error.message.includes('unavailable')) {
      errorMessage = 'GPS indisponible: Vérifiez que la géolocalisation est activée sur votre appareil';
    }
    
    throw new Error(errorMessage);
  }
}

function showLocationInfo(coords) {
  const status = $('status');
  const accuracy = coords.accuracy < 10 ? 'Excellente' : 
                   coords.accuracy < 50 ? 'Bonne' : 
                   coords.accuracy < 100 ? 'Moyenne' : 'Faible';
  
  status.innerHTML = `
    <div style="background: #e8f5e8; padding: 12px; border-radius: 8px; margin: 8px 0;">
      <strong>📍 Position détectée</strong><br>
      Précision: ${accuracy} (${Math.round(coords.accuracy)}m)<br>
      Coordonnées: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}
    </div>
  `;
}

// ===== TABLEAU DE BORD ET MÉTRIQUES =====

async function loadDashboardMetrics() {
  try {
    // Charger les données de présence pour le mois actuel
    const missionsResponse = await api('/me/missions');
    const missions = missionsResponse.missions || [];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Calculer les métriques
    const metrics = calculateMetrics(missions, currentMonth, currentYear);
    
    // Afficher les métriques avec animation
    displayMetrics(metrics);
    
    // Mettre à jour la position actuelle
    await updateCurrentLocation();
    
  } catch (error) {
    console.error('Erreur lors du chargement des métriques:', error);
  }
}

function calculateMetrics(missions, month, year) {
  const currentMonthMissions = missions.filter(mission => {
    if (!mission.start_time) return false;
    const missionDate = new Date(mission.start_time);
    return missionDate.getMonth() === month && missionDate.getFullYear() === year;
  });
  
  // Calculer les jours travaillés
  const uniqueDays = new Set();
  currentMonthMissions.forEach(mission => {
    if (mission.start_time) {
      const date = new Date(mission.start_time);
      uniqueDays.add(date.toDateString());
    }
  });
  
  // Calculer les heures travaillées
  let totalHours = 0;
  currentMonthMissions.forEach(mission => {
    if (mission.start_time && mission.end_time) {
      const start = new Date(mission.start_time);
      const end = new Date(mission.end_time);
      const hours = (end - start) / (1000 * 60 * 60);
      totalHours += Math.max(0, hours);
    }
  });
  
  // Calculer le taux de présence
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const attendanceRate = Math.round((uniqueDays.size / daysInMonth) * 100);
  
  return {
    daysWorked: uniqueDays.size,
    hoursWorked: Math.round(totalHours * 10) / 10,
    attendanceRate: Math.min(attendanceRate, 100)
  };
}

function displayMetrics(metrics) {
  // Animer l'affichage des métriques
  const cards = document.querySelectorAll('.metric-card');
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('animate');
    }, index * 200);
  });
  
  // Afficher les valeurs
  $('days-worked').textContent = metrics.daysWorked;
  $('hours-worked').textContent = `${metrics.hoursWorked}h`;
  $('attendance-rate').textContent = `${metrics.attendanceRate}%`;
  
  // Ajouter des couleurs selon les performances
  const attendanceRateElement = $('attendance-rate');
  if (metrics.attendanceRate >= 90) {
    attendanceRateElement.style.color = '#10b981';
  } else if (metrics.attendanceRate >= 70) {
    attendanceRateElement.style.color = '#f59e0b';
  } else {
    attendanceRateElement.style.color = '#ef4444';
  }
}

async function updateCurrentLocation() {
  try {
    const coords = await geoPromise();
    const location = await getLocationName(coords.latitude, coords.longitude);
    $('current-location').textContent = location || 'Position inconnue';
  } catch (error) {
    $('current-location').textContent = 'Non disponible';
  }
}

async function getLocationName(lat, lon) {
  try {
    // Utiliser l'API de géocodage inverse (vous pouvez remplacer par votre propre service)
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
    const data = await response.json();
    return data.locality || data.city || 'Position détectée';
  } catch (error) {
    return `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
  }
}

// Mettre à jour la navbar selon l'état de connexion et le rôle
async function updateNavbar() {
  const profileLink = $('profile-link');
  const dashboardLink = $('dashboard-link');
  const agentsLink = $('agents-link');
  const reportsLink = $('reports-link');
  const adminLink = $('admin-link');
  const navbarUser = $('navbar-user');
  const userInfo = $('user-info');
  
  if (jwt) {
    try {
      // Récupérer le profil utilisateur depuis le localStorage ou l'API
      let profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      
      // Si pas de profil en cache, essayer l'API
      if (!profile.id) {
        try {
          profile = await api('/profile');
          localStorage.setItem('userProfile', JSON.stringify(profile));
        } catch (e) {
          console.log('API profile non disponible, utilisation des données de connexion');
          // Utiliser les données de connexion stockées
          profile = JSON.parse(localStorage.getItem('loginData') || '{}');
        }
      }
      
      // Afficher le profil pour tous les utilisateurs connectés
      if (profileLink) profileLink.style.display = 'flex';
      
      // Navigation pour Admin et Superviseur
      if (profile && (profile.role === 'admin' || profile.role === 'superviseur')) {
        if (dashboardLink) dashboardLink.style.display = 'flex';
        if (agentsLink) agentsLink.style.display = 'flex';
        if (reportsLink) reportsLink.style.display = 'flex';
      } else {
        if (dashboardLink) dashboardLink.style.display = 'none';
        if (agentsLink) agentsLink.style.display = 'none';
        if (reportsLink) reportsLink.style.display = 'none';
      }
      
      // Navigation pour Admin uniquement
      if (profile && profile.role === 'admin') {
        if (adminLink) adminLink.style.display = 'flex';
      } else {
        if (adminLink) adminLink.style.display = 'none';
      }
      
      // Afficher les informations utilisateur
      if (navbarUser) navbarUser.style.display = 'flex';
      if (userInfo && profile) {
        const roleText = {
          'admin': 'Administrateur',
          'superviseur': 'Superviseur',
          'agent': 'Agent'
        };
        userInfo.textContent = `${profile.name} (${roleText[profile.role] || profile.role})`;
      }
      
      // Cacher le bouton d'inscription pour les utilisateurs connectés
      const registerLink = $('register-link');
      if (registerLink) {
        registerLink.style.display = 'none';
      }
      
      // Afficher les boutons d'accès rapide
      const quickAccess = $('quick-access');
      if (quickAccess) {
        quickAccess.style.display = 'flex';
      }
      
      // Masquer les informations d'accueil
      const welcomeInfo = $('welcome-info');
      if (welcomeInfo) {
        welcomeInfo.style.display = 'none';
      }
    } catch (e) {
      console.error('Error updating navbar:', e);
      // En cas d'erreur, cacher les éléments
      if (dashboardLink) dashboardLink.style.display = 'none';
      if (navbarUser) navbarUser.style.display = 'none';
    }
  } else {
    // Utilisateur non connecté
    if (dashboardLink) dashboardLink.style.display = 'none';
    if (navbarUser) navbarUser.style.display = 'none';
    
    // Afficher le bouton d'inscription
    const registerLink = $('register-link');
    if (registerLink) {
      registerLink.style.display = 'flex';
    }
    
    // Masquer les boutons d'accès rapide
    const quickAccess = $('quick-access');
    if (quickAccess) {
      quickAccess.style.display = 'none';
    }
    
    // Afficher les informations d'accueil
    const welcomeInfo = $('welcome-info');
    if (welcomeInfo) {
      welcomeInfo.style.display = 'block';
    }
  }
}

// Fonctions pour la saisie manuelle des unités géographiques
function setupManualGeoInputs() {
  console.log('🔧 Configuration de la saisie manuelle des unités géographiques...');
  
  // Configuration des boutons de basculement
  const geoFields = ['departement', 'commune', 'arrondissement', 'village'];
  
  geoFields.forEach(field => {
    const select = $(field);
    const manualInput = $(`${field}-manual`);
    const toggleBtn = $(`toggle-${field}`);
    
    if (select && manualInput && toggleBtn) {
      // Gestionnaire pour le bouton de basculement
      toggleBtn.addEventListener('click', () => {
        const isManual = manualInput.style.display !== 'none';
        
        if (isManual) {
          // Passer en mode sélection
          select.style.display = 'block';
          manualInput.style.display = 'none';
          toggleBtn.textContent = '✏️';
          toggleBtn.classList.remove('active');
          select.disabled = false;
        } else {
          // Passer en mode saisie manuelle
          select.style.display = 'none';
          manualInput.style.display = 'block';
          toggleBtn.textContent = '📋';
          toggleBtn.classList.add('active');
          select.disabled = true;
          manualInput.focus();
        }
      });
      
      // Synchroniser les valeurs entre select et input manuel
      select.addEventListener('change', () => {
        if (manualInput.style.display === 'none') {
          manualInput.value = select.options[select.selectedIndex]?.text || '';
        }
      });
      
      manualInput.addEventListener('input', () => {
        if (select.style.display === 'none') {
          // Trouver l'option correspondante dans le select
          const options = Array.from(select.options);
          const matchingOption = options.find(option => 
            option.text.toLowerCase().includes(manualInput.value.toLowerCase())
          );
          
          if (matchingOption) {
            select.value = matchingOption.value;
          }
        }
      });
    }
  });
}

// Fonction pour obtenir la valeur géographique (select ou manuel)
function getGeoValue(field) {
  const select = $(field);
  const manualInput = $(`${field}-manual`);
  
  if (manualInput && manualInput.style.display !== 'none' && manualInput.value.trim()) {
    return manualInput.value.trim();
  } else if (select && select.value) {
    return select.options[select.selectedIndex]?.text || select.value;
  }
  
  return '';
}

// Fonctions de chargement des données géographiques
async function loadDepartements() {
  try {
    const deptSelect = $('departement');
    if (!deptSelect) return;
    
    deptSelect.innerHTML = '<option value="">Sélectionner un département</option>';
    
    // Attendre que les données géographiques soient chargées
    if (window.loadGeoData) {
      await window.loadGeoData();
    }
    
    // Utiliser les données locales qui fonctionnent
    if (window.geoData && window.geoData.departements) {
      window.geoData.departements.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name; // Utiliser 'name' au lieu de 'nom'
        deptSelect.appendChild(opt);
      });
      console.log('✅ Départements chargés depuis les données locales:', window.geoData.departements.length);
    } else {
      console.error('❌ Données géographiques locales non disponibles');
    }
  } catch (error) {
    console.error('Erreur chargement départements:', error);
  }
}

async function loadCommunes(departementId) {
  try {
    console.log('🔍 loadCommunes appelée avec departementId:', departementId);
    const communeSelect = $('commune');
    if (!communeSelect) {
      console.error('❌ Élément commune non trouvé');
      return;
    }
    
    communeSelect.innerHTML = '<option value="">Sélectionner une commune</option>';
    
    // Attendre que les données géographiques soient chargées
    if (window.loadGeoData) {
      await window.loadGeoData();
    }
    
    console.log('🔍 Vérification de window.geoData:', !!window.geoData);
    if (window.geoData) {
      console.log('🔍 window.geoData.communes:', !!window.geoData.communes);
      console.log('🔍 Clés disponibles dans communes:', Object.keys(window.geoData.communes || {}));
      console.log('🔍 Communes pour departementId', departementId, ':', window.geoData.communes[departementId]);
    }
    
    // Utiliser les données de geo-data.js qui utilisent des IDs numériques
    if (window.geoData && window.geoData.communes && window.geoData.communes[departementId]) {
      const communes = window.geoData.communes[departementId];
      communes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        communeSelect.appendChild(opt);
      });
      console.log('✅ Communes chargées depuis geo-data.js:', communes.length, 'pour département ID:', departementId);
    } else {
      console.error('❌ Communes non disponibles pour le département ID:', departementId);
      console.log('Données disponibles:', window.geoData ? Object.keys(window.geoData.communes || {}) : 'geoData non disponible');
    }
    
    // Réinitialiser les niveaux suivants
    $('arrondissement').innerHTML = '<option value="">Sélectionner un arrondissement</option>';
    $('village').innerHTML = '<option value="">Sélectionner un village</option>';
  } catch (error) {
    console.error('Erreur chargement communes:', error);
  }
}

async function loadArrondissements(communeId) {
  try {
    const arrSelect = $('arrondissement');
    if (!arrSelect) return;
    
    arrSelect.innerHTML = '<option value="">Sélectionner un arrondissement</option>';
    
    // Utiliser les données de geo-data.js qui utilisent des IDs numériques
    if (window.geoData && window.geoData.arrondissements && window.geoData.arrondissements[communeId]) {
      const arrondissements = window.geoData.arrondissements[communeId];
      arrondissements.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        arrSelect.appendChild(opt);
      });
      console.log('✅ Arrondissements chargés depuis geo-data.js:', arrondissements.length, 'pour commune ID:', communeId);
    } else {
      console.error('❌ Arrondissements non disponibles pour la commune ID:', communeId);
      console.log('Données disponibles:', window.geoData ? Object.keys(window.geoData.arrondissements || {}) : 'geoData non disponible');
    }
    
    // Réinitialiser le niveau suivant
    $('village').innerHTML = '<option value="">Sélectionner un village</option>';
  } catch (error) {
    console.error('Erreur chargement arrondissements:', error);
  }
}

async function loadVillages(arrondissementId) {
  try {
    const villageSelect = $('village');
    if (!villageSelect) return;
    
    villageSelect.innerHTML = '<option value="">Sélectionner un village</option>';
    
    // Utiliser les données de geo-data.js qui utilisent des IDs numériques
    if (window.geoData && window.geoData.villages && window.geoData.villages[arrondissementId]) {
      const villages = window.geoData.villages[arrondissementId];
      villages.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        villageSelect.appendChild(opt);
      });
      console.log('✅ Villages chargés depuis geo-data.js:', villages.length, 'pour arrondissement ID:', arrondissementId);
    } else {
      console.error('❌ Villages non disponibles pour l\'arrondissement ID:', arrondissementId);
      console.log('Données disponibles:', window.geoData ? Object.keys(window.geoData.villages || {}) : 'geoData non disponible');
    }
  } catch (error) {
    console.error('Erreur chargement villages:', error);
  }
}

// Fonction pour valider les champs géographiques requis
function validateGeoFields() {
  const departement = getGeoValue('departement');
  const commune = getGeoValue('commune');
  
  if (!departement.trim()) {
    alert('❌ Veuillez sélectionner ou saisir un département');
    return false;
  }
  
  if (!commune.trim()) {
    alert('❌ Veuillez sélectionner ou saisir une commune');
    return false;
  }
  
  return true;
}

// Fonction d'initialisation locale des sélecteurs géographiques
function initGeoSelectorsLocal() {
  console.log('🌍 Initialisation locale des sélecteurs géographiques...');
  
  // Charger les départements
  loadDepartements();
  
  // Ajouter les événements
  const departementSelect = $('departement');
  const communeSelect = $('commune');
  const arrondissementSelect = $('arrondissement');
  
  if (departementSelect) {
    departementSelect.addEventListener('change', function() {
      loadCommunes(this.value);
    });
  }
  
  if (communeSelect) {
    communeSelect.addEventListener('change', function() {
      loadArrondissements(this.value);
    });
  }
  
  if (arrondissementSelect) {
    arrondissementSelect.addEventListener('change', function() {
      loadVillages(this.value);
    });
  }
  
  console.log('✅ Sélecteurs géographiques initialisés localement');
}

// Initialiser la saisie manuelle au chargement
document.addEventListener('DOMContentLoaded', () => {
  // Effacer la console au chargement
  console.clear();
  console.log('🚀 Application chargée - Console effacée');
  
  // Vérifier le token au chargement
  const jwt = localStorage.getItem('jwt');
  if (jwt && jwt.length < 50) {
    console.warn('⚠️ Ancien token détecté au chargement (longueur:', jwt.length, '). Suppression du token.');
    localStorage.removeItem('jwt');
    localStorage.removeItem('loginData');
    localStorage.removeItem('userProfile');
    // Ne pas forcer la reconnexion, laisser l'utilisateur naviguer normalement
  }
  
  setTimeout(() => {
    setupManualGeoInputs();
  }, 1000);
});

// Exposer les fonctions globalement
window.getGeoValue = getGeoValue;
window.validateGeoFields = validateGeoFields;
window.setupManualGeoInputs = setupManualGeoInputs;


