// ====== WEATHER & NATURAL DISASTERS ======
// Weather tiles: OpenWeatherMap (temp/wind/precip/clouds)
// Disaster pins: NASA FIRMS (wildfires), NOAA NHC (storms), GDACS (volcanoes/floods/tsunamis)
// NWS CAP Alerts: tornado/severe thunderstorm warning polygons (real-time, 2min refresh)

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

var activeWeatherLayer = null;
var weatherLayerVis = true;

// ── NWS alert config ──────────────────────────────────────────────────────────
const NWS_ALERT_COLORS = {
  'Tornado Emergency':           '#ff00ff',
  'Tornado Warning':             '#ff0000',
  'Severe Thunderstorm Warning': '#ff8800',
  'Flash Flood Emergency':       '#cc00ff',
  'Flash Flood Warning':         '#0088ff',
  'Tornado Watch':               '#ffff00',
  'Severe Thunderstorm Watch':   '#ff6600',
};
const NWS_ALERT_LABELS = {
  'Tornado Emergency':           'TOR EMERGENCY',
  'Tornado Warning':             'TOR',
  'Severe Thunderstorm Warning': 'SVR',
  'Flash Flood Emergency':       'FFE',
  'Flash Flood Warning':         'FFW',
  'Tornado Watch':               'WATCH',
  'Severe Thunderstorm Watch':   'SVR WATCH',
};
const NWS_ALERT_EVENTS = new Set(Object.keys(NWS_ALERT_COLORS));
const _nwsSeenIds = new Set();

