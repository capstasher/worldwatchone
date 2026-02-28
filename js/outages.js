// ====== NET OUTAGES ======
// Source: OONI Explorer API — live probe-confirmed interference by country
// Boundaries: OSM Overpass via Worker /api/boundary — exact country shapes
// Perf: canvas hatch throttled to ~10fps; boundaries cached for session

const OUTAGE_REFRESH_MS = 4 * 60 * 1000; // 4min

const _boundaryCache = {}; // ISO2 → GeoJSON geometry

let outageVis     = true;
let outageData    = [];
let _map          = null;
// hatch pattern registered as MapLibre image — no canvas overlay needed

// ── Init ─────────────────────────────────────────────────────────────────────
let _plasmaT = 0; // plasma time accumulator

const PLASMA_SIZE = 32; // tile px — small enough to update cheaply each frame
const PLASMA_BUF  = new Uint8Array(PLASMA_SIZE * PLASMA_SIZE * 4); // RGBA

function initOutages(map) {
  _map = map;

  map.addSource('outage-zones', { type:'geojson', data:{type:'FeatureCollection',features:[]} });

  // Solid tint base
  map.addLayer({ id:'outage-fill', type:'fill', source:'outage-zones',
    paint:{ 'fill-color':['get','fillColor'], 'fill-opacity':0.06 } });

  // Plasma fill-pattern layer
  map.addLayer({ id:'outage-hatch', type:'fill', source:'outage-zones',
    paint:{ 'fill-pattern':'plasma', 'fill-opacity':1 } });

  // Border
  map.addLayer({ id:'outage-border', type:'line', source:'outage-zones',
    paint:{ 'line-color':['get','fillColor'], 'line-width':1.5, 'line-opacity':0.9 } });

  // Register initial blank image then start animation loop
  _plasmaWriteFrame(0);
  map.addImage('plasma', { width:PLASMA_SIZE, height:PLASMA_SIZE, data:PLASMA_BUF }, { pixelRatio:1 });

  // rAF loop — updateImage is cheap (just uploads PLASMA_SIZE² pixels to GPU)
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - last < 80) return; // ~12fps cap
    last = ts;
    if (!outageVis) return;
    _plasmaT += 0.08;
    _plasmaWriteFrame(_plasmaT);
    if (_map.hasImage('plasma')) _map.updateImage('plasma', { width:PLASMA_SIZE, height:PLASMA_SIZE, data:PLASMA_BUF });
  }
  requestAnimationFrame(frame);

  fetchOutages();
  setInterval(fetchOutages, OUTAGE_REFRESH_MS);
}

// Bayer 4×4 ordered dither matrix
const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];

function _plasmaWriteFrame(t) {
  const isNerv = document.body.classList.contains('nerv');
  const [r,g,b] = isNerv ? [224,112,32] : [1,168,52];
  const S = PLASMA_SIZE;
  let i = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cx = x/S, cy = y/S;
      let v = Math.sin(cx*6.3+t) + Math.sin(cy*6.3+t*1.31)
            + Math.sin((cx+cy)*4.1+t*0.79)
            + Math.sin(Math.sqrt((cx-.5)**2+(cy-.5)**2)*11.7+t*1.09);
      v = (v + 4) / 8; // normalise 0..1
      let a = 0;
      if (v > 0.68) {
        a = Math.min(220, 160 + ((v-0.68)/0.32*75)|0);
      } else if (v > 0.28) {
        const thresh = BAYER[((y%4)*4)+(x%4)] / 16;
        a = ((v-0.28)/0.40 > thresh) ? 170 : 0;
      }
      PLASMA_BUF[i++]=r; PLASMA_BUF[i++]=g; PLASMA_BUF[i++]=b; PLASMA_BUF[i++]=a;
    }
  }
}

// ── Fetch outage data — OONI Explorer API only ───────────────────────────────
async function fetchOutages() {
  _setNetStatus('NET: SYNCING', 'var(--warning)');
  const result = await _fetchOONI();
  if (result === null) {
    _setNetStatus('NET: ERROR', '#ff2222');
    outageData = []; _setMapData([]); _updateOutageCounter();
  } else {
    outageData = result;
    await _applyOutageData();
    _setNetStatus(
      outageData.length > 0 ? `NET: ${outageData.length} OUTAGE${outageData.length!==1?'S':''}` : 'NET: CLEAR',
      outageData.length > 0 ? 'var(--accent)' : 'var(--text-dim)'
    );
  }
}

