// ====== NET OUTAGES — internet disruption overlay ======
// Primary:  Cloudflare Radar /api/v4/radar/netflows/top/locations (free, no key, CORS ok)
// Fallback: IODA v2 (CAIDA) — open CORS, country-level BGP + active probing signals
// Rendering: canvas hatch+wobble overlay clipped to country polygons

const OUTAGE_REFRESH_MS = 5 * 60 * 1000;

// ── Country centroids (ISO2 → [lon, lat]) for bounding-box fallback ───────────
const COUNTRY_CENTROIDS = {
  AF:[65.0,33.9],AL:[20.1,41.2],AM:[44.9,40.1],AO:[17.9,-11.2],AR:[-63.6,-38.4],
  AT:[14.5,47.5],AU:[133.8,-25.3],AZ:[47.6,40.1],BA:[17.8,44.2],BD:[90.4,23.7],
  BE:[4.5,50.5],BF:[-1.6,12.4],BG:[25.5,42.7],BI:[29.9,-3.4],BJ:[2.3,9.3],
  BO:[-64.7,-16.3],BR:[-51.9,-14.2],BT:[90.4,27.5],BW:[24.7,-22.3],BY:[28.0,53.7],
  BZ:[-88.5,17.2],CA:[-96.8,56.1],CD:[23.6,-2.9],CF:[20.9,6.6],CG:[15.8,-0.2],
  CH:[8.2,46.8],CI:[-5.5,7.5],CL:[-71.5,-35.7],CM:[12.4,3.9],CN:[104.2,35.9],
  CO:[-74.3,4.1],CR:[-84.0,9.7],CU:[-79.5,21.5],CY:[33.4,35.1],CZ:[15.5,49.8],
  DE:[10.5,51.2],DJ:[42.6,11.8],DK:[10.0,56.3],DO:[-70.2,19.0],DZ:[2.6,28.2],
  EC:[-78.1,-1.8],EE:[25.0,58.6],EG:[30.8,26.8],ER:[39.8,15.2],ES:[-3.7,40.2],
  ET:[40.5,9.1],FI:[26.0,64.0],FR:[2.2,46.2],GA:[11.6,-0.8],GB:[-3.4,55.4],
  GE:[43.4,42.3],GH:[-1.0,7.9],GN:[-11.8,11.0],GQ:[10.3,1.7],GR:[21.8,39.1],
  GT:[-90.2,15.8],GW:[-15.2,11.8],GY:[-58.9,4.9],HN:[-86.6,15.2],HR:[15.2,45.1],
  HT:[-72.3,19.0],HU:[19.5,47.2],ID:[117.2,-0.8],IE:[-8.1,53.1],IL:[34.9,31.5],
  IN:[78.7,20.6],IQ:[43.7,33.2],IR:[53.7,32.4],IS:[-18.5,65.0],IT:[12.6,42.5],
  JM:[-77.3,18.1],JO:[36.2,31.2],JP:[138.3,36.2],KE:[37.9,0.0],KG:[74.7,41.2],
  KH:[104.9,12.6],KP:[127.5,40.3],KR:[127.8,36.5],KW:[47.5,29.3],KZ:[66.9,48.0],
  LA:[103.8,18.2],LB:[35.5,33.9],LK:[80.7,7.9],LR:[-9.4,6.4],LS:[28.2,-29.6],
  LT:[23.9,55.2],LU:[6.1,49.8],LV:[24.6,56.9],LY:[17.2,26.3],MA:[-7.1,31.8],
  MD:[28.4,47.4],ME:[19.4,42.7],MG:[46.9,-18.8],MK:[21.7,41.6],ML:[-1.5,17.6],
  MM:[96.5,16.9],MN:[103.8,46.9],MR:[-10.9,20.3],MW:[34.3,-13.3],MX:[-102.6,23.9],
  MY:[109.7,4.2],MZ:[35.5,-18.7],NA:[18.5,-22.0],NE:[8.1,16.1],NG:[8.7,9.1],
  NI:[-85.2,12.9],NL:[5.3,52.3],NO:[8.5,60.5],NP:[83.9,28.4],NZ:[172.5,-42.3],
  OM:[57.6,21.5],PA:[-80.8,8.5],PE:[-75.0,-9.2],PG:[143.9,-6.3],PH:[121.8,12.9],
  PK:[69.3,30.4],PL:[19.1,52.1],PT:[-8.2,39.4],PY:[-58.4,-23.4],QA:[51.2,25.4],
  RO:[24.9,45.9],RS:[21.0,44.0],RU:[105.3,61.5],RW:[29.9,-1.9],SA:[45.1,24.0],
  SD:[29.9,12.9],SE:[18.6,60.1],SG:[103.8,1.4],SI:[14.8,46.1],SK:[19.7,48.7],
  SL:[-11.8,8.5],SN:[-14.5,14.5],SO:[45.3,6.1],SR:[-56.0,3.9],SS:[30.2,7.3],
  SV:[-88.9,13.8],SY:[38.5,35.0],SZ:[31.5,-26.5],TD:[17.5,15.5],TG:[0.8,8.6],
  TH:[100.9,15.9],TJ:[71.3,38.9],TM:[59.6,40.0],TN:[9.5,34.0],TR:[35.2,38.9],
  TZ:[34.9,-6.4],UA:[32.0,49.0],UG:[32.3,1.4],US:[-98.6,39.8],UY:[-55.8,-33.0],
  UZ:[63.9,41.4],VE:[-66.6,8.0],VN:[108.3,14.1],YE:[47.6,15.6],ZA:[25.1,-29.0],
  ZM:[27.8,-13.5],ZW:[29.9,-19.0],
};

