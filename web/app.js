const apiBase = '/api';
let jwt = localStorage.getItem('jwt') || '';
let currentMissionId = null;
let currentCalendarDate = new Date();
let presenceData = {};

function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

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
      e => reject(e), 
      { 
        enableHighAccuracy: false, // Moins strict pour plus de flexibilité
        timeout: 30000, // Plus de temps pour obtenir la position
        maximumAge: 600000 // 10 minutes de cache
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
      if (typeof initGeoSelectors === 'function') {
        console.log('🌍 Initialisation des sélecteurs géographiques après connexion...');
        initGeoSelectors();
      } else {
        console.error('❌ initGeoSelectors non disponible');
      }
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

  window.showRegisterForm = () => {
    $('login-form-container').style.display = 'none';
    $('register-form-container').style.display = 'block';
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.auth-tab[onclick="showRegisterForm()"]').classList.add('active');
  };

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
      jwt = data.token; localStorage.setItem('jwt', jwt);
      alert('Compte créé avec succès ! Vous êtes maintenant connecté.');
      hide(authSection); show(appSection);
      await loadAgentProfile();
      await updateNavbar();
    } catch (e) { 
      alert('Échec de la création du compte: ' + (e.message || 'Erreur inconnue'));
    }
    });
  }

  $('start-mission').onclick = async () => {
    const status = $('status');
    try {
      // Valider les champs géographiques requis
      if (!validateGeoFields()) {
        return;
      }
      
      status.textContent = 'Récupération GPS...';
      const coords = await getCurrentLocationWithValidation();
      
      // Obtenir les valeurs géographiques (select ou manuel)
      const departement = getGeoValue('departement');
      const commune = getGeoValue('commune');
      const arrondissement = getGeoValue('arrondissement');
      const village = getGeoValue('village');
      
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

      status.textContent = 'Envoi...';
      const res = await fetch(apiBase + '/presence/start', { method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      currentMissionId = data.mission_id;
      $('end-mission').disabled = false;
      $('checkin-btn').disabled = false;
      status.textContent = 'Présence (début) enregistrée';
      await refreshCheckins();
      await loadPresenceData(); // Mettre à jour le calendrier
    } catch (e) {
      console.error('Presence start error:', e);
      status.textContent = 'Erreur début présence';
      alert('Échec début présence: ' + (e.message || 'Erreur inconnue'));
    }
  };

  $('end-mission').onclick = async () => {
    const status = $('status');
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
      const res = await fetch(apiBase + '/presence/end', { method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body: fd });
      if (!res.ok) throw new Error(await res.text());
      await res.json();

      $('end-mission').disabled = true;
      $('checkin-btn').disabled = true;
      currentMissionId = null;
      $('checkins').innerHTML = '';
      status.textContent = 'Présence (fin) enregistrée';
      await loadPresenceData(); // Mettre à jour le calendrier
    } catch (e) {
      console.error('Presence end error:', e);
      alert('Échec fin présence: ' + (e.message || 'Erreur inconnue'));
    }
  };

  $('checkin-btn').onclick = async () => {
    if (!currentMissionId) { alert('Démarrer une mission d\'abord'); return; }
    const status = $('status');
    status.textContent = 'Récupération GPS...';
    try {
      const coords = await getCurrentLocationWithValidation();
      const fd = new FormData();
      fd.set('mission_id', String(currentMissionId));
      fd.set('lat', String(coords.latitude));
      fd.set('lon', String(coords.longitude));
      fd.set('note', $('note').value || '');
      const file = $('photo').files[0];
      if (file) fd.set('photo', file);
      status.textContent = 'Envoi...';
      await fetch(apiBase + '/mission/checkin', { method: 'POST', headers: { Authorization: 'Bearer ' + jwt }, body: fd });
      status.textContent = 'Check-in envoyé';
      await refreshCheckins();
    } catch (e) { status.textContent = 'Erreur check-in'; }
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
}

async function refreshCheckins() {
  if (!currentMissionId) return;
  const list = $('checkins');
  list.innerHTML = '';
  const items = await api(`/mission/${currentMissionId}/checkins`);
  for (const c of items) {
    const li = document.createElement('li');
    const when = new Date(c.timestamp + 'Z').toLocaleString();
    li.textContent = `${when} → (${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}) ${c.note || ''}`;
    if (c.photo_path) {
      const img = document.createElement('img');
      img.src = c.photo_path; img.style.maxWidth = '120px'; img.style.display = 'block'; img.style.marginTop = '4px';
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
    const missions = await api('/me/missions');
    
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
    
    return coords;
  } catch (error) {
    console.error('Erreur de géolocalisation:', error);
    throw error;
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
    const missions = await api('/me/missions');
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
    let departements;
    try {
      departements = await api('/geo/departements');
      console.log('Départements chargés via API:', departements);
    } catch (apiError) {
      console.log('API non disponible, utilisation des données locales');
      departements = window.getDepartements ? window.getDepartements() : [];
    }
    
    const deptSelect = $('departement');
    deptSelect.innerHTML = '<option value="">Sélectionner un département</option>';
    departements.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      deptSelect.appendChild(opt);
    });
  } catch (error) {
    console.error('Erreur chargement départements:', error);
  }
}

async function loadCommunes(departementId) {
  try {
    let communes;
    try {
      communes = await api(`/geo/communes/${departementId}`);
      console.log('Communes chargées via API:', communes);
    } catch (apiError) {
      console.log('API non disponible, utilisation des données locales');
      communes = window.getCommunes ? window.getCommunes(departementId) : [];
    }
    
    const communeSelect = $('commune');
    communeSelect.innerHTML = '<option value="">Sélectionner une commune</option>';
    communes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      communeSelect.appendChild(opt);
    });
    
    // Réinitialiser les niveaux suivants
    $('arrondissement').innerHTML = '<option value="">Sélectionner un arrondissement</option>';
    $('village').innerHTML = '<option value="">Sélectionner un village</option>';
  } catch (error) {
    console.error('Erreur chargement communes:', error);
  }
}

async function loadArrondissements(communeId) {
  try {
    let arrondissements;
    try {
      arrondissements = await api(`/geo/arrondissements/${communeId}`);
      console.log('Arrondissements chargés via API:', arrondissements);
    } catch (apiError) {
      console.log('API non disponible, utilisation des données locales');
      arrondissements = window.getArrondissements ? window.getArrondissements(communeId) : [];
    }
    
    const arrSelect = $('arrondissement');
    arrSelect.innerHTML = '<option value="">Sélectionner un arrondissement</option>';
    arrondissements.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      arrSelect.appendChild(opt);
    });
    
    // Réinitialiser le niveau suivant
    $('village').innerHTML = '<option value="">Sélectionner un village</option>';
  } catch (error) {
    console.error('Erreur chargement arrondissements:', error);
  }
}

async function loadVillages(arrondissementId) {
  try {
    let villages;
    try {
      villages = await api(`/geo/villages/${arrondissementId}`);
      console.log('Villages chargés via API:', villages);
    } catch (apiError) {
      console.log('API non disponible, utilisation des données locales');
      villages = window.getVillages ? window.getVillages(arrondissementId) : [];
    }
    
    const villageSelect = $('village');
    villageSelect.innerHTML = '<option value="">Sélectionner un village</option>';
    villages.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      villageSelect.appendChild(opt);
    });
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

// Initialiser la saisie manuelle au chargement
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    setupManualGeoInputs();
  }, 1000);
});

// Exposer les fonctions globalement
window.getGeoValue = getGeoValue;
window.validateGeoFields = validateGeoFields;
window.setupManualGeoInputs = setupManualGeoInputs;


