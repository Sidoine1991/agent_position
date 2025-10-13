document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('projects-tbody');
  const fromEl = document.getElementById('from');
  const toEl = document.getElementById('to');
  const btn = document.getElementById('load');

  function setRow(text) {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">${text}</td></tr>`;
  }

  function defaultDates() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1).toISOString().slice(0,10);
    const last = new Date(y, m+1, 0).toISOString().slice(0,10);
    fromEl.value = fromEl.value || first;
    toEl.value = toEl.value || last;
  }

  async function load() {
    defaultDates();
    const from = fromEl.value;
    const to = toEl.value;
    setRow('Chargement...');
    try {
      const q = new URLSearchParams({ from, to }).toString();
      const res = await fetch('/api/admin/project-summary?' + q, {
        headers: {
          'Authorization': (localStorage.getItem('jwt') ? ('Bearer ' + localStorage.getItem('jwt')) : ''),
          'Accept': 'application/json'
        }
      });
      if (!res.ok) { setRow('Accès refusé ou indisponible'); return; }
      const data = await res.json();
      const items = data.items || [];
      if (!Array.isArray(items) || items.length === 0) { setRow('Aucune donnée'); return; }
      const rows = items.map(it => `
        <tr>
          <td>${it.project_name}</td>
          <td>${it.agent_count}</td>
          <td>${it.planned_days}</td>
          <td>${it.present_days}</td>
          <td>${it.missions_count}</td>
          <td>${it.checkins_count}</td>
        </tr>
      `).join('');
      tbody.innerHTML = rows;
    } catch (e) {
      console.warn('Erreur project summary:', e);
      setRow('Erreur lors du chargement');
    }
  }

  btn?.addEventListener('click', load);
  load();
});
