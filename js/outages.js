// ====== NET OUTAGES ======
// Sources: NetBlocks RSS (free, no key) + Cloudflare Radar BGP anomalies
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

// ── Fetch outage data ─────────────────────────────────────────────────────────
// Primary:   NetBlocks RSS  →  parse affected countries from incident titles
// Secondary: Cloudflare Radar BGP anomaly feed
async function fetchOutages() {
  _setNetStatus('NET: SYNCING', 'var(--warning)');

  const found = await _tryNetBlocks() || await _tryCloudflareRadar();

  if (found) {
    _setNetStatus(`NET: ${outageData.length} OUTAGE${outageData.length!==1?'S':''}`,
      outageData.length > 0 ? 'var(--accent)' : 'var(--text-dim)');
  } else {
    _setNetStatus('NET: ERROR', '#ff2222');
    // Clear existing display but don't crash
    outageData = [];
    _setMapData([]);
    _updateOutageCounter();
  }
}

async function _tryNetBlocks() {
  // NetBlocks publishes free incident RSS — titles contain country names
  const url = 'https://netblocks.org/feed';
  try {
    const r = await fetch(`${PROXY_BASE}/api/proxy?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return false;
    const xml = await r.text();
    if (xml.length < 100) return false;

    const items = _parseRSSItems(xml);
    const countries = _extractCountriesFromItems(items);
    console.log('[WWO] NetBlocks items:', items.length, '→ countries:', countries.map(c=>c.code));

    outageData = countries;
    await _applyOutageData();
    return true;
  } catch(e) {
    console.warn('[WWO] NetBlocks failed:', e.message);
    return false;
  }
}

async function _tryCloudflareRadar() {
  // Cloudflare Radar routing anomalies — free, no key needed for summary
  const url = 'https://radar.cloudflare.com/api/v4/radar/bgp/hijacks/events?dateRange=1d&format=json';
  try {
    const r = await fetch(`${PROXY_BASE}/api/proxy?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return false;
    const d = await r.json();
    const events = d?.result?.asn_events || d?.result?.events || [];

    // Extract country codes from BGP events
    const byCode = new Map();
    events.forEach(ev => {
      const code = (ev.country || ev.originCountry || '').toUpperCase();
      if (code.length !== 2) return;
      if (!byCode.has(code)) byCode.set(code, { code, name: code, level: 'warning', score: 2 });
    });

    if (byCode.size === 0) return false;
    outageData = [...byCode.values()];
    console.log('[WWO] CF Radar BGP events:', events.length, '→ countries:', outageData.map(c=>c.code));
    await _applyOutageData();
    return true;
  } catch(e) {
    console.warn('[WWO] CF Radar failed:', e.message);
    return false;
  }
}

// ── Parse RSS XML into items ──────────────────────────────────────────────────
function _parseRSSItems(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = [];
  doc.querySelectorAll('item').forEach(el => {
    const title = el.querySelector('title')?.textContent || '';
    const desc  = el.querySelector('description')?.textContent || '';
    const date  = el.querySelector('pubDate')?.textContent || '';
    const link  = el.querySelector('link')?.textContent || '';
    items.push({ title, desc, date, link });
  });
  return items;
}

// ── Extract country codes from NetBlocks-style incident text ──────────────────
// NetBlocks titles like: "Iran internet disrupted amid protests"
// or: "#NetBlocks reports major outage in Venezuela"
const COUNTRY_NAME_MAP = {
  'iran':'IR','russia':'RU','ukraine':'UA','cuba':'CU','north korea':'KP',
  'syria':'SY','ethiopia':'ET','myanmar':'MM','belarus':'BY','turkmenistan':'TM',
  'pakistan':'PK','bangladesh':'BD','nigeria':'NG','sudan':'SD','venezuela':'VE',
  'afghanistan':'AF','india':'IN','china':'CN','turkey':'TR','egypt':'EG',
  'iraq':'IQ','libya':'LY','azerbaijan':'AZ','kazakhstan':'KZ','uzbekistan':'UZ',
  'tajikistan':'TJ','kyrgyzstan':'KG','cambodia':'KH','laos':'LA','senegal':'SN',
  'mali':'ML','guinea':'GN','mauritania':'MR','chad':'TD','niger':'NE',
  'eritrea':'ER','zimbabwe':'ZW','ethiopia':'ET','somalia':'SO','myanmar':'MM',
  'burma':'MM','venezuela':'VE','nicaragua':'NI','haiti':'HT','cameroon':'CM',
  'indonesia':'ID','brazil':'BR','mexico':'MX','colombia':'CO','argentina':'AR',
  'peru':'PE','kazakhstan':'KZ','gabon':'GA','togo':'TG','rwanda':'RW',
  'drc':'CD','congo':'CG','mozambique':'MZ','zambia':'ZM','angola':'AO',
  'mauritius':'MU','eswatini':'SZ','lesotho':'LS','namibia':'NA','botswana':'BW',
  'tanzania':'TZ','kenya':'KE','uganda':'UG','ghana':'GH','senegal':'SN',
  'burkina faso':'BF','ivory coast':'CI','benin':'BJ','tonga':'TO',
};

function _extractCountriesFromItems(items) {
  const found = new Map();
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000; // last 7 days

  items.forEach(item => {
    const pubDate = new Date(item.date).getTime();
    if (pubDate && pubDate < cutoff) return; // skip old items

    const text = (item.title + ' ' + item.desc).toLowerCase();

    // Direct ISO2 code mentions e.g. "#Iran" or "in Iran"
    for (const [name, code] of Object.entries(COUNTRY_NAME_MAP)) {
      if (text.includes(name)) {
        const severity = text.includes('disrupted') || text.includes('outage') ||
                         text.includes('shutdown') || text.includes('blackout')
          ? (text.includes('total') || text.includes('complete') || text.includes('major') ? 'critical' : 'warning')
          : 'warning';
        const score = severity === 'critical' ? 3 : 2;
        if (!found.has(code) || found.get(code).score < score)
          found.set(code, { code, name: name.charAt(0).toUpperCase()+name.slice(1), level: severity, score });
      }
    }
  });

  return [...found.values()];
}

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
    addLiveItem(`🔌 INTERNET OUTAGE — ${c.name}`, 'NetBlocks',
      new Date().toISOString(), 'https://netblocks.org', 'CYBER', 'al', false);
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
