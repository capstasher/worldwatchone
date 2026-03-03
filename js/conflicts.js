// ====== CONFLICT ZONE BOUNDARIES ======
// Each zone maps to either:
//   ISO-2 code  → full country boundary   e.g. 'IR'
//   rel:NNNNNNN → OSM relation ID          e.g. 'rel:72639'  (sub-national regions)
//
// OSM relation IDs: verify at openstreetmap.org/relation/<id>
// Whole-country zones just reuse the outage _fetchBoundary / _boundaryCache system.
// Sub-national zones get their own entries via 'rel:' prefix.

const CONF_ZONE_KEYS = {
  // ── Ukraine ──────────────────────────────────────────────────────────────
  'Donetsk':         'rel:71973',
  'Luhansk':         'rel:71971',
  'Zaporizhzhia':    'rel:71980',
  'Kherson':         'rel:71022',
  'Kharkiv':         'rel:71254',
  'Sumy':            'rel:71250',
  'Crimea':          'rel:72639',
  'Kursk':           'rel:72223',   // Kursk Oblast confirmed

  // ── Iran — provinces struck by US/Israel in Operation Epic Fury (Feb–Mar 2026) ──
  'Iran':                  'IR',           // whole country (fallback / heat zone)
  'Tehran Province':       'rel:537701',   // confirmed OSM rel
  'Isfahan Province':      'rel:241475',   // confirmed OSM rel
  'Hormozgan Province':    'rel:3385992',  // confirmed OSM rel; Minab school massacre 148 killed
  'Bushehr Province':      'name:Bushehr Province|IR|4',
  'Kermanshah Province':   'name:Kermanshah Province|IR|4',
  'East Azerbaijan':       'name:East Azerbaijan Province|IR|4',
  'Qom Province':          'name:Qom Province|IR|4',
  'Alborz Province':       'name:Alborz Province|IR|4',
  'Zanjan Province':       'name:Zanjan Province|IR|4',
  'Ilam Province':         'name:Ilam Province|IR|4',
  'Lorestan Province':     'name:Lorestan Province|IR|4',
  'Fars Province':         'name:Fars Province|IR|4',
  'West Azerbaijan':       'name:West Azerbaijan Province|IR|4',
  'Iraq':                  'IQ',           // IRGC militia bases; US bases targeted by Iran

  // ── Israel / Palestine ────────────────────────────────────────────────────
  'Israel':          'IL',
  'Gaza':            'rel:1473938',
  'West Bank':       'rel:1803010',

  // ── Lebanon ───────────────────────────────────────────────────────────────
  'South Lebanon':   'rel:2178721',

  // ── Syria ─────────────────────────────────────────────────────────────────
  'Syria':           'SY',

  // ── Sudan ─────────────────────────────────────────────────────────────────
  // RSF controls all 5 Darfur states + pushing into Kordofan (as of Mar 2026)
  // SAF recaptured Khartoum, Gezira; active Kordofan & Blue Nile fronts
  'Khartoum':        'rel:3774673',
  'North Darfur':    'rel:1305408',
  'West Darfur':     'name:West Darfur|SD|4',
  'Central Darfur':  'rel:1305403',  // RSF capital Nyala nearby, active fighting
  'South Darfur':    'rel:1305410',  // RSF controls Nyala, active ops
  'East Darfur':     'rel:1305402',  // RSF factions active, drone strikes
  'North Kordofan':  'rel:1305409',  // El Obeid besieged; major active front
  'South Kordofan':  'rel:1305411',  // Kadugli under siege, SPLM-N active
  'West Kordofan':   'rel:1305416',  // RSF captured Al-Fulah, drone strikes
  'Blue Nile':       'rel:1305412',  // SAF/RSF/SPLM-N clashes; Ethiopia border
  'Gezira':          'rel:13162974',  // SAF recaptured Jan 2025; still volatile, IDP returns
  'Sennar':          'rel:3774667',  // RSF drone strike on Singa army base Feb 2026
  'White Nile':      'rel:1305415',  // RSF drone strikes; SAF prepped for Khartoum defence

  // ── Myanmar ───────────────────────────────────────────────────────────────
  // Junta controls ~21% of territory; resistance holds ~60% (BBC 2024)
  'Myanmar':       'MM',           // whole country — junta ~21% territory, resistance ~60%

  // ── DRC ───────────────────────────────────────────────────────────────────
  // M23 captured Goma (Jan 2025), Bukavu (Feb 2025), Uvira (Dec 2025)
  // Active FARDC counteroffensive in Masisi district (Feb 2026)
  'North Kivu':      'rel:5642698',  // M23 HQ; Masisi district FARDC offensive ongoing
  'South Kivu':      'rel:2340463',  // M23 captured Bukavu + Uvira; ceasefire fragile
  'Ituri':           'name:Ituri|CD|4',  // ADF active + M23 expanding influence
  'Maniema':         'rel:2340458',  // Lower intensity; M23 expansion risk from Kivu

  // ── Yemen ─────────────────────────────────────────────────────────────────
  'Yemen':           'YE',

  // ── Somalia ───────────────────────────────────────────────────────────────
  'Somalia':         'SO',

  // ── Sahel ─────────────────────────────────────────────────────────────────
  // JNIM blockading Bamako; ISGS active; Russia Africa Corps deployed
  'Burkina Faso':    'BF',
  'Mali':            'ML',
  'Niger':           'NE',

  // ── Ethiopia ──────────────────────────────────────────────────────────────
  'Amhara Region':   'rel:1707264',
  'Tigray Region':   'rel:1579815',

  // ── Horn of Africa ────────────────────────────────────────────────────────
  'South Sudan':     'SS',

  // ── Mozambique ────────────────────────────────────────────────────────────
  'Cabo Delgado':    'rel:2400484',

  // ── Nigeria ───────────────────────────────────────────────────────────────
  // Boko Haram/ISWAP killing 2,266+ in H1 2025 alone; bandits control 725 villages
  'Borno':           'rel:3720358',  // ISWAP/Boko Haram heartland; daily attacks
  'Zamfara':         'rel:3720342',  // Bandit insurgency epicentre; 725 villages occupied
  'Yobe':            'rel:3720356',  // ISWAP stronghold region; Lake Chad Basin

  // ── Pakistan / Afghanistan ────────────────────────────────────────────────
  'Pakistan':        'PK',
  'Afghanistan':     'AF',

  // ── Latin America ─────────────────────────────────────────────────────────
  'Haiti':           'HT',
  'Venezuela':       'VE',
  'Colombia':        'CO',
  'Jalisco':         'rel:2340636',
  'Michoacan':       'rel:2340636',
  'Tamaulipas':      'rel:2415518',
  'Guanajuato':      'rel:2340909',
};

