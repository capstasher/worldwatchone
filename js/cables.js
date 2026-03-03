// ====== SUBMARINE CABLE LAYER + AIS PROXIMITY ALERT ======
// Cable routes: TeleGeography GeoJSON — served locally as data/cable-geo.json

// Loiter detection config — tunable
const CABLE_ALERT_CONFIG = {
  radiusKm:      5,
  loiterMinutes: 20,
  speedKnots:    3,
  checkInterval: 60000
};

let _cableGeo       = null;
let _cableSegments  = [];
const _vesselHistory  = {};
const _flaggedVessels = new Set();
let _cablesLoaded     = false;
let _cableLayersAdded = false;

// ── Haversine distance (km) ───────────────────────────────────────────────────
function _haverKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Point-to-segment distance (km) ───────────────────────────────────────────
function _ptSegDistKm(px, py, ax, ay, bx, by) {
  const dx = bx-ax, dy = by-ay, lenSq = dx*dx+dy*dy;
  if (lenSq === 0) return _haverKm(py, px, ay, ax);
  let t = Math.max(0, Math.min(1, ((px-ax)*dx+(py-ay)*dy)/lenSq));
  return _haverKm(py, px, ay+t*dy, ax+t*dx);
}

// ── Build segment index ───────────────────────────────────────────────────────
function _buildSegmentIndex(geo) {
  const segs = [];
  if (!geo?.features) return segs;
  geo.features.forEach(f => {
    const name = f.properties?.name || 'Unknown Cable';
    const lines = f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates
                : f.geometry?.type === 'LineString'      ? [f.geometry.coordinates]
                : [];
    lines.forEach(coords => {
      for (let i = 0; i < coords.length-1; i++)
        segs.push({ p1: coords[i], p2: coords[i+1], name });
    });
  });
  return segs;
}

// ── Nearest cable ─────────────────────────────────────────────────────────────
function _nearestCable(lat, lon) {
  let minDist = Infinity, nearestName = null;
  for (const seg of _cableSegments) {
    const d = _ptSegDistKm(lon, lat, seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]);
    if (d < minDist) { minDist = d; nearestName = seg.name; }
  }
  return { distKm: minDist, cable: nearestName };
}

// ── Vessel history / loiter detection ────────────────────────────────────────
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
  hist.push({ lat: vessel.lat, lon: vessel.lon, ts: now, speed: vessel.speed||0, distKm, cable });
  const inWindow = hist.filter(h => h.ts >= now - windowMs);
  if (inWindow.length < 3) return;
  const allNear    = inWindow.every(h => h.distKm <= CABLE_ALERT_CONFIG.radiusKm);
  const slowEnough = inWindow.every(h => h.speed <= CABLE_ALERT_CONFIG.speedKnots || h.speed === 0);
  const span       = inWindow[inWindow.length-1].ts - inWindow[0].ts;
  if (allNear && slowEnough && span >= windowMs * 0.8) {
    if (!_flaggedVessels.has(id)) _flagVessel(id, vessel, cable, distKm, Math.round(span/60000));
  } else {
    if (_flaggedVessels.has(id)) _unflagVessel(id);
  }
}

function _flagVessel(id, vessel, cableName, distKm, minutes) {
  _flaggedVessels.add(id);
  const callsign = vessel.callsign || vessel.flight || id;
  const msg = `⚠ CABLE PROXIMITY: ${callsign} loitering ${distKm.toFixed(1)}km from [${cableName}] for ${minutes}+ min — speed ${(vessel.speed||0).toFixed(1)}kts`;
  console.warn('[WWO-CABLES]', msg);
  if (typeof addLiveItem === 'function')
    addLiveItem(msg, 'CABLE-WATCH', new Date().toISOString(), null, 'OSINT', 'al', true);
  _refreshCableAlertLayer();
}

function _unflagVessel(id) {
  _flaggedVessels.delete(id);
  _refreshCableAlertLayer();
}

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

// ── Normalise for MapLibre globe (flatten + split antimeridian) ───────────────
function _normaliseCableGeo(geo) {
  const features = [];
  if (!geo?.features) return { type: 'FeatureCollection', features };
  geo.features.forEach(f => {
    const name = f.properties?.name || 'Unknown Cable';
    const id   = f.properties?.id   || '';
    const lines = f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates
                : f.geometry?.type === 'LineString'      ? [f.geometry.coordinates]
                : [];
    lines.forEach(coords => {
      _splitAtAntimeridian(coords).forEach(seg => {
        if (seg.length >= 2)
          features.push({ type:'Feature', geometry:{ type:'LineString', coordinates:seg }, properties:{ name, id } });
      });
    });
  });
  return { type: 'FeatureCollection', features };
}

