// ====== NET OUTAGES — real-time internet disruption overlay ======
// Data:      IODA v2 (CAIDA) via Worker proxy
// Geometry:  OSM Overpass API admin boundaries via Worker /api/boundary
// Rendering: canvas hatch+wobble overlay, clipped to exact country shape

const OUTAGE_REFRESH_MS = 5 * 60 * 1000; // 5min

// Per-country boundary cache (ISO2 → GeoJSON Feature), persists for session
const _boundaryCache = {};

let outageVis    = true;
let outageData   = [];      // [{code, name, level, score}]
let _map         = null;
let _hatchCanvas = null;
let _hatchCtx    = null;
let _hatchFeatures = [];    // GeoJSON features currently rendered
let _hatchFrame  = 0;

// ── Init ─────────────────────────────────────────────────────────────────────
function initOutages(map) {
  _map = map;

  map.addSource('outage-zones', {
    type: 'geojson',
    data: { type:'FeatureCollection', features:[] }
  });
  map.addLayer({
    id: 'outage-fill', type: 'fill', source: 'outage-zones',
    paint: { 'fill-color':['get','fillColor'], 'fill-opacity': 0.08 }
  });
  map.addLayer({
    id: 'outage-border', type: 'line', source: 'outage-zones',
    paint: { 'line-color':['get','fillColor'], 'line-width': 1.5, 'line-opacity': 0.85 }
  });

  _initHatchCanvas(map);
  fetchOutages();
  setInterval(fetchOutages, OUTAGE_REFRESH_MS);
}