// ── Init weather tile sources/layers ─────────────────────────────────────────
function initWeather(map) {
  console.log('[WWO] Weather: initializing tile layers + disaster pins');

  // ── SVG disaster icons ───────────────────────────────────────────────────────
  map.addImage('fire-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    x.globalAlpha = 0.25; x.fillStyle = '#ff4400';
    x.beginPath(); x.arc(0, 2, 11, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1; x.fillStyle = '#ff6600';
    x.beginPath(); x.moveTo(0, -13);
    x.bezierCurveTo(5, -8, 9, -3, 7, 4); x.bezierCurveTo(6, 8, 3, 11, 0, 13);
    x.bezierCurveTo(-3, 11, -6, 8, -7, 4); x.bezierCurveTo(-9, -3, -5, -8, 0, -13);
    x.fill();
    x.fillStyle = '#ffdd00';
    x.beginPath(); x.moveTo(0, -5);
    x.bezierCurveTo(3, -1, 4, 3, 2, 7); x.bezierCurveTo(1, 10, -1, 10, -2, 7);
    x.bezierCurveTo(-4, 3, -3, -1, 0, -5); x.fill();
  }, 28));

  map.addImage('volc-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    x.globalAlpha = 0.2; x.fillStyle = '#ff3300';
    x.beginPath(); x.arc(0, 3, 12, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1; x.fillStyle = '#cc4400';
    x.beginPath(); x.moveTo(-14, 13); x.lineTo(-3, -2); x.lineTo(0, -6);
    x.lineTo(3, -2); x.lineTo(14, 13); x.closePath(); x.fill();
    x.fillStyle = '#ff8844';
    x.beginPath(); x.moveTo(-4, -1); x.lineTo(0, -8); x.lineTo(4, -1);
    x.closePath(); x.fill();
    x.fillStyle = '#ff6600'; x.globalAlpha = 0.85;
    x.beginPath(); x.arc(-2, -11, 3.5, 0, Math.PI*2); x.fill();
    x.beginPath(); x.arc(2, -13, 2.5, 0, Math.PI*2); x.fill();
    x.beginPath(); x.arc(0, -15, 2, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1;
  }, 30));

  map.addImage('storm-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    x.globalAlpha = 0.18; x.fillStyle = '#00aaff';
    x.beginPath(); x.arc(0, 0, 13, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1; x.strokeStyle = '#00ccff'; x.lineWidth = 2.2; x.lineCap = 'round';
    for(let arm = 0; arm < 3; arm++) {
      x.save(); x.rotate(arm * Math.PI * 2/3); x.beginPath();
      for(let t = 0; t <= 1; t += 0.05) {
        const r = 2 + t * 9, a = t * Math.PI * 1.5;
        const px = r * Math.cos(a), py = r * Math.sin(a);
        t === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.globalAlpha = 0.7 + 0.3 * (1 - arm/3); x.stroke(); x.restore();
    }
    x.globalAlpha = 1; x.fillStyle = '#004466';
    x.beginPath(); x.arc(0, 0, 2.5, 0, Math.PI*2); x.fill();
    x.strokeStyle = '#00ccff'; x.lineWidth = 1;
    x.beginPath(); x.arc(0, 0, 2.5, 0, Math.PI*2); x.stroke();
  }, 30));

  map.addImage('tsun-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    x.globalAlpha = 0.2; x.fillStyle = '#00ddff';
    x.beginPath(); x.arc(0, 2, 12, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1; x.strokeStyle = '#00ddff'; x.lineWidth = 2.5; x.lineCap = 'round';
    x.globalAlpha = 0.45; x.beginPath(); x.moveTo(-12, -2);
    x.bezierCurveTo(-8, -10, -2, -10, 0, -4); x.bezierCurveTo(2, 2, 6, 2, 12, -4); x.stroke();
    x.globalAlpha = 1; x.lineWidth = 3; x.beginPath(); x.moveTo(-13, 4);
    x.bezierCurveTo(-9, -5, -3, -7, 0, -1); x.bezierCurveTo(3, 5, 8, 5, 13, -1); x.stroke();
    x.fillStyle = '#00ddff'; x.globalAlpha = 0.7;
    x.beginPath(); x.arc(-13, 4, 2.5, 0, Math.PI*2); x.fill();
  }, 30));

  map.addImage('flood-icon', mkImg((x,s) => {
    x.translate(s/2, s/2);
    x.globalAlpha = 0.25; x.fillStyle = '#1188ff';
    x.beginPath(); x.arc(0, 2, 13, 0, Math.PI*2); x.fill();
    x.globalAlpha = 1; x.fillStyle = '#1188ff'; x.strokeStyle = '#55aaff'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -12);
    x.bezierCurveTo(8, -4, 10, 4, 10, 6); x.bezierCurveTo(10, 13, -10, 13, -10, 6);
    x.bezierCurveTo(-10, 4, -8, -4, 0, -12); x.closePath();
    x.globalAlpha = 0.6; x.fill(); x.globalAlpha = 1; x.stroke();
    x.fillStyle = '#aaddff'; x.globalAlpha = 0.4;
    x.beginPath(); x.arc(-3, 0, 3, 0, Math.PI*2); x.fill();
  }, 30));

  // ── GeoJSON sources ───────────────────────────────────────────────────────
  map.addSource('fires',       { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('storms',      { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('storm-cones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('volcanoes',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('tsunamis',    { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('floods',      { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  // NWS: actual warning polygon GeoJSON from api.weather.gov
  map.addSource('nws-alerts',  { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  // FIRES
  map.addLayer({ id: 'fire-glow', type: 'circle', source: 'fires', paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'frp'], 0, 10, 50, 20, 200, 36],
    'circle-color': '#ff4400', 'circle-opacity': 0.12, 'circle-blur': 1
  }});
  map.addLayer({ id: 'fire-dot', type: 'symbol', source: 'fires', layout: {
    'icon-image': 'fire-icon',
    'icon-size': ['interpolate', ['linear'], ['get', 'frp'], 0, 0.55, 50, 0.8, 200, 1.1],
    'icon-allow-overlap': true, 'icon-ignore-placement': false
  }});

  // VOLCANOES
  map.addLayer({ id: 'volc-glow', type: 'circle', source: 'volcanoes', paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'alert'], 0, 14, 3, 28],
    'circle-color': '#ff3300', 'circle-opacity': 0.15, 'circle-blur': 1
  }});
  map.addLayer({ id: 'volc-dot', type: 'symbol', source: 'volcanoes', layout: {
    'icon-image': 'volc-icon',
    'icon-size': ['interpolate', ['linear'], ['get', 'alert'], 0, 0.8, 3, 1.1],
    'text-field': ['get', 'name'], 'text-size': 9,
    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
    'text-offset': [0, 1.6], 'text-allow-overlap': false, 'icon-allow-overlap': true
  }, paint: { 'text-color': '#ff8800', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.5 }});

  // STORMS
  map.addLayer({ id: 'storm-cone-fill', type: 'fill', source: 'storm-cones',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.10 }
  });
  map.addLayer({ id: 'storm-cone-line', type: 'line', source: 'storm-cones',
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.2, 'line-opacity': 0.5, 'line-dasharray': [3, 2] }
  });
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
      'text-field': ['get', 'name'], 'text-size': 10,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset': [0, 1.7], 'text-allow-overlap': false, 'icon-allow-overlap': true
    }, paint: { 'text-color': '#00ccff', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.5 }
  });

  // TSUNAMIS
  map.addLayer({ id: 'tsunami-ring', type: 'circle', source: 'tsunamis', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 20, 5, 40],
    'circle-color': 'transparent', 'circle-stroke-width': 2,
    'circle-stroke-color': '#00ddff', 'circle-stroke-opacity': 0.6
  }});
  map.addLayer({ id: 'tsunami-dot', type: 'symbol', source: 'tsunamis', layout: {
    'icon-image': 'tsun-icon', 'icon-size': 0.9, 'icon-allow-overlap': true
  }});

  // FLOODS
  map.addLayer({ id: 'flood-glow', type: 'circle', source: 'floods', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 22, 5, 38],
    'circle-color': '#1188ff', 'circle-opacity': 0.10, 'circle-blur': 1.2
  }});
  map.addLayer({ id: 'flood-dot', type: 'symbol', source: 'floods', layout: {
    'icon-image': 'flood-icon', 'icon-size': 0.9, 'icon-allow-overlap': true
  }});

  // ── NWS SEVERE WEATHER POLYGONS ───────────────────────────────────────────
  // Drawn as actual NWS warning polygons, colour-coded by event type.
  // Tornado Warning = red, Tornado Emergency = magenta, SVR = orange, etc.
  map.addLayer({ id: 'nws-fill', type: 'fill', source: 'nws-alerts',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 }
  });
  map.addLayer({ id: 'nws-line', type: 'line', source: 'nws-alerts',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['case',
        ['==', ['get', 'event'], 'Tornado Emergency'], 3.5,
        ['==', ['get', 'event'], 'Tornado Warning'],   2.5, 1.5],
      'line-opacity': 0.95,
    }
  });
  map.addLayer({ id: 'nws-label', type: 'symbol', source: 'nws-alerts',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 10,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0,0,0,0.95)',
      'text-halo-width': 2,
    }
  });

  // Register all in lMap / layerVis for togL()
  lMap.fires         = ['fire-glow', 'fire-dot'];
  lMap.storms        = ['storm-cone-fill','storm-cone-line','storm-glow','storm-dot','storm-track'];
  lMap.volcanoes     = ['volc-glow', 'volc-dot'];
  lMap.tsunamis      = ['tsunami-ring', 'tsunami-dot'];
  lMap.floods        = ['flood-glow', 'flood-dot'];
  lMap['nws-alerts'] = ['nws-fill', 'nws-line', 'nws-label'];

  layerVis.fires         = true;
  layerVis.storms        = true;
  layerVis.volcanoes     = true;
  layerVis.tsunamis      = true;
  layerVis.floods        = true;
  layerVis['nws-alerts'] = true;

  fetchFIRMS();
  fetchStorms();
  fetchGDACS();
  fetchNWSAlerts();

  setInterval(fetchFIRMS,     30 * 60 * 1000); // 30min
  setInterval(fetchStorms,    20 * 60 * 1000); // 20min
  setInterval(fetchGDACS,     30 * 60 * 1000); // 30min
  setInterval(fetchNWSAlerts,  2 * 60 * 1000); // 2min — warnings update fast

  console.log('[WWO] Weather: ready');
}