// Map from conflicts.json region → zone key(s) to fetch
// A region can span multiple zone keys (e.g. Sudan = Khartoum + Darfur states)
// Updated Mar 2026: added Sudan states (Kordofan/Darfur full set + Gezira/Sennar/White Nile),
//   Myanmar (Chin/Mandalay/Bago), Nigeria (Borno/Zamfara/Yobe). Removed Taiwan (tension, not active war).
const REGION_ZONE_MAP = {
  'Ukraine':      ['Donetsk','Luhansk','Zaporizhzhia','Kherson','Kharkiv','Sumy','Crimea'],
  'Iran':         ['Tehran Province','Isfahan Province','Hormozgan Province','Bushehr Province',
                   'Kermanshah Province','East Azerbaijan','Qom Province','Alborz Province',
                   'Zanjan Province','Ilam Province','Lorestan Province','Fars Province',
                   'West Azerbaijan','Iran'],
  // Gulf states — removed as polygon zones; now city-level CONF point markers in data.js
  // (UAE/Qatar/Kuwait/Bahrain/Saudi Arabia/Jordan were struck by Iranian missiles but are
  //  not ground war zones — intercepts/debris, not invasion)
  'Iraq':         ['Iraq'],
  'Iraq':         ['Iraq'],
  'Israel':       ['Israel'],
  'Palestine':    ['Gaza','West Bank'],
  'Lebanon':      ['South Lebanon'],
  'Syria':        ['Syria'],
  // Sudan: RSF controls all Darfur (5 states), pushing into Kordofan; SAF holds east/centre
  'Sudan':        ['Khartoum','North Darfur','West Darfur','Central Darfur','South Darfur','East Darfur',
                   'North Kordofan','South Kordofan','West Kordofan','Blue Nile',
                   'Gezira','Sennar','White Nile'],
  // Myanmar: junta ~21% territory; resistance ~60%; fighting across almost all states/regions
  'Myanmar':      ['Myanmar'],
  // DRC: M23 (Rwanda-backed) controls Goma, Bukavu, Uvira; active FARDC counteroffensive
  'DRC':          ['North Kivu','South Kivu','Ituri','Maniema'],
  'Yemen':        ['Yemen'],
  'Red Sea':      ['Yemen'],   // Houthi ops; Yemen coast as proxy
  'Somalia':      ['Somalia'],
  // Sahel: JNIM blockading Bamako; ISGS active across all 3; Russia Africa Corps deployed
  'Sahel':        ['Burkina Faso','Mali','Niger'],
  'Ethiopia':     ['Amhara Region','Tigray Region'],
  'South Sudan':  ['South Sudan'],
  'Mozambique':   ['Cabo Delgado'],
  // Nigeria: Boko Haram/ISWAP + bandit insurgency — 2,266+ killed H1 2025 alone
  'Nigeria':      ['Borno','Zamfara','Yobe'],
  'Pakistan':     ['Pakistan','Afghanistan'],
  'Haiti':        ['Haiti'],
  'Venezuela':    ['Venezuela'],
  'Colombia':     ['Colombia'],
  'Mexico':       ['Jalisco','Michoacan','Tamaulipas','Guanajuato'],
};

