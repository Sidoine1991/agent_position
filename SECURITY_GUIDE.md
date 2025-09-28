# Guide de Sécurité - Presence CCRB

## ⚠️ IMPORTANT: Sécurité des Secrets

### Variables d'environnement requises pour Vercel

**NE JAMAIS COMMITER CES VALEURS DANS GIT !**

```bash
# Supabase Configuration
SUPABASE_URL=https://eoamsmtdspedumjmmeui.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjcyMzksImV4cCI6MjA3NDYwMzIzOX0.5F1uBbPfMYNlGgFJI20jexPf_XmPLiEOEtCTO_zZDcw
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y
SUPABASE_JWT_SECRET=wineLDVtm0QzgEUg57/bJFMCdWjrjdwYi0Y5dg9BaF2mQlpE6gL6XgCQNtDB2yAry7hY4R9vL6RXtD3Sqjc7NA==

# JWT Secret (générer une nouvelle clé)
JWT_SECRET=your-super-secret-jwt-key-here

# CORS Origin
CORS_ORIGIN=https://agent-position.vercel.app

# Email (optionnel)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Superadmin password
SUPERADMIN_PASSWORD=123456
```

### Configuration Vercel

1. Aller dans Vercel Dashboard → Settings → Environment Variables
2. Ajouter toutes les variables ci-dessus
3. Redéployer l'application

### Sécurité

- ✅ Aucune donnée hardcodée dans le code
- ✅ Seul le superadmin est en dur (syebadokpo@gmail.com)
- ✅ Tous les secrets dans les variables d'environnement
- ✅ Fichiers sensibles dans .gitignore
- ✅ Base de données Supabase avec RLS activé

### Tests

Pour les tests, utiliser:
```bash
TEST_EMAIL=test@example.com
TEST_PASSWORD=testpassword
```
