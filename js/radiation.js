// ====== RADIATION MONITORING LAYER ======
// EURDEP / EPA RadNet / Japan NRA
const RAD_REFRESH_MS=15*60*1000;
const EURDEP_URL="https://rmap.jrc.ec.europa.eu/rmap/api/v1/gamma?format=json&valid=true&limit=5000";
const RADNET_URL="https://www.epa.gov/sites/default/files/2019-11/radnet_monitoring_data.json";
const NRA_URL="https://www.nsr.go.jp/monitoring/monitoring_map/radiation_latest.json";
let _radLayerAdded=false,_radFeatures=[];
function _radColor(u){return u>=5?"#ff0000":u>=1?"#ff6600":u>=0.3?"#ffcc00":"#00cc44";}
async function _fetchEURDEP(){try{const r=await fetch(PROXY(EURDEP_URL),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(r.status);const data=await r.json();const arr=Array.isArray(data)?data:(data.data||data.features||[]);return arr.map(s=>{const lat=parseFloat(s.lat||s.latitude);const lon=parseFloat(s.lon||s.longitude);const usv=parseFloat(s.value||s.doseRate||0);if(isNaN(lat)||isNaN(lon)||isNaN(usv))return null;return{type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},properties:{usv,source:"EURDEP",id:String(s.stationId||s.id||""),time:String(s.measurementTime||""),color:_radColor(usv),elevated:usv>=0.3}};}).filter(Boolean);}catch(e){console.warn("[WWO] EURDEP:",e.message);return[];}}
async function _fetchRadNet(){try{const r=await fetch(PROXY(RADNET_URL),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(r.status);const data=await r.json();const st=Array.isArray(data)?data:(data.stations||data.data||[]);return st.map(s=>{const lat=parseFloat(s.latitude||s.lat),lon=parseFloat(s.longitude||s.lon);let usv=parseFloat(s.gamma_dose_rate||s.doseRate||s.value||0);if(s.unit&&s.unit.toLowerCase().includes("r/h")&&!s.unit.toLowerCase().includes("sv"))usv*=0.00877;if(isNaN(lat)||isNaN(lon))return null;return{type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},properties:{usv,source:"RadNet",id:String(s.station_id||s.id||""),city:String(s.city||s.location||""),state:String(s.state||""),time:String(s.sample_date||""),color:_radColor(usv),elevated:usv>=0.3}};}).filter(Boolean);}catch(e){console.warn("[WWO] RadNet:",e.message);return[];}}
async function _fetchNRA(){try{const r=await fetch(PROXY(NRA_URL),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(r.status);const data=await r.json();const st=Array.isArray(data)?data:(data.stations||data.data||[]);return st.map(s=>{const lat=parseFloat(s.lat||s.latitude),lon=parseFloat(s.lon||s.longitude),usv=parseFloat(s.value||s.doseRate||0);if(isNaN(lat)||isNaN(lon))return null;return{type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},properties:{usv,source:"NRA",id:String(s.stationId||s.id||""),prefecture:String(s.prefecture||""),time:String(s.time||""),color:_radColor(usv),elevated:usv>=0.3}};}).filter(Boolean);}catch(e){console.warn("[WWO] NRA:",e.message);return[];}}

async function _fetchAllRadiation() {
  const [eurdep, radnet, nra] = await Promise.allSettled([_fetchEURDEP(), _fetchRadNet(), _fetchNRA()]);
  const features = [
    ...(eurdep.status === 'fulfilled' ? eurdep.value : []),
    ...(radnet.status === 'fulfilled' ? radnet.value : []),
    ...(nra.status === 'fulfilled'    ? nra.value    : []),
  ];
  _radFeatures = features;
  console.log(`[WWO] Radiation: ${features.length} stations (EURDEP+RadNet+NRA)`);
  if (_radLayerAdded) {
    const src = map.getSource('radiation');
    if (src) src.setData({ type: 'FeatureCollection', features });
    // Alert on elevated readings
    features.filter(f => f.properties.elevated).forEach(f => {
      const p = f.properties;
      console.warn(`[WWO RAD ELEVATED] ${p.source} station ${p.id}: ${p.usv.toFixed(3)} µSv/h`);
    });
  }
  return features;
}

function initRadiation(map) {
  map.addSource('radiation', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  // Background glow for elevated
  map.addLayer({ id: 'rad-glow', type: 'circle', source: 'radiation',
    filter: ['==', ['get', 'elevated'], true],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 12, 6, 20],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.15,
      'circle-blur': 1,
    }
  });

  // Sensor dot — all stations
  map.addLayer({ id: 'rad-dot', type: 'circle', source: 'radiation',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.5, 6, 4, 10, 6],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.85,
      'circle-stroke-width': 1,
      'circle-stroke-color': 'rgba(0,0,0,0.3)',
    }
  });

  if (typeof lMap !== 'undefined') lMap.radiation = ['rad-glow', 'rad-dot'];
  layerVis.radiation = true;
  _radLayerAdded = true;

  // Click popup
  map.on('click', 'rad-dot', e => {
    const p = e.features[0]?.properties || {};
    const label = p.usv >= 5 ? '🔴 CRITICAL' : p.usv >= 1 ? '🟠 ELEVATED' : p.usv >= 0.3 ? '🟡 ABOVE NORMAL' : '🟢 NORMAL';
    if (typeof showPopup === 'function') {
      showPopup(e.lngLat,
        `☢ <b>Radiation Monitor</b><br>Source: ${p.source}<br>Dose rate: <b>${(p.usv||0).toFixed(3)} µSv/h</b><br>Status: ${label}<br>${p.city||p.prefecture||p.id||''}`
      );
    }
  });
  map.on('mouseenter', 'rad-dot', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'rad-dot', () => map.getCanvas().style.cursor = '');

  _fetchAllRadiation();
  setInterval(_fetchAllRadiation, RAD_REFRESH_MS);
  console.log('[WWO] Radiation layer initialised');
}
