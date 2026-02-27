// ====== NET OUTAGES — IODA real-time internet disruption overlay ======
// Source: IODA v2 (Internet Outage Detection & Analysis) — CAIDA / Georgia Tech
// Data: country-level BGP visibility + active probing signals
// Effect: animated hatched fill + wobble shader, constrained within polygon borders

const OUTAGE_REFRESH_MS = 5 * 60 * 1000; // 5min
const PROXY_BASE = window.WWO_PROXY || 'https://wwo-proxy.capstasher.workers.dev';

// ISO2 → approx bounding box centre [lon, lat] for flyTo
// Full country GeoJSON for polygon fill comes from a free CDN source
const COUNTRY_CENTROIDS = {
  AF:[65.0,33.9],AG:[[-17.2],14.7],AL:[20.1,41.2],AM:[44.9,40.1],AO:[17.9,-11.2],
  AR:[-63.6,-38.4],AT:[14.5,47.5],AU:[133.8,-25.3],AZ:[47.6,40.1],BA:[17.8,44.2],
  BD:[90.4,23.7],BE:[4.5,50.5],BF:[-1.6,12.4],BG:[25.5,42.7],BI:[29.9,-3.4],
  BJ:[2.3,9.3],BN:[114.7,4.5],BO:[-64.7,-16.3],BR:[-51.9,-14.2],BT:[90.4,27.5],
  BW:[24.7,-22.3],BY:[28.0,53.7],BZ:[-88.5,17.2],CA:[-96.8,56.1],CD:[23.6,-2.9],
  CF:[20.9,6.6],CG:[15.8,-0.2],CH:[8.2,46.8],CI:[-5.5,7.5],CL:[-71.5,-35.7],
  CM:[12.4,3.9],CN:[104.2,35.9],CO:[-74.3,4.1],CR:[-84.0,9.7],CU:[-79.5,21.5],
  CV:[-24.0,16.0],CY:[33.4,35.1],CZ:[15.5,49.8],DE:[10.5,51.2],DJ:[42.6,11.8],
  DK:[10.0,56.3],DO:[-70.2,19.0],DZ:[2.6,28.2],EC:[-78.1,-1.8],EE:[25.0,58.6],
  EG:[30.8,26.8],ER:[39.8,15.2],ES:[-3.7,40.2],ET:[40.5,9.1],FI:[26.0,64.0],
  FJ:[178.1,-17.7],FR:[2.2,46.2],GA:[11.6,-0.8],GB:[-3.4,55.4],GE:[43.4,42.3],
  GH:[-1.0,7.9],GN:[-11.8,11.0],GQ:[10.3,1.7],GR:[21.8,39.1],GT:[-90.2,15.8],
  GW:[-15.2,11.8],GY:[-58.9,4.9],HN:[-86.6,15.2],HR:[15.2,45.1],HT:[-72.3,19.0],
  HU:[19.5,47.2],ID:[117.2,-0.8],IE:[-8.1,53.1],IL:[34.9,31.5],IN:[78.7,20.6],
  IQ:[43.7,33.2],IR:[53.7,32.4],IS:[-18.5,65.0],IT:[12.6,42.5],JM:[-77.3,18.1],
  JO:[36.2,31.2],JP:[138.3,36.2],KE:[37.9,0.0],KG:[74.7,41.2],KH:[104.9,12.6],
  KI:[173.0,1.9],KM:[43.3,-11.9],KP:[127.5,40.3],KR:[127.8,36.5],KW:[47.5,29.3],
  KZ:[66.9,48.0],LA:[103.8,18.2],LB:[35.5,33.9],LI:[9.6,47.1],LK:[80.7,7.9],
  LR:[-9.4,6.4],LS:[28.2,-29.6],LT:[23.9,55.2],LU:[6.1,49.8],LV:[24.6,56.9],
  LY:[17.2,26.3],MA:[-7.1,31.8],MC:[7.4,43.7],MD:[28.4,47.4],ME:[19.4,42.7],
  MG:[46.9,-18.8],MK:[21.7,41.6],ML:[-1.5,17.6],MM:[96.5,16.9],MN:[103.8,46.9],
  MR:[-10.9,20.3],MT:[14.4,35.9],MU:[57.6,-20.3],MV:[73.5,3.2],MW:[34.3,-13.3],
  MX:[-102.6,23.9],MY:[109.7,4.2],MZ:[35.5,-18.7],NA:[18.5,-22.0],NE:[8.1,16.1],
  NG:[8.7,9.1],NI:[-85.2,12.9],NL:[5.3,52.3],NO:[8.5,60.5],NP:[83.9,28.4],
  NR:[166.9,-0.5],NZ:[172.5,-42.3],OM:[57.6,21.5],PA:[-80.8,8.5],PE:[-75.0,-9.2],
  PG:[143.9,-6.3],PH:[121.8,12.9],PK:[69.3,30.4],PL:[19.1,52.1],PT:[-8.2,39.4],
  PW:[134.6,7.5],PY:[-58.4,-23.4],QA:[51.2,25.4],RO:[24.9,45.9],RS:[21.0,44.0],
  RU:[105.3,61.5],RW:[29.9,-1.9],SA:[45.1,24.0],SB:[160.2,-9.6],SD:[29.9,12.9],
  SE:[18.6,60.1],SG:[103.8,1.4],SI:[14.8,46.1],SK:[19.7,48.7],SL:[-11.8,8.5],
  SM:[12.5,43.9],SN:[-14.5,14.5],SO:[45.3,6.1],SR:[-56.0,3.9],SS:[30.2,7.3],
  ST:[6.6,0.2],SV:[-88.9,13.8],SY:[38.5,35.0],SZ:[31.5,-26.5],TD:[17.5,15.5],
  TG:[0.8,8.6],TH:[100.9,15.9],TJ:[71.3,38.9],TL:[125.7,-8.8],TM:[59.6,40.0],
  TN:[9.5,34.0],TO:[175.2,-21.2],TR:[35.2,38.9],TT:[-61.2,10.7],TV:[179.2,-8.5],
  TZ:[34.9,-6.4],UA:[32.0,49.0],UG:[32.3,1.4],US:[-98.6,39.8],UY:[-55.8,-33.0],
  UZ:[63.9,41.4],VA:[12.5,41.9],VC:[-61.2,13.3],VE:[-66.6,8.0],VN:[108.3,14.1],
  VU:[167.0,-15.4],WS:[-172.2,-13.8],YE:[47.6,15.6],ZA:[25.1,-29.0],ZM:[27.8,-13.5],ZW:[29.9,-19.0],
};

