// ====== WEATHER & NATURAL DISASTERS ======
// Weather tiles: OpenWeatherMap (temp/wind/precip/clouds)
// Disaster pins: NASA FIRMS (wildfires), NOAA NHC (storms), GDACS (volcanoes/floods/tsunamis)

const OWM_KEY = '672decb9af50b0fd34671e756d149224';
// FIRMS_KEY is stored as a Cloudflare Worker secret — never exposed client-side

// OWM tile layer IDs
const OWM_LAYERS = {
  temp:    'temp_new',
  wind:    'wind_new',
  precip:  'precipitation_new',
  clouds:  'clouds_new',
  pressure:'pressure_new',
};

var activeWeatherLayer = null; // null = off
var weatherLayerVis = true;    // master toggle

// ── Init weather tile sources/layers ─────────────────────────────────────────
function initWeather(map) {
  console.log('[WWO] Weather: initializing tile layers + disaster pins');

  // OWM raster layers are registered lazily on first activation (avoids 400s for unused layers)
  // See setWeatherLayer() below — sources/layers added on demand.

  // ── SVG disaster icons (same mkImg pattern as planes/sats) ──────────────────
  // Fire icon — flame shape
  map.addImage('fire-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    // Outer glow
    x.globalAlpha = 0.25;
    x.fillStyle = '#ff4400';
    x.beginPath(); x.arc(0, 2, 11, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1;
    // Flame body
    x.fillStyle = '#ff6600';
    x.beginPath();
    x.moveTo(0, -13);
    x.bezierCurveTo(5, -8, 9, -3, 7, 4);
    x.bezierCurveTo(6, 8, 3, 11, 0, 13);
    x.bezierCurveTo(-3, 11, -6, 8, -7, 4);
    x.bezierCurveTo(-9, -3, -5, -8, 0, -13);
    x.fill();
    // Inner hot core
    x.fillStyle = '#ffdd00';
    x.beginPath();
    x.moveTo(0, -5);
    x.bezierCurveTo(3, -1, 4, 3, 2, 7);
    x.bezierCurveTo(1, 10, -1, 10, -2, 7);
    x.bezierCurveTo(-4, 3, -3, -1, 0, -5);
    x.fill();
  }, 28));

  // Volcano icon — mountain with eruption plume
  map.addImage('volc-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    // Glow
    x.globalAlpha = 0.2;
    x.fillStyle = '#ff3300';
    x.beginPath(); x.arc(0, 3, 12, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1;
    // Mountain body
    x.fillStyle = '#cc4400';
    x.beginPath();
    x.moveTo(-14, 13);
    x.lineTo(-3, -2);
    x.lineTo(0, -6);
    x.lineTo(3, -2);
    x.lineTo(14, 13);
    x.closePath(); x.fill();
    // Snow/crater cap
    x.fillStyle = '#ff8844';
    x.beginPath();
    x.moveTo(-4, -1);
    x.lineTo(0, -8);
    x.lineTo(4, -1);
    x.closePath(); x.fill();
    // Eruption plume
    x.fillStyle = '#ff6600';
    x.globalAlpha = 0.85;
    x.beginPath(); x.arc(-2, -11, 3.5, 0, Math.PI*2); x.fill();
    x.beginPath(); x.arc(2, -13, 2.5, 0, Math.PI*2); x.fill();
    x.beginPath(); x.arc(0, -15, 2, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1;
  }, 30));

  // Storm icon — spiral/cyclone
  map.addImage('storm-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    // Glow
    x.globalAlpha = 0.18;
    x.fillStyle = '#00aaff';
    x.beginPath(); x.arc(0, 0, 13, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1;
    // Spiral arms
    x.strokeStyle = '#00ccff';
    x.lineWidth = 2.2;
    x.lineCap = 'round';
    for(let arm = 0; arm < 3; arm++) {
      x.save();
      x.rotate(arm * Math.PI * 2/3);
      x.beginPath();
      for(let t = 0; t <= 1; t += 0.05) {
        const r = 2 + t * 9;
        const a = t * Math.PI * 1.5;
        const px = r * Math.cos(a);
        const py = r * Math.sin(a);
        t === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.globalAlpha = 0.7 + 0.3 * (1 - arm/3);
      x.stroke();
      x.restore();
    }
    x.globalAlpha = 1;
    // Eye
    x.fillStyle = '#004466';
    x.beginPath(); x.arc(0, 0, 2.5, 0, Math.PI*2); x.fill();
    x.strokeStyle = '#00ccff';
    x.lineWidth = 1;
    x.beginPath(); x.arc(0, 0, 2.5, 0, Math.PI*2); x.stroke();
  }, 30));

  // Tsunami icon — wave
  map.addImage('tsun-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    // Glow
    x.globalAlpha = 0.2;
    x.fillStyle = '#00ddff';
    x.beginPath(); x.arc(0, 2, 12, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1;
    x.strokeStyle = '#00ddff';
    x.lineWidth = 2.5;
    x.lineCap = 'round';
    // Wave 1 (back)
    x.globalAlpha = 0.45;
    x.beginPath();
    x.moveTo(-12, -2);
    x.bezierCurveTo(-8, -10, -2, -10, 0, -4);
    x.bezierCurveTo(2, 2, 6, 2, 12, -4);
    x.stroke();
    // Wave 2 (front)
    x.globalAlpha = 1;
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(-13, 4);
    x.bezierCurveTo(-9, -5, -3, -7, 0, -1);
    x.bezierCurveTo(3, 5, 8, 5, 13, -1);
    x.stroke();
    // Crest curl
    x.fillStyle = '#00ddff';
    x.globalAlpha = 0.7;
    x.beginPath(); x.arc(-13, 4, 2.5, 0, Math.PI*2); x.fill();
  }, 30));

  // ── Disaster pin GeoJSON sources ─────────────────────────────────────────
  map.addSource('fires',     { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('storms',    { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('volcanoes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('tsunamis',  { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  // FIRES — glow halo + icon
  map.addLayer({ id: 'fire-glow', type: 'circle', source: 'fires', paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'frp'], 0, 10, 50, 20, 200, 36],
    'circle-color': '#ff4400', 'circle-opacity': 0.12, 'circle-blur': 1
  }});
  map.addLayer({ id: 'fire-dot', type: 'symbol', source: 'fires', layout: {
    'icon-image': 'fire-icon',
    'icon-size': ['interpolate', ['linear'], ['get', 'frp'], 0, 0.55, 50, 0.8, 200, 1.1],
    'icon-allow-overlap': true, 'icon-ignore-placement': false
  }});

  // VOLCANOES — glow halo + icon + label
  map.addLayer({ id: 'volc-glow', type: 'circle', source: 'volcanoes', paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'alert'], 0, 14, 3, 28],
    'circle-color': '#ff3300', 'circle-opacity': 0.15, 'circle-blur': 1
  }});
  map.addLayer({ id: 'volc-dot', type: 'symbol', source: 'volcanoes', layout: {
    'icon-image': 'volc-icon',
    'icon-size': ['interpolate', ['linear'], ['get', 'alert'], 0, 0.8, 3, 1.1],
    'text-field': ['get', 'name'],
    'text-size': 9,
    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
    'text-offset': [0, 1.6],
    'text-allow-overlap': false,
    'icon-allow-overlap': true
  }, paint: {
    'text-color': '#ff8800',
    'text-halo-color': 'rgba(0,0,0,0.9)',
    'text-halo-width': 1.5
  }});

  // STORMS — track line + glow + icon + label
  map.addLayer({ id: 'storm-track', type: 'line', source: 'storms',
    filter: ['==', ['get', 'type'], 'track'],
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-dasharray': [4,2], 'line-opacity': 0.5 }
  });
  map.addLayer({ id: 'storm-glow', type: 'circle', source: 'storms',
    filter: ['==', ['get', 'type'], 'center'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'wind'], 0, 18, 64, 32, 130, 48],
      'circle-color': ['interpolate', ['linear'], ['get', 'cat'], 0, '#00aaff', 1, '#ffcc00', 3, '#ff6600', 5, '#ff0000'],
      'circle-opacity': 0.12, 'circle-blur': 1
    }
  });
  map.addLayer({ id: 'storm-dot', type: 'symbol', source: 'storms',
    filter: ['==', ['get', 'type'], 'center'],
    layout: {
      'icon-image': 'storm-icon',
      'icon-size': ['interpolate', ['linear'], ['get', 'wind'], 0, 0.75, 64, 0.95, 130, 1.2],
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset': [0, 1.7],
      'text-allow-overlap': false,
      'icon-allow-overlap': true
    }, paint: {
      'text-color': '#00ccff',
      'text-halo-color': 'rgba(0,0,0,0.9)',
      'text-halo-width': 1.5
    }
  });

  // TSUNAMIS — pulsing ring + icon
  map.addLayer({ id: 'tsunami-ring', type: 'circle', source: 'tsunamis', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 20, 5, 40],
    'circle-color': 'transparent',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#00ddff',
    'circle-stroke-opacity': 0.6
  }});
  map.addLayer({ id: 'tsunami-dot', type: 'symbol', source: 'tsunamis', layout: {
    'icon-image': 'tsun-icon',
    'icon-size': 0.9,
    'icon-allow-overlap': true
  }});

  // Add to global layer map so togL() works
  lMap.fires    = ['fire-glow', 'fire-dot'];
  lMap.storms   = ['storm-glow', 'storm-dot', 'storm-track'];
  lMap.volcanoes= ['volc-glow', 'volc-dot'];
  lMap.tsunamis = ['tsunami-ring', 'tsunami-dot'];

  layerVis.fires    = true;
  layerVis.storms   = true;
  layerVis.volcanoes= true;
  layerVis.tsunamis = true;

  // Start data fetches
  fetchFIRMS();
  fetchStorms();
  fetchGDACS();

  setInterval(fetchFIRMS,   30 * 60 * 1000); // 30min (was 15)
  setInterval(fetchStorms,  20 * 60 * 1000); // 20min (was 10)
  setInterval(fetchGDACS,   30 * 60 * 1000); // 30min (was 15)

  console.log('[WWO] Weather: ready');
}