function _splitAtAntimeridian(coords) {
  if (!coords?.length) return [];
  const segments = [];
  let current = [[_clampLon(coords[0][0]), _clampLat(coords[0][1])]];
  for (let i = 1; i < coords.length; i++) {
    const lon = _clampLon(coords[i][0]), lat = _clampLat(coords[i][1]);
    if (Math.abs(lon - current[current.length-1][0]) > 180) {
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
  lon = parseFloat(lon) || 0;
  while (lon >  180) lon -= 360;
  while (lon < -180) lon += 360;
  return Math.round(lon * 1e5) / 1e5;
}
function _clampLat(lat) {
  return Math.max(-90, Math.min(90, Math.round((parseFloat(lat)||0) * 1e5) / 1e5));
}

// ── Load local GeoJSON file ───────────────────────────────────────────────────
async function fetchCableGeo() {
  // Try multiple paths in case the file is served from a different root
  const paths = [
    '../data/cable-geo.json',
  ];
  let r;
  for (const path of paths) {
    try {
      console.log('[WWO] Cables: trying', path);
      r = await fetch(path, { signal: AbortSignal.timeout(8000) });
      if (r.ok) { console.log('[WWO] Cables: found at', path); break; }
      console.warn('[WWO] Cables:', path, '→', r.status);
      r = null;
    } catch(e) {
      console.warn('[WWO] Cables:', path, '→', e.message);
      r = null;
    }
  }
  try {
    if (!r) throw new Error('File not found at any path — see console for details');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const geo = await r.json();
    if (!geo?.features?.length) throw new Error('Empty GeoJSON');

    _cableGeo      = geo;
    _cableSegments = _buildSegmentIndex(geo);
    _cablesLoaded  = true;

    const normalised = _normaliseCableGeo(geo);
    if (_cableLayersAdded) {
      const src = map.getSource('cables');
      if (src) src.setData(normalised);
    }
    console.log(`[WWO] Cables: loaded ${geo.features.length} cables, ${_cableSegments.length} segments`);
    return geo;
  } catch(e) {
    console.error('[WWO] Cables: failed to load data/cable-geo.json —', e.message,
      '\n→ Download from: https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/v3/cable/cable-geo.json');
    return null;
  }
}

// ── Init map layers ───────────────────────────────────────────────────────────
function initCables(map) {
  map.addSource('cables',       { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
  map.addSource('cable-alerts', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });

  map.addLayer({ id:'cable-glow', type:'line', source:'cables', paint:{
    'line-color': '#00aaff',
    'line-width': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8],
    'line-opacity': 0.18,
    'line-blur': 3
  }});

  map.addLayer({ id:'cable-line', type:'line', source:'cables', paint:{
    'line-color': '#00ccff',
    'line-width': ['interpolate',['linear'],['zoom'], 1,1.2, 5,2, 10,3],
    'line-opacity': 0.85
  }});

  map.addLayer({ id:'cable-alert-glow', type:'circle', source:'cable-alerts', paint:{
    'circle-radius':20, 'circle-color':'#ff4400', 'circle-opacity':0.18, 'circle-blur':1
  }});
  map.addLayer({ id:'cable-alert-dot', type:'circle', source:'cable-alerts', paint:{
    'circle-radius':6, 'circle-color':'#ff4400', 'circle-opacity':0.9,
    'circle-stroke-width':2, 'circle-stroke-color':'#ffaa00'
  }});

  if (typeof lMap !== 'undefined') {
    lMap.cables = ['cable-glow','cable-line'];
    lMap['cable-alerts'] = ['cable-alert-glow','cable-alert-dot'];
  }
  layerVis.cables = true;
  layerVis['cable-alerts'] = true;
  _cableLayersAdded = true;

  map.on('click', 'cable-line', e => {
    const name = e.features[0]?.properties?.name || 'Unknown cable';
    if (typeof showPopup === 'function') showPopup(e.lngLat, `🔵 <b>${name}</b><br>Submarine cable route`);
  });
  map.on('click', 'cable-alert-dot', e => {
    const p = e.features[0]?.properties || {};
    if (typeof showPopup === 'function')
      showPopup(e.lngLat, `⚠ <b>CABLE PROXIMITY ALERT</b><br>Vessel: ${p.id}<br>Cable: ${p.cable}<br>Distance: ${p.distKm}km<br>Speed: ${p.speed}kts`);
  });
  ['cable-line','cable-alert-dot'].forEach(id => {
    map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', id, () => map.getCanvas().style.cursor = '');
  });

  fetchCableGeo();
  setInterval(_runLoiterCheck, CABLE_ALERT_CONFIG.checkInterval);
  console.log('[WWO] Cables: layer initialised');
}

// ── Loiter check + public hook ────────────────────────────────────────────────
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

function cableCheckVessel(vessel) {
  if (_cablesLoaded) _updateVesselHistory(vessel);
}
