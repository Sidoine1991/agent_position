-- Mise à jour des informations utilisateurs (SERIKI FATAÏ, ADOHO DEDJINNIN THIBURCE)
-- Exécution: collez dans Supabase SQL Editor puis Exécuter

-- 1) SERIKI FATAÏ
UPDATE users
SET
  name = 'SERIKI FATAÏ',
  first_name = 'SERIKI',
  last_name = 'FATAÏ',
  phone = '0164763685',
  departement = 'Collines',
  commune = 'Banté',
  arrondissement = 'BANTÉ CENTRE',
  -- zone de référence: Collines/BANTÉ (répartie dans departement/commune)
  reference_lat = 8.409533,
  reference_lon = 1.919052,
  contract_start_date = '2025-02-03',
  contract_end_date = '2027-03-31',
  years_of_service = 8.0
WHERE email = 'fataiseriki01@gmail.com';

-- Vérification SERIKI
SELECT id, name, first_name, last_name, email, phone, departement, commune, arrondissement,
       reference_lat, reference_lon, contract_start_date, contract_end_date, years_of_service
FROM users WHERE email = 'fataiseriki01@gmail.com';

-- 2) ADOHO DEDJINNIN THIBURCE
UPDATE users
SET
  name = 'ADOHO DEDJINNIN THIBURCE',
  first_name = 'ADOHO DEDJINNIN',
  last_name = 'THIBURCE',
  phone = '0166060617',
  departement = 'Collines',
  commune = 'Savalou',
  arrondissement = 'OTOLLA',
  village = 'AKPAKI',
  -- ATTENTION: valeurs fournies par l'utilisateur
  reference_lat = 1.641511,
  reference_lon = 8.8016875,
  contract_start_date = '2025-02-03',
  contract_end_date = '2027-03-31',
  years_of_service = 2.0
WHERE email = 'thiburce976@gmail.com';

-- Vérification ADOHO
SELECT id, name, first_name, last_name, email, phone, departement, commune, arrondissement, village,
       reference_lat, reference_lon, contract_start_date, contract_end_date, years_of_service
FROM users WHERE email = 'thiburce976@gmail.com';


