// ====== WEATHER & NATURAL DISASTERS ======
// Weather tiles: OpenWeatherMap (temp/wind/precip/clouds)
// Disaster pins: NASA FIRMS (wildfires), NOAA NHC (storms), GDACS (volcanoes/floods/tsunamis)

const OWM_KEY = '672decb9af50b0fd34671e756d149224';
// FIRMS_KEY is stored as a Cloudflare Worker secret — never exposed client-side

// OWM tile layer IDs
const OWM_LAYERS = {
  temp:   'TA2',       // Temperature at 2m
  wind:   'WND',       // Wind speed
  precip: 'PA0',       // Precipitation
  clouds: 'CL',        // Cloud cover
  pressure:'APM',      // Pressure
};

var activeWeatherLayer = null; // null = off
var weatherLayerVis = true;    // master toggle

// ── Init weather tile sources/layers ─────────────────────────────────────────
function initWeather(map) {
  console.log('[WWO] Weather: initializing tile layers + disaster pins');

  // One raster source per OWM layer type (swap tile URL to change view)
  Object.keys(OWM_LAYERS).forEach(key => {
    const code = OWM_LAYERS[key];
    map.addSource('wx-' + key, {
      type: 'raster',
      tiles: [`https://tile.openweathermap.org/map/${code}/{z}/{x}/{y}.png?appid=${OWM_KEY}`],
      tileSize: 256,
      attribution: '© OpenWeatherMap'
    });
    map.addLayer({
      id: 'wx-' + key,
      type: 'raster',
      source: 'wx-' + key,
      paint: { 'raster-opacity': 0.72 },
      layout: { visibility: 'none' }
    });
  });

  // ── Disaster pin sources ──────────────────────────────────────────────────
  // WILDFIRES (NASA FIRMS — VIIRS S-NPP NRT)
  map.addSource('fires', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'fire-glow', type: 'circle', source: 'fires',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'frp'], 0, 8, 50, 18, 200, 32],
      'circle-color': '#ff4400',
      'circle-opacity': 0.18,
      'circle-blur': 1
    }
  });
  map.addLayer({
    id: 'fire-dot', type: 'circle', source: 'fires',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'frp'], 0, 3, 50, 6, 200, 10],
      'circle-color': ['interpolate', ['linear'], ['get', 'frp'], 0, '#ff8800', 50, '#ff4400', 200, '#ff0000'],
      'circle-opacity': 0.9,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ff6600',
      'circle-stroke-opacity': 0.4
    }
  });

  // STORMS (NHC active tropical cyclones)
  map.addSource('storms', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  // Storm center
  map.addLayer({
    id: 'storm-glow', type: 'circle', source: 'storms',
    filter: ['==', ['get', 'type'], 'center'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'wind'], 0, 16, 64, 28, 130, 44],
      'circle-color': ['interpolate', ['linear'], ['get', 'cat'], 0, '#00aaff', 1, '#ffcc00', 3, '#ff6600', 5, '#ff0000'],
      'circle-opacity': 0.15,
      'circle-blur': 1
    }
  });
  map.addLayer({
    id: 'storm-dot', type: 'circle', source: 'storms',
    filter: ['==', ['get', 'type'], 'center'],
    paint: {
      'circle-radius': 7,
      'circle-color': ['interpolate', ['linear'], ['get', 'cat'], 0, '#00aaff', 1, '#ffcc00', 3, '#ff6600', 5, '#ff0000'],
      'circle-opacity': 0.95,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.3
    }
  });
  // Storm track line
  map.addLayer({
    id: 'storm-track', type: 'line', source: 'storms',
    filter: ['==', ['get', 'type'], 'track'],
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.5,
      'line-dasharray': [4, 2],
      'line-opacity': 0.6
    }
  });
  // Storm label
  map.addLayer({
    id: 'storm-label', type: 'symbol', source: 'storms',
    filter: ['==', ['get', 'type'], 'center'],
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset': [0, 1.6],
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#00ccff',
      'text-halo-color': 'rgba(0,0,0,0.9)',
      'text-halo-width': 1.5
    }
  });

  // VOLCANOES (GDACS)
  map.addSource('volcanoes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'volc-glow', type: 'circle', source: 'volcanoes',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'alert'], 0, 12, 3, 26],
      'circle-color': '#ff3300',
      'circle-opacity': 0.2,
      'circle-blur': 1
    }
  });
  map.addLayer({
    id: 'volc-dot', type: 'circle', source: 'volcanoes',
    paint: {
      'circle-radius': 5,
      'circle-color': ['interpolate', ['linear'], ['get', 'alert'], 0, '#ff8800', 2, '#ff3300', 3, '#dd0000'],
      'circle-opacity': 0.95,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffaa00',
      'circle-stroke-opacity': 0.5
    }
  });
  map.addLayer({
    id: 'volc-label', type: 'symbol', source: 'volcanoes',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 9,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset': [0, 1.4],
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#ff8800',
      'text-halo-color': 'rgba(0,0,0,0.9)',
      'text-halo-width': 1.5
    }
  });

  // TSUNAMIS (PTWC warnings)
  map.addSource('tsunamis', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'tsunami-ring', type: 'circle', source: 'tsunamis',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 18, 5, 36],
      'circle-color': 'transparent',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#00ddff',
      'circle-stroke-opacity': 0.7
    }
  });
  map.addLayer({
    id: 'tsunami-dot', type: 'circle', source: 'tsunamis',
    paint: {
      'circle-radius': 5,
      'circle-color': '#00ddff',
      'circle-opacity': 0.9,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.3
    }
  });

  // Add to global layer map so togL() works
  lMap.fires    = ['fire-glow', 'fire-dot'];
  lMap.storms   = ['storm-glow', 'storm-dot', 'storm-track', 'storm-label'];
  lMap.volcanoes= ['volc-glow', 'volc-dot', 'volc-label'];
  lMap.tsunamis = ['tsunami-ring', 'tsunami-dot'];

  layerVis.fires    = true;
  layerVis.storms   = true;
  layerVis.volcanoes= true;
  layerVis.tsunamis = true;

  // Start data fetches
  fetchFIRMS();
  fetchStorms();
  fetchGDACS();

  setInterval(fetchFIRMS,   15 * 60 * 1000); // 15min
  setInterval(fetchStorms,  10 * 60 * 1000); // 10min
  setInterval(fetchGDACS,   15 * 60 * 1000); // 15min

  console.log('[WWO] Weather: ready');
}