// ── Weather tile toggle ───────────────────────────────────────────────────────
const wxLayerLoaded = {};

function setWeatherLayer(key) {
  Object.keys(OWM_LAYERS).forEach(k => {
    if (wxLayerLoaded[k]) {
      try { map.setLayoutProperty('wx-' + k, 'visibility', 'none'); } catch(e) {}
    }
  });
  if (activeWeatherLayer === key) {
    activeWeatherLayer = null;
    document.querySelectorAll('.wx-btn').forEach(b => b.classList.remove('on'));
    var sg = document.getElementById('sea-gradient');
    if (sg) sg.style.opacity = '';
    return;
  }
  activeWeatherLayer = key;
  var sg = document.getElementById('sea-gradient');
  if (sg) sg.style.opacity = key ? '0' : '';
  if (key) {
    if (!wxLayerLoaded[key]) {
      const code = OWM_LAYERS[key];
      try {
        map.addSource('wx-' + key, {
          type: 'raster',
          tiles: ['https://tile.openweathermap.org/map/' + code + '/{z}/{x}/{y}.png?appid=' + OWM_KEY],
          tileSize: 256, attribution: 'OpenWeatherMap'
        });
        map.addLayer({ id: 'wx-' + key, type: 'raster', source: 'wx-' + key,
          paint: { 'raster-opacity': 0.68 }
        });
        wxLayerLoaded[key] = true;
      } catch(e) {
        console.warn('[WWO] Weather layer error:', e.message);
        activeWeatherLayer = null; return;
      }
    } else {
      try { map.setLayoutProperty('wx-' + key, 'visibility', 'visible'); } catch(e) {}
    }
  }
  document.querySelectorAll('.wx-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.wx === key);
  });
}