// Conflict zone colours — uniform red, opacity scales slightly with intensity
function _confFillColor(int) {
  const a = 0.08 + int * 0.10; // 0.08–0.18
  return `rgba(255,0,0,${a.toFixed(3)})`;
}
function _confLineColor(int) {
  const a = 0.45 + int * 0.40; // 0.45–0.85
  return `rgba(255,0,0,${a.toFixed(3)})`;
}

// Per-zone max vertex count — small territories need fewer points to avoid
// glitching at low zoom; large countries can handle more detail
const _ZONE_MAX_PTS = {
  'Gaza':           300,
  'West Bank':      500,
  'South Lebanon':  800,
  // Small island/peninsula states — enough for clean coastlines without over-detail
  // Iran provinces
  'Tehran Province':     1500,
  'Isfahan Province':    2000,
  'Hormozgan Province':  2000,   // complex coastline + islands
  'Bushehr Province':    1500,
  'Kermanshah Province': 1500,
  'East Azerbaijan':     1500,
  'Qom Province':        1000,
  'Alborz Province':     800,
  'Zanjan Province':     1000,
  'Ilam Province':       1000,
  'Lorestan Province':   1200,
  'Fars Province':       2000,
  'West Azerbaijan':     1500,
  'Iran':                4000,   // whole country fallback
  // Iraq
  'Iraq':                3000,
  'Venezuela':      4000,
  'Colombia':       4000,
  'Crimea':         1200,
  'Kursk':          1200,
  // Sudan states — simplified; most are large desert polygons
  'Khartoum':       1500,
  'Gezira':         1000,
  'Sennar':         1000,
  'White Nile':     1000,
  // Myanmar regions — complex terrain
};
const _DEFAULT_MAX_PTS = 4000;

// Conflict-specific geometry parser — proper inner ring handling + per-zone decimation
function _confToGeoJSON(data, zoneName) {
  const maxPts = _ZONE_MAX_PTS[zoneName] || _DEFAULT_MAX_PTS;
  const relation = data?.elements?.find(e => e.type === 'relation');
  if (!relation?.members) return null;

  const outerWays = [], innerWays = [];
  relation.members.forEach(m => {
    if (m.type !== 'way' || !m.geometry?.length) return;
    const pts = m.geometry.map(pt => [pt.lon, pt.lat]);
    if (pts.length < 2) return;
    if (m.role === 'inner') innerWays.push(pts);
    else if (m.role === 'outer' || m.role === '') outerWays.push(pts);
    // ignore sub-relation members and any other roles
  });
  if (!outerWays.length) return null;

  const EPS = 1e-5;
  const ptKey = pt => `${(pt[0]/EPS|0)},${(pt[1]/EPS|0)}`;

  function stitch(ways) {
    let remaining = ways.map(w => [...w]);
    const rings = [];
    while (remaining.length > 0) {
      let ring = remaining.shift();
      let grew = true;
      while (grew) {
        grew = false;
        const tk = ptKey(ring[ring.length-1]), hk = ptKey(ring[0]);
        for (let i = 0; i < remaining.length; i++) {
          const w = remaining[i];
          const wh = ptKey(w[0]), wt = ptKey(w[w.length-1]);
          if      (wh === tk) ring = ring.concat(w.slice(1));
          else if (wt === tk) ring = ring.concat(w.slice(0,-1).reverse());
          else if (wt === hk) ring = w.concat(ring.slice(1));
          else if (wh === hk) ring = w.slice().reverse().concat(ring.slice(1));
          else continue;
          remaining.splice(i, 1); grew = true; break;
        }
      }
      const f = ring[0], l = ring[ring.length-1];
      if (ptKey(f) !== ptKey(l)) ring.push([...f]);
      const dec = _decimate(ring, maxPts);
      if (dec.length >= 4) rings.push(dec);
    }
    return rings;
  }

  const outerRings = stitch(outerWays);
  const innerRings = stitch(innerWays);
  if (!outerRings.length) return null;

  if (outerRings.length === 1) {
    return { type: 'Polygon', coordinates: [outerRings[0], ...innerRings] };
  }

  // MultiPolygon — assign each inner ring to its containing outer by bbox
  function bbox(ring) {
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for (const [x,y] of ring) { if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y; }
    return [x0,y0,x1,y1];
  }
  const outerBboxes = outerRings.map(bbox);
  const polys = outerRings.map(r => [r]);
  innerRings.forEach(inner => {
    const tp = inner[0];
    for (let i = 0; i < outerBboxes.length; i++) {
      const [x0,y0,x1,y1] = outerBboxes[i];
      if (tp[0]>=x0&&tp[0]<=x1&&tp[1]>=y0&&tp[1]<=y1) { polys[i].push(inner); return; }
    }
    polys[0].push(inner); // fallback
  });
  return { type: 'MultiPolygon', coordinates: polys };
}