// ── Weather tile toggle ───────────────────────────────────────────────────────
function setWeatherLayer(key) {
  // key = null (off) or one of OWM_LAYERS keys
  Object.keys(OWM_LAYERS).forEach(k => {
    try { map.setLayoutProperty('wx-' + k, 'visibility', 'none'); } catch(e) {}
  });

  activeWeatherLayer = key;

  if (key && weatherLayerVis) {
    try { map.setLayoutProperty('wx-' + key, 'visibility', 'visible'); } catch(e) {}
  }

  // Update UI buttons
  document.querySelectorAll('.wx-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.wx === key);
  });
}

// ── NASA FIRMS — wildfire detections ─────────────────────────────────────────
async function fetchFIRMS() {
  try {
    // Key is stored server-side as a Worker secret — routed via /api/firms
    const url = `${PROXY_BASE}/api/firms?source=VIIRS_SNPP_NRT&days=1&area=world`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('FIRMS ' + r.status);
    const csv = await r.text();
    const features = parseFIRMScsv(csv);
    const src = map.getSource('fires');
    if (src) src.setData({ type: 'FeatureCollection', features });
    const el = document.getElementById('fire-cnt');
    if (el) el.textContent = features.length;
    console.log(`[WWO] FIRMS: ${features.length} fire detections`);
    // Inject major fires into feed
    const major = features.filter(f => (f.properties.frp || 0) > 100);
    if (major.length > 0) {
      addLiveItem(`🔥 ${major.length} MAJOR FIRE DETECTIONS (FRP>100MW) — global`,
        'NASA FIRMS', new Date().toISOString(),
        'https://firms.modaps.eosdis.nasa.gov', 'GEO', 'wa', false);
    }
  } catch(e) { console.warn('[WWO] FIRMS error:', e.message); }
}

function parseFIRMScsv(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const latI  = headers.indexOf('latitude');
  const lonI  = headers.indexOf('longitude');
  const frpI  = headers.indexOf('frp');
  const brightI = headers.indexOf('bright_ti4');
  const dateI = headers.indexOf('acq_date');
  const confI = headers.indexOf('confidence');
  const features = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 4) continue;
    const lat = parseFloat(cols[latI]);
    const lon = parseFloat(cols[lonI]);
    if (isNaN(lat) || isNaN(lon)) continue;
    const frp  = parseFloat(cols[frpI]) || 0;
    const bright = parseFloat(cols[brightI]) || 0;
    const conf = cols[confI] || 'n';
    // Filter: skip low-confidence detections
    if (conf === 'l') continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: { frp, bright, date: cols[dateI] || '', conf }
    });
  }
  return features;
}