// ── NWS CAP Alerts — tornado/SVR warning polygons ────────────────────────────
// api.weather.gov returns actual NWS warning polygons as GeoJSON.
// No auth, no proxy needed (CORS headers present). Polls every 2min.
async function fetchNWSAlerts() {
  try {
    const url = 'https://api.weather.gov/alerts/active' +
      '?status=actual&message_type=alert&urgency=Immediate,Expected&severity=Extreme,Severe';

    let data;
    try {
      // Direct — api.weather.gov has CORS headers
      const r = await fetch(url, {
        headers: { 'Accept': 'application/geo+json', 'User-Agent': 'WWO-Monitor/4.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
    } catch(_) {
      // Fallback to Worker proxy
      const r = await fetch(PROXY(url), { signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error('NWS proxy ' + r.status);
      data = await r.json();
    }

    const features = [];
    for (const f of (data.features || [])) {
      const props = f.properties || {};
      const event = props.event || '';
      if (!NWS_ALERT_EVENTS.has(event)) continue;

      // api.weather.gov geometry IS the actual NWS warning polygon
      // Watch boxes sometimes omit geometry — skip those
      if (!f.geometry) continue;

      const color    = NWS_ALERT_COLORS[event] || '#ffaa00';
      const label    = NWS_ALERT_LABELS[event]  || event.slice(0, 3).toUpperCase();
      const id       = props.id || f.id || '';
      const area     = props.areaDesc || '';
      const expires  = props.expires || props.ends || '';
      const sent     = props.sent || new Date().toISOString();
      const headline = props.headline || event;

      features.push({
        type: 'Feature',
        geometry: f.geometry,
        properties: { event, color, label, id, area, expires, headline, sent }
      });

      // Push to OSINT feed once per alert ID
      if (!_nwsSeenIds.has(id)) {
        _nwsSeenIds.add(id);
        const isTornado = event.includes('Tornado');
        const icon = event === 'Tornado Emergency' ? 'SOS' : isTornado ? 'TORNADO' : 'SVR';
        addLiveItem(
          icon + ' ' + event.toUpperCase() + ': ' + area,
          'NWS', sent, 'https://www.weather.gov', 'GEO',
          isTornado ? 'al' : 'wa', false
        );
        if (_nwsSeenIds.size > 500) {
          const it = _nwsSeenIds.values();
          for (let i = 0; i < 100; i++) _nwsSeenIds.delete(it.next().value);
        }
      }
    }

    const src = map.getSource('nws-alerts');
    if (src) src.setData({ type: 'FeatureCollection', features });

    // Sidebar counter shows total active severe alerts
    const el = document.getElementById('knws');
    if (el) el.textContent = features.length || '';

    const torCount = features.filter(f =>
      f.properties.event === 'Tornado Warning' || f.properties.event === 'Tornado Emergency').length;
    const svrCount = features.filter(f =>
      f.properties.event.includes('Thunderstorm')).length;
    if (features.length > 0) {
      console.log('[WWO] NWS Alerts: ' + features.length + ' active (' + torCount + ' TOR, ' + svrCount + ' SVR)');
    }
  } catch(e) {
    console.warn('[WWO] NWS alerts failed:', e.message);
  }
}

// ── NASA FIRMS — wildfire detections ─────────────────────────────────────────
async function fetchFIRMS() {
  try {
    const url = PROXY_BASE + '/api/firms?source=VIIRS_SNPP_NRT&days=1&area=world';
    const r = await fetch(url, { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),20000); return _c.signal; })() });
    if (!r.ok) throw new Error('FIRMS ' + r.status);
    const csv = await r.text();
    const features = parseFIRMScsv(csv);
    const src = map.getSource('fires');
    if (src) {
      const existing = src.serialize().data || { type: 'FeatureCollection', features: [] };
      const gdacsWildfires = (existing.features || []).filter(f => f.properties && f.properties.source === 'GDACS');
      src.setData({ type: 'FeatureCollection', features: features.concat(gdacsWildfires) });
    }
    const el = document.getElementById('fire-cnt');
    if (el) el.textContent = features.length;
    console.log('[WWO] FIRMS: ' + features.length + ' fire detections');
    const major = features.filter(f => (f.properties.frp || 0) > 100);
    if (major.length > 0) {
      addLiveItem(major.length + ' MAJOR FIRE DETECTIONS (FRP>100MW) — global',
        'NASA FIRMS', new Date().toISOString(),
        'https://firms.modaps.eosdis.nasa.gov', 'GEO', 'wa', false);
    }
  } catch(e) { console.warn('[WWO] FIRMS error:', e.message); }
}

function parseFIRMScsv(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers   = lines[0].split(',');
  const latI      = headers.indexOf('latitude');
  const lonI      = headers.indexOf('longitude');
  const frpI      = headers.indexOf('frp');
  const brightI   = headers.indexOf('bright_ti4');
  const dateI     = headers.indexOf('acq_date');
  const confI     = headers.indexOf('confidence');
  const countryI  = headers.indexOf('country_id');
  const dayNightI = headers.indexOf('daynight');
  const features  = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 4) continue;
    const lat = parseFloat(cols[latI]), lon = parseFloat(cols[lonI]);
    if (isNaN(lat) || isNaN(lon)) continue;
    const frp    = parseFloat(cols[frpI]);
    const bright = parseFloat(cols[brightI]);
    const conf   = (cols[confI] || '').trim().toLowerCase();
    if (conf === 'l') continue;
    const country  = countryI  >= 0 ? (cols[countryI]  || '').trim() : '';
    const dayNight = dayNightI >= 0 ? (cols[dayNightI] || '').trim().toUpperCase() : '';
    let confDisplay;
    if      (conf === 'n' || conf === 'nominal') confDisplay = 'NOMINAL';
    else if (conf === 'h' || conf === 'high')    confDisplay = 'HIGH';
    else if (!isNaN(conf))                        confDisplay = conf + '%';
    else                                          confDisplay = conf.toUpperCase() || 'NOMINAL';
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: { frp: isNaN(frp) ? 0 : frp, bright: isNaN(bright) ? 0 : bright,
        date: cols[dateI] || '', conf: confDisplay, country, dayNight, source: 'FIRMS' }
    });
  }
  return features;
}