// Known approximate country bboxes [minLon,minLat,maxLon,maxLat] for fast polygon fallback
const COUNTRY_BBOX = {
  IR:[44.0,25.0,63.5,39.8], IQ:[38.8,29.0,48.8,37.4], SY:[35.7,32.3,42.4,37.3],
  YE:[42.5,12.0,55.0,19.0], AF:[60.5,29.3,74.9,38.5], PK:[61.0,23.7,77.0,37.1],
  RU:[27.3,41.2,190.0,81.9],CN:[73.5,18.2,135.1,53.6],US:[-125.0,24.4,-66.9,49.4],
  BR:[-74.0,-33.8,-28.8,5.3],IN:[68.2,8.1,97.4,37.1], EG:[24.7,22.0,36.9,31.7],
  SD:[22.0,3.5,38.7,23.0],  NG:[2.7,4.3,14.7,13.9],   ET:[33.0,3.4,47.9,15.0],
  CD:[12.2,-13.5,31.3,5.4], MX:[-117.1,14.5,-86.7,32.7],TR:[26.0,35.8,44.8,42.1],
  UA:[22.1,44.4,40.2,52.4], KP:[124.2,37.7,130.7,43.0],IR:[44.0,25.0,63.5,39.8],
  LY:[9.3,19.5,25.2,33.2],  MM:[92.2,9.8,101.2,28.5], VE:[-73.4,0.6,-59.8,12.2],
  MR:[-17.1,14.7,-4.8,27.3],ML:[-4.2,10.1,4.3,25.0],  NE:[0.2,11.7,15.9,23.5],
  TD:[13.5,7.4,24.0,23.5],  SD:[22.0,3.5,38.7,23.0],
};

let outageVis = true;
let outageData = [];
let _map = null;
let _hatchCanvas = null;
let _hatchCtx = null;
let _hatchFeatures = [];
let _hatchFrame = 0;

