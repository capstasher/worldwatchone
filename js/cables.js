// ====== SUBMARINE CABLE LAYER + AIS PROXIMITY ALERT ======
// Cable routes: TeleGeography public GeoJSON
// Loiter detection: AIS positions cross-referenced against cable corridors
// Baltic sabotage pattern: slow vessels within configurable radius for configurable duration

const CABLE_DATA_URL = 'https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/v3/cable/cable-geo.json';

// Loiter detection config — tunable
const CABLE_ALERT_CONFIG = {
  radiusKm:    5,      // flag vessel within Nkm of any cable segment
  loiterMinutes: 20,   // flag if within radius for >= N minutes
  speedKnots:  3,      // flag if speed below N kts (slow = loitering/dragging)
  checkInterval: 60000 // re-run check every 60s against latest AIS positions
};

// Internal state
let _cableGeo = null;                  // raw GeoJSON FeatureCollection
let _cableSegments = [];               // flattened array of {p1,p2} for fast proximity checks
const _vesselHistory = {};             // icao24 → [{lat,lon,ts,speed}] rolling 30min window
const _flaggedVessels = new Set();     // currently flagged ICAOs
let _cablesLoaded = false;
let _cableLayersAdded = false;

// ── Haversine distance (km) ────────────────────────────────────────────────────
function _haverKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Point-to-segment distance (km) ────────────────────────────────────────────
function _ptSegDistKm(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return _haverKm(py, px, ay, ax);
  let t = ((px - ax)*dx + (py - ay)*dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return _haverKm(py, px, ay + t*dy, ax + t*dx);
}

// ── Build segment index from GeoJSON ──────────────────────────────────────────
function _buildSegmentIndex(geo) {
  const segs = [];
  if (!geo || !geo.features) return segs;
  geo.features.forEach(f => {
    const name = f.properties?.name || 'Unknown Cable';
    const coords = f.geometry?.type === 'MultiLineString'
      ? f.geometry.coordinates.flat(1)
      : f.geometry?.type === 'LineString'
        ? f.geometry.coordinates
        : [];
    for (let i = 0; i < coords.length - 1; i++) {
      segs.push({
        p1: coords[i],     // [lon, lat]
        p2: coords[i+1],
        name
      });
    }
  });
  return segs;
}

// ── Check if a position is near any cable ─────────────────────────────────────
function _nearestCable(lat, lon) {
  let minDist = Infinity, nearestName = null;
  for (const seg of _cableSegments) {
    const d = _ptSegDistKm(lon, lat, seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]);
    if (d < minDist) { minDist = d; nearestName = seg.name; }
  }
  return { distKm: minDist, cable: nearestName };
}

// ── Record AIS position and check for loiter ──────────────────────────────────
function _updateVesselHistory(vessel) {
  if (!vessel || vessel.lat == null || vessel.lon == null) return;
  const id = vessel.icao24 || vessel.callsign || vessel.id;
  if (!id) return;

  const now = Date.now();
  const windowMs = CABLE_ALERT_CONFIG.loiterMinutes * 60000;

  if (!_vesselHistory[id]) _vesselHistory[id] = [];
  const hist = _vesselHistory[id];

  const cutoff = now - windowMs * 2;
  while (hist.length && hist[0].ts < cutoff) hist.shift();

  const { distKm, cable } = _nearestCable(vessel.lat, vessel.lon);

  if (distKm > CABLE_ALERT_CONFIG.radiusKm * 3) {
    if (hist.length) _vesselHistory[id] = [];
    if (_flaggedVessels.has(id)) _unflagVessel(id);
    return;
  }

  hist.push({ lat: vessel.lat, lon: vessel.lon, ts: now, speed: vessel.speed || 0, distKm, cable });

  const windowStart = now - windowMs;
  const inWindow = hist.filter(h => h.ts >= windowStart);
  if (inWindow.length < 3) return;

  const allNear    = inWindow.every(h => h.distKm <= CABLE_ALERT_CONFIG.radiusKm);
  const slowEnough = inWindow.every(h => h.speed <= CABLE_ALERT_CONFIG.speedKnots || h.speed === 0);
  const timeSpanMs = inWindow[inWindow.length-1].ts - inWindow[0].ts;

  if (allNear && slowEnough && timeSpanMs >= windowMs * 0.8) {
    if (!_flaggedVessels.has(id)) {
      _flagVessel(id, vessel, cable, distKm, Math.round(timeSpanMs / 60000));
    }
  } else {
    if (_flaggedVessels.has(id)) _unflagVessel(id);
  }
}

