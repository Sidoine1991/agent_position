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
  const res = await fetch(apiBase + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

function geoPromise() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(p => resolve(p.coords), e => reject(e), { enableHighAccuracy: true, timeout: 10000 });
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
  } else { 
    show(authSection); 
    hide(appSection); 
  }

  $('login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const email = $('email').value.trim();
      const password = $('password').value.trim();
      const data = await api('/login', { method: 'POST', body: { email, password } });
      jwt = data.token; localStorage.setItem('jwt', jwt);
      hide(authSection); show(appSection);
      await loadAgentProfile();
      await updateNavbar(); // Mettre à jour la navbar après connexion
    } catch (e) { alert('Connexion échouée'); }
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
  $('register-form').addEventListener('submit', async (ev) => {
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

  $('start-mission').onclick = async () => {
    const status = $('status');
    try {
      status.textContent = 'Récupération GPS...';
      const coords = await getCurrentLocationWithValidation();
      const villageId = Number($('village').value) || undefined;
      const startTime = $('start-time').value;
      const note = $('note').value || '';
      const file = $('photo').files[0];

      const fd = new FormData();
      if (typeof villageId === 'number') fd.set('village_id', String(villageId));
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
    const profile = await api('/me/profile');
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

async function loadDepartements() {
  try {
    const dep = $('departement'); dep.innerHTML = '';
    const rows = await api('/geo/departements');
    dep.append(new Option('Département...', ''));
    for (const r of rows) dep.append(new Option(r.name, r.id));
    $('commune').disabled = true; $('arrondissement').disabled = true; $('village').disabled = true;
  } catch (e) {
    console.error('Error loading departements:', e);
    $('status').textContent = 'Erreur chargement départements';
  }
}

async function loadCommunes(departementId) {
  const com = $('commune'); com.innerHTML = '';
  if (!departementId) { $('commune').disabled = true; return; }
  const rows = await api('/geo/communes?departement_id=' + departementId);
  com.append(new Option('Commune...', ''));
  for (const r of rows) com.append(new Option(r.name, r.id));
  $('commune').disabled = false; $('arrondissement').disabled = true; $('village').disabled = true;
}

async function loadArrondissements(communeId) {
  const arr = $('arrondissement'); arr.innerHTML = '';
  if (!communeId) { $('arrondissement').disabled = true; return; }
  const rows = await api('/geo/arrondissements?commune_id=' + communeId);
  arr.append(new Option('Arrondissement...', ''));
  for (const r of rows) arr.append(new Option(r.name, r.id));
  $('arrondissement').disabled = false; $('village').disabled = true;
}

async function loadVillages(arrondissementId) {
  const vil = $('village'); vil.innerHTML = '';
  if (!arrondissementId) { $('village').disabled = true; return; }
  const rows = await api('/geo/villages?arrondissement_id=' + arrondissementId);
  vil.append(new Option('Village...', ''));
  for (const r of rows) vil.append(new Option(r.name, r.id));
  $('village').disabled = false;
}

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
    const notification = new Notification(title, {
      body: message,
      icon: '/Media/PP CCRB.png',
      badge: '/Media/PP CCRB.png',
      tag: 'presence-reminder',
      requireInteraction: true,
      actions: [
        { action: 'mark-presence', title: 'Marquer présence' },
        { action: 'dismiss', title: 'Ignorer' }
      ]
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

    // Auto-fermer après 10 secondes
    setTimeout(() => notification.close(), 10000);
  }
}

// ===== AMÉLIORATION DE LA GÉOLOCALISATION =====

async function getCurrentLocationWithValidation() {
  try {
    const coords = await geoPromise();
    
    // Vérifier la précision GPS
    if (coords.accuracy > 100) {
      throw new Error('Précision GPS insuffisante. Veuillez vous déplacer vers un endroit plus ouvert.');
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
      // Récupérer le profil utilisateur
      const profile = await api('/profile');
      
      // Afficher le profil pour tous les utilisateurs connectés
      if (profileLink) profileLink.style.display = 'flex';
      
      // Navigation pour Admin et Superviseur
      if (profile && (profile.role === 'admin' || profile.role === 'supervisor')) {
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
          'supervisor': 'Superviseur',
          'agent': 'Agent'
        };
        userInfo.textContent = `${profile.name} (${roleText[profile.role] || profile.role})`;
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
  }
}


