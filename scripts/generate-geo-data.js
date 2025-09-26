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

function headerIncludes(hNorm, keywords) {
  return keywords.some(k => hNorm.includes(k));
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
  // Aggregate rows from all sheets to be robust
  let rows = [];
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const part = xlsx.utils.sheet_to_json(ws, { defval: '' });
    if (Array.isArray(part) && part.length) rows = rows.concat(part);
  }
  if (!rows.length) {
    console.error('No rows found in XLSX (all sheets)');
    // Still output default departements to unblock UI
    const geo = {
      departements: [
        { id:1, name:'Alibori' },{ id:2, name:'Atacora' },{ id:3, name:'Atlantique' },{ id:4, name:'Borgou' },{ id:5, name:'Collines' },
        { id:6, name:'Couffo' },{ id:7, name:'Donga' },{ id:8, name:'Littoral' },{ id:9, name:'Mono' },{ id:10, name:'Ouémé' },{ id:11, name:'Plateau' },{ id:12, name:'Zou' }
      ],
      communes: {}, arrondissements: {}, villages: {}, loaded: true
    };
    fs.writeFileSync(outPath, JSON.stringify(geo));
    console.log('✅ Generated (defaults only)', outPath);
    process.exit(0);
  }

  // Build header maps with fuzzy detection
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const normalizedMap = {};
  for (const h of headers) normalizedMap[normalizeHeader(h)] = h;

  // Auto-detect best header for a semantic field
  function detectHeader(keywords, fallbacks = []) {
    const kw = keywords.map(normalizeHeader);
    // exact normalized match
    for (const [hn, orig] of Object.entries(normalizedMap)) {
      if (kw.includes(hn)) return orig;
    }
    // substring match
    for (const [hn, orig] of Object.entries(normalizedMap)) {
      if (headerIncludes(hn, kw)) return orig;
    }
    // fallback names
    for (const f of fallbacks) {
      const n = normalizeHeader(f);
      if (normalizedMap[n]) return normalizedMap[n];
    }
    return null;
  }

  const depIdHeader = detectHeader(['id departement', 'departement id', 'dept id']);
  const depNameHeader = detectHeader(['departement', 'département', 'nom departement', 'nom du departement'], ['departement_nom']);
  const comIdHeader = detectHeader(['id commune', 'commune id']);
  const comNameHeader = detectHeader(['commune', 'nom commune', 'nom de la commune'], ['commune_nom']);
  const arrIdHeader = detectHeader(['id arrondissement', 'arrondissement id']);
  const arrNameHeader = detectHeader(['arrondissement', 'nom arrondissement', 'nom de l arrondissement'], ['arrondissement_nom']);
  const vilIdHeader = detectHeader(['id village', 'village id', 'localite id']);
  const vilNameHeader = detectHeader(['village', 'nom village', 'localite', 'nom de la localite'], ['localite_nom']);

  function getField(r, header, altHeaders = []) {
    if (header && r[header] !== undefined) return r[header];
    for (const a of altHeaders) {
      if (a && r[a] !== undefined) return r[a];
    }
    return undefined;
  }

  // Accept typical headers variants
  const depKeys = ['departement', 'département', 'dept', 'departement id', 'id departement'];
  const depNameKeys = ['departement name', 'nom departement', 'nom du departement', 'département', 'departement', 'departement_nom'];
  const comKeys = ['commune', 'commune id', 'id commune'];
  const comNameKeys = ['nom commune', 'commune name', 'nom de la commune', 'commune', 'commune_nom'];
  const arrKeys = ['arrondissement', 'arrondissement id', 'id arrondissement'];
  const arrNameKeys = ['nom arrondissement', 'arrondissement name', 'nom de l arrondissment', 'arrondissement', 'arrondissement_nom'];
  const vilKeys = ['village', 'village id', 'id village', 'localite id'];
  const vilNameKeys = ['nom village', 'village name', 'nom de la localite', 'localite', 'village', 'localite_nom'];

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
    let depId = getField(r, depIdHeader);
    let depName = getField(r, depNameHeader);
    let comId = getField(r, comIdHeader);
    let comName = getField(r, comNameHeader);
    let arrId = getField(r, arrIdHeader);
    let arrName = getField(r, arrNameHeader);
    let vilId = getField(r, vilIdHeader);
    let vilName = getField(r, vilNameHeader);

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

  // Ensure default departements if none detected
  let depsOut = Array.from(departements.values()).sort((a,b)=>a.id-b.id);
  if (depsOut.length === 0) {
    depsOut = [
      { id:1, name:'Alibori' },{ id:2, name:'Atacora' },{ id:3, name:'Atlantique' },{ id:4, name:'Borgou' },{ id:5, name:'Collines' },
      { id:6, name:'Couffo' },{ id:7, name:'Donga' },{ id:8, name:'Littoral' },{ id:9, name:'Mono' },{ id:10, name:'Ouémé' },{ id:11, name:'Plateau' },{ id:12, name:'Zou' }
    ];
  }

  const geo = {
    departements: depsOut,
    communes: Object.fromEntries(Array.from(communes.entries()).map(([k,v]) => [String(k), v])),
    arrondissements: Object.fromEntries(Array.from(arrondissements.entries()).map(([k,v]) => [String(k), v])),
    villages: Object.fromEntries(Array.from(villages.entries()).map(([k,v]) => [String(k), v])),
    loaded: true
  };

  fs.writeFileSync(outPath, JSON.stringify(geo));
  console.log('✅ Generated', outPath);
}

main();


