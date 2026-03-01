// ====== NET OUTAGES ======
// Source: OONI Explorer API — live probe-confirmed interference by country
// Boundaries: OSM Overpass via Worker /api/boundary — exact country shapes
// Perf: canvas hatch throttled to ~10fps; boundaries cached for session

const OUTAGE_REFRESH_MS = 10 * 60 * 1000; // 10min (was 4min — OONI data is 24h window)

const _boundaryCache = {}; // ISO2 → GeoJSON geometry

let outageVis     = true;
let outageData    = [];
let _map          = null;
// hatch pattern registered as MapLibre image — no canvas overlay needed

// ── Init ─────────────────────────────────────────────────────────────────────

// Plasma tile — 48x48 RGBA, updated inside map.on('render')
const _PS = 96;
const _PB = new Uint8Array(_PS * _PS * 4);
const _BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];

function _writePlasma(t) {
  const isNerv = document.body.classList.contains('nerv');
  const [pr,pg,pb] = isNerv ? [224,112,32] : [1,168,52];
  // Seamless tiling: all spatial frequencies must be integer multiples of 2π/tile
  // so sin(k * 2π * cx) = sin(k * 2π * (cx+1)) — left edge == right edge always
  const TAU = Math.PI * 2;
  let i = 0;
  for (let y = 0; y < _PS; y++) {
    for (let x = 0; x < _PS; x++) {
      const cx = x / _PS, cy = y / _PS;
      // Each wave uses integer k so tile wraps perfectly
      let v = Math.sin(TAU * (2*cx + 1*cy) + t * 1.0)
            + Math.sin(TAU * (1*cx + 2*cy) + t * 1.3)
            + Math.sin(TAU * (3*cx + 1*cy) + t * 0.7)
            + Math.sin(TAU * (1*cx + 3*cy) + t * 0.9)
            + Math.sin(TAU * (2*cx + 2*cy) + t * 1.1) * 0.6;
      v = (v + 4.6) / 9.2; // normalise 0..1
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

function initOutages(map) {
  _map = map;

  map.addSource('outage-zones', { type:'geojson', data:{type:'FeatureCollection',features:[]} });

  // Thin solid base so the zone is visible even mid-transition
  map.addLayer({ id:'outage-fill', type:'fill', source:'outage-zones',
    paint:{ 'fill-color':['get','fillColor'], 'fill-opacity':0.06 } });

  // Plasma pattern layer
  map.addLayer({ id:'outage-hatch', type:'fill', source:'outage-zones',
    paint:{ 'fill-pattern':'plasma', 'fill-opacity':1 } });

  // Border
  map.addLayer({ id:'outage-border', type:'line', source:'outage-zones',
    paint:{ 'line-color':['get','fillColor'], 'line-width':1.5, 'line-opacity':0.9 } });

  // Seed the image in the atlas
  _writePlasma(0);
  map.addImage('plasma', { width:_PS, height:_PS, data:_PB }, { pixelRatio:1 });

  // Animation — inside MapLibre's own render event, no competing rAF
  let t = 0;
  map.on('render', () => {
    if (!outageVis || !outageData.length) return;
    t += 0.022;
    _writePlasma(t);
    // updateImage swaps pixel data in the existing GPU texture — cheap
    if (map.hasImage('plasma')) map.updateImage('plasma', { width:_PS, height:_PS, data:_PB });
    map.triggerRepaint();
  });

  fetchOutages();
  setInterval(fetchOutages, OUTAGE_REFRESH_MS);
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
    const _ctrl1 = new AbortController(); const _t1 = setTimeout(()=>_ctrl1.abort(),15000);
    let r; try { r = await fetch(`${PROXY_BASE}/api/proxy?url=${encodeURIComponent(url)}`,{ signal: _ctrl1.signal }); } finally { clearTimeout(_t1); }
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
    addLiveItem(`INTERNET OUTAGE — ${c.name}`, 'OONI/CAIDA',
      new Date().toISOString(), 'https://explorer.ooni.org', 'CYBER', 'al', false);
  });
}

// ── Fetch one country boundary via Worker → Overpass OSM ─────────────────────
async function _fetchBoundary(iso) {
  if (_boundaryCache[iso]) return;
  try {
    const _ctrl2 = new AbortController(); const _t2 = setTimeout(()=>_ctrl2.abort(),25000);
    let r; try { r = await fetch(`${PROXY_BASE}/api/boundary?iso=${iso}`,{ signal: _ctrl2.signal }); } finally { clearTimeout(_t2); }
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const geom = _overpassToGeoJSON(data);
    if (geom) { _boundaryCache[iso] = geom; console.log('[WWO] Boundary cached:', iso); }
    else console.warn('[WWO] No geometry for', iso);
  } catch(e) { console.warn('[WWO] Boundary failed:', iso, e.message); }
}

// Decimate a ring to at most maxPts vertices using simple stride sampling
function _decimate(ring, maxPts) {
  if (ring.length <= maxPts) return ring;
  const stride = Math.ceil(ring.length / maxPts);
  const out = [];
  for (let i = 0; i < ring.length - 1; i += stride) out.push(ring[i]);
  out.push(ring[0]); // close
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
    // Use a map keyed by endpoint coords for O(n) stitching
    // Build endpoint → way index lookup
    const EPS = 1e-5;
    function key(pt) { return `${(pt[0]/EPS|0)},${(pt[1]/EPS|0)}`; }

    let remaining = ways.map(w => [...w]);

    while (remaining.length > 0) {
      let ring = remaining.shift();
      let grew = true;

      while (grew) {
        grew = false;
        const tail = ring[ring.length - 1];
        const head = ring[0];
        const tk = key(tail), hk = key(head);

        for (let i = 0; i < remaining.length; i++) {
          const w = remaining[i];
          const wh = key(w[0]), wt = key(w[w.length-1]);

          if (wh === tk) {
            ring = ring.concat(w.slice(1));
          } else if (wt === tk) {
            ring = ring.concat(w.slice(0,-1).reverse());
          } else if (wt === hk) {
            ring = w.concat(ring.slice(1));
          } else if (wh === hk) {
            ring = w.slice().reverse().concat(ring.slice(1));
          } else { continue; }

          remaining.splice(i, 1);
          grew = true;
          break;
        }
      }

      const f = ring[0], l = ring[ring.length-1];
      if (key(f) !== key(l)) ring.push([...f]);
      // Decimate to max 800 pts per ring to keep tesselator happy
      const dec = _decimate(ring, 6000); // 6000 preserves detail on complex borders
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
    try { _map.setLayoutProperty(id,'visibility', vis?'visible':'none'); } catch(e){}
  });
}