// ── NOAA NHC — active tropical storms ────────────────────────────────────────
async function fetchStorms() {
  try {
    // NHC publishes GeoJSON for active storms
    const url = 'https://www.nhc.noaa.gov/CurrentStorms.json';
    const r = await fetch(PROXY(url), { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('NHC ' + r.status);
    const d = await r.json();
    const features = parseNHCStorms(d);
    const src = map.getSource('storms');
    if (src) src.setData({ type: 'FeatureCollection', features });
    const el = document.getElementById('storm-cnt');
    if (el) el.textContent = features.filter(f => f.properties.type === 'center').length;
    console.log(`[WWO] NHC: ${features.filter(f=>f.properties.type==='center').length} active storms`);
  } catch(e) {
    // Fallback: try ATCF best track GeoJSON
    try {
      const url2 = 'https://www.nhc.noaa.gov/gis/Allstorms.kmz';
      // KMZ is binary — skip, use RSS instead
      await fetchStormsRSS();
    } catch(e2) { console.warn('[WWO] NHC error:', e.message); }
  }
}

async function fetchStormsRSS() {
  try {
    const url = 'https://www.nhc.noaa.gov/index-at.xml';
    const r = await fetch(PROXY(url), { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const xml = await r.text();
    // Parse basic storm info from RSS
    const items = parseRSSXml(xml);
    items.forEach(item => {
      if (item.title && item.title.match(/Advisory|Outlook|Discussion/)) {
        addLiveItem('🌀 ' + item.title, 'NHC', item.pubDate, item.link, 'GEO', 'wa', false);
      }
    });
  } catch(e) {}
}

function parseNHCStorms(d) {
  const features = [];
  if (!d || !d.activeStorms) return features;
  const catColors = ['#00aaff','#00ff88','#ffcc00','#ff8800','#ff4400','#ff0000'];
  d.activeStorms.forEach(storm => {
    const cat  = storm.classification === 'TD' ? 0 :
                 storm.classification === 'TS' ? 1 :
                 parseInt(storm.intensity) || 0;
    const wind = parseInt(storm.intensity) || 0;
    const color = catColors[Math.min(cat, catColors.length-1)];
    // Current center
    if (storm.latitudeNumeric && storm.longitudeNumeric) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [storm.longitudeNumeric, storm.latitudeNumeric] },
        properties: {
          type: 'center', name: storm.name || storm.id,
          cat, wind, color,
          classification: storm.classification || 'TC',
          id: storm.id
        }
      });
    }
    // Forecast track if available
    if (storm.forecastTrack && storm.forecastTrack.coordinates) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: storm.forecastTrack.coordinates },
        properties: { type: 'track', color, name: storm.name }
      });
    }
    // Feed injection
    addLiveItem(
      `🌀 ${storm.classification || 'TC'} ${storm.name || storm.id} — ${wind}kt winds`,
      'NHC', new Date().toISOString(),
      `https://www.nhc.noaa.gov/refresh/graphics_${(storm.id||'').toLowerCase()}`,
      'GEO', 'wa', false
    );
  });
  return features;
}

// ── GDACS — Global Disaster Alert (volcanoes, floods, tsunamis) ──────────────
async function fetchGDACS() {
  try {
    const url = 'https://www.gdacs.org/xml/rss.xml';
    const r = await fetch(PROXY(url), { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('GDACS ' + r.status);
    const xml = await r.text();
    parseGDACS(xml);
  } catch(e) { console.warn('[WWO] GDACS error:', e.message); }
}

function parseGDACS(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = doc.querySelectorAll('item');
  const volcFeatures = [];
  const tsunamiFeatures = [];

  items.forEach(item => {
    const title    = item.querySelector('title')?.textContent || '';
    const link     = item.querySelector('link')?.textContent || '';
    const pubDate  = item.querySelector('pubDate')?.textContent || '';
    const desc     = item.querySelector('description')?.textContent || '';

    // GDACS uses georss:point or geo: namespace for coordinates
    const geoPoint = item.querySelector('point')?.textContent ||
                     item.getElementsByTagNameNS('*','point')[0]?.textContent || '';
    const coords = geoPoint.trim().split(/\s+/).map(Number);
    const lat = coords[0], lon = coords[1];
    if (isNaN(lat) || isNaN(lon)) return;

    // Alert level from title
    const alertMatch = title.match(/\b(green|orange|red)\b/i);
    const alertLevel = alertMatch
      ? { green: 0, orange: 1, red: 2 }[alertMatch[1].toLowerCase()] || 0
      : 0;

    const lcTitle = title.toLowerCase();

    if (lcTitle.includes('volcan') || lcTitle.includes('eruption')) {
      const name = title.replace(/volcano|eruption|alert/gi,'').trim();
      volcFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { name, alert: alertLevel, title, link, pubDate }
      });
      addLiveItem('🌋 ' + title, 'GDACS', pubDate, link, 'GEO', 'al', false);
    } else if (lcTitle.includes('tsunami')) {
      tsunamiFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { title, link, pubDate, alert: alertLevel }
      });
      addLiveItem('🌊 ' + title, 'GDACS', pubDate, link, 'GEO', 'al', false);
    } else if (lcTitle.includes('flood') || lcTitle.includes('cyclone') || lcTitle.includes('earthquake')) {
      // Other GDACS events — inject to feed only (no dedicated pin layer)
      addLiveItem('⚠ ' + title, 'GDACS', pubDate, link, 'GEO', 'wa', false);
    }
  });

  const vs = map.getSource('volcanoes');
  if (vs) vs.setData({ type: 'FeatureCollection', features: volcFeatures });
  const ts = map.getSource('tsunamis');
  if (ts) ts.setData({ type: 'FeatureCollection', features: tsunamiFeatures });

  const vc = document.getElementById('volc-cnt');
  if (vc) vc.textContent = volcFeatures.length;
  const tc = document.getElementById('tsun-cnt');
  if (tc) tc.textContent = tsunamiFeatures.length;

  console.log(`[WWO] GDACS: ${volcFeatures.length} volcanoes, ${tsunamiFeatures.length} tsunamis`);
}

