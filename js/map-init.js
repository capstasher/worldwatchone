// ====== MAP INIT — MapLibre setup, sources, layers, init orchestration ======

// ====== MAP ======
const map=new maplibregl.Map({container:'map',style:'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',center:[30,20],zoom:2.2,minZoom:1,maxZoom:20,attributionControl:false,maxPitch:70,projection:'globe'});
map.on('style.load',()=>{try{map.setProjection({type:'globe'});}catch(e){try{map.setProjection('globe');}catch(e2){}}try{map.setFog({color:'rgba(60,28,4,1)',"high-color":'rgba(80,35,6,1)',"horizon-blend":0.06,"space-color":'#1a0c00',"star-intensity":0.2});}catch(e){}});

// These are window-globals so all modules can access them
var nervMode=false;
var layerVis={flights:true,sats:true,conf:true,cams:true,osint:true,fronts:true,outages:true,quakes:true,fires:true,storms:true,volcanoes:true,tsunamis:true};
var baseLayerIds=[];// will store carto's own layer IDs — global for nerv-ctrl.js


map.on('load',()=>{
  // Snapshot Carto's base layer IDs before we add ours
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
  // Subtle fill shading — color scales with conflict intensity
  map.addLayer({id:'fronts-fill',type:'fill',source:'frontlines',paint:{
    'fill-color':['interpolate',['linear'],['get','int'],
      0.4,'rgba(160,60,0,0.06)',
      0.65,'rgba(200,40,0,0.10)',
      0.85,'rgba(230,20,0,0.14)',
      1.0,'rgba(255,0,0,0.18)'
    ],
    'fill-opacity':1
  }});
  // Dashed frontline perimeter border
  map.addLayer({id:'fronts-line',type:'line',source:'frontlines',paint:{
    'line-color':['interpolate',['linear'],['get','int'],
      0.4,'rgba(200,90,0,0.45)',
      0.65,'rgba(220,50,0,0.58)',
      0.85,'rgba(240,20,0,0.70)',
      1.0,'rgba(255,10,0,0.82)'
    ],
    'line-width':['interpolate',['linear'],['zoom'],1,1.0,5,1.8,10,2.5],
    'line-dasharray':[5,3.5]
  }});
  // Subtle outer glow line
  map.addLayer({id:'fronts-border',type:'line',source:'frontlines',paint:{
    'line-color':['interpolate',['linear'],['get','int'],
      0.4,'rgba(200,80,0,0.08)',
      1.0,'rgba(255,30,0,0.12)'
    ],
    'line-width':['interpolate',['linear'],['zoom'],1,6,5,10,10,16],
    'line-blur':4
  }});

  // CONFLICT HEATGLOW (above frontlines)
  map.addSource('conf-heat',{type:'geojson',data:{type:"FeatureCollection",features:confPts}});
  map.addLayer({id:'cheat',type:'circle',source:'conf-heat',paint:{'circle-radius':['interpolate',['linear'],['get','int'],0.2,20,1.0,65],'circle-color':['interpolate',['linear'],['get','int'],0.2,'rgba(200,120,0,0.03)',0.5,'rgba(200,60,0,0.07)',0.8,'rgba(220,30,0,0.12)',1.0,'rgba(255,0,0,0.17)'],'circle-blur':1}});
  // Conflict core dots (above frontlines)
  map.addSource('conf-core',{type:'geojson',data:{type:"FeatureCollection",features:confPts}});
  map.addLayer({id:'ccore',type:'circle',source:'conf-core',paint:{'circle-radius':['interpolate',['linear'],['get','int'],0.2,4,1.0,9],'circle-color':['interpolate',['linear'],['get','int'],0.25,'#cc8800',0.55,'#dd5500',0.8,'#dd2200',1.0,'#ff0000'],'circle-opacity':0.9,'circle-stroke-width':2,'circle-stroke-color':['interpolate',['linear'],['get','int'],0.25,'#cc8800',1.0,'#ff0000'],'circle-stroke-opacity':0.3}});

  // CAMERAS
  map.addSource('cams',{type:'geojson',data:{type:"FeatureCollection",features:mkCP()}});
  map.addLayer({id:'cam-glow',type:'circle',source:'cams',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,10,8,20],'circle-color':['case',['==',['get','region'],'uk'],'#ffaa00','#00ff88'],'circle-opacity':0.06,'circle-blur':1}});
  map.addLayer({id:'cam-dot',type:'circle',source:'cams',paint:{'circle-radius':['interpolate',['linear'],['zoom'],1,3,8,6,14,9],'circle-color':['case',['==',['get','region'],'uk'],'#ffaa00','#00ff88'],'circle-opacity':0.85,'circle-stroke-width':2,'circle-stroke-color':['case',['==',['get','region'],'uk'],'#ffaa00','#00ff88'],'circle-stroke-opacity':0.25}});

  // SATELLITES
  map.addSource('sats',{type:'geojson',data:{type:"FeatureCollection",features:mkSP()}});
  map.addLayer({id:'sat-lyr',type:'symbol',source:'sats',layout:{'icon-image':'s-icon','icon-size':['interpolate',['linear'],['zoom'],1,0.6,6,0.85,12,1],'icon-allow-overlap':true,'icon-ignore-placement':true}});

  // ---- SHIPS (AIS) ----


  // Initialize earthquake tracker
  initEarthquakes(map);

  // Initialize weather tile layers + disaster pins
  initWeather(map);

  // Initialize click handlers and flight filter
  initClicks(map);

  // Initialize weather click handlers (after map layers exist)
  initWeatherClicks(map);

  // Coordinate display (map must exist)
  map.on('move',()=>{const c=map.getCenter();document.getElementById('vz').textContent=map.getZoom().toFixed(2);document.getElementById('vla').textContent=c.lat.toFixed(4);document.getElementById('vlo').textContent=c.lng.toFixed(4);});
  map.on('mousemove',e=>document.getElementById('mc').textContent=`${e.lngLat.lat.toFixed(4)} , ${e.lngLat.lng.toFixed(4)}`);

  document.getElementById('fc').textContent='--';   // updated live by fetchOpenSky()
  document.getElementById('sf').textContent='--';   // updated live by fetchOpenSky()
  document.getElementById('sc2').textContent='...';
  document.getElementById('ss2').textContent='...';
  document.getElementById('cc2').textContent=CONF.length;
  document.getElementById('se').textContent=CONF.length;
  document.getElementById('kc').textContent=CAMS.length;

  // ANIMATION — sats only; flights driven by OpenSky poll; cams are still images
  setInterval(()=>{const s=map.getSource('sats');if(s)s.setData({type:"FeatureCollection",features:mkSP()});},2000);

  // ---- FLIGHT TYPE FILTER ----
  // OpenSky category field (index 16): 0=No info, 1=No ADS-B, 2=Light<15500lb, 3=Small<75000lb,
  // 4=Large, 5=High Vortex, 6=Heavy, 7=High Performance, 8=Rotorcraft, 9-13=Glider/Balloon/etc
  // We classify: MIL = matches MIL_PREFIXES callsign, LIGHT = category 2-3 or rotorcraft(8), COM = everything else
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
  // Authenticated: 4000 credits/day → can poll every ~22s safely
  // Poll every 60 seconds as baseline (comfortable margin), with exponential backoff on errors
  let oskyInterval=60000;// 60 seconds
  let oskyBackoff=0;
  let oskyTimer=setInterval(fetchOpenSky,oskyInterval);
  function oskySchedule(ok){
    clearInterval(oskyTimer);
    if(ok){oskyBackoff=0;oskyInterval=60000;}
    else{oskyBackoff=Math.min(oskyBackoff+1,5);oskyInterval=60000*Math.pow(1.5,oskyBackoff);}
    oskyTimer=setInterval(fetchOpenSky,oskyInterval);
    console.log(`[WWO] OpenSky next poll in ${Math.round(oskyInterval/1000)}s (backoff=${oskyBackoff})`);
  }

  // CelesTrak TLE fetch — on load then refresh every 2 hours (TLEs update infrequently)
  fetchCelesTrak();
  setInterval(fetchCelesTrak,2*60*60*1000);

  // Kick off Wikipedia live sync (non-blocking)
  fetchWikiSummaries();

  // Apply CTRL green paints to base map first, then toggle to NERV
  baseLayerIds.forEach(id=>{try{const l=map.getLayer(id);if(!l)return;const t=l.type;
    const cp=ctrlPaints[t];if(cp)Object.entries(cp).forEach(([k,v])=>{try{map.setPaintProperty(id,k,v);}catch(e){}});
    if(id.includes('water')||t==='fill'&&id.includes('ocean')){try{map.setPaintProperty(id,'fill-color','#043d1e');}catch(e){}}
  }catch(e){}});
  try{map.setFog({color:'rgba(4,28,14,1)',"high-color":'rgba(6,35,18,1)',"horizon-blend":0.06,"space-color":'#000c1a',"star-intensity":0.2});}catch(e){}
  // Now switch to NERV mode (default)
  togNerv();
});



// ====== LAYER TOGGLES ======
var lMap={flights:['fl-lyr','fl-glow','fl-emerg'],sats:['sat-lyr'],conf:['cheat','ccore'],cams:['cam-dot','cam-glow'],fronts:['fronts-fill','fronts-line','fronts-border'],outages:['outage-glow','outage-dot','outage-label'],quakes:['eq-ring-0','eq-ring-1','eq-ring-2','eq-core','eq-label']};
function togL(el){const l=el.dataset.l;layerVis[l]=!layerVis[l];el.classList.toggle('on');if(lMap[l])lMap[l].forEach(id=>{try{map.setLayoutProperty(id,'visibility',layerVis[l]?'visible':'none');}catch(e){}});if(l==='osint')document.getElementById('pr').style.display=layerVis.osint?'flex':'none';}