let outageVis = true;
let outageData = []; // [{code, name, severity, score}]
let outageAnimHandle = null;
let _map = null;

// ── Called from map-init.js after map loaded ──────────────────────────────────
function initOutages(map) {
  _map = map;
  // Source + layers for outage polygon fill and animated hatch
  map.addSource('outage-zones', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Solid tinted fill (low opacity)
  map.addLayer({
    id: 'outage-fill',
    type: 'fill',
    source: 'outage-zones',
    paint: {
      'fill-color': ['get', 'fillColor'],
      'fill-opacity': 0.12
    }
  });

  // Crisp border
  map.addLayer({
    id: 'outage-border',
    type: 'line',
    source: 'outage-zones',
    paint: {
      'line-color': ['get', 'fillColor'],
      'line-width': 1.5,
      'line-opacity': 0.75
    }
  });

  // Hatch overlay — rendered on a canvas texture updated per frame
  // We use a custom canvas approach via the map's canvas overlay pattern
  _initHatchCanvas(map);

  // Initial fetch + periodic refresh
  fetchOutages();
  setInterval(fetchOutages, OUTAGE_REFRESH_MS);

  lMap.outages = ['outage-fill', 'outage-border'];
}

// ── Fetch IODA outage alerts ──────────────────────────────────────────────────
async function fetchOutages() {
  try {
    const r = await fetch(`${PROXY_BASE}/api/outages`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('IODA ' + r.status);
    const d = await r.json();
    parseIODA(d);
  } catch(e) {
    console.warn('[WWO] IODA outages error:', e.message);
    // Fallback: try direct (may work without CORS issues from some regions)
    try {
      const now = Math.floor(Date.now()/1000);
      const r2 = await fetch(`https://api.ioda.caida.org/v2/alerts?from=${now-86400}&until=${now}&limit=100`,
        { signal: AbortSignal.timeout(12000) });
      if (r2.ok) { const d2 = await r2.json(); parseIODA(d2); }
    } catch(e2) {}
  }
}

function parseIODA(d) {
  // IODA v2 response: { data: { alerts: [ { entity:{type,code,name}, time, level, ... } ] } }
  const alerts = d?.data?.alerts || d?.alerts || [];
  const byCountry = new Map();

  alerts.forEach(a => {
    const entity = a.entity || a;
    if (!entity || entity.type !== 'country') return;
    const code = (entity.code || '').toUpperCase();
    const name = entity.name || code;
    // Score based on alert level (IODA: 'critical', 'warning', 'normal')
    const level = (a.level || '').toLowerCase();
    const score = level === 'critical' ? 3 : level === 'warning' ? 2 : 1;

    if (!byCountry.has(code) || byCountry.get(code).score < score) {
      byCountry.set(code, { code, name, level, score });
    }
  });

  outageData = [...byCountry.values()].filter(c => c.score >= 2); // warning+critical only

  _buildOutageFeatures();
  _updateOutageCounter();

  if (outageData.length > 0) {
    // Inject critical outages into OSINT feed
    outageData.filter(c => c.score >= 3).forEach(c => {
      addLiveItem(`🔌 INTERNET OUTAGE DETECTED — ${c.name} (${c.code})`,
        'IODA/CAIDA', new Date().toISOString(),
        'https://ioda.live', 'CYBER', 'al', false);
    });
  }

  console.log(`[WWO] IODA: ${outageData.length} active internet disruptions`);
}

// ── Convert outage country codes → GeoJSON features using built-in Natural Earth borders ─
// We use a simplified country border dataset fetched from a reliable CDN
async function _buildOutageFeatures() {
  if (!_map || outageData.length === 0) {
    const src = _map?.getSource('outage-zones');
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
    return;
  }

  const needed = new Set(outageData.map(c => c.code));
  const theme = document.body.classList.contains('nerv') ? 'nerv' : 'ctrl';
  const fillColor = theme === 'nerv' ? '#e07020' : '#01a834';

  // Try to get country GeoJSON (simplified Natural Earth via public CDN)
  let geoData = null;
  const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
  try {
    if (!window._countryGeoCache) {
      const r = await fetch(PROXY_BASE + '/api/proxy?url=' + encodeURIComponent(GEOJSON_URL),
        { signal: AbortSignal.timeout(30000) });
      if (r.ok) {
        window._countryGeoCache = await r.json();
        console.log('[WWO] Country GeoJSON cached:', window._countryGeoCache.features?.length, 'features');
      }
    }
    geoData = window._countryGeoCache;
  } catch(e) {
    console.warn('[WWO] Country GeoJSON fetch failed:', e.message);
  }

  let features = [];

  if (geoData?.features) {
    // Match by ISO_A2 property in the GeoJSON
    features = geoData.features
      .filter(f => {
        const iso = f.properties?.ISO_A2 || f.properties?.iso_a2 || f.properties?.ADM0_A3?.slice(0,2) || '';
        return needed.has(iso.toUpperCase());
      })
      .map(f => {
        const iso = (f.properties?.ISO_A2 || f.properties?.iso_a2 || '').toUpperCase();
        const outage = outageData.find(c => c.code === iso);
        return {
          ...f,
          properties: {
            ...f.properties,
            outageCode: iso,
            outageName: outage?.name || iso,
            outageLevel: outage?.level || 'warning',
            outageScore: outage?.score || 2,
            fillColor,
          }
        };
      });
  }

  // Fallback: generate approximate bounding-box polygons from COUNTRY_CENTROIDS
  if (features.length < needed.size) {
    const missing = [...needed].filter(code => !features.find(f => f.properties.outageCode === code));
    missing.forEach(code => {
      const c = COUNTRY_CENTROIDS[code];
      if (!c) return;
      const [lon, lat] = c;
      const pad = 3.5; // rough ~7° box
      const outage = outageData.find(x => x.code === code);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[
          [lon-pad, lat-pad], [lon+pad, lat-pad], [lon+pad, lat+pad],
          [lon-pad, lat+pad], [lon-pad, lat-pad]
        ]] },
        properties: { outageCode: code, outageName: outage?.name || code,
          outageLevel: outage?.level || 'warning', outageScore: outage?.score || 2, fillColor }
      });
    });
  }

  const src = _map.getSource('outage-zones');
  if (src) src.setData({ type: 'FeatureCollection', features });

  // Trigger hatch redraw with new feature set
  _hatchFeatures = features;
}

