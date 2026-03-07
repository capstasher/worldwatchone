// ====== MAP INIT — MapLibre setup, sources, layers, init orchestration ======

// ====== MAP ======
var map=new maplibregl.Map({container:'map',style:'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',center:[30,20],zoom:2.2,minZoom:1,maxZoom:20,attributionControl:false,maxPitch:70,projection:'globe'});
// Globe projection set in load handler below (not style.load, which re-triggers and wipes dynamic layers)

// These are window-globals so all modules can access them
var nervMode=false;
var layerVis={flights:true,sats:true,conf:true,cams:true,osint:true,fronts:true,outages:true,quakes:true,fires:true,storms:true,volcanoes:true,tsunamis:true,cables:true,radiation:true,"terror-events":true,wind:false,floods:true,"nws-alerts":true};
var baseLayerIds=[];// will store carto's own layer IDs — global for nerv-ctrl.js


map.on('load',()=>{
  // Snapshot Carto's base layer IDs before we add ours
  // (globe projection set in Map constructor — do NOT set again here or in style.load)
  baseLayerIds=map.getStyle().layers.map(l=>l.id);

  // Register icons
  map.addImage('p-com',planeImg('#00cc66'));
  map.addImage('p-light',planeImg('#00ccff'));
  map.addImage('p-mil',planeImg('#ff3333'));
  map.addImage('s-icon',satImg('#5588dd'));

  // FLIGHTS — source pre-populated empty; OpenSky fills it on first fetch
  map.addSource('flights',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'fl-glow',type:'circle',source:'flights',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,8,6,14,12,20],'circle-color':['case',['==',['get','mil'],1],'#ff3333',['==',['get','isLight'],1],'#00ccff','#00cc66'],'circle-opacity':0.25,'circle-blur':1}});
  // Emergency squawk pulsing ring
  map.addLayer({id:'fl-emerg',type:'circle',source:'flights',filter:['==',['get','emergency'],1],paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,14,6,24,12,36],'circle-color':'#ff0000','circle-opacity':0.4,'circle-blur':0.6,'circle-stroke-width':2,'circle-stroke-color':'#ff0000','circle-stroke-opacity':0.8}});
  map.addLayer({id:'fl-lyr',type:'symbol',source:'flights',layout:{'icon-image':['case',['==',['get','mil'],1],'p-mil',['==',['get','isLight'],1],'p-light','p-com'],'icon-size':['interpolate',['linear'],['zoom'],1,0.5,6,0.7,12,1],'icon-rotate':['get','bearing'],'icon-rotation-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true}});

  // FRONTLINES / CONFLICT ZONE SHADING (added first so dots render above)
  map.addSource('frontlines',{type:'geojson',data:FRONTLINES});
  map.addLayer({id:'fronts-fill',type:'fill',source:'frontlines',paint:{
    'fill-color': 'rgba(255,0,0,0.12)',
    'fill-opacity': 0.25
  }});
  map.addLayer({id:'fronts-line',type:'line',source:'frontlines',paint:{
    'line-color': 'rgba(255,0,0,0.70)',
    'line-width':['interpolate',['linear'],['zoom'],1,1.0,5,1.8,10,2.5],
    'line-dasharray':[5,3.5]
  }});
  map.addLayer({id:'fronts-border',type:'line',source:'frontlines',paint:{
    'line-color': 'rgba(255,0,0,0.10)',
    'line-width':['interpolate',['linear'],['zoom'],1,6,5,10,10,16],
    'line-blur':4
  }});

  // CONFLICT HEATGLOW (above frontlines)
  map.addSource('conf-heat',{type:'geojson',data:{type:"FeatureCollection",features:confPts}});
  map.addLayer({id:'cheat',type:'circle',source:'conf-heat',paint:{'circle-radius':['interpolate',['linear'],['get','int'],0.2,20,1.0,65],'circle-color':['interpolate',['linear'],['get','int'],0.2,'rgba(200,120,0,0.03)',0.5,'rgba(200,60,0,0.07)',0.8,'rgba(220,30,0,0.12)',1.0,'rgba(255,0,0,0.17)'],'circle-blur':1}});
  map.addSource('conf-core',{type:'geojson',data:{type:"FeatureCollection",features:confPts}});
  map.addLayer({id:'ccore',type:'circle',source:'conf-core',paint:{'circle-radius':['interpolate',['linear'],['get','int'],0.2,4,1.0,9],'circle-color':['interpolate',['linear'],['get','int'],0.25,'#cc8800',0.55,'#dd5500',0.8,'#dd2200',1.0,'#ff0000'],'circle-opacity':0.9,'circle-stroke-width':2,'circle-stroke-color':['interpolate',['linear'],['get','int'],0.25,'#cc8800',1.0,'#ff0000'],'circle-stroke-opacity':0.3}});

  // CAMERAS
  map.addSource('cams',{type:'geojson',data:{type:"FeatureCollection",features:mkCP()}});
  map.addLayer({id:'cam-glow',type:'circle',source:'cams',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,10,8,20],'circle-color':['case',['==',['get','region'],'uk'],'#ffaa00','#00ff88'],'circle-opacity':0.06,'circle-blur':1}});
  map.addLayer({id:'cam-dot',type:'circle',source:'cams',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,3,8,6,14,9],'circle-color':['case',['==',['get','region'],'uk'],'#ffaa00','#00ff88'],'circle-opacity':0.85,'circle-stroke-width':2,'circle-stroke-color':['case',['==',['get','region'],'uk'],'#ffaa00','#00ff88'],'circle-stroke-opacity':0.25}});

  // SATELLITES
  map.addSource('sats',{type:'geojson',data:{type:"FeatureCollection",features:mkSP()}});
  map.addLayer({id:'sat-lyr',type:'symbol',source:'sats',layout:{'icon-image':'s-icon','icon-size':['interpolate',['linear'],['zoom'],1,0.6,6,0.85,12,1],'icon-allow-overlap':true,'icon-ignore-placement':true}});

  // Initialize earthquake tracker
  try { initEarthquakes(map); } catch(e) { console.error('[WWO] initEarthquakes failed:', e); }

  // Initialize weather tile layers + disaster pins (also registers floods, nws-alerts layers + lMap entries)
  try { initWeather(map); } catch(e) { console.error('[WWO] initWeather failed:', e); }

  try { initOutages(map); } catch(e) { console.error('[WWO] initOutages failed:', e); }

  try { initConflictZones(map); } catch(e) { console.error('[WWO] initConflictZones failed:', e); }

  try { initCables(map); } catch(e) { console.error('[WWO] initCables failed:', e); }

  try { initRadiation(map); } catch(e) { console.error('[WWO] initRadiation failed:', e); }

  try { initTerrorEvents(map); } catch(e) { console.error('[WWO] initTerrorEvents failed:', e); }

  try { initWindParticles(map); } catch(e) { console.error('[WWO] initWindParticles failed:', e); }

  // Initialize click handlers and flight filter
  try { initClicks(map); } catch(e) { console.error('[WWO] initClicks failed:', e); }

  // Initialize weather click handlers (after map layers exist)
  try { initWeatherClicks(map); } catch(e) { console.error('[WWO] initWeatherClicks failed:', e); }

  // Coordinate display (map must exist)
  map.on('move',()=>{const c=map.getCenter();document.getElementById('vz').textContent=map.getZoom().toFixed(2);document.getElementById('vla').textContent=c.lat.toFixed(4);document.getElementById('vlo').textContent=c.lng.toFixed(4);});
  map.on('mousemove',e=>document.getElementById('mc').textContent=`${e.lngLat.lat.toFixed(4)} , ${e.lngLat.lng.toFixed(4)}`);

  document.getElementById('fc').textContent='--';
  document.getElementById('sf').textContent='--';
  document.getElementById('sc2').textContent='...';
  document.getElementById('ss2').textContent='...';
  document.getElementById('cc2').textContent=CONF.length;
  document.getElementById('se').textContent=CONF.length;
  document.getElementById('kc').textContent=CAMS.length;

  // ANIMATION — sats only
  setInterval(()=>{const s=map.getSource('sats');if(s)s.setData({type:"FeatureCollection",features:mkSP()});},2000);

  // ---- FLIGHT TYPE FILTER ----
  window.flightFilter={com:true,mil:true,light:true};
  window.filterFlights=function(){
    window.flightFilter.com=document.getElementById('ft-com').checked;
    window.flightFilter.mil=document.getElementById('ft-mil').checked;
    window.flightFilter.light=document.getElementById('ft-light').checked;
    const feats=mkOpenSkyFeatures();
    const src=map.getSource('flights');
    if(src)src.setData({type:'FeatureCollection',features:feats});
    const total=feats.length;
    document.getElementById('fc').textContent=total.toLocaleString();
    document.getElementById('sf').textContent=total.toLocaleString();
    console.log('[WWO] Flight filter applied: COM='+window.flightFilter.com+' MIL='+window.flightFilter.mil+' LIGHT='+window.flightFilter.light+' showing='+total);
  };

  window.filterCams=function(){
    const feats=mkCP();
    const src=map.getSource('cams');
    if(src)src.setData({type:'FeatureCollection',features:feats});
    document.getElementById('kc').textContent=feats.length;
  };

  // OpenSky live flight poll
  fetchOpenSky();
  let oskyInterval=60000;
  let oskyBackoff=0;
  let oskyTimer=setInterval(fetchOpenSky,oskyInterval);
  function oskySchedule(ok){
    clearInterval(oskyTimer);
    if(ok){oskyBackoff=0;oskyInterval=60000;}
    else{oskyBackoff=Math.min(oskyBackoff+1,5);oskyInterval=60000*Math.pow(1.5,oskyBackoff);}
    oskyTimer=setInterval(fetchOpenSky,oskyInterval);
    console.log(`[WWO] OpenSky next poll in ${Math.round(oskyInterval/1000)}s (backoff=${oskyBackoff})`);
  }

  // CelesTrak TLE fetch
  fetchCelesTrak();
  setInterval(fetchCelesTrak,2*60*60*1000);

  // Kick off Wikipedia live sync (non-blocking)
  fetchWikiSummaries();

  // Apply CTRL green paints to base map first, then toggle to NERV
  baseLayerIds.forEach(id=>{try{const l=map.getLayer(id);if(!l)return;const t=l.type;
    const cp=ctrlPaints[t];if(cp)Object.entries(cp).forEach(([k,v])=>{try{map.setPaintProperty(id,k,v);}catch(e){}});
    if(id.includes('water')||t==='fill'&&id.includes('ocean')){try{map.setPaintProperty(id,'fill-color','#043d1e');}catch(e){}}
  }catch(e){}});
  try{map.setFog({color:'rgba(255,80,0,0.9)',"high-color":'rgba(0,100,40,0.9)',"horizon-blend":0.08,"space-color":'#000000',"star-intensity":0.3});}catch(e){}
  // Now switch to NERV mode (default)
  togNerv();
});



// ====== LAYER TOGGLES ======
var lMap={
  flights:['fl-lyr','fl-glow','fl-emerg'],
  sats:['sat-lyr'],
  conf:['cheat','ccore'],
  cams:['cam-dot','cam-glow'],
  fronts:['fronts-fill','fronts-line','fronts-border'],
  outages:['outage-fill','outage-hatch','outage-border'],
  quakes:['eq-ring-0','eq-ring-1','eq-ring-2','eq-core','eq-label'],
  floods:['flood-glow','flood-dot'],
  'nws-alerts':['nws-fill','nws-line','nws-label'],
};
function togL(el){
  const l=el.dataset.l;
  layerVis[l]=!layerVis[l];
  el.classList.toggle('on');
  if(lMap[l])lMap[l].forEach(id=>{try{map.setLayoutProperty(id,'visibility',layerVis[l]?'visible':'none');}catch(e){}});
  if(l==='osint')document.getElementById('pr').style.display=layerVis.osint?'flex':'none';
  if(l==='outages'&&typeof setOutageVis==='function')setOutageVis(layerVis.outages);
}
function togWindParticles(el){el.classList.toggle('on');const vis=el.classList.contains('on');if(typeof setWindParticlesVisible==='function')setWindParticlesVisible(vis);}
