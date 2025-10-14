const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

(async () => {
  try {
    const geoPath = path.join(process.cwd(), 'www', 'geo-data.json');
    const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));

    const depMap = new Map();
    const comMap = new Map();
    const arrMap = new Map();
    const vilMap = new Map();

    (geo.departements || []).forEach(d => depMap.set(String(d.id), d.name));
    Object.values(geo.communes || {}).forEach(list => list.forEach(c => comMap.set(String(c.id), c.name)));
    Object.values(geo.arrondissements || {}).forEach(list => list.forEach(a => arrMap.set(String(a.id), a.name)));
    Object.values(geo.villages || {}).forEach(list => list.forEach(v => vilMap.set(String(v.id), v.name)));

    const isNumericLike = v => v != null && /^\d+$/.test(String(v).trim());

    const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
    const adminToken = jwt.sign({ id: 33, email: 'syebadokpo@gmail.com', role: 'admin' }, JWT_SECRET, { expiresIn: '20m' });
    const headers = { 'Authorization': 'Bearer ' + adminToken, 'Content-Type': 'application/json' };

    const listRes = await fetch('http://localhost:3010/api/admin/agents', { headers });
    if (!listRes.ok) {
      console.error('GET agents failed', listRes.status);
      process.exit(1);
    }
    const payload = await listRes.json();
    const agents = payload.data || payload.agents || [];

    let updated = 0, skipped = 0, failed = 0;
    for (const a of agents) {
      const upd = {};
      let need = false;

      const d = a.departement, c = a.commune, r = a.arrondissement, v = a.village;
      if (isNumericLike(d) && depMap.has(String(d))) { upd.departement = depMap.get(String(d)); need = true; }
      if (isNumericLike(c) && comMap.has(String(c))) { upd.commune = comMap.get(String(c)); need = true; }
      if (isNumericLike(r) && arrMap.has(String(r))) { upd.arrondissement = arrMap.get(String(r)); need = true; }
      if (isNumericLike(v) && vilMap.has(String(v))) { upd.village = vilMap.get(String(v)); need = true; }

      if (need) {
        const url = `http://localhost:3010/api/admin/agents/${a.id}`;
        const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(upd) });
        if (res.ok) {
          updated++;
        } else {
          failed++;
          const txt = await res.text();
          console.error('Fail update id', a.id, txt);
        }
      } else {
        skipped++;
      }
    }

    console.log('Backfill completed. Updated:', updated, 'Skipped:', skipped, 'Failed:', failed);
  } catch (e) {
    console.error('Backfill error:', e);
    process.exit(1);
  }
})();