// ── NOAA NHC — active tropical storms ────────────────────────────────────────
async function fetchStorms() {
  try {
    const url = 'https://www.nhc.noaa.gov/CurrentStorms.json';
    const r = await fetch(PROXY(url), { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),10000); return _c.signal; })() });
    if (!r.ok) throw new Error('NHC ' + r.status);
    const d = await r.json();
    const features = parseNHCStorms(d);
    const src = map.getSource('storms');
    if (src) src.setData({ type: 'FeatureCollection', features });
    const el = document.getElementById('storm-cnt');
    if (el) el.textContent = features.filter(f => f.properties.type === 'center').length;
    console.log('[WWO] NHC: ' + features.filter(f => f.properties.type === 'center').length + ' active storms');
    if (d.activeStorms) _fetchStormCones(d.activeStorms);
  } catch(e) {
    try { await fetchStormsRSS(); } catch(e2) { console.warn('[WWO] NHC error:', e.message); }
  }
}

async function _fetchStormCones(storms) {
  const coneFeatures = [];
  const catColors = ['#00aaff','#00ff88','#ffcc00','#ff8800','#ff4400','#ff0000'];
  for (const storm of storms) {
    const id = (storm.id || '').toLowerCase();
    if (!id) continue;
    const cat = storm.classification === 'TD' ? 0 : storm.classification === 'TS' ? 1 : parseInt(storm.intensity) || 0;
    const color = catColors[Math.min(cat, 5)];
    const coneUrl = 'https://www.nhc.noaa.gov/gis/forecast/archive/' + id + '_5day_pgn.dat';
    try {
      const r = await fetch(PROXY(coneUrl), { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const text = await r.text();
        const coords = _parsePGN(text);
        if (coords.length >= 3) {
          coneFeatures.push({ type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { name: storm.name || id, color, cat, storm: id }
          });
          continue;
        }
      }
    } catch(_) {}
    if (storm.forecastTrack && storm.forecastTrack.coordinates && storm.forecastTrack.coordinates.length >= 2) {
      const cone = _buildApproxCone(storm.forecastTrack.coordinates, storm.intensity || 0);
      if (cone) coneFeatures.push({ type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [cone] },
        properties: { name: storm.name || id, color, cat, storm: id }
      });
    }
  }
  const coneSrc = map.getSource('storm-cones');
  if (coneSrc) coneSrc.setData({ type: 'FeatureCollection', features: coneFeatures });
  console.log('[WWO] Storm cones: ' + coneFeatures.length + ' polygons loaded');
}

function _parsePGN(text) {
  return text.trim().split(/\n/).map(function(line) {
    const parts = line.trim().split(/\s+/);
    const lon = parseFloat(parts[0]), lat = parseFloat(parts[1]);
    return (!isNaN(lon) && !isNaN(lat)) ? [lon, lat] : null;
  }).filter(Boolean);
}

