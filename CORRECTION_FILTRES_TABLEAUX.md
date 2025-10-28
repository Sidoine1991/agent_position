# Correction des filtres sur tous les tableaux

## Problème identifié

Les filtres par projet, agent ou superviseur n'étaient pas appliqués de manière cohérente sur tous les tableaux de la page rapports :
- ❌ **Tableau récapitulatif mensuel** : N'affichait pas que les agents du projet filtré
- ❌ **Tableau de planification** : N'affichait pas que les agents du projet filtré
- ✅ **Tableau de validation** : Fonctionnait correctement

## Solution implémentée

### 1. Fonction `getSelectedFilters()` centralisée

Création d'une fonction qui récupère TOUS les filtres de manière cohérente :

```javascript
function getSelectedFilters() {
  return {
    dateRange: document.getElementById('date-range')?.value || 'today',
    preciseDate: document.getElementById('date-filter')?.value || '',
    agentId: document.getElementById('agent-filter')?.value || 'all',
    project: document.getElementById('project-filter')?.value || 'all',
    department: document.getElementById('department-filter')?.value || 'all',
    commune: document.getElementById('commune-filter')?.value || 'all',
    supervisorId: document.getElementById('supervisor-filter')?.value || 'all'
  };
}
```

### 2. Application cohérente des filtres

#### Dans `updatePresenceSummary()` (récapitulatif mensuel)
```javascript
// Utilise maintenant getSelectedFilters() pour la cohérence
const filters = getSelectedFilters();
const projectFilter = filters.project;
const departementFilter = filters.department;
const communeFilter = filters.commune;
const agentFilter = filters.agentId;
const supervisorFilter = filters.supervisorId;

// Les filtres sont ensuite appliqués lors du traitement des données
if (agentFilter && agentFilter !== 'all' && String(agentId) !== String(agentFilter)) return;
if (supervisorFilter && supervisorFilter !== 'all' && ...) return;
if (projectFilter && projectFilter !== 'all' && presenceProject !== projectFilter) return;
// etc.
```

#### Dans `loadUsersPlanning()` (tableau de planification)
```javascript
// Récupère les filtres
const filters = getSelectedFilters();

// Applique le filtre projet
if (filters.project && filters.project !== 'all') {
  const userProject = user.project_name || user.projet || '';
  const cleanedUserProject = cleanProjectName(userProject);
  const cleanedFilterProject = cleanProjectName(filters.project);
  if (cleanedUserProject?.toLowerCase() !== cleanedFilterProject?.toLowerCase()) {
    return false;
  }
}

// Applique le filtre agent
if (filters.agentId && filters.agentId !== 'all' && user.id != filters.agentId) {
  return false;
}

// Applique le filtre superviseur
if (filters.supervisorId && filters.supervisorId !== 'all') {
  const userSupervisorId = user.supervisor_id || user.supervisor || '';
  if (String(userSupervisorId) !== String(filters.supervisorId)) {
    return false;
  }
}
```

### 3. Mise à jour automatique

Les deux fonctions se mettent à jour automatiquement quand les filtres changent grâce aux événements attachés :

```javascript
// Tous les filtres déclenchent la mise à jour
const filterElements = [
  document.getElementById('month-selector'),
  document.getElementById('year-selector'),
  document.getElementById('project-filter'),
  document.getElementById('department-filter'),
  document.getElementById('commune-filter'),
  document.getElementById('agent-filter'),
  document.getElementById('supervisor-filter')
];

filterElements.forEach(element => {
  element?.addEventListener('change', updatePresenceSummary);
});
```

## Comportement attendu

### Filtre par Projet
Quand un projet est sélectionné, **tous les tableaux** affichent uniquement :
- ✅ Agents du projet sélectionné
- ✅ Planifications du projet sélectionné
- ✅ Validations du projet sélectionné
- ✅ Récapitulatif mensuel du projet sélectionné

### Filtre par Agent
Quand un agent est sélectionné, **tous les tableaux** affichent uniquement :
- ✅ Les données de cet agent spécifique
- ✅ Pas de données d'autres agents

### Filtre par Superviseur
Quand un superviseur est sélectionné, **tous les tableaux** affichent uniquement :
- ✅ Les agents supervisés par ce superviseur
- ✅ Les planifications de ces agents
- ✅ Les validations de ces agents
- ✅ Le récapitulatif mensuel de ces agents

## Vérification

Pour vérifier que les filtres fonctionnent :

1. **Sélectionner un projet** dans le filtre
2. Vérifier que **tous les tableaux** ne montrent que les agents du projet
3. **Sélectionner un agent** spécifique
4. Vérifier que **tous les tableaux** ne montrent que cet agent
5. **Sélectionner un superviseur**
6. Vérifier que **tous les tableaux** ne montrent que les agents supervisés

## Logs de debug

Dans la console, vous verrez :
```
🔍 Filtres actifs pour le récapitulatif mensuel: { 
  projectFilter: "Projet Riz", 
  agentFilter: "all",
  ...
}
📍 Source des filtres: getSelectedFilters()
```

Ces logs permettent de vérifier que les bons filtres sont appliqués.

