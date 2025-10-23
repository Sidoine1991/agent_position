# Résolution du problème des coordonnées GPS manquantes

## Problème identifié
Les coordonnées GPS n'apparaissaient pas dans l'historique des missions, affichant "-" au lieu des coordonnées réelles.

## Cause du problème
Les coordonnées GPS étaient bien récupérées et sauvegardées dans la table `checkins`, mais n'étaient pas transférées vers les colonnes dédiées `start_lat`, `start_lon`, `end_lat`, `end_lon` de la table `missions`.

## Solution appliquée
1. **Vérification de la structure de la base de données** : Les colonnes GPS existaient déjà dans la table `missions`
2. **Analyse des données** : Identification que les coordonnées GPS étaient présentes dans les checkins mais manquantes dans les missions
3. **Exécution du script de backfill** : Le script `scripts/backfill_mission_gps.js` a été exécuté avec succès

## Résultat
- ✅ **119 missions corrigées** : Toutes les missions ont maintenant leurs coordonnées GPS complètes
- ✅ **Mission #289** : Maintenant affiche `Start GPS: 7.1421876, 2.0601151 | End GPS: 7.1421877, 2.0601152`
- ✅ **100% de couverture** : Toutes les missions ont leurs coordonnées GPS

## Scripts utilisés
- `scripts/backfill_mission_gps.js` : Script de correction des coordonnées GPS manquantes
- `database/add_mission_gps_columns.sql` : Migration des colonnes GPS (déjà appliquée)

## Date de résolution
23 octobre 2025

## Statut
✅ **RÉSOLU** - Les coordonnées GPS s'affichent maintenant correctement dans l'historique des missions.
