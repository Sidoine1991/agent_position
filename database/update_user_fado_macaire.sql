-- Mise à jour de l'agent FADO Kami Macaire dans la table users
-- Exécution: collez dans le SQL Editor de Supabase puis Exécuter

UPDATE users
SET
  name = 'FADO Kami Macaire',
  first_name = 'FADO',
  last_name = 'Kami Macaire',
  phone = '+229 0161078747',
  departement = 'Collines',
  commune = 'Bantè',
  arrondissement = 'Bantè',
  village = 'Adjantè',
  reference_lat = 8.401730,
  reference_lon = 1.897925,
  contract_start_date = '2025-02-03',
  contract_end_date = '2027-03-31',
  years_of_service = 10.0
WHERE email = 'macairefado18@gmail.com';

-- Vérification
SELECT id, name, first_name, last_name, email, phone,
       departement, commune, arrondissement, village,
       reference_lat, reference_lon,
       contract_start_date, contract_end_date, years_of_service
FROM users
WHERE email = 'macairefado18@gmail.com';