function _buildApproxCone(trackCoords, intensity) {
  if (trackCoords.length < 2) return null;
  const side1 = [], side2 = [];
  const radii = [55, 75, 100, 130, 165, 200];
  trackCoords.forEach(function(coord, i) {
    const lon = coord[0], lat = coord[1];
    const r = (radii[Math.min(i, radii.length-1)] / 111);
    let bearing = 0;
    if (i < trackCoords.length - 1) {
      const dx = trackCoords[i+1][0] - lon, dy = trackCoords[i+1][1] - lat;
      bearing = Math.atan2(dx, dy);
    } else if (i > 0) {
      const dx = lon - trackCoords[i-1][0], dy = lat - trackCoords[i-1][1];
      bearing = Math.atan2(dx, dy);
    }
    side1.push([lon + r * Math.cos(bearing), lat + r * Math.sin(bearing)]);
    side2.unshift([lon - r * Math.cos(bearing), lat - r * Math.sin(bearing)]);
  });
  return side1.concat(side2).concat([side1[0]]);
}

async function fetchStormsRSS() {
  try {
    const url = 'https://www.nhc.noaa.gov/index-at.xml';
    const r = await fetch(PROXY(url), { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),10000); return _c.signal; })() });
    if (!r.ok) return;
    const xml = await r.text();
    const items = parseRSSXml(xml);
    items.forEach(function(item) {
      if (item.title && item.title.match(/Advisory|Outlook|Discussion/)) {
        addLiveItem('STORM ' + item.title, 'NHC', item.pubDate, item.link, 'GEO', 'wa', false);
      }
    });
  } catch(e) {}
}

function parseNHCStorms(d) {
  const features = [];
  if (!d || !d.activeStorms) return features;
  const catColors = ['#00aaff','#00ff88','#ffcc00','#ff8800','#ff4400','#ff0000'];
  d.activeStorms.forEach(function(storm) {
    const cat   = storm.classification === 'TD' ? 0 : storm.classification === 'TS' ? 1 : parseInt(storm.intensity) || 0;
    const wind  = parseInt(storm.intensity) || 0;
    const color = catColors[Math.min(cat, catColors.length-1)];
    if (storm.latitudeNumeric && storm.longitudeNumeric) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [storm.longitudeNumeric, storm.latitudeNumeric] },
        properties: { type: 'center', name: storm.name || storm.id, cat, wind, color,
          classification: storm.classification || 'TC', id: storm.id }
      });
    }
    if (storm.forecastTrack && storm.forecastTrack.coordinates) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: storm.forecastTrack.coordinates },
        properties: { type: 'track', color, name: storm.name }
      });
    }
    addLiveItem('STORM ' + (storm.classification || 'TC') + ' ' + (storm.name || storm.id) + ' ' + wind + 'kt winds',
      'NHC', new Date().toISOString(),
      'https://www.nhc.noaa.gov/refresh/graphics_' + (storm.id || '').toLowerCase(),
      'GEO', 'wa', false);
  });
  return features;
}

