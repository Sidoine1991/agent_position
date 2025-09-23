// Reports page logic for Presence CCRB
// Initializes filters, generates mock report data, supports export and saved report actions

(function initializeReportsPage() {
  if (typeof window === 'undefined') {
    return;
  }

  const byId = (id) => document.getElementById(id);

  const elements = {
    reportResults: byId('report-results'),
    reportTitle: byId('report-title'),
    reportPeriod: byId('report-period'),
    generatedDate: byId('generated-date'),
    totalAgents: byId('total-agents'),
    presentAgents: byId('present-agents'),
    absentAgents: byId('absent-agents'),
    attendanceRate: byId('attendance-rate'),
    tableBody: byId('report-table-body'),
    reportType: byId('report-type'),
    dateRange: byId('date-range'),
    startDate: byId('start-date'),
    endDate: byId('end-date'),
    agentFilter: byId('agent-filter'),
    customDateGroupStart: byId('custom-date-group'),
    customDateGroupEnd: byId('custom-date-group-end'),
    profileLink: byId('profile-link'),
    dashboardLink: byId('dashboard-link'),
    agentsLink: byId('agents-link'),
    adminLink: byId('admin-link'),
    navbarUser: byId('navbar-user'),
    userInfo: byId('user-info')
  };

  let charts = {
    line: null,
    pie: null
  };

  async function api(path, options = {}) {
    const headers = options.headers || {};
    headers['Accept'] = 'application/json';
    const token = localStorage.getItem('jwt');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const fetchOptions = { method: options.method || 'GET', headers };
    if (options.body) fetchOptions.body = options.body;
    const res = await fetch(`/api${path}`, fetchOptions);
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
  }

  function getNowFormatted() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  function setReportTitleFromType() {
    const type = elements.reportType?.value || 'presence';
    const map = {
      presence: 'Rapport de Présence',
      activity: "Rapport d'Activité",
      performance: 'Rapport de Performance',
      summary: 'Résumé Exécutif'
    };
    if (elements.reportTitle) {
      elements.reportTitle.textContent = map[type] || 'Rapport';
    }
  }

  function computePeriodLabel() {
    const range = elements.dateRange?.value || 'today';
    const start = elements.startDate?.value;
    const end = elements.endDate?.value;
    switch (range) {
      case 'today':
        return "Période: Aujourd'hui";
      case 'week':
        return 'Période: Cette semaine';
      case 'month':
        return 'Période: Ce mois';
      case 'quarter':
        return 'Période: Ce trimestre';
      case 'year':
        return 'Période: Cette année';
      case 'custom':
        if (start && end) {
          return `Période: du ${formatDateISOToFR(start)} au ${formatDateISOToFR(end)}`;
        }
        return 'Période: personnalisée';
      default:
        return 'Période';
    }
  }

  function formatDateISOToFR(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function showOrHideCustomDates() {
    const isCustom = elements.dateRange?.value === 'custom';
    if (elements.customDateGroupStart) {
      elements.customDateGroupStart.style.display = isCustom ? '' : 'none';
    }
    if (elements.customDateGroupEnd) {
      elements.customDateGroupEnd.style.display = isCustom ? '' : 'none';
    }
  }

  function generateMockRows(count) {
    const names = [
      'Admin Principal',
      'Superviseur Principal',
      'Agent Test',
      'Agent 1',
      'Agent 2'
    ];
    const roles = ['Admin', 'Superviseur', 'Agent'];
    const rows = [];
    for (let i = 0; i < count; i += 1) {
      const name = names[i % names.length];
      const role = roles[i % roles.length];
      const present = Math.random() > 0.2;
      const arrivalHour = 8 + Math.floor(Math.random() * 2);
      const arrivalMin = Math.floor(Math.random() * 60);
      const departureHour = present ? 16 + Math.floor(Math.random() * 2) : null;
      const departureMin = present ? Math.floor(Math.random() * 60) : null;
      const durationH = present ? (departureHour - arrivalHour) : 0;
      rows.push({
        name,
        role,
        status: present ? 'Présent' : 'Absent',
        arrival: present ? `${String(arrivalHour).padStart(2, '0')}:${String(arrivalMin).padStart(2, '0')}` : '-',
        departure: present && departureHour !== null ? `${String(departureHour).padStart(2, '0')}:${String(departureMin).padStart(2, '0')}` : '-',
        duration: present ? `${durationH}h` : '-',
        location: present ? 'Siège Cotonou' : '-'
      });
    }
    return rows;
  }

  function renderTable(rows) {
    if (!elements.tableBody) return;
    elements.tableBody.innerHTML = '';
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.role}</td>
        <td>${r.status}</td>
        <td>${r.arrival}</td>
        <td>${r.departure}</td>
        <td>${r.duration}</td>
        <td>${r.location}</td>
      `;
      elements.tableBody.appendChild(tr);
    });
  }

  function destroyChartsIfAny() {
    if (charts.line) {
      charts.line.destroy();
      charts.line = null;
    }
    if (charts.pie) {
      charts.pie.destroy();
      charts.pie = null;
    }
  }

  function buildLineChartData(rows) {
    // Build a simple timeline with hours 8-17 and count of presents
    const labels = Array.from({ length: 10 }, (_, i) => `${8 + i}h`);
    const values = labels.map((label) => {
      const hour = 8 + labels.indexOf(label);
      return rows.filter((r) => {
        if (r.status !== 'Présent') return false;
        if (r.arrival === '-' || r.departure === '-') return false;
        const aH = Number(r.arrival.split(':')[0]);
        const dH = Number(r.departure.split(':')[0]);
        return hour >= aH && hour <= dH;
      }).length;
    });
    return { labels, values };
  }

  function buildRolePieData(rows) {
    const roles = ['Admin', 'Superviseur', 'Agent'];
    const counts = roles.map((role) => rows.filter((r) => r.role === role).length);
    return { labels: roles, values: counts };
  }

  function renderCharts(rows) {
    const lineCanvas = document.getElementById('presence-line-chart');
    const pieCanvas = document.getElementById('role-pie-chart');
    if (!lineCanvas || !pieCanvas || typeof Chart === 'undefined') {
      return;
    }
    destroyChartsIfAny();

    const lineData = buildLineChartData(rows);
    charts.line = new Chart(lineCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: lineData.labels,
        datasets: [{
          label: 'Présents par heure',
          data: lineData.values,
          fill: false,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.2)',
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, precision: 0 } }
      }
    });

    const pieData = buildRolePieData(rows);
    charts.pie = new Chart(pieCanvas.getContext('2d'), {
      type: 'pie',
      data: {
        labels: pieData.labels,
        datasets: [{
          label: 'Répartition par rôle',
          data: pieData.values,
          backgroundColor: ['#34d399', '#f59e0b', '#60a5fa']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } }
      }
    });
  }

  function generateMetrics(rows) {
    const total = rows.length;
    const present = rows.filter((r) => r.status === 'Présent').length;
    const absent = total - present;
    const rate = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, absent, rate };
  }

  function updateMetricsDisplay(metrics) {
    if (elements.totalAgents) elements.totalAgents.textContent = String(metrics.total);
    if (elements.presentAgents) elements.presentAgents.textContent = String(metrics.present);
    if (elements.absentAgents) elements.absentAgents.textContent = String(metrics.absent);
    if (elements.attendanceRate) elements.attendanceRate.textContent = `${metrics.rate}%`;
  }

  function getFilteredCountByAgentSelection() {
    const val = elements.agentFilter?.value || 'all';
    if (val === 'all') return 5;
    return 1;
  }

  function mapMissionsToRows(missions) {
    return missions.map((m) => {
      const name = m.agent_name || 'Moi';
      const role = m.agent_role || 'Agent';
      const present = m.status === 'completed' || m.status === 'active';
      const arrival = m.start_time ? new Date(m.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
      const departure = m.end_time ? new Date(m.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-';
      let duration = '-';
      if (m.start_time && m.end_time) {
        const start = new Date(m.start_time);
        const end = new Date(m.end_time);
        const diffH = Math.max(0, Math.round((end - start) / 36e5));
        duration = `${diffH}h`;
      }
      const location = [m.departement, m.commune].filter(Boolean).join(' / ') || '-';
      return {
        name,
        role,
        status: present ? 'Présent' : 'Absent',
        arrival,
        departure,
        duration,
        location
      };
    });
  }

  // Public API attached to window for inline handlers in HTML
  window.updateReportFilters = function updateReportFilters() {
    setReportTitleFromType();
  };

  window.updateDateInputs = function updateDateInputs() {
    showOrHideCustomDates();
    if (elements.reportPeriod) {
      elements.reportPeriod.textContent = computePeriodLabel();
    }
  };

  window.generateReport = async function generateReport() {
    if (elements.generatedDate) {
      elements.generatedDate.textContent = getNowFormatted();
    }
    if (elements.reportPeriod) {
      elements.reportPeriod.textContent = computePeriodLabel();
    }
    setReportTitleFromType();

    let rows = [];
    try {
      const agentVal = elements.agentFilter?.value || 'all';
      // For now: fetch only current user's missions
      const data = await api('/me/missions');
      const missions = Array.isArray(data) ? data : (data.missions || []);
      // Optional: filter by agent if your API supports it in future
      rows = mapMissionsToRows(missions);
      if (rows.length === 0) {
        // fallback mock if none
        rows = generateMockRows(getFilteredCountByAgentSelection());
      }
    } catch (e) {
      // Offline or error: fallback to mocks
      rows = generateMockRows(getFilteredCountByAgentSelection());
    }

    renderTable(rows);
    updateMetricsDisplay(generateMetrics(rows));
    renderCharts(rows);

    if (elements.reportResults) {
      elements.reportResults.style.display = '';
    }
  };

  window.exportReport = function exportReport() {
    // Export current table to CSV
    const table = elements.tableBody?.closest('table');
    if (!table) {
      alert('Aucun rapport à exporter. Veuillez générer un rapport d\'abord.');
      return;
    }
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows
      .map((tr) => Array.from(tr.querySelectorAll('th,td'))
        .map((cell) => `"${(cell.textContent || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const title = (elements.reportTitle?.textContent || 'rapport').toLowerCase().replace(/\s+/g, '-');
    a.download = `${title}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.printReport = function printReport() {
    // Use browser print dialog (user can save as PDF)
    window.print();
  };

  window.viewSavedReport = function viewSavedReport(id) {
    // For now, just generate a mock report and show it
    window.generateReport();
    // Optionally, adjust title to indicate saved report
    if (elements.reportTitle) {
      elements.reportTitle.textContent = `${elements.reportTitle.textContent} (Sauvegardé #${id})`;
    }
  };

  window.downloadSavedReport = function downloadSavedReport(id) {
    // Produce a simple CSV placeholder
    const blob = new Blob([
      'Titre,Note\n' +
      `Rapport sauvegardé #${id},Exemple\n`
    ], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-sauvegarde-${id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.deleteSavedReport = function deleteSavedReport(id) {
    const confirmDelete = confirm('Supprimer ce rapport sauvegardé ?');
    if (!confirmDelete) return;
    const items = document.querySelectorAll('.saved-report-item');
    const index = Number(id) - 1;
    if (items[index]) {
      items[index].remove();
    }
  };

  window.logout = function logout() {
    try {
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
    } catch (e) {
      // no-op
    }
    window.location.href = '/login.html';
  };

  function initializeNavbarUser() {
    try {
      const userName = localStorage.getItem('userName') || 'Utilisateur';
      const userRole = localStorage.getItem('userRole') || 'agent';
      if (elements.userInfo) {
        elements.userInfo.textContent = `${userName} (${userRole})`;
      }
      if (elements.navbarUser) {
        elements.navbarUser.style.display = '';
      }
      if (elements.profileLink) {
        elements.profileLink.style.display = '';
      }
      const isSupervisor = userRole === 'superviseur' || userRole === 'admin';
      if (elements.dashboardLink) {
        elements.dashboardLink.style.display = isSupervisor ? '' : 'none';
      }
      if (elements.agentsLink) {
        elements.agentsLink.style.display = isSupervisor ? '' : 'none';
      }
      if (elements.adminLink) {
        elements.adminLink.style.display = userRole === 'admin' ? '' : 'none';
      }
    } catch (e) {
      // Fail silently
    }
  }

  function attachDefaultEvents() {
    if (elements.reportType) {
      elements.reportType.addEventListener('change', window.updateReportFilters);
    }
    if (elements.dateRange) {
      elements.dateRange.addEventListener('change', window.updateDateInputs);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initializeNavbarUser();
    setReportTitleFromType();
    showOrHideCustomDates();
    if (elements.reportPeriod) {
      elements.reportPeriod.textContent = computePeriodLabel();
    }
    attachDefaultEvents();
  });
})();


