// Generate web/geo-data.json from benin_subdvision.xlsx
// Flexible header detection (French/English, accents ignored)

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function normalizeHeader(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  return undefined;
}

function main() {
  const xlsxPath = path.resolve(__dirname, '..', 'benin_subdvision.xlsx');
  const outPath = path.resolve(__dirname, '..', 'web', 'geo-data.json');
  if (!fs.existsSync(xlsxPath)) {
    console.error('XLSX not found at', xlsxPath);
    process.exit(1);
  }

  const wb = xlsx.readFile(xlsxPath);
  // Use first sheet by default
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
  if (!rows.length) {
    console.error('No rows found in XLSX');
    process.exit(1);
  }

  // Build key map for headers
  const first = rows[0];
  const headers = Object.keys(first);
  const normalizedMap = {};
  for (const h of headers) normalizedMap[normalizeHeader(h)] = h;

  function getField(r, variants) {
    for (const v of variants) {
      const key = normalizedMap[normalizeHeader(v)] || normalizedMap[v];
      if (key && r[key] !== undefined) return r[key];
    }
    // try direct by normalized name
    for (const h of headers) {
      if (normalizeHeader(h) === normalizeHeader(variants[0])) return r[h];
    }
    return undefined;
  }

  // Accept typical headers variants
  const depKeys = ['departement', 'département', 'dept', 'departement id', 'id departement'];
  const depNameKeys = ['departement name', 'nom departement', 'nom du departement', 'département', 'departement'];
  const comKeys = ['commune', 'commune id', 'id commune'];
  const comNameKeys = ['nom commune', 'commune name', 'nom de la commune', 'commune'];
  const arrKeys = ['arrondissement', 'arrondissement id', 'id arrondissement'];
  const arrNameKeys = ['nom arrondissement', 'arrondissement name', 'nom de l arrondissment', 'arrondissement'];
  const vilKeys = ['village', 'village id', 'id village', 'localite id'];
  const vilNameKeys = ['nom village', 'village name', 'nom de la localite', 'localite', 'village'];

  const departements = new Map(); // id -> {id,name}
  const communes = new Map(); // key depId -> [{id,name}]
  const arrondissements = new Map(); // key communeId -> [{id,name}]
  const villages = new Map(); // key arrondissementId -> [{id,name}]

  function add(map, key, value) {
    const k = String(key);
    if (!map.has(k)) map.set(k, []);
    const arr = map.get(k);
    if (!arr.find(x => String(x.id) === String(value.id))) arr.push(value);
  }

  function nextIdFactory() {
    let id = 1;
    return () => id++;
  }
  const nextCommuneId = nextIdFactory();
  const nextArrId = nextIdFactory();
  const nextVillId = nextIdFactory();

  const depNameToId = new Map();
  const comNameToId = new Map(); // scoped globally; collisions across deps unlikely but acceptable if IDs present missing
  const arrNameToId = new Map();

  for (const r of rows) {
    let depId = getField(r, depKeys);
    let depName = getField(r, depNameKeys);
    let comId = getField(r, comKeys);
    let comName = getField(r, comNameKeys);
    let arrId = getField(r, arrKeys);
    let arrName = getField(r, arrNameKeys);
    let vilId = getField(r, vilKeys);
    let vilName = getField(r, vilNameKeys);

    // Normalize
    depId = depId || depNameToId.get(String(depName).trim());
    if (!depId && depName) {
      // Map to known 1..11 ids by name if possible
      const depLookup = {
        'alibori': 1, 'atacora': 2, 'atlantique': 3, 'borgou': 4, 'collines': 5,
        'couffo': 6, 'donga': 7, 'littoral': 8, 'mono': 9, 'oueme': 10, 'plateau': 11,
        'ouémé': 10
      };
      const key = String(depName).toLowerCase();
      depId = depLookup[key];
      if (!depId) {
        // fallback assign by inserting into map size
        depId = depNameToId.get(key);
        if (!depId) {
          depId = departements.size + 1;
          depNameToId.set(key, depId);
        }
      }
    }
    if (depId && depName) {
      const idNum = Number(depId);
      if (!departements.has(idNum)) departements.set(idNum, { id: idNum, name: String(depName).trim() });
    }

    // Commune
    if (!comId && comName) {
      const key = String(comName).trim().toLowerCase();
      comId = comNameToId.get(key);
      if (!comId) { comId = nextCommuneId(); comNameToId.set(key, comId); }
    }
    if (depId && comId && comName) {
      add(communes, depId, { id: Number(comId), name: String(comName).trim() });
    }

    // Arrondissement
    if (!arrId && arrName) {
      const key = String(arrName).trim().toLowerCase();
      arrId = arrNameToId.get(key);
      if (!arrId) { arrId = nextArrId(); arrNameToId.set(key, arrId); }
    }
    if (comId && arrId && arrName) {
      add(arrondissements, comId, { id: Number(arrId), name: String(arrName).trim() });
    }

    // Village
    if (!vilId && vilName) {
      vilId = nextVillId();
    }
    if (arrId && vilId && vilName) {
      add(villages, arrId, { id: Number(vilId), name: String(vilName).trim() });
    }
  }

  const geo = {
    departements: Array.from(departements.values()).sort((a,b)=>a.id-b.id),
    communes: Object.fromEntries(Array.from(communes.entries()).map(([k,v]) => [String(k), v])),
    arrondissements: Object.fromEntries(Array.from(arrondissements.entries()).map(([k,v]) => [String(k), v])),
    villages: Object.fromEntries(Array.from(villages.entries()).map(([k,v]) => [String(k), v])),
    loaded: true
  };

  fs.writeFileSync(outPath, JSON.stringify(geo));
  console.log('✅ Generated', outPath);
}

main();


