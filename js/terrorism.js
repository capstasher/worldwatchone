// ====== TERRORISM / MASS CASUALTY EVENT LAYER ======
// Backend: Cloudflare Workers + KV store (binding: WWO_EVENTS)
// Worker periodically scrapes SITE Intelligence RSS, Reuters breaking, AP alerts
// and geocodes events via Nominatim — writes to KV with 48h TTL.
// Client polls /api/events every 5 minutes. Events persist between sessions.
// Events expire naturally when KV TTL expires — no manual cleanup needed.
//
// KV key format: event:{timestamp_ms}_{lat}_{lon}
// KV value: JSON { id, lat, lon, title, source, severity, ts, category }

const TERROR_POLL_MS     = 5 * 60 * 1000;   // poll every 5min
const TERROR_DISPLAY_TTL = 48 * 60 * 60 * 1000; // hide client-side after 48h

// Severity colours
const TERROR_COLORS = {
  critical: '#ff0000',   // mass casualty, WMD
  high:     '#ff6600',   // bombing, armed attack, significant casualties
  medium:   '#ffcc00',   // shooting, knife attack, threat
  low:      '#00ccff',   // arrest, foiled plot, incident
};

let _terrorLayerAdded = false;
let _terrorFeatures   = [];
let _terrorPollTimer  = null;

// ── Fetch events from Worker KV endpoint ─────────────────────────────────────
async function _fetchTerrorEvents() {
  try {
    const r = await fetch(`${PROXY_BASE}/api/events`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('Events Worker ' + r.status);
    const data = await r.json();
    const events = Array.isArray(data) ? data : (data.events || []);

    // Client-side TTL filter (belt + suspenders over KV TTL)
    const cutoff = Date.now() - TERROR_DISPLAY_TTL;
    _terrorFeatures = events
      .filter(e => e.lat != null && e.lon != null && (e.ts || 0) > cutoff)
      .map(e => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
        properties: {
          id:       e.id || String(e.ts),
          title:    e.title || 'Unknown event',
          source:   e.source || 'Unknown',
          severity: e.severity || 'medium',
          category: e.category || 'incident',
          ts:       e.ts || Date.now(),
          color:    TERROR_COLORS[e.severity] || TERROR_COLORS.medium,
          ageHours: ((Date.now() - (e.ts || Date.now())) / 3600000).toFixed(1),
        }
      }));

    if (_terrorLayerAdded) {
      const src = map.getSource('terror-events');
      if (src) src.setData({ type: 'FeatureCollection', features: _terrorFeatures });
    }

    // Surface critical events to OSINT feed
    const recent = _terrorFeatures.filter(f => f.properties.ts > Date.now() - TERROR_POLL_MS * 2);
    recent.forEach(f => {
      const p = f.properties;
      if (p.severity === 'critical' || p.severity === 'high') {
        if (typeof addLiveItem === 'function') {
          addLiveItem(`🔴 ${p.title}`, p.source, new Date(p.ts).toUTCString(), null, 'OSINT', 'al', false);
        }
      }
    });

    if (_terrorFeatures.length > 0) {
      console.log(`[WWO] Terror/events layer: ${_terrorFeatures.length} events`);
    }
  } catch(e) {
    console.warn('[WWO] Events poll failed:', e.message);
  }
}

// ── Init map layers ───────────────────────────────────────────────────────────
function initTerrorEvents(map) {
  map.addSource('terror-events', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  // Outer glow (severity-based radius)
  map.addLayer({ id: 'terror-glow', type: 'circle', source: 'terror-events',
    paint: {
      'circle-radius': [
        'match', ['get', 'severity'],
        'critical', 32,
        'high', 22,
        'medium', 16,
        12
      ],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.15,
      'circle-blur': 1.5,
    }
  });

  // Core dot
  map.addLayer({ id: 'terror-dot', type: 'circle', source: 'terror-events',
    paint: {
      'circle-radius': [
        'match', ['get', 'severity'],
        'critical', 8,
        'high', 6,
        'medium', 5,
        4
      ],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.95,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(0,0,0,0.4)',
    }
  });

  // Age label (hours ago)
  map.addLayer({ id: 'terror-label', type: 'symbol', source: 'terror-events',
    layout: {
      'text-field': ['+', ['get', 'ageHours'], 'h'],
      'text-size': 8,
      'text-offset': [0, 1.2],
      'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0,0,0,0.9)',
      'text-halo-width': 1.5,
    }
  });

  if (typeof lMap !== 'undefined') lMap['terror-events'] = ['terror-glow', 'terror-dot', 'terror-label'];
  layerVis['terror-events'] = true;
  _terrorLayerAdded = true;

  // Click popup
  map.on('click', 'terror-dot', e => {
    const p = e.features[0]?.properties || {};
    const sevIcon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[p.severity] || '⚫';
    const age = p.ageHours < 1 ? 'Just now' : `${p.ageHours}h ago`;
    if (typeof showPopup === 'function') {
      showPopup(e.lngLat,
        `${sevIcon} <b>${p.title}</b><br>Source: ${p.source}<br>Category: ${p.category}<br>Severity: ${p.severity.toUpperCase()}<br>${age}`
      );
    }
  });
  map.on('mouseenter', 'terror-dot', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'terror-dot', () => map.getCanvas().style.cursor = '');

  // Start polling
  _fetchTerrorEvents();
  _terrorPollTimer = setInterval(_fetchTerrorEvents, TERROR_POLL_MS);

  console.log('[WWO] Terror/events layer initialised');
}