// ── Weather tile toggle ───────────────────────────────────────────────────────
// Lazy: only register a source/layer when the user first activates it
const wxLayerLoaded = {};

function setWeatherLayer(key) {
  // Hide all active wx layers
  Object.keys(OWM_LAYERS).forEach(k => {
    if (wxLayerLoaded[k]) {
      try { map.setLayoutProperty('wx-' + k, 'visibility', 'none'); } catch(e) {}
    }
  });

  // Toggle off if clicking the active layer
  if (activeWeatherLayer === key) {
    activeWeatherLayer = null;
    document.querySelectorAll('.wx-btn').forEach(b => b.classList.remove('on'));
    var sg = document.getElementById('sea-gradient');
    if (sg) sg.style.opacity = '';
    return;
  }

  activeWeatherLayer = key;

  // Hide sea-gradient overlay when weather layer active (it washes out wx colours)
  var sg = document.getElementById('sea-gradient');
  if (sg) sg.style.opacity = key ? '0' : '';

  if (key) {
    // Lazy-register source + layer on first use
    if (!wxLayerLoaded[key]) {
      const code = OWM_LAYERS[key];
      try {
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
          paint: { 'raster-opacity': 0.68 }
        });
        wxLayerLoaded[key] = true;
        console.log('[WWO] Weather layer registered: ' + key + ' (' + code + ')');
      } catch(e) {
        console.warn('[WWO] Weather layer error:', e.message);
        activeWeatherLayer = null;
        return;
      }
    } else {
      try { map.setLayoutProperty('wx-' + key, 'visibility', 'visible'); } catch(e) {}
    }
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
    const r = await fetch(url, { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),20000); return _c.signal; })() });
    if (!r.ok) throw new Error('FIRMS ' + r.status);
    const csv = await r.text();
    const features = parseFIRMScsv(csv);
    const src = map.getSource('fires');
    if (src) {
      // Preserve any GDACS wildfire pins already in the layer
      const existing = src.serialize().data || { type: 'FeatureCollection', features: [] };
      const gdacsWildfires = (existing.features || []).filter(f => f.properties?.source === 'GDACS');
      src.setData({ type: 'FeatureCollection', features: [...features, ...gdacsWildfires] });
    }
    const el = document.getElementById('fire-cnt');
    if (el) el.textContent = features.length;
    console.log(`[WWO] FIRMS: ${features.length} fire detections`);
    // Inject major fires into feed
    const major = features.filter(f => (f.properties.frp || 0) > 100);
    if (major.length > 0) {
      addLiveItem(`${major.length} MAJOR FIRE DETECTIONS (FRP>100MW) — global`,
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
    const r = await fetch(PROXY(url), { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),10000); return _c.signal; })() });
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
    const r = await fetch(PROXY(url), { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),10000); return _c.signal; })() });
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
    const r = await fetch(PROXY(url), { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),12000); return _c.signal; })() });
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
  const gdacsFireFeatures = [];

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
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', 'al', false);
    } else if (lcTitle.includes('tsunami')) {
      tsunamiFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { title, link, pubDate, alert: alertLevel }
      });
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', 'al', false);
    } else if (lcTitle.includes('forest fire') || lcTitle.includes('wildfire') || lcTitle.includes('fire notification')) {
      // Wildfire/forest fire — add to fires layer with frp=0 (min size icon)
      gdacsFireFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { title, link, pubDate, alert: alertLevel, frp: 0, source: 'GDACS' }
      });
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', alertLevel >= 1 ? 'al' : 'wa', false);
    } else if (lcTitle.includes('flood') || lcTitle.includes('cyclone') || lcTitle.includes('earthquake')) {
      // Other GDACS events — inject to feed only (no dedicated pin layer)
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', 'wa', false);
    }
  });

  const vs = map.getSource('volcanoes');
  if (vs) vs.setData({ type: 'FeatureCollection', features: volcFeatures });
  const ts = map.getSource('tsunamis');
  if (ts) ts.setData({ type: 'FeatureCollection', features: tsunamiFeatures });

  // Merge GDACS wildfires into the fires layer (alongside FIRMS data)
  if (gdacsFireFeatures.length > 0) {
    const fs = map.getSource('fires');
    if (fs) {
      const existing = fs.serialize().data || { type: 'FeatureCollection', features: [] };
      // Filter out any previous GDACS fire entries then re-add fresh ones
      const firmsOnly = (existing.features || []).filter(f => f.properties?.source !== 'GDACS');
      fs.setData({ type: 'FeatureCollection', features: [...firmsOnly, ...gdacsFireFeatures] });
    }
  }

  const vc = document.getElementById('volc-cnt');
  if (vc) vc.textContent = volcFeatures.length;
  const tc = document.getElementById('tsun-cnt');
  if (tc) tc.textContent = tsunamiFeatures.length;

  console.log(`[WWO] GDACS: ${volcFeatures.length} volcanoes, ${tsunamiFeatures.length} tsunamis, ${gdacsFireFeatures.length} wildfires`);
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