// ── Click handlers for disaster pins ─────────────────────────────────────────
function initWeatherClicks(map) {
  // Fire click
  map.on('click', 'fire-dot', e => {
    const p = e.features[0].properties;
    showDisasterDetail('WILDFIRE DETECTION', '🔥', [
      ['FRP (MW)',      p.frp ? p.frp.toFixed(1) + ' MW' : 'N/A'],
      ['BRIGHTNESS',   p.bright ? p.bright.toFixed(1) + ' K' : 'N/A'],
      ['CONFIDENCE',   (p.conf || '').toUpperCase()],
      ['DATE',         p.date || 'RECENT'],
      ['SOURCE',       'NASA FIRMS / VIIRS S-NPP NRT'],
    ], 'https://firms.modaps.eosdis.nasa.gov/map/');
  });

  // Storm click
  map.on('click', 'storm-dot', e => {
    const p = e.features[0].properties;
    showDisasterDetail('TROPICAL CYCLONE — ' + (p.name || p.id), '🌀', [
      ['CLASSIFICATION', p.classification || 'TC'],
      ['WIND SPEED',     (p.wind || '--') + ' kt'],
      ['CATEGORY',       p.cat > 0 ? 'CAT ' + p.cat : 'SUB-HURRICANE'],
      ['SOURCE',         'NOAA / NHC'],
    ], `https://www.nhc.noaa.gov`);
  });

  // Volcano click
  map.on('click', 'volc-dot', e => {
    const p = e.features[0].properties;
    const alertLabels = ['GREEN', 'ORANGE', 'RED'];
    showDisasterDetail('VOLCANIC ACTIVITY', '🌋', [
      ['NAME',      p.name || 'UNKNOWN'],
      ['ALERT LVL', alertLabels[p.alert] || 'GREEN'],
      ['PUBLISHED', p.pubDate ? new Date(p.pubDate).toUTCString() : '--'],
      ['SOURCE',    'GDACS'],
    ], p.link || 'https://gdacs.org');
  });

  // Tsunami click
  map.on('click', 'tsunami-dot', e => {
    const p = e.features[0].properties;
    showDisasterDetail('TSUNAMI WARNING', '🌊', [
      ['STATUS',   p.title || 'ACTIVE WARNING'],
      ['ISSUED',   p.pubDate ? new Date(p.pubDate).toUTCString() : '--'],
      ['SOURCE',   'GDACS / PTWC'],
    ], p.link || 'https://gdacs.org');
  });

  // Cursors
  ['fire-dot','storm-dot','volc-dot','tsunami-dot'].forEach(id => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  });
}

function showDisasterDetail(title, icon, rows, link) {
  const dp = document.getElementById('dp');
  const dt = document.getElementById('dt');
  const dtl = document.getElementById('dtl');
  const dpb = document.getElementById('dpb');
  dt.textContent = icon + ' DISASTER';
  dt.style.background = 'rgba(255,60,0,0.2)';
  dt.style.color = '#ff6600';
  dtl.textContent = title;
  dpb.innerHTML = rows.map(([l,v]) =>
    `<div class="dr"><span class="dl">${l}</span><span class="dv2">${v}</span></div>`
  ).join('') + (link
    ? `<a href="${link}" target="_blank" rel="noopener" class="track-btn" style="margin-top:10px;display:block;text-align:center">↗ OPEN SOURCE</a>`
    : '');
  dp.classList.add('show');
}