// OONI Explorer API — country-level anomaly summary, last 24h
// Returns countries where >30% of measurements show anomalies
async function _fetchOONI() {
  const since = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const until = new Date().toISOString().slice(0,10);
  // OONI aggregation endpoint — one row per country with anomaly counts
  const url = `https://api.ooni.io/api/v1/aggregation?since=${since}&until=${until}&axis_x=probe_cc&test_name=web_connectivity&format=JSON`;
  try {
    const r = await fetch(`${PROXY_BASE}/api/proxy?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const rows = d?.result || d?.data || [];
    console.log('[WWO] OONI rows:', rows.length);

    const found = [];
    rows.forEach(row => {
      const code  = (row.probe_cc || '').toUpperCase();
      if (!code || code.length !== 2) return;
      const total = row.measurement_count || 0;
      const anom  = row.anomaly_count || 0;
      if (total < 5) return; // too few probes to be meaningful
      const rate = anom / total;
      if (rate < 0.3) return; // below 30% anomaly threshold
      const level = rate > 0.7 ? 'critical' : 'warning';
      const score = rate > 0.7 ? 3 : 2;
      const name  = ISO2_NAMES[code] || code;
      found.push({ code, name, level, score, ooniRate: rate });
    });

    console.log('[WWO] OONI confirmed anomalies:', found.map(f=>`${f.code}(${(f.ooniRate*100).toFixed(0)}%)`));
    return found;
  } catch(e) {
    console.warn('[WWO] OONI failed:', e.message);
    return null;
  }
}

// ISO2 → display name (for OONI results that only give code)
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

// ── Fetch OSM boundaries + render ─────────────────────────────────────────────
async function _applyOutageData() {
  _updateOutageCounter();
  if (outageData.length === 0) { _setMapData([]); return; }

  const isNerv    = document.body.classList.contains('nerv');
  const fillColor = isNerv ? '#e07020' : '#01a834';

  // Fetch missing boundaries in parallel
  const needed = outageData.filter(o => !_boundaryCache[o.code]);
  if (needed.length) {
    await Promise.allSettled(needed.map(o => _fetchBoundary(o.code)));
  }

  const features = outageData
    .filter(o => _boundaryCache[o.code])
    .map(o => ({
      type: 'Feature',
      geometry: _boundaryCache[o.code],
      properties: { fillColor,
        outageCode:o.code, outageName:o.name, outageLevel:o.level, outageScore:o.score, ooniRate:o.ooniRate||null }
    }));

  console.log('[WWO] Outage polygons rendered:', features.map(f=>f.properties.outageCode));
  _setMapData(features);

  // OSINT feed injection
  outageData.filter(c => c.score >= 3).forEach(c => {
    addLiveItem(`🔌 INTERNET OUTAGE — ${c.name}`, 'OONI/CAIDA',
      new Date().toISOString(), 'https://explorer.ooni.org', 'CYBER', 'al', false);
  });
}

// ── Fetch one country boundary via Worker → Overpass OSM ─────────────────────
async function _fetchBoundary(iso) {
  if (_boundaryCache[iso]) return;
  try {
    const r = await fetch(`${PROXY_BASE}/api/boundary?iso=${iso}`,
      { signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const geom = _overpassToGeoJSON(data);
    if (geom) { _boundaryCache[iso] = geom; console.log('[WWO] Boundary cached:', iso); }
    else console.warn('[WWO] No geometry for', iso);
  } catch(e) { console.warn('[WWO] Boundary failed:', iso, e.message); }
}

function _overpassToGeoJSON(data) {
  const relation = data?.elements?.find(e => e.type === 'relation');
  if (!relation?.members) return null;

  // Separate outer and inner ways — each way is a line segment, not a closed ring
  const outerWays = [], innerWays = [];
  relation.members.forEach(m => {
    if (m.type !== 'way' || !m.geometry?.length) return;
    const pts = m.geometry.map(pt => [pt.lon, pt.lat]);
    if (pts.length < 2) return;
    (m.role === 'inner' ? innerWays : outerWays).push(pts);
  });

  if (!outerWays.length) return null;

  // Stitch disconnected ways into closed rings by chaining end→start matches
  function stitchWays(ways) {
    const rings = [];
    let remaining = ways.map(w => [...w]);

    while (remaining.length > 0) {
      // Start a new ring with the first remaining way
      let ring = remaining.shift();
      let changed = true;

      while (changed) {
        changed = false;
        const head = ring[0];
        const tail = ring[ring.length - 1];

        for (let i = 0; i < remaining.length; i++) {
          const w = remaining[i];
          const wHead = w[0], wTail = w[w.length - 1];
          const EPS = 1e-6;

          const tailMatchHead = Math.abs(tail[0]-wHead[0])<EPS && Math.abs(tail[1]-wHead[1])<EPS;
          const tailMatchTail = Math.abs(tail[0]-wTail[0])<EPS && Math.abs(tail[1]-wTail[1])<EPS;
          const headMatchTail = Math.abs(head[0]-wTail[0])<EPS && Math.abs(head[1]-wTail[1])<EPS;
          const headMatchHead = Math.abs(head[0]-wHead[0])<EPS && Math.abs(head[1]-wHead[1])<EPS;

          if (tailMatchHead) {
            ring = [...ring, ...w.slice(1)];
          } else if (tailMatchTail) {
            ring = [...ring, ...[...w].reverse().slice(1)];
          } else if (headMatchTail) {
            ring = [...w, ...ring.slice(1)];
          } else if (headMatchHead) {
            ring = [[...w].reverse(), ...ring.slice(1)].flat();
          } else { continue; }

          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }

      // Close ring if not already closed
      const f = ring[0], l = ring[ring.length-1];
      if (Math.abs(f[0]-l[0]) > 1e-6 || Math.abs(f[1]-l[1]) > 1e-6) ring.push([...f]);
      if (ring.length >= 4) rings.push(ring);
    }
    return rings;
  }

  const outerRings = stitchWays(outerWays);
  const innerRings = stitchWays(innerWays);

  if (!outerRings.length) return null;

  if (outerRings.length === 1) {
    return { type:'Polygon', coordinates:[outerRings[0], ...innerRings] };
  } else {
    // MultiPolygon — assign inner rings to nearest outer
    return { type:'MultiPolygon', coordinates: outerRings.map(outer => [outer]) };
  }
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
  // Plasma recolours automatically from body.nerv check in _plasmaWriteFrame
  if (outageData.length) _applyOutageData();
}

function setOutageVis(vis) {
  outageVis = vis;
  if (_map) ['outage-fill','outage-hatch','outage-border'].forEach(id => {
    try { _map.setLayoutProperty(id,'visibility', vis?'visible':'none'); } catch(e){}
  });
}
