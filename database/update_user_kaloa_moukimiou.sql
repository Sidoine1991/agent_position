-- Mise à jour de l'agent KALOA Moukimiou dans la table users
-- Exécution: collez dans le SQL Editor de Supabase puis Exécuter

-- Conversion DMS -> décimal (fourni)
-- Latitude  = 9°43'1,86168"  ≈ 9.717184
-- Longitude = 1°22'40,62396" ≈ 1.377951

UPDATE users
SET
  name = 'KALOA Moukimiou',
  first_name = 'KALOA',
  last_name = 'Moukimiou',
  phone = '0156686848',
  departement = 'Donga',
  commune = 'Ouaké',
  arrondissement = 'BADJOUDE/Semere2',
  reference_lat = 9.717184,
  reference_lon = 1.377951,
  contract_start_date = '2025-02-03',
  contract_end_date = '2027-03-31',
  years_of_service = 3.0
WHERE email = 'kaloamoukimiou@gmail.com';

-- Vérification
SELECT id, name, first_name, last_name, email, phone,
       departement, commune, arrondissement, village,
       reference_lat, reference_lon,
       contract_start_date, contract_end_date, years_of_service
FROM users
WHERE email = 'kaloamoukimiou@gmail.com';


