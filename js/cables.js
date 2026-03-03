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

  // Prune entries older than window
  const cutoff = now - windowMs * 2;
  while (hist.length && hist[0].ts < cutoff) hist.shift();

  // Only track vessels potentially near cables (coarse bbox filter first)
  const { distKm, cable } = _nearestCable(vessel.lat, vessel.lon);

  if (distKm > CABLE_ALERT_CONFIG.radiusKm * 3) {
    // Far from any cable — remove from history to save memory
    if (hist.length) _vesselHistory[id] = [];
    if (_flaggedVessels.has(id)) _unflagVessel(id);
    return;
  }

  hist.push({ lat: vessel.lat, lon: vessel.lon, ts: now, speed: vessel.speed || 0, distKm, cable });

  // Check loiter condition: vessel within radius for >= loiterMinutes
  const windowStart = now - windowMs;
  const inWindow = hist.filter(h => h.ts >= windowStart);
  if (inWindow.length < 3) return; // need multiple fixes

  const allNear = inWindow.every(h => h.distKm <= CABLE_ALERT_CONFIG.radiusKm);
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
  // Update alert layer on map
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

// ── Fetch cable GeoJSON from TeleGeography ────────────────────────────────────
async function fetchCableGeo() {
  try {
    // Try direct first (CORS-permissive on GitHub raw), then proxy
    let r;
    try {
      r = await fetch(CABLE_DATA_URL, { signal: AbortSignal.timeout(15000) });
    } catch {
      r = await fetch(PROXY(CABLE_DATA_URL), { signal: AbortSignal.timeout(20000) });
    }
    if (!r.ok) throw new Error('Cable GeoJSON ' + r.status);
    const geo = await r.json();
    _cableGeo = geo;
    _cableSegments = _buildSegmentIndex(geo);
    _cablesLoaded = true;
    console.log(`[WWO] Cables: loaded ${geo.features?.length || 0} cables, ${_cableSegments.length} segments`);

    // Update map layer if already initialised
    if (_cableLayersAdded) {
      const src = map.getSource('cables');
      if (src) src.setData(geo);
    }
    return geo;
  } catch(e) {
    console.warn('[WWO] Cable fetch failed:', e.message);
    return null;
  }
}

// ── Init map layers ────────────────────────────────────────────────────────────
function initCables(map) {
  // Cable route lines
  map.addSource('cables', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('cable-alerts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  // Glow halo (wide, faint)
  map.addLayer({ id: 'cable-glow', type: 'line', source: 'cables', paint: {
    'line-color': '#0088ff',
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.5, 5, 3, 10, 5],
    'line-opacity': 0.07,
    'line-blur': 4
  }});

  // Main cable line
  map.addLayer({ id: 'cable-line', type: 'line', source: 'cables', paint: {
    'line-color': '#0055cc',
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 5, 1.2, 10, 2],
    'line-opacity': 0.55
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

  // Start loiter check loop — runs against whatever AIS data is in _flightFeatures
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
