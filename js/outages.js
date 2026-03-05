// ====== NET OUTAGES ======
// Primary source:   CAIDA IODA — BGP + active probe outage detection (real blackouts)
// Secondary source: OONI Explorer — web connectivity anomalies (censorship/throttling)
// IODA detects actual internet outages (BGP withdrawals, ping going dark) within minutes.
// OONI detects censorship — requires working internet to submit, so real blackouts go SILENT.
// Boundaries: OSM Overpass via Worker /api/boundary

const OUTAGE_REFRESH_MS = 10 * 60 * 1000;

const _boundaryCache = {};
let outageVis  = true;
let outageData = [];   // merged IODA + OONI results
let _map       = null;

// ── Plasma animation ──────────────────────────────────────────────────────────
const _PS = 96;
const _PB = new Uint8Array(_PS * _PS * 4);
const _BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];

function _writePlasma(t) {
  const isNerv = document.body.classList.contains('nerv');
  const [pr,pg,pb] = isNerv ? [224,112,32] : [1,168,52];
  const TAU = Math.PI * 2;
  let i = 0;
  for (let y = 0; y < _PS; y++) {
    for (let x = 0; x < _PS; x++) {
      const cx = x / _PS, cy = y / _PS;
      let v = Math.sin(TAU * (2*cx + 1*cy) + t * 1.0)
            + Math.sin(TAU * (1*cx + 2*cy) + t * 1.3)
            + Math.sin(TAU * (3*cx + 1*cy) + t * 0.7)
            + Math.sin(TAU * (1*cx + 3*cy) + t * 0.9)
            + Math.sin(TAU * (2*cx + 2*cy) + t * 1.1) * 0.6;
      v = (v + 4.6) / 9.2;
      let a = 0;
      if (v > 0.62) {
        a = 130 + ((v - 0.62) / 0.38 * 90) | 0;
      } else if (v > 0.28) {
        const thr = _BAYER[((y % 4) * 4) + (x % 4)] / 16;
        a = ((v - 0.28) / 0.34 > thr) ? 150 : 0;
      }
      _PB[i++]=pr; _PB[i++]=pg; _PB[i++]=pb; _PB[i++]=a;
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initOutages(map) {
  _map = map;

  map.addSource('outage-zones', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });

  map.addLayer({ id:'outage-fill', type:'fill', source:'outage-zones',
    paint:{ 'fill-color':['get','fillColor'], 'fill-opacity':0.06 } });
  map.addLayer({ id:'outage-hatch', type:'fill', source:'outage-zones',
    paint:{ 'fill-pattern':'plasma', 'fill-opacity':1 } });
  map.addLayer({ id:'outage-border', type:'line', source:'outage-zones',
    paint:{ 'line-color':['get','fillColor'], 'line-width':1.5, 'line-opacity':0.9 } });

  _writePlasma(0);
  map.addImage('plasma', { width:_PS, height:_PS, data:_PB }, { pixelRatio:1 });

  // Throttled plasma animation — ~10fps instead of 60fps
  let t = 0, _lastPlasma = 0;
  map.on('render', () => {
    if (!outageVis || !outageData.length) return;
    const now = performance.now();
    if (now - _lastPlasma < 100) return; // 10fps cap
    _lastPlasma = now;
    t += 0.022;
    _writePlasma(t);
    if (map.hasImage('plasma')) map.updateImage('plasma', { width:_PS, height:_PS, data:_PB });
    map.triggerRepaint();
  });

  fetchOutages();
  setInterval(fetchOutages, OUTAGE_REFRESH_MS);
}

// ── Master fetch — IODA primary, OONI secondary ───────────────────────────────
async function fetchOutages() {
  _setNetStatus('NET: SYNCING', 'var(--warning)');

  // Run both in parallel
  const [iodaResult, ooniResult] = await Promise.allSettled([_fetchIODA(), _fetchOONI()]);

  const ioda = iodaResult.status === 'fulfilled' ? iodaResult.value : [];
  const ooni = ooniResult.status === 'fulfilled' ? ooniResult.value : [];

  // Merge: IODA takes precedence, OONI fills in if not already covered
  const merged = new Map();
  ioda.forEach(r => merged.set(r.code, r));
  ooni.forEach(r => {
    if (!merged.has(r.code)) merged.set(r.code, r);
    else {
      // Upgrade severity if OONI also flagging same country
      const existing = merged.get(r.code);
      if (r.score > existing.score) merged.set(r.code, { ...existing, score: r.score, level: r.level });
    }
  });

  // Clear old data completely before applying new — prevents stale countries persisting
  outageData = [];
  _setMapData([]);

  outageData = Array.from(merged.values());

  if (outageData.length > 0) {
    await _applyOutageData();
    _setNetStatus(`NET: ${outageData.length} OUTAGE${outageData.length !== 1 ? 'S' : ''}`, 'var(--accent)');
  } else {
    _setNetStatus('NET: CLEAR', 'var(--text-dim)');
  }

  _updateOutageCounter();
}

// ── CAIDA IODA — BGP + active probe outage detection ─────────────────────────
// This is the right tool for real blackouts. Detects when a country's BGP
// prefixes withdraw or active probes go dark — works even when internet is cut.
async function _fetchIODA() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    let r;
    try {
      r = await fetch(`${PROXY_BASE}/api/outages`, { signal: ctrl.signal });
    } finally { clearTimeout(t); }
    if (!r.ok) throw new Error('IODA ' + r.status);
    const d = await r.json();

    // IODA response shape: { data: { outages: [...] } } or { result: [...] }
    // Each outage: { entity: { code, name }, score, ... }
    const outages = d?.data?.outages || d?.result || d?.outages || [];
    const found = [];

    outages.forEach(o => {
      // Only country-level entities
      const entity = o.entity || o;
      const code = (entity.code || entity.country_code || '').toUpperCase();
      if (!code || code.length !== 2) return;

      const score = parseFloat(o.score || o.overallScore || 0);
      if (score < 0.1) return; // below noise floor

      const level = score > 0.5 ? 'critical' : 'warning';
      const name  = entity.name || ISO2_NAMES[code] || code;

      found.push({ code, name, level, score, source: 'IODA' });
    });

    console.log(`[WWO] IODA outages: ${found.length}`, found.map(f => `${f.code}(${f.score.toFixed(2)})`));
    return found;
  } catch(e) {
    console.warn('[WWO] IODA failed:', e.message);
    return [];
  }
}

