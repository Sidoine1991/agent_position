# Guide de Débogage - Problème de Mise à Jour du Profil

## Problème
Les modifications dans la page profile ne se mettent pas à jour dans la table `users`.

## Solution de Débogage

### 1. Vérifier l'Authentification
Ouvrez la console du navigateur (F12) et tapez :
```javascript
checkJWT()
```
- Si `false` : L'utilisateur n'est pas authentifié ou le token a expiré
- Si `true` : L'authentification est OK

### 2. Tester l'API Directement
Dans la console du navigateur, tapez :
```javascript
testProfileAPI()
```
- Cela va tester l'API `/api/me/profile` avec des données de test
- Regardez les logs pour voir si l'API fonctionne

### 3. Vérifier les Logs du Serveur
Regardez les logs du serveur dans le terminal :
- Vous devriez voir : `✅ Profil utilisateur mis à jour dans la table users: [ID]`
- Si vous ne voyez pas ce message, l'API n'est pas appelée

### 4. Vérifier les Appels API
Dans la console du navigateur, vous devriez voir :
- `🔍 API call: /api/me/profile` quand vous modifiez un champ
- `📡 API response: 200` si l'appel réussit
- `💾 Sauvegarde [champ]: [valeur]` quand vous sauvegardez

### 5. Problèmes Possibles

#### A. Token JWT Expiré
**Symptôme** : `checkJWT()` retourne `false`
**Solution** : Se reconnecter

#### B. API Non Appelée
**Symptôme** : Pas de logs `🔍 API call` dans la console
**Solution** : Vérifier que les boutons "Enregistrer" sont bien cliqués

#### C. Erreur 401/403
**Symptôme** : `📡 API response: 401` ou `403`
**Solution** : Token JWT invalide, se reconnecter

#### D. Erreur 500
**Symptôme** : `📡 API response: 500`
**Solution** : Problème serveur, vérifier les logs du serveur

### 6. Test Manuel
1. Allez sur `http://localhost:3010/profile.html`
2. Ouvrez la console (F12)
3. Modifiez un champ (ex: téléphone)
4. Cliquez sur "Enregistrer"
5. Vérifiez les logs dans la console
6. Vérifiez les logs du serveur

### 7. Vérification Finale
Après une modification, vérifiez dans la base de données :
```sql
SELECT id, name, phone, departement, commune, arrondissement, village, project_name 
FROM users 
WHERE id = [VOTRE_ID];
```

## Logs Attendus

### Console Navigateur (Succès)
```
🔍 API call: /api/me/profile {method: "POST", headers: {...}, body: {...}}
🔑 JWT token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
📡 API response: 200 OK
💾 Sauvegarde phone: +229123456789
✅ phone mis à jour: {success: true, user: {...}}
```

### Serveur (Succès)
```
✅ Profil utilisateur mis à jour dans la table users: [ID]
```

## Si le Problème Persiste

1. **Vérifiez que le serveur utilise la bonne version** :
   - Redémarrez le serveur : `npm start`
   - Vérifiez que les logs montrent la nouvelle version

2. **Vérifiez la base de données** :
   - Connectez-vous à Supabase
   - Vérifiez que la table `users` est bien mise à jour

3. **Testez avec un autre utilisateur** :
   - Créez un nouveau compte
   - Testez la modification du profil

4. **Vérifiez les permissions** :
   - L'utilisateur doit être authentifié
   - Le token JWT doit être valide
   - L'endpoint doit être accessible
