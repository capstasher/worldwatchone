// ====== WIND VECTOR LAYER ======
// Renders GFS 10m wind as directional arrows on the MapLibre globe.
// Uses a proper GeoJSON symbol layer — moves/zooms correctly with the globe,
// no canvas overlay, no clipping issues.
// Data: NOAA GFS via WWO Worker (/api/wind) — U/V components at ~5° resolution
// Refresh: every 3 hours (GFS update cycle)

const WIND_REFRESH_MS  = 3 * 60 * 60 * 1000;
const WIND_GRID_DEG    = 5;   // sample every N degrees (lower = denser grid, heavier)
const WIND_MIN_SPEED   = 1.0; // m/s — skip near-calm cells to reduce clutter

let _windVisible  = false;
let _windLayerAdded = false;
let _windMap      = null;

// ── Build arrow icon ──────────────────────────────────────────────────────────
// A simple north-pointing arrow; MapLibre rotates it per-feature via icon-rotate.
function _makeArrowImage(map) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;

  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.fillStyle   = 'rgba(255,255,255,0.9)';
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Shaft — pointing up (north = 0°)
  ctx.beginPath();
  ctx.moveTo(cx, cy + 9);
  ctx.lineTo(cx, cy - 7);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(cx,     cy - 12);
  ctx.lineTo(cx - 4, cy - 5);
  ctx.lineTo(cx + 4, cy - 5);
  ctx.closePath();
  ctx.fill();

  return map.createImage ? { width: size, height: size, data: ctx.getImageData(0,0,size,size).data } : canvas;
}