// ── Init (called from map-init.js after map loaded) ───────────────────────────
function initOutages(map) {
  _map = map;

  map.addSource('outage-zones', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  map.addLayer({
    id: 'outage-fill',
    type: 'fill',
    source: 'outage-zones',
    paint: { 'fill-color': ['get','fillColor'], 'fill-opacity': 0.10 }
  });

  map.addLayer({
    id: 'outage-border',
    type: 'line',
    source: 'outage-zones',
    paint: { 'line-color': ['get','fillColor'], 'line-width': 1.4, 'line-opacity': 0.8 }
  });

  _initHatchCanvas(map);
  fetchOutages();
  setInterval(fetchOutages, OUTAGE_REFRESH_MS);
}

// ── Multi-source fetch with full diagnostics ──────────────────────────────────
async function fetchOutages() {
  const now  = Math.floor(Date.now() / 1000);
  const from = now - 86400;

  const attempts = [
    // 1. IODA v2 outages — direct (open CORS)
    {
      label: 'IODA /v2/outages direct',
      fn: () => fetch(
        `https://api.ioda.caida.org/v2/outages?entityType=country&from=${from}&until=${now}&limit=200`,
        { signal: AbortSignal.timeout(18000), headers:{ Accept:'application/json' } }
      )
    },
    // 2. IODA via Worker proxy
    {
      label: 'IODA via Worker',
      fn: () => fetch(`${PROXY_BASE}/api/outages`, { signal: AbortSignal.timeout(22000) })
    },
    // 3. IODA signals/events — broader endpoint
    {
      label: 'IODA /v2/signals/events direct',
      fn: () => fetch(
        `https://api.ioda.caida.org/v2/signals/events?entityType=country&from=${from}&until=${now}`,
        { signal: AbortSignal.timeout(18000), headers:{ Accept:'application/json' } }
      )
    },
  ];

  for (const { label, fn } of attempts) {
    try {
      const r = await fn();
      const text = await r.text();
      console.log(`[WWO] ${label} → HTTP ${r.status}, body length: ${text.length}`);
      console.log(`[WWO] Body preview:`, text.slice(0, 400));
      if (!r.ok || text.length < 5) continue;
      let d;
      try { d = JSON.parse(text); } catch(e) { console.warn('[WWO] JSON parse failed'); continue; }
      const found = parseIODA(d);
      if (found >= 0) return; // parsed successfully (even 0 results is valid)
    } catch(e) {
      console.warn(`[WWO] ${label} error:`, e.message);
    }
  }

  // If all sources fail, inject a known static test to verify rendering
  console.warn('[WWO] All IODA sources failed — using static test data');
  _injectTestData();
}

// ── Parse IODA response — returns count parsed (-1 = unrecognised shape) ──────
function parseIODA(d) {
  const byCountry = new Map();

  function ingestArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    let n = 0;
    arr.forEach(item => {
      // Shape A: { entity:{type,code,name}, level, ... }
      // Shape B: { entityType, entityCode, entityName, overallScore, ... }
      // Shape C: flat with type/code at top level
      const type = item.entity?.type || item.entityType || item.type || '';
      if (type && type !== 'country') return;

      const code = (
        item.entity?.code || item.entityCode || item.code ||
        item.entity?.attrs?.fqid?.split('.')?.pop() || ''
      ).toUpperCase().replace(/^COUNTRY\./, '');
      if (!code || code.length !== 2) return;

      const name = item.entity?.name || item.entityName || item.name || code;

      // Determine severity
      let level = (item.level || item.alertLevel || '').toLowerCase();
      let score = 0;

      if (level === 'critical') { score = 3; }
      else if (level === 'warning' || level === 'warn') { score = 2; }
      else {
        // Numeric overall score (0–1 range or 0–100)
        let s = item.overallScore ?? item.score ?? item.magnitude ?? -1;
        if (s > 1) s = s / 100; // normalise if 0-100
        if (s >= 0) {
          if (s > 0.7)      { score = 3; level = 'critical'; }
          else if (s > 0.2) { score = 2; level = 'warning'; }
          else               { score = 1; level = 'normal'; }
        }
      }
      if (score < 1) score = 1; // at minimum, mark as seen

      if (!byCountry.has(code) || byCountry.get(code).score < score) {
        byCountry.set(code, { code, name, level, score });
        n++;
      }
    });
    return n;
  }

  // Try all plausible shapes
  let total = 0;
  const candidates = [
    d,                    // root might be array
    d?.data,              // { data: [...] }
    d?.result,            // { result: [...] }
    d?.data?.alerts,      // { data: { alerts: [...] } }
    d?.data?.outages,
    d?.alerts,
    d?.outages,
    d?.events,
    d?.data?.events,
  ];

  let recognised = false;
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      const n = ingestArray(c);
      if (n > 0) { total += n; recognised = true; }
    }
  }

  // Log full key structure for debugging
  const topKeys = Object.keys(d || {});
  const dataKeys = d?.data ? (Array.isArray(d.data) ? [`array[${d.data.length}]`] : Object.keys(d.data)) : [];
  console.log(`[WWO] IODA shape: top=${JSON.stringify(topKeys)} data=${JSON.stringify(dataKeys)} → ingested ${total} entries`);

  outageData = [...byCountry.values()].filter(c => c.score >= 2);
  console.log(`[WWO] IODA countries with warning+: ${outageData.length}`, outageData.map(c=>c.code));

  _buildOutageFeatures();
  _updateOutageCounter();

  if (outageData.length > 0) {
    outageData.filter(c => c.score >= 3).forEach(c => {
      addLiveItem(`🔌 INTERNET OUTAGE — ${c.name}`, 'IODA/CAIDA',
        new Date().toISOString(), 'https://ioda.live', 'CYBER', 'al', false);
    });
  }

  return recognised ? total : (topKeys.length > 0 ? 0 : -1);
}