// ── Fetch IODA outage data via Worker proxy ───────────────────────────────────
async function fetchOutages() {
  try {
    const r = await fetch(`${PROXY_BASE}/api/outages`, {
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) throw new Error(`Worker returned ${r.status}`);
    const text = await r.text();
    console.log('[WWO] IODA raw (first 500):', text.slice(0, 500));
    const d = JSON.parse(text);
    _parseAndApply(d);
  } catch(e) {
    console.warn('[WWO] IODA fetch failed:', e.message);
    // Static fallback — shows confirmed long-term outages for visual testing
    _parseAndApply({ _static: true, outages: [
      { code:'IR', name:'Iran',        level:'critical' },
      { code:'RU', name:'Russia',      level:'warning'  },
      { code:'CU', name:'Cuba',        level:'warning'  },
      { code:'KP', name:'North Korea', level:'critical' },
      { code:'SY', name:'Syria',       level:'warning'  },
    ]});
  }
}

// ── Parse IODA response (handles multiple API shapes) and apply ───────────────
function _parseAndApply(d) {
  // If static fallback, use directly
  if (d._static) {
    outageData = d.outages.map(o => ({...o, score: o.level === 'critical' ? 3 : 2}));
    _applyOutageData();
    return;
  }

  const byCountry = new Map();

  function tryIngest(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(item => {
      // Pull entity info from multiple possible shapes
      const entity   = item.entity || item;
      const type     = (entity.type || entity.entityType || '').toLowerCase();
      // Accept if type is country or not specified (let code length filter)
      if (type && type !== 'country') return;

      let code = (entity.code || entity.entityCode || entity.iso ||
                  item.code  || item.entityCode   || '').toUpperCase();
      // IODA sometimes uses "country.IR" format
      code = code.replace(/^[A-Z]+\./, '');
      if (!code || code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return;

      const name = entity.name || entity.entityName || item.name || code;

      // Severity: string level takes priority, then numeric score
      let level = (item.level || item.alertLevel || entity.level || '').toLowerCase();
      let score;
      if      (level === 'critical')             score = 3;
      else if (level === 'warning' || level === 'warn') score = 2;
      else {
        let s = item.overallScore ?? item.score ?? item.magnitude
             ?? item.meanNormalizedSignal ?? -1;
        if (typeof s === 'number' && s > 1) s /= 100;
        if      (s > 0.65) { score = 3; level = 'critical'; }
        else if (s > 0.25) { score = 2; level = 'warning';  }
        else                { score = 1; level = 'normal';   }
      }

      if (!byCountry.has(code) || byCountry.get(code).score < score)
        byCountry.set(code, { code, name, level, score });
    });
  }

  // Try every plausible envelope
  [d, d?.data, d?.result, d?.data?.alerts, d?.data?.outages,
   d?.alerts, d?.outages, d?.events, d?.data?.events
  ].forEach(v => tryIngest(Array.isArray(v) ? v : v ? [v] : []));

  const top  = Object.keys(d || {});
  const dTyp = Array.isArray(d?.data) ? `array[${d.data.length}]` : typeof d?.data;
  console.log(`[WWO] IODA shape: ${JSON.stringify(top)}, data: ${dTyp}, mapped: ${byCountry.size}`);

  outageData = [...byCountry.values()].filter(c => c.score >= 2);
  console.log('[WWO] Outages warning+:', outageData.map(c => `${c.code}(${c.level})`));

  _applyOutageData();
}

// ── Resolve country codes → accurate OSM polygons, then render ────────────────
async function _applyOutageData() {
  _updateOutageCounter();

  if (outageData.length === 0) {
    _setMapData([]);
    return;
  }

  const isNerv    = document.body.classList.contains('nerv');
  const fillColor = isNerv ? '#e07020' : '#01a834';

  // Fetch OSM boundaries for any code not yet cached (parallel)
  const needed = outageData.filter(o => !_boundaryCache[o.code]);
  if (needed.length > 0) {
    console.log('[WWO] Fetching OSM boundaries for:', needed.map(o => o.code));
    await Promise.allSettled(needed.map(o => _fetchBoundary(o.code)));
  }

  // Build feature collection from cache
  const features = [];
  for (const o of outageData) {
    const cached = _boundaryCache[o.code];
    if (cached) {
      // cached is a GeoJSON geometry (Polygon or MultiPolygon)
      features.push({
        type: 'Feature',
        geometry: cached,
        properties: { fillColor, outageCode: o.code, outageLevel: o.level, outageScore: o.score }
      });
    } else {
      console.warn('[WWO] No boundary for', o.code, '— skipping');
    }
  }

  console.log('[WWO] Rendering', features.length, 'outage polygons');
  _setMapData(features);

  // Feed injection for critical outages
  outageData.filter(c => c.score >= 3).forEach(c => {
    addLiveItem(`🔌 INTERNET OUTAGE — ${c.name}`, 'IODA/CAIDA',
      new Date().toISOString(), 'https://ioda.live', 'CYBER', 'al', false);
  });
}

// ── Fetch single country boundary from Worker → Overpass OSM ─────────────────
async function _fetchBoundary(iso) {
  if (_boundaryCache[iso]) return; // already have it
  try {
    const r = await fetch(`${PROXY_BASE}/api/boundary?iso=${iso}`, {
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) throw new Error(`boundary ${r.status}`);
    const data = await r.json();
    // Overpass returns {elements:[{type:'relation', members:[{type:'way', geometry:[{lat,lon},...]},...]}]}
    const geom = _overpassToGeoJSON(data, iso);
    if (geom) {
      _boundaryCache[iso] = geom;
      console.log(`[WWO] OSM boundary cached: ${iso} (${geom.type})`);
    } else {
      console.warn(`[WWO] No geometry parsed for ${iso}`);
    }
  } catch(e) {
    console.warn(`[WWO] Boundary fetch failed for ${iso}:`, e.message);
  }
}

// ── Convert Overpass JSON → GeoJSON geometry ──────────────────────────────────
function _overpassToGeoJSON(data, iso) {
  const elements = data?.elements;
  if (!elements?.length) return null;

  // Find the relation element (the country boundary relation)
  const relation = elements.find(e => e.type === 'relation');
  if (!relation?.members) return null;

  // Collect outer ways as coordinate rings
  const outerRings = [];
  const innerRings = [];

  relation.members.forEach(member => {
    if (member.type !== 'way' || !member.geometry?.length) return;
    // Convert [{lat,lon}] → [lon,lat] pairs
    const ring = member.geometry.map(pt => [pt.lon, pt.lat]);
    if (ring.length < 4) return;
    // Close ring if not already closed
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);

    if (member.role === 'outer' || member.role === '') outerRings.push(ring);
    else if (member.role === 'inner') innerRings.push(ring);
  });

  if (outerRings.length === 0) return null;

  // Assemble rings: each outer + its inner holes into a Polygon
  // For simplicity: one MultiPolygon with all outers, no holes (holes are rare at country level)
  if (outerRings.length === 1) {
    return { type: 'Polygon', coordinates: [outerRings[0], ...innerRings] };
  } else {
    return { type: 'MultiPolygon', coordinates: outerRings.map(outer => [outer]) };
  }
}

// ── Push features to MapLibre source + hatch canvas ──────────────────────────
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

// ── Theme switch (NERV/CTRL) ──────────────────────────────────────────────────
function outageThemeUpdate() {
  if (outageData.length > 0) _applyOutageData();
}

// ── Layer visibility toggle ───────────────────────────────────────────────────
function setOutageVis(vis) {
  outageVis = vis;
  if (_map) {
    ['outage-fill','outage-border'].forEach(id => {
      try { _map.setLayoutProperty(id,'visibility', vis ? 'visible' : 'none'); } catch(e) {}
    });
  }
  // Canvas hatch respects outageVis via _drawHatch check
}

// ── Canvas hatch+wobble overlay ───────────────────────────────────────────────
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

  (function frame() { requestAnimationFrame(frame); _drawHatch(); })();
}

function _drawHatch() {
  if (!_hatchCtx || !_map) return;
  const ctx = _hatchCtx;
  const W   = _hatchCanvas.width;
  const H   = _hatchCanvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!outageVis || _hatchFeatures.length === 0) return;

  const t      = _hatchFrame++ * 0.016;
  const isNerv = document.body.classList.contains('nerv');
  const colA   = isNerv ? 'rgba(224,112,32,0.55)' : 'rgba(1,168,52,0.55)';
  const spacing = 8;

  _hatchFeatures.forEach(feature => {
    const geom = feature.geometry;
    if (!geom) return;

    // Collect all rings (Polygon or MultiPolygon)
    const allRings = geom.type === 'Polygon'
      ? geom.coordinates
      : geom.type === 'MultiPolygon'
        ? geom.coordinates.flat(1)
        : [];

    allRings.forEach(ring => {
      // Project lon/lat → screen px
      const pts = [];
      for (const [lon, lat] of ring) {
        try {
          const p = _map.project([lon, lat]);
          pts.push(p);
        } catch(e) { /* off-globe */ }
      }
      if (pts.length < 3) return;

      // Bounding box of this ring on screen
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }

      // Skip rings entirely off-screen
      if (maxX < 0 || minX > W || maxY < 0 || minY > H) return;
      // Clamp to canvas
      minX = Math.max(minX, 0); minY = Math.max(minY, 0);
      maxX = Math.min(maxX, W); maxY = Math.min(maxY, H);

      ctx.save();

      // Clip path from projected polygon ring
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.clip();

      // Animated diagonal hatching at 45° with per-line sine wobble
      ctx.strokeStyle = colA;
      ctx.lineWidth   = 1;

      const diag = (maxX - minX) + (maxY - minY);
      for (let k = -diag; k < diag; k += spacing) {
        ctx.beginPath();
        // Walk down the 45° line in small steps, displacing x by wobble
        const y0   = minY;
        const y1   = maxY;
        const steps = Math.max(3, Math.ceil((y1 - y0) / 4));
        for (let s = 0; s <= steps; s++) {
          const frac   = s / steps;
          const y      = y0 + (y1 - y0) * frac;
          const x      = minX + k + (y - minY); // 45° offset
          // Wobble: horizontal displacement that pulses along the line
          const wobble = Math.sin(t * 1.8 + y * 0.055 + k * 0.04) * 4;
          if (s === 0) ctx.moveTo(x + wobble, y);
          else         ctx.lineTo(x + wobble, y);
        }
        ctx.stroke();
      }

      ctx.restore();
    });
  });
}
