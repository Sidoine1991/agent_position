# Migration Render Postgres -> Supabase

## 1) Créer le schéma dans Supabase
- Ouvrir Supabase → SQL Editor
- Coller le contenu de `supabase/schema.sql`
- Exécuter

## 2) Configurer les variables d'environnement
- `DATABASE_URL=postgresql://...` (Render Postgres source)
- `SUPABASE_URL=https://...supabase.co`
- `SUPABASE_SERVICE_ROLE=...` (clé service role)

Ne jamais exposer la clé service_role côté front.

## 3) Lancer la migration
```bash
node scripts/migrate-to-supabase.js
```

Le script lit toutes les tables depuis Render et insère dans Supabase par batchs.

## 4) Basculement de l'app vers Supabase
- Définir `USE_SUPABASE=true` sur le backend
- Configurer `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE`

## Notes
- Les dates sont converties en ISO string pour l'insertion
- Les id sont conservés si non conflictuels; sinon Supabase générera des ids identity.
- En cas d'erreur sur une table, le script s'arrête (fail fast).
