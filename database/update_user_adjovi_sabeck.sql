-- Mise à jour de l'agent ADJOVI COMLAN SABECK dans la table users
-- Exécution: collez dans le SQL Editor de Supabase puis Exécuter

UPDATE users
SET
  name = 'ADJOVI COMLAN SABECK',
  first_name = 'ADJOVI COMLAN',
  last_name = 'SABECK',
  phone = '0141456353',
  departement = 'Zou',
  commune = 'Zogbodomey',
  arrondissement = 'Domè',
  reference_lat = 7.0672533,
  reference_lon = 2.3452993,
  contract_start_date = '2024-11-01',
  contract_end_date = '2026-01-31',
  years_of_service = 10.0
WHERE email = 'becko1995123@gmail.com';

-- Vérification
SELECT id, name, first_name, last_name, email, phone,
       departement, commune, arrondissement, village,
       reference_lat, reference_lon,
       contract_start_date, contract_end_date, years_of_service
FROM users
WHERE email = 'becko1995123@gmail.com';


