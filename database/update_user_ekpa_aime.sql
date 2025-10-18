-- Met à jour les informations de l'agent EKPA CHABI OGOUDÉLÉ AIMÉ dans la table users
-- Exécution: collez ce script dans Supabase SQL Editor et exécutez-le

-- 1) Mise à jour principale par email (source de vérité)
UPDATE users
SET
  name = 'EKPA CHABI OGOUDÉLÉ AIMÉ',
  first_name = 'EKPA CHABI OGOUDÉLÉ',
  last_name = 'AIMÉ',
  phone = '0195433465',
  departement = 'Donga',
  commune = 'Bassila',
  arrondissement = 'Manigri',
  village = 'Manigri Ikanni',
  reference_lat = 9.03690,
  reference_lon = 1.400020,
  contract_start_date = '2025-02-01',
  contract_end_date = '2027-03-31',
  years_of_service = 10.0
WHERE email = 'ekpaaime64@gmail.com';

-- 2) Vérification rapide
SELECT 
  id, name, first_name, last_name, email, phone,
  departement, commune, arrondissement, village,
  reference_lat, reference_lon,
  contract_start_date, contract_end_date, years_of_service
FROM users
WHERE email = 'ekpaaime64@gmail.com';


