// ====== EARTHQUAKES — USGS feed, ring animation, magnitude coloring ======

// eqColor is module-scope so clicks.js can access it (briefing requirement)
function eqColor(mag){
  if(mag<3)return[0,220,100];
  if(mag<4)return[120,220,50];
  if(mag<5)return[230,200,0];
  if(mag<6)return[240,140,0];
  if(mag<7)return[230,60,0];
  return[220,0,0];
}

// initEarthquakes(map) is called from map-init.js after map load
function initEarthquakes(map) {

// Earthquake tracker initialization
console.log('[WWO] Earthquake tracker: initializing...');
const USGS_FEED='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
let eqData=[];

const EQ_MAG_COLOR=['interpolate',['linear'],['get','mag'],
  0,'#00dc64', 3,'#78dc32', 4,'#e6c800', 5,'#f08c00', 6,'#e63c00', 7,'#dc0000'];

// One source per wave ring + one for cores
const WAVE_N=3;
for(let w=0;w<WAVE_N;w++){
  map.addSource('eq-ring-'+w,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({
    id:'eq-ring-'+w, type:'circle', source:'eq-ring-'+w,
    paint:{
      'circle-color':'transparent',
      'circle-radius':['get','r'],
      'circle-stroke-color':EQ_MAG_COLOR,
      'circle-stroke-width':['interpolate',['linear'],['get','mag'],2,1,5,1.5,7,2.5],
      'circle-stroke-opacity':['get','op'],
    }
  },'fl-glow');
}

map.addSource('eq-pts',{type:'geojson',data:{type:'FeatureCollection',features:[]}});

// Epicenter core dot
map.addLayer({
  id:'eq-core',type:'circle',source:'eq-pts',
  paint:{
    'circle-radius':['interpolate',['linear'],['get','mag'],2,3,4,5,5,7,6,10,7,14,8,20],
    'circle-color':EQ_MAG_COLOR,
    'circle-opacity':['get','coreOp'],
    'circle-stroke-width':1.5,
    'circle-stroke-color':EQ_MAG_COLOR,
    'circle-stroke-opacity':['*',['get','coreOp'],0.4],
  }
});

// Labels for significant quakes (M4+)
map.addLayer({
  id:'eq-label',type:'symbol',source:'eq-pts',
  filter:['>=',['get','mag'],4],
  layout:{
    'text-field':['concat','M',['to-string',['get','mag']],' — ',['get','place']],
    'text-size':['interpolate',['linear'],['get','mag'],4,9,6,11,8,14],
    'text-font':['DIN Pro Medium','Arial Unicode MS Regular'],
    'text-offset':[0,1.5],
    'text-allow-overlap':false,
  },
  paint:{
    'text-color':EQ_MAG_COLOR,
    'text-halo-color':'rgba(0,0,0,0.85)',
    'text-halo-width':1.5,
  }
});

// Max pixel radius per ring based on magnitude
function eqMaxR(mag){return Math.pow(mag,1.8)*3;}

// Animation: update ring sources with current phase radii/opacities at 10fps
const CYCLE_MS=4000;
let eqAnimId=null;
// Set core point source — called once on fetch, not every animation frame
function updateEqCores(){
  const corePts=eqData.map(eq=>{
    const mag=eq.properties.mag||0;
    const c=eq.geometry.coordinates;
    const ageHrs=(Date.now()-eq.properties.time)/3600000;
    return{
      type:'Feature',
      geometry:{type:'Point',coordinates:[c[0],c[1]]},
      properties:{mag,coreOp:Math.max(0.3,Math.max(0.15,1-ageHrs/24)),place:eq.properties.place||'',time:eq.properties.time,url:eq.properties.url||'',sig:eq.properties.sig||0,depth:c[2]||0}
    };
  });
  const cs=map.getSource('eq-pts');
  if(cs)cs.setData({type:'FeatureCollection',features:corePts});
}

function animateEQ(){
  if(!layerVis.quakes||eqData.length===0){eqAnimId=setTimeout(animateEQ,250);return;}
  const now=performance.now();

  const ringPts=[];
  for(let w=0;w<WAVE_N;w++)ringPts.push([]);

  eqData.forEach(eq=>{
    const mag=eq.properties.mag||0;
    const c=eq.geometry.coordinates;
    const ageHrs=(Date.now()-eq.properties.time)/3600000;
    const ageFade=Math.max(0.15,1-ageHrs/24);
    const maxR=eqMaxR(mag);

    for(let w=0;w<WAVE_N;w++){
      const phase=((now%CYCLE_MS)/CYCLE_MS+(w/WAVE_N))%1;
      const r=phase*maxR;
      const op=Math.sin(phase*Math.PI)*0.65*ageFade;
      if(op<0.02)continue;
      ringPts[w].push({
        type:'Feature',
        geometry:{type:'Point',coordinates:[c[0],c[1]]},
        properties:{mag,r,op,place:eq.properties.place||'',time:eq.properties.time,url:eq.properties.url||'',sig:eq.properties.sig||0,depth:c[2]||0}
      });
    }
  });

  try{
    for(let w=0;w<WAVE_N;w++){
      const s=map.getSource('eq-ring-'+w);
      if(s)s.setData({type:'FeatureCollection',features:ringPts[w]});
    }
  }catch(e){console.warn('[WWO] EQ anim error:',e);}

  eqAnimId=setTimeout(animateEQ,100);// 10fps
}
console.log('[WWO] Earthquake tracker: layers created, starting animation');
animateEQ();

// Fetch earthquake data
async function fetchEarthquakes(){
  try{
    let geo=null;
    // Try direct first (USGS sends CORS *), then proxy fallback
    const urls=[
      USGS_FEED,
      PROXY(USGS_FEED),
    ];
    for(const u of urls){
      try{
        const r=await fetch(u,{signal:AbortSignal.timeout(12000)});
        if(!r.ok)continue;
        geo=await r.json();
        if(geo&&geo.features)break;
      }catch(e){console.warn('[WWO] EQ fetch attempt failed:',e.message);continue;}
    }
    if(!geo||!geo.features){console.warn('[WWO] EQ: all fetch methods failed');return;}
    eqData=geo.features;
    // Sort: biggest magnitude first for rendering priority
    eqData.sort((a,b)=>(b.properties.mag||0)-(a.properties.mag||0));
    updateEqCores();
    console.log('[WWO] Earthquakes: '+eqData.length+' events (M2.5+ past 24h)');
    const el=document.getElementById('eqc');
    if(el)el.textContent=eqData.length;
    // Inject significant quakes into OSINT feed
    eqData.filter(eq=>(eq.properties.mag||0)>=5).forEach(eq=>{
      const p=eq.properties;
      addLiveItem('🌋 M'+p.mag+' EARTHQUAKE: '+(p.place||'Unknown'),
        'USGS',new Date(p.time).toISOString(),
        p.url||'https://earthquake.usgs.gov','MULTI','al',false);
    });
  }catch(e){
    console.warn('[WWO] Earthquake fetch error:',e.message);
  }
}
fetchEarthquakes();
setInterval(fetchEarthquakes,5*60*1000);// refresh every 5 mins


}