// ── Static test data — confirms rendering works when API is unavailable ────────
function _injectTestData() {
  // Iran outage (confirmed active as of Feb 2025), plus a couple of others for visibility
  outageData = [
    { code:'IR', name:'Iran',        level:'critical', score:3 },
    { code:'RU', name:'Russia',      level:'warning',  score:2 },
    { code:'CU', name:'Cuba',        level:'warning',  score:2 },
    { code:'KP', name:'North Korea', level:'critical', score:3 },
  ];
  console.log('[WWO] Injected static test outage data:', outageData.map(c=>c.code));
  _buildOutageFeatures();
  _updateOutageCounter();
}

// ── Build GeoJSON features for outage countries ───────────────────────────────
async function _buildOutageFeatures() {
  if (!_map) return;
  if (outageData.length === 0) {
    const src = _map.getSource('outage-zones');
    if (src) src.setData({ type:'FeatureCollection', features:[] });
    _hatchFeatures = [];
    return;
  }

  const needed = new Set(outageData.map(c => c.code));
  const isNerv  = document.body.classList.contains('nerv');
  const fillColor = isNerv ? '#e07020' : '#01a834';

  // Try to fetch full country polygons from CDN (cached after first load)
  if (!window._countryGeoCache) {
    const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
    try {
      const r = await fetch(
        PROXY_BASE + '/api/proxy?url=' + encodeURIComponent(GEOJSON_URL),
        { signal: AbortSignal.timeout(25000) }
      );
      if (r.ok) {
        window._countryGeoCache = await r.json();
        console.log('[WWO] Country GeoJSON cached:', window._countryGeoCache.features?.length, 'features');
      }
    } catch(e) { console.warn('[WWO] Country GeoJSON fetch failed:', e.message); }
  }

  let features = [];

  // Match against full polygon GeoJSON if available
  if (window._countryGeoCache?.features) {
    features = window._countryGeoCache.features
      .filter(f => {
        const iso = (f.properties?.ISO_A2 || f.properties?.iso_a2 || '').toUpperCase();
        return needed.has(iso);
      })
      .map(f => {
        const iso = (f.properties?.ISO_A2 || f.properties?.iso_a2 || '').toUpperCase();
        const o   = outageData.find(x => x.code === iso);
        return { ...f, properties: { ...f.properties, fillColor, outageCode:iso,
          outageLevel: o?.level, outageScore: o?.score } };
      });
    console.log('[WWO] Matched polygon features:', features.length, '/', needed.size);
  }

  // Fallback: use COUNTRY_BBOX or COUNTRY_CENTROIDS for any unmatched codes
  const matched = new Set(features.map(f => f.properties.outageCode));
  [...needed].filter(code => !matched.has(code)).forEach(code => {
    const bbox = COUNTRY_BBOX[code];
    const cen  = COUNTRY_CENTROIDS[code];
    let coords;
    if (bbox) {
      const [w,s,e,n] = bbox;
      coords = [[[w,s],[e,s],[e,n],[w,n],[w,s]]];
    } else if (cen) {
      const [lon,lat] = cen, pad = 3.5;
      coords = [[[lon-pad,lat-pad],[lon+pad,lat-pad],[lon+pad,lat+pad],[lon-pad,lat+pad],[lon-pad,lat-pad]]];
    } else return;
    const o = outageData.find(x => x.code === code);
    features.push({
      type:'Feature',
      geometry:{ type:'Polygon', coordinates:coords },
      properties:{ fillColor, outageCode:code, outageLevel:o?.level, outageScore:o?.score }
    });
  });

  console.log('[WWO] Total outage features built:', features.length);
  const src = _map.getSource('outage-zones');
  if (src) src.setData({ type:'FeatureCollection', features });
  _hatchFeatures = features;
}