// ── GDACS — volcanoes, floods, tsunamis ───────────────────────────────────────
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
  const doc    = parser.parseFromString(xml, 'text/xml');
  const items  = doc.querySelectorAll('item');
  const volcFeatures = [], tsunamiFeatures = [], gdacsFireFeatures = [], floodFeatures = [];

  items.forEach(function(item) {
    const title   = item.querySelector('title') ? item.querySelector('title').textContent : '';
    const link    = item.querySelector('link')  ? item.querySelector('link').textContent  : '';
    const pubDate = item.querySelector('pubDate') ? item.querySelector('pubDate').textContent : '';
    const evType  = (item.getElementsByTagNameNS('*','eventtype')[0] ? item.getElementsByTagNameNS('*','eventtype')[0].textContent : '').toUpperCase();
    const lcTitle = title.toLowerCase();

    const geoPoint = item.getElementsByTagNameNS('*','point')[0] ? item.getElementsByTagNameNS('*','point')[0].textContent : '';
    let lat, lon;
    if (geoPoint) {
      const parts = geoPoint.trim().split(/\s+/).map(Number);
      lat = parts[0]; lon = parts[1];
    } else {
      lat = parseFloat(item.getElementsByTagNameNS('*','lat')[0]  ? item.getElementsByTagNameNS('*','lat')[0].textContent  : NaN);
      lon = parseFloat(item.getElementsByTagNameNS('*','long')[0] ? item.getElementsByTagNameNS('*','long')[0].textContent : NaN);
    }
    if (isNaN(lat) || isNaN(lon)) return;

    const alertTag   = item.getElementsByTagNameNS('*','alertlevel')[0] ? item.getElementsByTagNameNS('*','alertlevel')[0].textContent : '';
    const alertMatch = alertTag || (title.match(/\b(green|orange|red)\b/i) ? title.match(/\b(green|orange|red)\b/i)[1] : 'green');
    const alertLevelMap = { green: 0, orange: 1, red: 2 };
    const alertLevel = alertLevelMap[alertMatch.toLowerCase()] !== undefined ? alertLevelMap[alertMatch.toLowerCase()] : 0;
    const country    = item.getElementsByTagNameNS('*','country')[0] ? item.getElementsByTagNameNS('*','country')[0].textContent : '';
    const ty         = alertLevel >= 2 ? 'al' : alertLevel >= 1 ? 'wa' : 'in';

    const isVO = evType === 'VO' || lcTitle.includes('volcan') || lcTitle.includes('eruption');
    const isTS = evType === 'TS' || evType === 'TSU' || lcTitle.includes('tsunami');
    const isWF = evType === 'WF' || lcTitle.includes('forest fire') || lcTitle.includes('wildfire');
    const isFL = evType === 'FL' || lcTitle.includes('flood');
    const isTC = evType === 'TC' || lcTitle.includes('cyclone');
    const isEQ = evType === 'EQ' || lcTitle.includes('earthquake');

    if (isVO) {
      const name = title.replace(/volcano|eruption|alert|green|orange|red/gi,'').replace(/\s+/g,' ').trim();
      volcFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { name: name || title, alert: alertLevel, title, link, pubDate, country }
      });
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', ty, false);
    } else if (isTS) {
      tsunamiFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { title, link, pubDate, alert: alertLevel, country }
      });
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', ty, false);
    } else if (isWF) {
      gdacsFireFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { title, link, pubDate, alert: alertLevel, frp: 0, bright: 0,
          conf: 'GDACS', date: pubDate, source: 'GDACS', country }
      });
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', ty, false);
    } else if (isFL) {
      floodFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { title, link, pubDate, alert: alertLevel, country }
      });
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', ty, false);
    } else if (isTC || isEQ) {
      addLiveItem(title, 'GDACS', pubDate, link, 'GEO', ty, false);
    }
  });

  const vs = map.getSource('volcanoes');  if (vs) vs.setData({ type: 'FeatureCollection', features: volcFeatures });
  const ts = map.getSource('tsunamis');   if (ts) ts.setData({ type: 'FeatureCollection', features: tsunamiFeatures });
  const fls = map.getSource('floods');    if (fls) fls.setData({ type: 'FeatureCollection', features: floodFeatures });
  const fs = map.getSource('fires');
  if (fs) {
    const existing  = fs.serialize().data || { type: 'FeatureCollection', features: [] };
    const firmsOnly = (existing.features || []).filter(function(f) { return f.properties && f.properties.source !== 'GDACS'; });
    const merged    = firmsOnly.concat(gdacsFireFeatures);
    fs.setData({ type: 'FeatureCollection', features: merged });
    const fireCnt = document.getElementById('fire-cnt');
    if (fireCnt && parseInt(fireCnt.textContent) === 0) fireCnt.textContent = merged.length;
  }

  const vc = document.getElementById('volc-cnt');  if (vc) vc.textContent = volcFeatures.length;
  const tc = document.getElementById('tsun-cnt');  if (tc) tc.textContent = tsunamiFeatures.length;
  const fc = document.getElementById('flood-cnt'); if (fc) fc.textContent = floodFeatures.length;
  console.log('[WWO] GDACS: ' + volcFeatures.length + ' volc, ' + tsunamiFeatures.length + ' tsun, ' + gdacsFireFeatures.length + ' wf, ' + floodFeatures.length + ' flood');
}