// ── OONI — web connectivity anomalies (censorship indicator) ─────────────────
// Good for detecting throttling/blocking. NOT suitable for real blackouts
// because probes need working internet to submit. Stricter thresholds here.
async function _fetchOONI() {
  const since = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const until = new Date().toISOString().slice(0,10);
  const url = `https://api.ooni.io/api/v1/aggregation?since=${since}&until=${until}&axis_x=probe_cc&test_name=web_connectivity&format=JSON`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    let r;
    try {
      r = await fetch(`${PROXY_BASE}/api/proxy?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    } finally { clearTimeout(t); }
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const rows = d?.result || d?.data || [];
    console.log('[WWO] OONI rows:', rows.length);

    const found = [];
    rows.forEach(row => {
      const code  = (row.probe_cc || '').toUpperCase();
      if (!code || code.length !== 2) return;
      const total = row.measurement_count || 0;
      const anom  = row.anomaly_count     || 0;

      // Stricter thresholds — minimum 30 probes, 50% anomaly rate
      // (was 5 probes / 30% — far too easy to false-positive)
      if (total < 30) return;
      const rate = anom / total;
      if (rate < 0.50) return;

      const level = rate > 0.75 ? 'critical' : 'warning';
      const score = rate;
      const name  = ISO2_NAMES[code] || code;
      found.push({ code, name, level, score, source: 'OONI', ooniRate: rate });
    });

    console.log('[WWO] OONI anomalies:', found.map(f => `${f.code}(${(f.score*100).toFixed(0)}%)`));
    return found;
  } catch(e) {
    console.warn('[WWO] OONI failed:', e.message);
    return [];
  }
}

// ── Apply outage data — fetch boundaries + render ─────────────────────────────
async function _applyOutageData() {
  if (outageData.length === 0) { _setMapData([]); return; }

  const isNerv    = document.body.classList.contains('nerv');
  const fillColor = isNerv ? '#e07020' : '#01a834';

  // Fetch any missing boundaries
  const needed = outageData.filter(o => !_boundaryCache[o.code]);
  if (needed.length) {
    await Promise.allSettled(needed.map(o => _fetchBoundary(o.code)));
  }

  const features = outageData
    .filter(o => _boundaryCache[o.code])
    .map(o => ({
      type: 'Feature',
      geometry: _boundaryCache[o.code],
      properties: {
        fillColor,
        outageCode:  o.code,
        outageName:  o.name,
        outageLevel: o.level,
        outageScore: o.score,
        outageSource: o.source || 'UNKNOWN',
        ooniRate:    o.ooniRate || null,
      }
    }));

  console.log('[WWO] Outage polygons rendered:', features.map(f =>
    `${f.properties.outageCode}(${f.properties.outageSource})`));
  _setMapData(features);

  // OSINT feed injection for critical outages
  outageData.filter(c => c.level === 'critical').forEach(c => {
    addLiveItem(
      `INTERNET OUTAGE — ${c.name} [${c.source}]`,
      'IODA/OONI', new Date().toISOString(),
      'https://ioda.inetintel.cc.gatech.edu', 'CYBER', 'al', false
    );
  });
}

// ── Boundary fetch ────────────────────────────────────────────────────────────
async function _fetchBoundary(iso) {
  if (_boundaryCache[iso]) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    let r;
    try {
      r = await fetch(`${PROXY_BASE}/api/boundary?iso=${iso}`, { signal: ctrl.signal });
    } finally { clearTimeout(t); }
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const geom = _overpassToGeoJSON(data);
    if (geom) { _boundaryCache[iso] = geom; console.log('[WWO] Boundary cached:', iso); }
    else console.warn('[WWO] No geometry for', iso);
  } catch(e) { console.warn('[WWO] Boundary failed:', iso, e.message); }
}

// ── OSM way stitching ─────────────────────────────────────────────────────────
function _decimate(ring, maxPts) {
  if (ring.length <= maxPts) return ring;
  const stride = Math.ceil(ring.length / maxPts);
  const out = [];
  for (let i = 0; i < ring.length - 1; i += stride) out.push(ring[i]);
  out.push(ring[0]);
  return out;
}

function _overpassToGeoJSON(data) {
  const relation = data?.elements?.find(e => e.type === 'relation');
  if (!relation?.members) return null;

  const outerWays = [], innerWays = [];
  relation.members.forEach(m => {
    if (m.type !== 'way' || !m.geometry?.length) return;
    const pts = m.geometry.map(pt => [pt.lon, pt.lat]);
    if (pts.length < 2) return;
    (m.role === 'inner' ? innerWays : outerWays).push(pts);
  });

  if (!outerWays.length) return null;

  function stitchWays(ways) {
    const rings = [];
    const EPS = 1e-5;
    function key(pt) { return `${(pt[0]/EPS|0)},${(pt[1]/EPS|0)}`; }
    let remaining = ways.map(w => [...w]);

    while (remaining.length > 0) {
      let ring = remaining.shift();
      let grew = true;
      while (grew) {
        grew = false;
        const tail = ring[ring.length-1];
        const head = ring[0];
        const tk = key(tail), hk = key(head);
        for (let i = 0; i < remaining.length; i++) {
          const w = remaining[i];
          const wh = key(w[0]), wt = key(w[w.length-1]);
          if      (wh === tk) { ring = ring.concat(w.slice(1)); }
          else if (wt === tk) { ring = ring.concat(w.slice(0,-1).reverse()); }
          else if (wt === hk) { ring = w.concat(ring.slice(1)); }
          else if (wh === hk) { ring = w.slice().reverse().concat(ring.slice(1)); }
          else { continue; }
          remaining.splice(i, 1);
          grew = true;
          break;
        }
      }
      const f = ring[0], l = ring[ring.length-1];
      if (key(f) !== key(l)) ring.push([...f]);
      const dec = _decimate(ring, 6000);
      if (dec.length >= 4) rings.push(dec);
    }
    return rings;
  }

  const outerRings = stitchWays(outerWays);
  const innerRings = stitchWays(innerWays);
  if (!outerRings.length) return null;

  return outerRings.length === 1
    ? { type:'Polygon',      coordinates: [outerRings[0], ...innerRings] }
    : { type:'MultiPolygon', coordinates: outerRings.map(r => [r]) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _setMapData(features) {
  if (!_map) return;
  const src = _map.getSource('outage-zones');
  if (src) src.setData({ type:'FeatureCollection', features });
}

function _updateOutageCounter() {
  const el = document.getElementById('outc');
  if (el) el.textContent = outageData.length;
}

function _setNetStatus(text, color) {
  const el = document.getElementById('net-status');
  if (el) { el.textContent = text; el.style.color = color; }
}

function outageThemeUpdate() {
  if (!_map) return;
  const isNerv = document.body.classList.contains('nerv');
  try {
    _map.setPaintProperty('outage-fill',  'fill-color', isNerv ? '#e07020' : '#01a834');
    _map.setPaintProperty('outage-border','line-color',  isNerv ? '#e07020' : '#01a834');
  } catch(e) {}
  if (outageData.length) _applyOutageData();
}

function setOutageVis(vis) {
  outageVis = vis;
  if (_map) ['outage-fill','outage-hatch','outage-border'].forEach(id => {
    try { _map.setLayoutProperty(id, 'visibility', vis ? 'visible' : 'none'); } catch(e) {}
  });
}

// ── ISO2 country name lookup ──────────────────────────────────────────────────
const ISO2_NAMES = {
  AF:'Afghanistan',AL:'Albania',AM:'Armenia',AO:'Angola',AR:'Argentina',
  AT:'Austria',AU:'Australia',AZ:'Azerbaijan',BA:'Bosnia',BD:'Bangladesh',
  BE:'Belgium',BF:'Burkina Faso',BG:'Bulgaria',BI:'Burundi',BJ:'Benin',
  BO:'Bolivia',BR:'Brazil',BY:'Belarus',CA:'Canada',CD:'DR Congo',
  CF:'C. African Rep.',CG:'Congo',CH:'Switzerland',CI:'Ivory Coast',
  CL:'Chile',CM:'Cameroon',CN:'China',CO:'Colombia',CR:'Costa Rica',
  CU:'Cuba',CY:'Cyprus',CZ:'Czechia',DE:'Germany',DJ:'Djibouti',
  DK:'Denmark',DZ:'Algeria',EC:'Ecuador',EE:'Estonia',EG:'Egypt',
  ER:'Eritrea',ES:'Spain',ET:'Ethiopia',FI:'Finland',FR:'France',
  GA:'Gabon',GB:'UK',GE:'Georgia',GH:'Ghana',GN:'Guinea',
  GR:'Greece',GT:'Guatemala',GW:'Guinea-Bissau',HN:'Honduras',
  HR:'Croatia',HT:'Haiti',HU:'Hungary',ID:'Indonesia',IE:'Ireland',
  IL:'Israel',IN:'India',IQ:'Iraq',IR:'Iran',IS:'Iceland',IT:'Italy',
  JM:'Jamaica',JO:'Jordan',JP:'Japan',KE:'Kenya',KG:'Kyrgyzstan',
  KH:'Cambodia',KP:'North Korea',KR:'South Korea',KW:'Kuwait',
  KZ:'Kazakhstan',LA:'Laos',LB:'Lebanon',LK:'Sri Lanka',LR:'Liberia',
  LT:'Lithuania',LV:'Latvia',LY:'Libya',MA:'Morocco',MD:'Moldova',
  ME:'Montenegro',MG:'Madagascar',MK:'N. Macedonia',ML:'Mali',
  MM:'Myanmar',MN:'Mongolia',MR:'Mauritania',MW:'Malawi',MX:'Mexico',
  MY:'Malaysia',MZ:'Mozambique',NA:'Namibia',NE:'Niger',NG:'Nigeria',
  NI:'Nicaragua',NL:'Netherlands',NO:'Norway',NP:'Nepal',NZ:'New Zealand',
  OM:'Oman',PA:'Panama',PE:'Peru',PG:'Papua New Guinea',PH:'Philippines',
  PK:'Pakistan',PL:'Poland',PT:'Portugal',PY:'Paraguay',QA:'Qatar',
  RO:'Romania',RS:'Serbia',RU:'Russia',RW:'Rwanda',SA:'Saudi Arabia',
  SD:'Sudan',SE:'Sweden',SG:'Singapore',SI:'Slovenia',SK:'Slovakia',
  SN:'Senegal',SO:'Somalia',SR:'Suriname',SS:'South Sudan',SV:'El Salvador',
  SY:'Syria',SZ:'Eswatini',TD:'Chad',TG:'Togo',TH:'Thailand',
  TJ:'Tajikistan',TM:'Turkmenistan',TN:'Tunisia',TR:'Turkey',
  TZ:'Tanzania',UA:'Ukraine',UG:'Uganda',US:'United States',
  UY:'Uruguay',UZ:'Uzbekistan',VE:'Venezuela',VN:'Vietnam',
  YE:'Yemen',ZA:'South Africa',ZM:'Zambia',ZW:'Zimbabwe',
};
