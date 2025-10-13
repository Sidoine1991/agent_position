# 🔄 Guide de Sauvegarde et Restauration Supabase

Ce guide explique comment sauvegarder et restaurer votre base de données Supabase pour l'application Presence CCR-B.

## 📋 Prérequis

- Node.js installé
- Variables d'environnement configurées dans `.env`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 🚀 Scripts Disponibles

### 1. Test de Connexion
```bash
node test_supabase_connection.js
```
Vérifie que la connexion à Supabase fonctionne correctement.

### 2. Sauvegarde Manuelle
```bash
node backup_supabase.js
```
Crée une sauvegarde complète de toutes les tables de la base de données.

### 3. Sauvegarde Automatique
```bash
node backup_scheduler.js
```
Démarre un planificateur qui effectue des sauvegardes automatiques toutes les 24 heures.

### 4. Restauration
```bash
# Restaurer depuis un fichier spécifique
node restore_supabase.js restore backups/supabase_backup_2024-01-15.json

# Restaurer depuis la dernière sauvegarde
node restore_supabase.js restore latest

# Lister les sauvegardes disponibles
node restore_supabase.js list
```

## 📁 Structure des Sauvegardes

```
backups/
├── latest_backup.json          # Lien vers la dernière sauvegarde
├── supabase_backup_2024-01-15.json
├── supabase_backup_2024-01-16.json
└── ...
```

## 🔧 Configuration

### Intervalle de Sauvegarde
Modifiez `BACKUP_INTERVAL` dans `backup_scheduler.js`:
```javascript
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 heures
```

### Nombre de Sauvegardes Conservées
Modifiez `MAX_BACKUPS` dans `backup_scheduler.js`:
```javascript
const MAX_BACKUPS = 7; // Garder 7 sauvegardes
```

### Tables Sauvegardées
Modifiez la liste `tables` dans `backup_supabase.js`:
```javascript
const tables = [
  'users',
  'planifications',
  'missions',
  'checkins',
  'settings',
  'profiles'
];
```

## 📊 Format de Sauvegarde

Les sauvegardes sont stockées au format JSON avec la structure suivante:

```json
{
  "metadata": {
    "created_at": "2024-01-15T10:30:00.000Z",
    "supabase_url": "https://xxx.supabase.co",
    "version": "1.0.0",
    "description": "Sauvegarde complète de la base de données Presence CCR-B"
  },
  "tables": {
    "users": [...],
    "planifications": [...],
    "missions": [...],
    "checkins": [...],
    "settings": [...],
    "profiles": [...]
  }
}
```

## ⚠️ Important

### Avant la Restauration
- **ATTENTION**: La restauration remplace TOUTES les données existantes
- Assurez-vous d'avoir une sauvegarde récente avant de restaurer
- Testez d'abord sur un environnement de développement

### Sécurité
- Les sauvegardes contiennent des données sensibles
- Stockez-les dans un endroit sécurisé
- Ne partagez jamais les fichiers de sauvegarde

### Performance
- Les sauvegardes peuvent prendre du temps selon la taille des données
- La restauration peut être lente pour de gros volumes
- Planifiez les sauvegardes pendant les heures creuses

## 🔄 Processus de Récupération d'Urgence

1. **Identifier le problème**
   ```bash
   node test_supabase_connection.js
   ```

2. **Lister les sauvegardes disponibles**
   ```bash
   node restore_supabase.js list
   ```

3. **Restaurer depuis la dernière sauvegarde**
   ```bash
   node restore_supabase.js restore latest
   ```

4. **Vérifier la restauration**
   ```bash
   node test_supabase_connection.js
   ```

## 📈 Surveillance

### Logs de Sauvegarde
Les scripts affichent des logs détaillés:
- ✅ Succès
- ❌ Erreurs
- ⚠️ Avertissements
- 📊 Statistiques

### Vérification Régulière
- Vérifiez régulièrement que les sauvegardes se créent
- Testez la restauration périodiquement
- Surveillez l'espace disque du dossier `backups/`

## 🛠️ Dépannage

### Erreur de Connexion
```
❌ Variables d'environnement manquantes
```
**Solution**: Vérifiez votre fichier `.env`

### Erreur de Permissions
```
❌ Erreur lors de la sauvegarde de users: permission denied
```
**Solution**: Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` a les bonnes permissions

### Fichier de Sauvegarde Corrompu
```
❌ Fichier de sauvegarde non trouvé
```
**Solution**: Utilisez une autre sauvegarde ou créez-en une nouvelle

## 📞 Support

En cas de problème:
1. Vérifiez les logs d'erreur
2. Testez la connexion avec `test_supabase_connection.js`
3. Consultez la documentation Supabase
4. Contactez l'équipe de développement

---

**Note**: Ce système de sauvegarde est conçu pour l'application Presence CCR-B. Adaptez les tables et la configuration selon vos besoins spécifiques.
