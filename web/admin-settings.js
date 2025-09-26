// Configuration de l'API - utiliser Render en production sur Vercel
const onVercel = /\.vercel\.app$/.test(window.location.hostname) || window.location.hostname.includes('vercel.app');
const apiBase = onVercel ? 'https://presence-ccrb-v2.onrender.com/api' : '/api';
let jwt = localStorage.getItem('jwt') || '';

async function api(path, opts={}) {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
  const res = await fetch(apiBase + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined)
  });
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

function $(id){ return document.getElementById(id); }

async function loadSettings() {
  try {
    const data = await api('/admin/settings');
    const s = data.settings || {};
    $('expected_days').value = s['presence.expected_days_per_month'] ?? '';
    $('expected_hours').value = s['presence.expected_hours_per_month'] ?? '';
    $('default_departement').value = s['geo.default_departement'] ?? '';
    $('pwd_min_len').value = s['security.password_min_length'] ?? '';
    $('status').textContent = 'Paramètres chargés';
  } catch (e) {
    $('status').textContent = 'Erreur de chargement des paramètres';
  }
}

async function saveSettings() {
  try {
    const payload = {
      settings: {
        'presence.expected_days_per_month': Number($('expected_days').value) || null,
        'presence.expected_hours_per_month': Number($('expected_hours').value) || null,
        'geo.default_departement': $('default_departement').value || null,
        'security.password_min_length': Number($('pwd_min_len').value) || null
      }
    };
    await api('/admin/settings', { method: 'PUT', body: payload });
    $('status').textContent = 'Paramètres enregistrés';
  } catch (e) {
    $('status').textContent = 'Erreur lors de l\'enregistrement';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('save').onclick = saveSettings;
  $('reload').onclick = loadSettings;
  loadSettings();
});