function _updateOutageCounter() {
  const el = document.getElementById('outc');
  if (el) el.textContent = outageData.length;
}

// ── Theme change (NERV/CTRL toggle) ──────────────────────────────────────────
function outageThemeUpdate() {
  if (outageData.length > 0) _buildOutageFeatures();
}

// ── Visibility toggle ─────────────────────────────────────────────────────────
function setOutageVis(vis) {
  outageVis = vis;
  if (_map) {
    ['outage-fill','outage-border'].forEach(id => {
      try { _map.setLayoutProperty(id, 'visibility', vis ? 'visible' : 'none'); } catch(e) {}
    });
  }
}

// ── Animated hatch+wobble canvas overlay ─────────────────────────────────────
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

  (function frame() {
    requestAnimationFrame(frame);
    _drawHatch();
  })();
}

function _drawHatch() {
  if (!_hatchCtx || !_map) return;
  const ctx = _hatchCtx;
  const W = _hatchCanvas.width, H = _hatchCanvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!outageVis || _hatchFeatures.length === 0) return;

  const t = _hatchFrame++ * 0.016;
  const isNerv = document.body.classList.contains('nerv');
  const col = isNerv ? 'rgba(224,112,32,' : 'rgba(1,168,52,';

  _hatchFeatures.forEach(feature => {
    const geom = feature.geometry;
    if (!geom) return;
    const rings = geom.type === 'Polygon'      ? geom.coordinates
                : geom.type === 'MultiPolygon' ? geom.coordinates.flat(1)
                : [];

    rings.forEach(ring => {
      const pts = ring.map(([lon, lat]) => {
        try { return _map.project([lon, lat]); } catch(e) { return null; }
      }).filter(Boolean);
      if (pts.length < 3) return;

      let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
      pts.forEach(p => { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); });
      if (maxX<0||minX>W||maxY<0||minY>H) return;

      // Clip to polygon
      ctx.save();
      ctx.beginPath();
      pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
      ctx.closePath();
      ctx.clip();

      // Diagonal hatch with wobble
      const spacing = 9;
      ctx.strokeStyle = col + '0.5)';
      ctx.lineWidth = 1;

      for (let offset = minX - (maxY-minY) - spacing; offset < maxX + spacing; offset += spacing) {
        ctx.beginPath();
        const steps = Math.ceil((maxY - minY + 20) / 3);
        for (let s = 0; s <= steps; s++) {
          const frac = s / steps;
          const lx = offset + (maxY - minY + 20) * frac;
          const ly = minY - 10 + (maxY - minY + 20) * frac;
          const wobble = Math.sin(t + ly * 0.07 + offset * 0.05) * 3.5;
          s===0 ? ctx.moveTo(lx+wobble, ly) : ctx.lineTo(lx+wobble, ly);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  });
}