// ── Click handlers ────────────────────────────────────────────────────────────
function initWeatherClicks(map) {
  map.on('click', 'fire-dot', function(e) {
    const p = e.features[0].properties;
    const isGDACS = p.source === 'GDACS';
    const loc = p.country ? p.country : parseFloat(e.lngLat.lat).toFixed(2) + 'N, ' + parseFloat(e.lngLat.lng).toFixed(2) + 'E';
    const rows = [['LOCATION', loc || 'UNKNOWN']];
    if (!isGDACS) {
      rows.push(['FRP (MW)',    p.frp > 0 ? parseFloat(p.frp).toFixed(1) + ' MW' : '< 1 MW']);
      rows.push(['BRIGHTNESS', p.bright > 0 ? parseFloat(p.bright).toFixed(1) + ' K' : '--']);
      rows.push(['CONFIDENCE', p.conf || 'NOMINAL']);
      rows.push(['ACQUIRED',   p.date || '--']);
      rows.push(['DAY/NIGHT',  p.dayNight || '--']);
    } else {
      rows.push(['EVENT',  p.title || 'GDACS WILDFIRE']);
      rows.push(['ALERT',  ['GREEN','ORANGE','RED'][p.alert] || 'GREEN']);
      rows.push(['ISSUED', p.pubDate ? new Date(p.pubDate).toDateString() : '--']);
    }
    rows.push(['SOURCE', isGDACS ? 'GDACS' : 'NASA FIRMS / VIIRS S-NPP NRT']);
    showDisasterDetail('WILDFIRE DETECTION', 'FIRE', rows,
      isGDACS ? (p.link || 'https://gdacs.org') : 'https://firms.modaps.eosdis.nasa.gov/map/');
  });

  map.on('click', 'storm-dot', function(e) {
    const p = e.features[0].properties;
    showDisasterDetail('TROPICAL CYCLONE ' + (p.name || p.id), 'CYCLONE', [
      ['CLASSIFICATION', p.classification || 'TC'],
      ['WIND SPEED',     (p.wind || '--') + ' kt'],
      ['CATEGORY',       p.cat > 0 ? 'CAT ' + p.cat : 'SUB-HURRICANE'],
      ['SOURCE',         'NOAA / NHC'],
    ], 'https://www.nhc.noaa.gov');
  });

  map.on('click', 'volc-dot', function(e) {
    const p = e.features[0].properties;
    showDisasterDetail('VOLCANIC ACTIVITY', 'VOLCANO', [
      ['NAME',      p.name || 'UNKNOWN'],
      ['ALERT LVL', ['GREEN','ORANGE','RED'][p.alert] || 'GREEN'],
      ['PUBLISHED', p.pubDate ? new Date(p.pubDate).toUTCString() : '--'],
      ['SOURCE',    'GDACS'],
    ], p.link || 'https://gdacs.org');
  });

  map.on('click', 'tsunami-dot', function(e) {
    const p = e.features[0].properties;
    showDisasterDetail('TSUNAMI WARNING', 'TSUNAMI', [
      ['STATUS',  p.title || 'ACTIVE WARNING'],
      ['ISSUED',  p.pubDate ? new Date(p.pubDate).toUTCString() : '--'],
      ['SOURCE',  'GDACS / PTWC'],
    ], p.link || 'https://gdacs.org');
  });

  map.on('click', 'flood-dot', function(e) {
    const p = e.features[0].properties;
    showDisasterDetail('FLOOD EVENT', 'FLOOD', [
      ['LOCATION', p.country || 'UNKNOWN'],
      ['ALERT LVL', ['GREEN','ORANGE','RED'][p.alert] || 'GREEN'],
      ['EVENT',    p.title || '--'],
      ['ISSUED',   p.pubDate ? new Date(p.pubDate).toDateString() : '--'],
      ['SOURCE',   'GDACS'],
    ], p.link || 'https://gdacs.org');
  });

  // NWS warning polygon click
  map.on('click', 'nws-fill', function(e) {
    const p = e.features[0] ? e.features[0].properties : {};
    const expires = p.expires ? new Date(p.expires).toUTCString() : '--';
    const isTornado = (p.event || '').includes('Tornado');
    const isEmergency = p.event === 'Tornado Emergency';
    const icon = isEmergency ? 'EMERGENCY' : isTornado ? 'TORNADO' : 'SEVERE';
    showDisasterDetail(p.event || 'NWS SEVERE WEATHER', icon, [
      ['EVENT',    p.event    || '--'],
      ['AREA',     p.area     || '--'],
      ['EXPIRES',  expires],
      ['HEADLINE', p.headline || '--'],
      ['SOURCE',   'NOAA / NWS'],
    ], 'https://www.weather.gov');
  });

  // Cursor pointer on hover
  ['fire-dot','storm-dot','volc-dot','tsunami-dot','flood-dot','nws-fill'].forEach(function(id) {
    map.on('mouseenter', id, function() { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, function() { map.getCanvas().style.cursor = ''; });
  });
}

function showDisasterDetail(title, icon, rows, link) {
  const dp  = document.getElementById('dp');
  const dt  = document.getElementById('dt');
  const dtl = document.getElementById('dtl');
  const dpb = document.getElementById('dpb');
  dt.textContent = icon + ' DISASTER';
  dt.style.background = 'rgba(255,60,0,0.2)';
  dt.style.color = '#ff6600';
  dtl.textContent = title;
  dpb.innerHTML = rows.map(function(r) {
    return '<div class="dr"><span class="dl">' + r[0] + '</span><span class="dv2">' + r[1] + '</span></div>';
  }).join('') + (link
    ? '<a href="' + link + '" target="_blank" rel="noopener" class="track-btn" style="margin-top:10px;display:block;text-align:center">OPEN SOURCE</a>'
    : '');
  dp.classList.add('show');
}