function _flagVessel(id, vessel, cableName, distKm, minutes) {
  _flaggedVessels.add(id);
  const callsign = vessel.callsign || vessel.flight || id;
  const msg = `⚠ CABLE PROXIMITY: ${callsign} loitering ${distKm.toFixed(1)}km from [${cableName}] for ${minutes}+ min — speed ${(vessel.speed||0).toFixed(1)}kts`;
  console.warn('[WWO-CABLES]', msg);
  if (typeof addLiveItem === 'function') {
    addLiveItem(msg, 'CABLE-WATCH', new Date().toISOString(), null, 'OSINT', 'al', true);
  }
  _refreshCableAlertLayer();
}

function _unflagVessel(id) {
  _flaggedVessels.delete(id);
  _refreshCableAlertLayer();
}

// ── Refresh the alert dot layer for flagged vessels ────────────────────────────
function _refreshCableAlertLayer() {
  if (!_cableLayersAdded || typeof map === 'undefined') return;
  const src = map.getSource('cable-alerts');
  if (!src) return;
  const features = [];
  Object.entries(_vesselHistory).forEach(([id, hist]) => {
    if (!_flaggedVessels.has(id) || !hist.length) return;
    const last = hist[hist.length-1];
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [last.lon, last.lat] },
      properties: { id, cable: last.cable, distKm: last.distKm.toFixed(1), speed: last.speed }
    });
  });
  src.setData({ type: 'FeatureCollection', features });
}

