document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('projects-tbody');
  function setRow(text) {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="2" class="text-muted">${text}</td></tr>`;
  }

  try {
    const res = await fetch('/api/admin/agents', {
      headers: {
        'Authorization': localStorage.getItem('jwt') ? ('Bearer ' + localStorage.getItem('jwt')) : ''
      }
    });
    if (!res.ok) {
      setRow('Accès refusé ou indisponible');
      return;
    }
    const data = await res.json();
    const users = data.agents || data.data || [];
    const counts = new Map();

    (Array.isArray(users) ? users : []).forEach(u => {
      const role = (u.role || '').toLowerCase();
      if (role !== 'agent') return; // on compte les agents uniquement
      const name = (u.project_name || '').trim() || '—';
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    if (counts.size === 0) {
      setRow('Aucun projet trouvé');
      return;
    }

    const rows = Array.from(counts.entries())
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([name, n]) => `<tr><td>${name}</td><td>${n}</td></tr>`)
      .join('');
    tbody.innerHTML = rows;
  } catch (e) {
    console.warn('Erreur synthèse projets:', e);
    setRow('Erreur lors du chargement');
  }
});
