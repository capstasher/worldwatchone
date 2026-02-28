// ====== NET OUTAGES ======
// Source: OONI Explorer API — live probe-confirmed interference by country
// Boundaries: OSM Overpass via Worker /api/boundary — exact country shapes
// Perf: canvas hatch throttled to ~10fps; boundaries cached for session

const OUTAGE_REFRESH_MS = 4 * 60 * 1000; // 4min

const _boundaryCache = {}; // ISO2 → GeoJSON geometry

let outageVis     = true;
let outageData    = [];
let _map          = null;
let _hatchCanvas  = null;
let _hatchCtx     = null;
let _hatchFeatures= [];
let _hatchFrame   = 0;
let _lastHatchDraw= 0;
const HATCH_FPS   = 10; // cap canvas redraws

// ── Init ─────────────────────────────────────────────────────────────────────
function initOutages(map) {
  _map = map;

  map.addSource('outage-zones', { type:'geojson', data:{type:'FeatureCollection',features:[]} });
  map.addLayer({ id:'outage-fill',   type:'fill',   source:'outage-zones',
    paint:{ 'fill-color':['get','fillColor'], 'fill-opacity':0.08 } });
  map.addLayer({ id:'outage-border', type:'line',   source:'outage-zones',
    paint:{ 'line-color':['get','fillColor'], 'line-width':1.5, 'line-opacity':0.9 } });

  _initHatchCanvas(map);
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
      properties: { fillColor, outageCode:o.code, outageLevel:o.level, outageScore:o.score }
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

  const outerRings = [], innerRings = [];
  relation.members.forEach(m => {
    if (m.type !== 'way' || !m.geometry?.length) return;
    const ring = m.geometry.map(pt => [pt.lon, pt.lat]);
    if (ring.length < 4) return;
    const f = ring[0], l = ring[ring.length-1];
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push([...f]);
    (m.role === 'inner' ? innerRings : outerRings).push(ring);
  });

  if (!outerRings.length) return null;
  return outerRings.length === 1
    ? { type:'Polygon',      coordinates:[outerRings[0], ...innerRings] }
    : { type:'MultiPolygon', coordinates:outerRings.map(r => [r]) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _setMapData(features) {
  if (!_map) return;
  const src = _map.getSource('outage-zones');
  if (src) src.setData({ type:'FeatureCollection', features });
  _hatchFeatures = features;
}

function _updateOutageCounter() {
  const el = document.getElementById('outc');
  if (el) el.textContent = outageData.length;
}

function _setNetStatus(text, color) {
  const el = document.getElementById('net-status');
  if (el) { el.textContent = text; el.style.color = color; }
}

function outageThemeUpdate() { if (outageData.length) _applyOutageData(); }

function setOutageVis(vis) {
  outageVis = vis;
  if (_map) ['outage-fill','outage-border'].forEach(id => {
    try { _map.setLayoutProperty(id,'visibility', vis?'visible':'none'); } catch(e){}
  });
}

// ── Canvas hatch+wobble — throttled to HATCH_FPS ─────────────────────────────
function _initHatchCanvas(map) {
  const container = map.getContainer();
  _hatchCanvas = document.createElement('canvas');
  _hatchCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:2;';
  container.appendChild(_hatchCanvas);
  _hatchCtx = _hatchCanvas.getContext('2d');

  const resize = () => {
    _hatchCanvas.width  = container.clientWidth;
    _hatchCanvas.height = container.clientHeight;
  };
  resize();
  window.addEventListener('resize', resize);
  map.on('resize', resize);

  (function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - _lastHatchDraw < 1000 / HATCH_FPS) return;
    _lastHatchDraw = ts;
    _drawHatch();
  })(0);
}

function _drawHatch() {
  if (!_hatchCtx || !_map) return;
  const ctx = _hatchCtx, W = _hatchCanvas.width, H = _hatchCanvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!outageVis || !_hatchFeatures.length) return;

  const t      = _hatchFrame++ * 0.1; // advance slower since we're throttled
  const isNerv = document.body.classList.contains('nerv');
  const col    = isNerv ? 'rgba(224,112,32,0.55)' : 'rgba(1,168,52,0.55)';
  const spacing = 9;

  _hatchFeatures.forEach(feat => {
    const geom = feat.geometry;
    if (!geom) return;
    const allRings = geom.type === 'Polygon'      ? geom.coordinates
                   : geom.type === 'MultiPolygon' ? geom.coordinates.flat(1) : [];

    allRings.forEach(ring => {
      const pts = [];
      for (const [lon,lat] of ring) {
        try { pts.push(_map.project([lon,lat])); } catch(e) {}
      }
      if (pts.length < 3) return;

      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for (const p of pts) {
        if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x;
        if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y;
      }
      if (maxX<0||minX>W||maxY<0||minY>H) return;

      ctx.save();
      ctx.beginPath();
      pts.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.closePath();
      ctx.clip();

      ctx.strokeStyle = col;
      ctx.lineWidth   = 1;
      const diag = (maxX-minX)+(maxY-minY);
      for (let k = -diag; k < diag; k += spacing) {
        ctx.beginPath();
        const steps = Math.max(2, Math.ceil((maxY-minY)/5));
        for (let s=0; s<=steps; s++) {
          const frac = s/steps;
          const y    = minY + (maxY-minY)*frac;
          const x    = minX + k + (y-minY);
          const wb   = Math.sin(t + y*0.06 + k*0.04) * 4;
          s ? ctx.lineTo(x+wb,y) : ctx.moveTo(x+wb,y);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  });
}