// ── Fetch cable GeoJSON ────────────────────────────────────────────────────────
async function fetchCableGeo() {
  // Attempt 1: direct (works if GitHub raw ever relaxes CORS, or from localhost)
  // Attempt 2: via Cloudflare Worker proxy
  // Attempt 3: allorigins.win as a last resort
  const attempts = [
    () => fetch(CABLE_DATA_URL, { signal: AbortSignal.timeout(15000) }),
    () => fetch(`${PROXY_BASE}/api/proxy?url=${encodeURIComponent(CABLE_DATA_URL)}`, { signal: AbortSignal.timeout(20000) }),
    () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(CABLE_DATA_URL)}`, { signal: AbortSignal.timeout(20000) }),
  ];

  let geo = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      const r = await attempts[i]();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      geo = JSON.parse(text);
      if (!geo || !Array.isArray(geo.features) || geo.features.length === 0) throw new Error('Empty or invalid GeoJSON');
      console.log(`[WWO] Cables: loaded ${geo.features.length} cables via attempt ${i + 1}`);
      break;
    } catch(e) {
      console.warn(`[WWO] Cable fetch attempt ${i + 1} failed:`, e.message);
    }
  }

  if (!geo) {
    console.error('[WWO] Cables: all fetch attempts failed — layer will be empty');
    return null;
  }

  _cableGeo = geo;
  _cableSegments = _buildSegmentIndex(geo);
  _cablesLoaded = true;

  // Normalise geometry for MapLibre globe — flatten MultiLineString → individual
  // LineString features, and clamp all coordinates to [-180,180] / [-90,90].
  // Long cables that cross the antimeridian are split so MapLibre doesn't
  // draw a line straight through the globe interior.
  const normalised = _normaliseCableGeo(geo);

  if (_cableLayersAdded) {
    const src = map.getSource('cables');
    if (src) {
      src.setData(normalised);
      console.log(`[WWO] Cables: map source updated with ${normalised.features.length} features, ${_cableSegments.length} segments`);
    }
  }
  return geo;
}

// ── Normalise cable GeoJSON for MapLibre globe ────────────────────────────────
// Flattens MultiLineString → LineStrings, clamps coords, splits on antimeridian
// crossings so MapLibre doesn't draw chords through the globe.
function _normaliseCableGeo(geo) {
  const features = [];
  if (!geo || !geo.features) return { type: 'FeatureCollection', features };

  geo.features.forEach(f => {
    const name = f.properties?.name || 'Unknown Cable';
    const id   = f.properties?.id   || '';
    let lineStrings = [];

    if (f.geometry?.type === 'LineString') {
      lineStrings = [f.geometry.coordinates];
    } else if (f.geometry?.type === 'MultiLineString') {
      lineStrings = f.geometry.coordinates;
    }

    lineStrings.forEach(coords => {
      // Clamp coordinates and split at antimeridian
      const segments = _splitAtAntimeridian(coords);
      segments.forEach(seg => {
        if (seg.length >= 2) {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: seg },
            properties: { name, id }
          });
        }
      });
    });
  });

  return { type: 'FeatureCollection', features };
}

// Split a coordinate array into sub-arrays wherever it crosses the antimeridian
// (i.e. consecutive points differ by more than 180° in longitude).
function _splitAtAntimeridian(coords) {
  if (!coords || coords.length === 0) return [];
  const segments = [];
  let current = [[_clampLon(coords[0][0]), _clampLat(coords[0][1])]];

  for (let i = 1; i < coords.length; i++) {
    const lon = _clampLon(coords[i][0]);
    const lat = _clampLat(coords[i][1]);
    const prevLon = current[current.length - 1][0];

    if (Math.abs(lon - prevLon) > 180) {
      // Antimeridian crossing — start a new segment
      segments.push(current);
      current = [[lon, lat]];
    } else {
      current.push([lon, lat]);
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

function _clampLon(lon) {
  // Normalise to [-180, 180]
  lon = parseFloat(lon) || 0;
  while (lon > 180)  lon -= 360;
  while (lon < -180) lon += 360;
  return Math.round(lon * 1e5) / 1e5;
}

function _clampLat(lat) {
  return Math.max(-90, Math.min(90, Math.round((parseFloat(lat) || 0) * 1e5) / 1e5));
}

// ── Init map layers ────────────────────────────────────────────────────────────
function initCables(map) {
  // Cable route lines
  map.addSource('cables', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('cable-alerts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  // Glow halo (wide, faint)
  map.addLayer({ id: 'cable-glow', type: 'line', source: 'cables', paint: {
    'line-color': '#00aaff',
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3, 5, 5, 10, 8],
    'line-opacity': 0.18,
    'line-blur': 3
  }});

  // Main cable line
  map.addLayer({ id: 'cable-line', type: 'line', source: 'cables', paint: {
    'line-color': '#00ccff',
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 5, 2, 10, 3],
    'line-opacity': 0.85
  }});

  // Alert dots for loitering vessels
  map.addLayer({ id: 'cable-alert-glow', type: 'circle', source: 'cable-alerts', paint: {
    'circle-radius': 20, 'circle-color': '#ff4400',
    'circle-opacity': 0.18, 'circle-blur': 1
  }});
  map.addLayer({ id: 'cable-alert-dot', type: 'circle', source: 'cable-alerts', paint: {
    'circle-radius': 6, 'circle-color': '#ff4400',
    'circle-opacity': 0.9, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffaa00'
  }});

  // Register in layerVis system
  if (typeof lMap !== 'undefined') {
    lMap.cables = ['cable-glow', 'cable-line'];
    lMap['cable-alerts'] = ['cable-alert-glow', 'cable-alert-dot'];
  }
  layerVis.cables = true;
  layerVis['cable-alerts'] = true;
  _cableLayersAdded = true;

  // Click handler
  map.on('click', 'cable-line', e => {
    const name = e.features[0]?.properties?.name || 'Unknown cable';
    if (typeof showPopup === 'function') showPopup(e.lngLat, `🔵 <b>${name}</b><br>Submarine cable route`);
  });
  map.on('click', 'cable-alert-dot', e => {
    const p = e.features[0]?.properties || {};
    if (typeof showPopup === 'function') {
      showPopup(e.lngLat,
        `⚠ <b>CABLE PROXIMITY ALERT</b><br>Vessel: ${p.id}<br>Cable: ${p.cable}<br>Distance: ${p.distKm}km<br>Speed: ${p.speed}kts`
      );
    }
  });
  map.on('mouseenter', 'cable-line', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'cable-line', () => map.getCanvas().style.cursor = '');
  map.on('mouseenter', 'cable-alert-dot', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'cable-alert-dot', () => map.getCanvas().style.cursor = '');

  // Fetch cable routes
  fetchCableGeo();

  // Start loiter check loop
  setInterval(_runLoiterCheck, CABLE_ALERT_CONFIG.checkInterval);

  console.log('[WWO] Cables: layer initialised');
}

// ── Periodic loiter check — hooks into flight AIS data ────────────────────────
function _runLoiterCheck() {
  if (!_cablesLoaded || typeof _flightFeatures === 'undefined') return;
  _flightFeatures.forEach(f => {
    if (!f.properties) return;
    _updateVesselHistory({
      icao24:   f.properties.icao24 || f.properties.id,
      callsign: f.properties.callsign || f.properties.flight,
      lat:      f.geometry?.coordinates?.[1],
      lon:      f.geometry?.coordinates?.[0],
      speed:    f.properties.speed || 0,
    });
  });
}

// ── Public hook: call from flights.js after each AIS update ───────────────────
function cableCheckVessel(vessel) {
  if (_cablesLoaded) _updateVesselHistory(vessel);
}