function _updateOutageCounter() {
  const el = document.getElementById('outc');
  if (el) el.textContent = outageData.length;
}

// ── Animated hatch+wobble canvas overlay ─────────────────────────────────────
// Renders onto a canvas that sits above the MapLibre canvas.
// Hatch lines are drawn in screen space, clipped to projected polygon bounds.
// A sine-wave displacement creates the "melt/wobble" effect.

let _hatchCanvas = null;
let _hatchCtx = null;
let _hatchFeatures = [];
let _hatchFrame = 0;

function _initHatchCanvas(map) {
  // Create overlay canvas sized to map container
  const container = map.getContainer();
  _hatchCanvas = document.createElement('canvas');
  _hatchCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:2;';
  container.appendChild(_hatchCanvas);
  _hatchCtx = _hatchCanvas.getContext('2d');

  function resize() {
    _hatchCanvas.width  = container.clientWidth;
    _hatchCanvas.height = container.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  map.on('resize', resize);

  // Animate every frame while outages layer is visible
  function frame() {
    outageAnimHandle = requestAnimationFrame(frame);
    _drawHatch();
  }
  frame();

  // Redraw on map move/zoom
  map.on('move', () => { /* handled by rAF */ });
}

function _drawHatch() {
  if (!_hatchCtx || !_map) return;
  const ctx = _hatchCtx;
  const W = _hatchCanvas.width, H = _hatchCanvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!outageVis || _hatchFeatures.length === 0) return;

  const t = _hatchFrame++ * 0.018; // time for wobble
  const isNerv = document.body.classList.contains('nerv');
  const col = isNerv ? 'rgba(224,112,32,' : 'rgba(1,168,52,';

  _hatchFeatures.forEach(feature => {
    const geom = feature.geometry;
    if (!geom) return;

    // Project all polygon rings to screen coords
    const rings = geom.type === 'Polygon' ? geom.coordinates
      : geom.type === 'MultiPolygon' ? geom.coordinates.flat(1) : [];

    rings.forEach(ring => {
      const screenPts = ring.map(([lon, lat]) => {
        try { return _map.project([lon, lat]); }
        catch(e) { return null; }
      }).filter(Boolean);

      if (screenPts.length < 3) return;

      // Bounding box of this ring in screen space
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      screenPts.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      });

      // Skip rings entirely off-screen
      if (maxX < 0 || minX > W || maxY < 0 || minY > H) return;

      // Create clipping path from projected ring
      ctx.save();
      ctx.beginPath();
      screenPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.clip();

      // Draw animated hatching lines (diagonal, ~45°)
      const spacing = 8;
      const lineLen = maxX - minX + maxY - minY; // diagonal span

      ctx.strokeStyle = col + '0.55)';
      ctx.lineWidth = 1;

      for (let offset = minX - lineLen; offset < maxX + spacing; offset += spacing) {
        // Wobble: displace each hatch line's start/end using sin wave
        const wobbleAmp = 4;
        const wobbleFreq = 0.06;

        ctx.beginPath();
        // Walk along the line and wobble Y position
        const x0 = offset, y0 = minY - 10;
        const x1 = offset + (maxY - minY + 20), y1 = maxY + 10;

        const steps = Math.max(2, Math.floor((y1 - y0) / 4));
        for (let s = 0; s <= steps; s++) {
          const frac = s / steps;
          const lx = x0 + (x1 - x0) * frac;
          const ly = y0 + (y1 - y0) * frac;
          // Wobble perpendicular to the line direction (~perpendicular to 45° = horizontal)
          const wobble = Math.sin(t + ly * wobbleFreq + offset * 0.04) * wobbleAmp;
          s === 0 ? ctx.moveTo(lx + wobble, ly) : ctx.lineTo(lx + wobble, ly);
        }
        ctx.stroke();
      }

      ctx.restore();
    });
  });
}

// ── Theme change hook — recolour when NERV/CTRL switches ─────────────────────
function outageThemeUpdate() {
  if (_hatchFeatures.length > 0) _buildOutageFeatures();
}

// ── Visibility toggle (called by togL) ───────────────────────────────────────
function setOutageVis(vis) {
  outageVis = vis;
  if (_map) {
    ['outage-fill','outage-border'].forEach(id => {
      try { _map.setLayoutProperty(id, 'visibility', vis ? 'visible' : 'none'); } catch(e){}
    });
  }
}