const _confBoundaryCache = {};  // separate from outage cache
// Pre-populate from static zone-geo-cache.js if loaded before this script
if (typeof ZONE_GEO_CACHE !== 'undefined') Object.assign(_confBoundaryCache, ZONE_GEO_CACHE);

async function _fetchConfBoundary(key, zoneName) {
  if (_confBoundaryCache[key]) return;
  // name: keys are harvester-only — resolved at build time into zone-geo-cache.js
  // If not in cache already, skip (don't attempt runtime name lookup)
  if (key.startsWith('name:')) { console.warn('[WWO] name: key not in cache, run harvester:', key); return; }
  try {
    const param = key.startsWith('rel:') ? `rel=${key.slice(4)}` : `iso=${key}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let r;
    try {
      r = await fetch(`${PROXY_BASE}/api/boundary?${param}`, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const geom = _confToGeoJSON(data, zoneName);
    if (geom) { _confBoundaryCache[key] = geom; console.log('[WWO] Conf boundary cached:', key, zoneName); }
    else console.warn('[WWO] No conf geometry for', key, zoneName);
  } catch(e) { console.warn('[WWO] Conf boundary failed:', key, e.message); }
}

// ── Conflict zone pulse animation ────────────────────────────────────────────
// Slow sine breath: opacity oscillates between MIN and MAX over PERIOD ms
// Hooked into map.on('render') like the plasma — no competing rAF
let _confPulseT = 0;
const _PULSE_PERIOD = 3500; // ms for one full cycle
const _PULSE_MIN    = 0.25;
const _PULSE_MAX    = 1.0;

function _startConfPulse(map) {
  let last = performance.now();
  map.on('render', () => {
    const now = performance.now();
    _confPulseT += (now - last) / _PULSE_PERIOD;
    last = now;
    // Sine goes -1→1; remap to MIN→MAX
    const s = (Math.sin(_confPulseT * Math.PI * 2) + 1) / 2; // 0→1→0
    const opacity = _PULSE_MIN + s * (_PULSE_MAX - _PULSE_MIN);
    try {
      map.setPaintProperty('fronts-fill', 'fill-opacity', opacity);
    } catch(e) {}
    map.triggerRepaint();
  });
}

// Fetch and render real OSM boundaries for all active conflict zones
async function initConflictZones(map) {
  // Collect all unique zone keys needed for current CONF data
  const regions = [...new Set(CONF.map(c => c.region))];
  const needed  = new Set();
  regions.forEach(r => (REGION_ZONE_MAP[r] || []).forEach(z => needed.add(z)));

  console.log(`[WWO] Fetching ${needed.size} conflict zone boundaries…`);

  // Fetch in parallel (Overpass handles concurrent requests fine; Worker caches 24h)
  await Promise.allSettled([...needed].map(zoneName => {
    const key = CONF_ZONE_KEYS[zoneName];
    if (!key) return Promise.resolve();
    return _fetchConfBoundary(key, zoneName);
  }));

  // Build GeoJSON features — one per zone, styled by highest intensity in that region
  const features = [];
  regions.forEach(region => {
    const zoneNames = REGION_ZONE_MAP[region] || [];
    const regionConfs = CONF.filter(c => c.region === region);
    const maxInt = regionConfs.reduce((m, c) => Math.max(m, c.int), 0);

    zoneNames.forEach(zoneName => {
      const key  = CONF_ZONE_KEYS[zoneName];
      const geom = key && _confBoundaryCache[key];
      if (!geom) return;

      features.push({
        type: 'Feature',
        geometry: geom,
        properties: {
          name:  zoneName,
          zone:  region,
          int:   maxInt,
          fill:  _confFillColor(maxInt),
          line:  _confLineColor(maxInt),
        },
      });
    });
  });

  console.log(`[WWO] Conflict zones rendered: ${features.length}`);

  const src = map.getSource('frontlines');
  if (src && features.length > 0) {
    src.setData({ type: 'FeatureCollection', features });
    // Apply per-feature colour expressions only when we have OSM data with fill/line props.
    // With static FRONTLINES fallback these props don't exist — ['get','fill'] returns null → black.
    try {
      map.setPaintProperty('fronts-fill', 'fill-color', ['get','fill']);
      map.setPaintProperty('fronts-line', 'line-color', ['get','line']);
      map.setPaintProperty('fronts-border','line-color', ['get','line']);
    } catch(e) {}
  } else {
    console.warn('[WWO] No OSM boundaries — keeping static FRONTLINES fallback with default paint');
  }

  // Start the slow pulse — opacity breathes in/out over the fill layer
  _startConfPulse(map);
}

// ====== DETAIL PANELS ======
function showD(type,title,style,html){document.getElementById('dt').textContent=type;document.getElementById('dt').style.cssText=style;document.getElementById('dtl').textContent=title;document.getElementById('dpb').innerHTML=html;document.getElementById('dp').classList.add('show');}
function closeD(){document.getElementById('dp').classList.remove('show');}

// showFlightD is defined above in the OpenSky section

function showSatD(norad){const td=tleData.get(norad);if(!td)return;const alt=td.altKm!=null?td.altKm+' km':'N/A';const inc=td.inc!=null?td.inc.toFixed(1)+'\u00b0':'N/A';const per=td.per!=null?td.per.toFixed(1)+' min':'N/A';showD('SATELLITE',td.name,'background:rgba(80,120,220,0.15);color:#5588dd',`<div class="dr"><span class="dl">NAME</span><span class="dv2">${td.name}</span></div><div class="dr"><span class="dl">NORAD ID</span><span class="dv2">${norad}</span></div><div class="dr"><span class="dl">OPERATOR</span><span class="dv2">${td.op||'Unknown'}</span></div><div class="dr"><span class="dl">PURPOSE</span><span class="dv2">${td.pur||'Satellite'}</span></div><div class="dr"><span class="dl">ALTITUDE</span><span class="dv2">${alt}</span></div><div class="dr"><span class="dl">INCLINATION</span><span class="dv2">${inc}</span></div><div class="dr"><span class="dl">PERIOD</span><span class="dv2">${per}</span></div><div class="dr"><span class="dl">SOURCE</span><span class="dv2" style="color:var(--accent2)">CELESTRAK TLE \u2192 SGP4</span></div><div class="dr"><span class="dl">STATUS</span><span class="dv2" style="color:#00ff88">TRACKED</span></div>`);}

function showCamD(i){
  const c=CAMS[i];
  if(window._camRefresh){clearInterval(window._camRefresh);window._camRefresh=null;}
  const hasFeed=c.type==='img'&&!!c.feed;
  const isUKCam=c.type==='ukcam';
  const isLink=c.type==='link'&&!!c.feed;
  const isUK=c.region==='uk';
  let fh,statusColor,statusText,sourceText,extLink='';
  if(isUKCam){
    // Live image from trafficcameras.uk — loads on demand
    const imgUrl=c.feed+'?t='+Date.now();
    fh=`<img id="cam-live-img" src="${imgUrl}" style="width:100%;height:100%;object-fit:contain;background:#000" onerror="this.onerror=null;this.style.display='none';this.parentElement.querySelector('.cf-err').style.display='block'"><div class="cf-err" style="display:none;text-align:center;padding:20px;color:#ffaa00;font-size:10px">\u26a0 Image unavailable<br><span style="font-size:8px;color:var(--text-dim)">Camera may be offline or under maintenance</span></div>`;
    statusColor='#ffaa00';statusText='LIVE (5min refresh)';sourceText='National Highways via trafficcameras.uk';
    const roadSlug=c.city.replace('UK ','').toLowerCase();
    extLink=`<div class="dr"><span class="dl">VIEW ON SITE</span><span class="dv2"><a href="https://trafficcameras.uk/${roadSlug}" target="_blank" style="color:var(--accent2);text-decoration:underline">\u2197 trafficcameras.uk/${roadSlug}</a></span></div>`+
      `<div class="dr"><span class="dl">DIRECT IMAGE</span><span class="dv2"><a href="${c.feed}" target="_blank" style="color:var(--accent2);text-decoration:underline">\u2197 Open image</a></span></div>`+
      `<div style="text-align:center;margin-top:6px"><button onclick="document.getElementById('cam-live-img').src='${c.feed}?t='+Date.now();document.getElementById('cam-ts').textContent=new Date().toISOString().slice(11,19)+' UTC'" style="background:rgba(255,170,0,0.15);color:#ffaa00;border:1px solid #ffaa0044;padding:4px 16px;cursor:pointer;font-family:var(--ft);font-size:9px;letter-spacing:1px">\u21bb REFRESH IMAGE</button></div>`;
  }else if(hasFeed){
    fh=`<img id="cam-live-img" src="${c.feed}?t=${Date.now()}" style="width:100%;height:100%;object-fit:contain;background:#000" onerror="this.style.display='none'">`;
    statusColor='#00ff88';statusText='LIVE (DOT)';sourceText='NYC DOT / NYCTMC';
    extLink=`<div class="dr"><span class="dl">OPEN FEED</span><span class="dv2"><a href="${c.feed}" target="_blank" style="color:var(--accent2);text-decoration:underline">\u2197 Direct Image</a></span></div>`;
  }else if(isLink){
    fh=`<div class="cf-offline" style="background:#0a1a0e"><div style="color:#ffaa00">\u26a0 UK TRAFFIC CAM</div><div style="font-size:8px;margin-top:4px;color:var(--text-dim)">${c.id}</div><div style="font-size:7px;margin-top:2px;color:var(--text)">National Highways feed</div></div>`;
    statusColor='#ffaa00';statusText='EXTERNAL LINK';sourceText='National Highways via trafficcameras.uk';
    extLink=`<div class="dr"><span class="dl">VIEW CAMERAS</span><span class="dv2"><a href="${c.feed}" target="_blank" style="color:var(--accent2);text-decoration:underline">\u2197 trafficcameras.uk</a></span></div>`;
  }else{
    fh=`<div class="cf-offline"><div>NO LIVE FEED</div><div style="font-size:8px;margin-top:4px;color:var(--text-dim)">${c.id}</div><div style="font-size:7px;margin-top:2px;color:var(--text-dim)">Camera marker only</div><div class="cf-noise"></div></div>`;
    statusColor='var(--warning)';statusText='MARKER';sourceText='Map Marker';
  }
  const panelColor=isUK?'background:rgba(255,170,0,0.1);color:#ffaa00':'background:rgba(0,255,136,0.15);color:#00ff88';
  showD(isUK?'UK TRAFFIC':'CCTV',c.name,panelColor,
    `<div class="cam-feed">${fh}<div class="cf-rec">${hasFeed?'\u25cf LIVE':isUKCam?'\u25cf UK LIVE':isLink?'\u25cb EXT':'\u25cb OFF'}</div><div class="cf-ts" id="cam-ts">${new Date().toISOString().slice(11,19)} UTC</div><div class="cf-id">${c.id}</div></div>`+
    `<div class="dr"><span class="dl">LOCATION</span><span class="dv2">${c.city}</span></div>`+
    `<div class="dr"><span class="dl">ROAD</span><span class="dv2">${c.city.replace('UK ','')}</span></div>`+
    `<div class="dr"><span class="dl">FEED ID</span><span class="dv2">${c.id}${c.tcId?' (TC#'+c.tcId+')':''}</span></div>`+
    `<div class="dr"><span class="dl">STATUS</span><span class="dv2" style="color:${statusColor}">${statusText}</span></div>`+
    `<div class="dr"><span class="dl">SOURCE</span><span class="dv2">${sourceText}</span></div>`+
    extLink
  );
  if(hasFeed){
    window._camRefresh=setInterval(()=>{
      const img=document.getElementById('cam-live-img');if(img)img.src=c.feed+'?t='+Date.now();
      const ts=document.getElementById('cam-ts');if(ts)ts.textContent=new Date().toISOString().slice(11,19)+' UTC';
    },3000);
  }
}

function showConfD(i){const c=CONF[i],col=confCol(c.int);
  // Get REAL posts matching this conflict zone
  const realPosts=getPostsForZone(c.region);
  let feed='';
  if(realPosts.length>0){
    realPosts.slice(-5).reverse().forEach(p=>{
      feed+=`<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:10px;line-height:1.4;cursor:pointer" onclick="window.open('${p.link}','_blank','noopener')"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#1d9bf0;font-size:9px;font-family:var(--fm)">${p.source}</span><span style="color:#1d9bf0;font-size:7px;font-family:var(--ft);letter-spacing:1px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px">TELEGRAM</span></div>${p.text.slice(0,200)}${p.text.length>200?'…':''}<div style="color:var(--text-dim);font-size:8px;margin-top:2px">${timeAgo(p.pubDate)}</div></div>`;
    });
  }else{
    feed='<div style="color:var(--text-dim);font-size:10px;font-family:var(--fm);padding:8px 0">No matched OSINT posts in last 24h. Feed syncing…</div>';
  }
  const summaryHtml=c.summary?`<div style="margin:8px 0;padding:8px;background:rgba(255,60,0,0.05);border-left:2px solid ${col};font-size:10px;line-height:1.5;font-family:var(--fm);color:var(--text)">${c.summary}</div>`:'';
  showD('CONFLICT',c.name,`background:rgba(255,60,0,0.15);color:${col}`,`<div class="dr"><span class="dl">ZONE</span><span class="dv2">${c.name}</span></div><div class="dr"><span class="dl">TYPE</span><span class="dv2">${c.type}</span></div><div class="dr"><span class="dl">REGION</span><span class="dv2">${c.region}</span></div><div class="dr"><span class="dl">INTENSITY</span><span class="dv2" style="color:${col}">${~~(c.int*100)}%</span></div><div class="dr"><span class="dl">EVENTS (24H)</span><span class="dv2">${c.events}</span></div><div class="dr"><span class="dl">DISPLACED</span><span class="dv2">${c.disp}</span></div><div class="dr"><span class="dl">THREAT LEVEL</span><span class="dv2" style="color:${col}">${c.int>0.75?'CRITICAL':c.int>0.5?'ELEVATED':'WATCH'}</span></div>${summaryHtml}<button class="track-btn" onclick="openCTO(${i})">OPEN DEDICATED TRACKER</button><div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px"><div style="font-family:var(--ft);font-size:9px;letter-spacing:2px;color:var(--accent);margin-bottom:6px">LIVE OSINT FEED <span style="color:#1d9bf0;font-size:7px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px;margin-left:6px">REAL DATA</span></div>${feed}</div>`);}

// ====== CONFLICT TRACKER ======
let ctoI=null;
let ctoRegion=null;// track which region is open for live updates
function openCTO(i){closeD();const c=CONF[i],col=confCol(c.int);
ctoRegion=c.region;
document.getElementById('cto-name').textContent='TRACKER // '+c.name.toUpperCase();document.getElementById('cto-name').style.color=col;
const rel=CONF.filter(x=>x.region===c.region);
let st=`<h3>SITUATION OVERVIEW</h3><div class="cto-stat"><span>Zone</span><span class="csv">${c.name}</span></div><div class="cto-stat"><span>Classification</span><span class="csv">${c.type}</span></div><div class="cto-stat"><span>Intensity</span><span class="csv" style="color:${col}">${~~(c.int*100)}%</span></div><div class="cto-stat"><span>Threat Level</span><span class="csv" style="color:${col}">${c.int>0.75?'CRITICAL':c.int>0.5?'ELEVATED':'WATCH'}</span></div><div class="cto-stat"><span>24hr Events</span><span class="csv">${c.events}</span></div><div class="cto-stat"><span>Displaced</span><span class="csv">${c.disp}</span></div>`;
if(rel.length>1){st+=`<h3 style="margin-top:12px">RELATED ZONES (${c.region})</h3>`;rel.forEach(r=>{const rc=confCol(r.int);st+=`<div class="cto-stat"><span style="color:${rc}">${r.name}</span><span class="csv">${~~(r.int*100)}%</span></div>`;});}

// Real posts for timeline
const zonePosts=getPostsForZone(c.region);
let tl='<h3>LIVE EVENT TIMELINE <span style="color:#1d9bf0;font-size:7px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px;margin-left:4px">REAL DATA</span></h3>';
if(zonePosts.length>0){
  zonePosts.slice(-8).reverse().forEach(p=>{
    tl+=`<div class="tli" style="cursor:pointer" onclick="window.open('${p.link}','_blank','noopener')"><span class="tld">${timeAgo(p.pubDate)}</span><span><span style="color:#1d9bf0;font-size:8px">${p.source}</span> ${p.text.slice(0,120)}${p.text.length>120?'…':''}</span></div>`;
  });
}else{
  tl+='<div style="color:var(--text-dim);font-size:10px;font-family:var(--fm);padding:8px 0">Awaiting matched posts for this zone. Feed refreshes every 3 min.</div>';
}

let sr='<h3>MONITORED SOURCES</h3>';
// Zone-specific Telegram channels + global OSINT channels
const zoneTg=TELEGRAM_OSINT_CHANNELS.filter(ch=>ch.zone===c.region||ch.zone==='OSINT');
sr+='<div style="font-size:8px;color:var(--text-dim);margin-bottom:6px;font-family:var(--fm);letter-spacing:1px">TELEGRAM CHANNELS</div>';
zoneTg.forEach(ch=>{
  sr+=`<div style="padding:4px 0;font-family:var(--fm);font-size:10px;border-bottom:1px solid rgba(40,80,140,0.08);display:flex;justify-content:space-between;align-items:center">`;
  sr+=`<a href="https://t.me/${ch.channel}" target="_blank" rel="noopener" style="color:#1d9bf0;text-decoration:none;flex:1" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'"><span style="opacity:0.6;font-size:8px">t.me/</span>${ch.channel}</a>`;
  sr+=`<span style="color:var(--text-dim);font-size:8px;margin-left:8px">${ch.label}${ch.twitter?' <span style="font-size:7px">@'+ch.twitter+'</span>':''}</span>`;
  sr+=`</div>`;
});
const zoneNews=FEED_QUERIES.filter(q=>q.zone===c.region);
if(zoneNews.length>0){
  sr+='<div style="font-size:8px;color:var(--text-dim);margin:10px 0 6px;font-family:var(--fm);letter-spacing:1px">GOOGLE NEWS FEEDS</div>';
  zoneNews.forEach(q=>{
    const url='https://news.google.com/rss/search?q='+q.q+'&hl=en-US&gl=US&ceid=US:en';
    sr+=`<div style="padding:4px 0;font-family:var(--fm);font-size:10px;border-bottom:1px solid rgba(40,80,140,0.08)"><a href="${url}" target="_blank" rel="noopener" style="color:#34a853;text-decoration:none" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">↗ ${q.q.replace(/\+/g,' ')}</a></div>`;
  });
}

document.getElementById('cto-body').innerHTML=`<div class="cto-s">${st}</div><div class="cto-s"><h3>LIVE INTELLIGENCE <span style="color:var(--danger);font-size:8px">&#9679; LIVE</span> <span style="color:#1d9bf0;font-size:7px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px;margin-left:4px">REAL DATA</span></h3><div id="cto-feed"></div></div><div class="cto-s">${tl}</div><div class="cto-s">${sr}</div>`;
document.getElementById('cto').classList.add('show');

// Populate live intelligence feed with real posts
const fe=document.getElementById('cto-feed');
function renderCTOFeed(){
  fe.innerHTML='';
  const posts=getPostsForZone(c.region);
  if(posts.length===0){
    fe.innerHTML='<div style="color:var(--text-dim);font-size:10px;font-family:var(--fm);padding:8px 0">Scanning Telegram channels for ${c.region} intel… Feed refreshes every 3 min.</div>';
    return;
  }
  posts.slice(-12).reverse().forEach(p=>{
    const el=document.createElement('div');
    el.className='cto-ev';
    el.style.cursor='pointer';
    el.onclick=()=>window.open(p.link,'_blank','noopener');
    el.innerHTML=`<div class="ces" style="display:flex;justify-content:space-between"><span style="color:#1d9bf0">${p.source}</span><span style="color:#1d9bf0;font-size:7px;font-family:var(--ft);letter-spacing:1px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px">TELEGRAM</span></div>${p.text.slice(0,200)}${p.text.length>200?'…':''}<div class="cet">${timeAgo(p.pubDate)}</div>`;
    fe.appendChild(el);
  });
}
renderCTOFeed();

// Live update: re-render CTO feed every 30 seconds with latest posts
if(ctoI)clearInterval(ctoI);
ctoI=setInterval(renderCTOFeed,30000);
map.flyTo({center:[c.lng,c.lat],zoom:6,duration:1000});}
function closeCTO(){document.getElementById('cto').classList.remove('show');ctoRegion=null;if(ctoI){clearInterval(ctoI);ctoI=null;}}

// ── Open tracker directly by region name (for sidebar shortcut buttons) ──────
// Composite trackers map multiple data regions into one combined view
const TRACKER_REGION_MAP={
  'Iran War':  ['Iran','Lebanon','Gulf','Red Sea','Iran War'],
  'Palestine': ['Palestine','Gaza','West Bank'],
};
function openCTOByRegion(region){
  const searchRegions=TRACKER_REGION_MAP[region]||[region];
  const matches=CONF.map((c,i)=>({c,i})).filter(({c})=>searchRegions.includes(c.region));
  if(!matches.length){console.warn('[WWO] No CONF entry for tracker:',region,searchRegions);return;}
  const best=matches.reduce((a,b)=>b.c.int>a.c.int?b:a);
  openCTO(best.i);
}