// ── Convert U/V wind components to GeoJSON point features ────────────────────
function _windFieldToGeoJSON(field) {
  if (!field || !field.u || !field.v) return { type: 'FeatureCollection', features: [] };
  const { width, height, u, v, bbox } = field;
  const west  = bbox?.west  ?? 0;
  const east  = bbox?.east  ?? 360;
  const north = bbox?.north ?? 90;
  const south = bbox?.south ?? -90;
  const features = [];

  // Sample at WIND_GRID_DEG resolution regardless of field resolution
  const lonStep = WIND_GRID_DEG;
  const latStep = WIND_GRID_DEG;

  for (let lat = south + latStep/2; lat < north; lat += latStep) {
    for (let lon = west; lon < east; lon += lonStep) {
      // Normalise lon to [-180, 180]
      let normLon = lon > 180 ? lon - 360 : lon;

      // Bilinear sample from field
      const nx = (lon - west)  / (east  - west);
      const ny = 1 - (lat - south) / (north - south);
      const fx = Math.max(0, Math.min(1, nx)) * (width  - 1);
      const fy = Math.max(0, Math.min(1, ny)) * (height - 1);
      const x0 = Math.floor(fx), x1 = Math.min(x0+1, width-1);
      const y0 = Math.floor(fy), y1 = Math.min(y0+1, height-1);
      const tx = fx - x0, ty = fy - y0;
      const lerp = (a,b,t) => a + (b-a)*t;
      const idx  = (r,c) => r*width + c;
      const uVal = lerp(lerp(u[idx(y0,x0)], u[idx(y0,x1)], tx), lerp(u[idx(y1,x0)], u[idx(y1,x1)], tx), ty);
      const vVal = lerp(lerp(v[idx(y0,x0)], v[idx(y0,x1)], tx), lerp(v[idx(y1,x0)], v[idx(y1,x1)], tx), ty);

      const speed = Math.sqrt(uVal*uVal + vVal*vVal);
      if (speed < WIND_MIN_SPEED) continue;

      // Meteorological convention: bearing = direction wind is blowing TO
      // atan2(u, v) gives bearing from north, clockwise positive
      const bearingRad = Math.atan2(uVal, vVal);
      const bearing    = (bearingRad * 180 / Math.PI + 360) % 360;

      // Speed in knots for display
      const knots = speed * 1.944;

      // Colour by speed: calm=cyan, moderate=yellow, strong=orange, severe=red
      let color;
      if      (knots < 10)  color = '#00ddff';
      else if (knots < 20)  color = '#00ff88';
      else if (knots < 35)  color = '#ffdd00';
      else if (knots < 50)  color = '#ff8800';
      else                  color = '#ff2200';

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [normLon, lat] },
        properties: { bearing, speed: +speed.toFixed(1), knots: +knots.toFixed(1), color }
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

// ── Fetch wind field from Worker ──────────────────────────────────────────────
async function _fetchWindField() {
  try {
    const r = await fetch(`${PROXY_BASE}/api/wind`, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error('Wind Worker ' + r.status);
    const data = await r.json();
    if (!data.u || !data.v) throw new Error('Invalid wind field');
    console.log(`[WWO] Wind: ${data.width}×${data.height} grid (${data.synthetic ? 'SYNTHETIC' : 'GFS LIVE'})`);
    return data;
  } catch(e) {
    console.warn('[WWO] Wind fetch failed, using synthetic field:', e.message);
    return _syntheticWindField();
  }
}

// Synthetic westerly fallback — basic jet stream shape
function _syntheticWindField() {
  const W = 72, H = 37;
  const u = new Float32Array(W * H);
  const v = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lat = 90 - (y / (H-1)) * 180;
      const jet = Math.exp(-((Math.abs(lat) - 45)**2) / 200);
      u[y*W+x] = 8 * jet + Math.sin(x/5) * 2;
      v[y*W+x] = Math.sin(y/4) * 1.5;
    }
  }
  return { width: W, height: H, u, v,
    bbox: { west: 0, east: 360, south: -90, north: 90 }, synthetic: true };
}

// ── Init MapLibre layer ───────────────────────────────────────────────────────
function initWindParticles(map) {
  _windMap = map;

  // Register arrow icon
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size/2, cy = size/2;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.fillStyle   = 'rgba(255,255,255,0.95)';
  ctx.lineWidth   = 2;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy+9); ctx.lineTo(cx, cy-7); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy-13); ctx.lineTo(cx-4, cy-5); ctx.lineTo(cx+4, cy-5);
  ctx.closePath(); ctx.fill();
  map.addImage('wind-arrow', { width:size, height:size, data: new Uint8Array(ctx.getImageData(0,0,size,size).data.buffer) });

  // GeoJSON source — empty until first fetch
  map.addSource('wind-vectors', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Arrow symbol layer — icon-rotate drives direction, icon-size drives speed
  map.addLayer({
    id: 'wind-arrows',
    type: 'symbol',
    source: 'wind-vectors',
    layout: {
      'icon-image': 'wind-arrow',
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-size': [
        'interpolate', ['linear'], ['get', 'knots'],
        0, 0.35,   // calm — small
        20, 0.5,
        50, 0.75,  // gale — larger
        80, 0.95
      ],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-color': ['get', 'color'],
      'icon-opacity': 0.82,
      'icon-halo-color': 'rgba(0,0,0,0.4)',
      'icon-halo-width': 0.5,
    }
  });

  // Start hidden (toggled on by user via weather panel)
  map.setLayoutProperty('wind-arrows', 'visibility', 'none');

  // Register in layer system
  if (typeof lMap !== 'undefined') lMap['wind-vectors'] = ['wind-arrows'];
  layerVis['wind-vectors'] = false;

  // Click popup
  map.on('click', 'wind-arrows', e => {
    const p = e.features[0]?.properties || {};
    if (typeof showPopup === 'function') {
      showPopup(e.lngLat,
        `💨 <b>Wind</b><br>Speed: ${p.knots} kt (${p.speed} m/s)<br>Direction: ${Math.round(p.bearing)}°`
      );
    }
  });
  map.on('mouseenter', 'wind-arrows', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'wind-arrows', () => map.getCanvas().style.cursor = '');

  _windLayerAdded = true;

  // Initial fetch
  _fetchWindField().then(field => {
    const geojson = _windFieldToGeoJSON(field);
    const src = map.getSource('wind-vectors');
    if (src) src.setData(geojson);
    console.log(`[WWO] Wind: ${geojson.features.length} arrow vectors loaded`);
  });

  // Refresh every 3h
  setInterval(async () => {
    const field = await _fetchWindField();
    const geojson = _windFieldToGeoJSON(field);
    const src = map.getSource('wind-vectors');
    if (src) src.setData(geojson);
    console.log(`[WWO] Wind: refreshed — ${geojson.features.length} vectors`);
  }, WIND_REFRESH_MS);

  console.log('[WWO] Wind vector layer initialised');
}

// ── Public toggle (called from weather panel button) ─────────────────────────
function setWindParticlesVisible(vis) {
  _windVisible = vis;
  if (!_windMap || !_windLayerAdded) return;
  _windMap.setLayoutProperty('wind-arrows', 'visibility', vis ? 'visible' : 'none');
}
