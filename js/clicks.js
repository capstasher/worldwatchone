// ====== CLICKS — Unified click handler, cursor management, flight filter ======

// Called from app.js inside map.on('load')
function initClicks(map) {

// ---- CLICK HANDLERS (12px bbox buffer for easy targeting) ----
const HIT=12;// pixel radius around click point
function bbox(e){return[[e.point.x-HIT,e.point.y-HIT],[e.point.x+HIT,e.point.y+HIT]];}
map.on('click',e=>{
  // Priority order: flights > sats > conf dots > cams > earthquakes
  let f;
  f=map.queryRenderedFeatures(bbox(e),{layers:['fl-lyr']});
  if(f.length){showFlightD(f[0].properties.icao);return;}
  f=map.queryRenderedFeatures(bbox(e),{layers:['sat-lyr']});
  if(f.length){showSatD(f[0].properties.norad);return;}
  f=map.queryRenderedFeatures(bbox(e),{layers:['ccore']});
  if(f.length){showConfD(f[0].properties.id);return;}
  f=map.queryRenderedFeatures(bbox(e),{layers:['cam-dot']});
  if(f.length){showCamD(f[0].properties.id);return;}
  // Earthquake — query core dots AND ring layers for wider hit area
  f=map.queryRenderedFeatures(bbox(e),{layers:['eq-core','eq-ring-0','eq-ring-1','eq-ring-2']});
  if(f.length){
    // Prefer core feature if available, otherwise use ring feature coords
    const core=f.find(ft=>ft.layer.id==='eq-core')||f[0];
    const p=core.properties;
    const coords=core.geometry.coordinates;
    const timeStr=new Date(p.time).toLocaleString();
    const mag=p.mag||0;
    const [cr,cg,cb]=eqColor(mag);
    const cc='rgb('+cr+','+cg+','+cb+')';
    const ageMin=Math.round((Date.now()-p.time)/60000);
    const ageTxt=ageMin<60?ageMin+'m ago':Math.round(ageMin/60)+'h '+ageMin%60+'m ago';
    new maplibregl.Popup({className:'eq-popup',maxWidth:'280px',closeButton:true})
      .setLngLat(coords)
      .setHTML(`<div class="eq-hdr"><span class="eq-mag" style="color:${cc}">M${mag}</span><span class="eq-type">EARTHQUAKE</span></div>
        <div class="eq-body">
          <div class="eq-place">${p.place||'Unknown location'}</div>
          <div class="eq-row"><span>DEPTH</span><span>${p.depth||'?'} km</span></div>
          <div class="eq-row"><span>SIGNIFICANCE</span><span>${p.sig||'?'}</span></div>
          <div class="eq-row"><span>TIME</span><span>${ageTxt}</span></div>
          <div class="eq-row"><span>UTC</span><span>${timeStr}</span></div>
          ${p.url?'<a class="eq-link" href="'+p.url+'" target="_blank" style="color:'+cc+'">USGS DETAIL →</a>':''}
        </div>`)
      .addTo(map);
    return;
  }
});
// Cursor changes — also use bbox so pointer appears before you're pixel-perfect
map.on('mousemove',e=>{
  const hit=['fl-lyr','sat-lyr','ccore','cam-dot','eq-core'];
  const f=map.queryRenderedFeatures(bbox(e),{layers:hit});
  map.getCanvas().style.cursor=f.length?'pointer':'crosshair';
});

// FRONTLINE HOVER TOOLTIP + unified cursor handler
const fzTip=document.getElementById('fz-tip');
let fzActive=false;
const hitLayers=['fl-lyr','sat-lyr','ccore','cam-dot'];
map.on('mousemove',e=>{
  // Dot cursor — takes priority over frontline hover
  const dotHit=map.queryRenderedFeatures([[e.point.x-HIT,e.point.y-HIT],[e.point.x+HIT,e.point.y+HIT]],{layers:hitLayers});
  if(dotHit.length){map.getCanvas().style.cursor='pointer';fzTip.classList.remove('show');fzActive=false;return;}
  // Frontline zone hover
  if(!layerVis.fronts){map.getCanvas().style.cursor='crosshair';return;}
  const zoneHit=map.queryRenderedFeatures(e.point,{layers:['fronts-fill']});
  if(!zoneHit.length){fzTip.classList.remove('show');fzActive=false;map.getCanvas().style.cursor='crosshair';return;}
  fzActive=true;
  map.getCanvas().style.cursor='crosshair';
  const p=zoneHit[0].properties;
  const col=confCol(p.int);
  const threat=p.int>0.75?'CRITICAL':p.int>0.5?'ELEVATED':'WATCH';
  const threatCol=p.int>0.75?'#ee1100':p.int>0.5?'#dd5500':'#cc8800';
  document.getElementById('fzt-name').textContent=p.name;
  document.getElementById('fzt-badge').textContent=threat;
  document.getElementById('fzt-badge').style.cssText=`background:${threatCol}22;color:${threatCol};border:1px solid ${threatCol}55;`;
  document.getElementById('fzt-type').textContent=p.type;
  document.getElementById('fzt-int').textContent=(Math.round(p.int*100))+'%';
  document.getElementById('fzt-int').style.color=col;
  document.getElementById('fzt-threat').textContent=threat;
  document.getElementById('fzt-threat').style.color=threatCol;
  document.getElementById('fzt-disp').textContent=p.disp||'N/A';
  document.getElementById('fzt-ev').textContent=p.events||'--';
  const live=wikiCache[p.wikiKey];
  const srcLbl=document.getElementById('fzt-src-lbl');
  const wikiLink=document.getElementById('fzt-wiki');
  if(live){
    document.getElementById('fzt-sum').textContent=live.summary;
    srcLbl.textContent='SRC: WIKIPEDIA // '+live.timestamp;
    srcLbl.className='fzt-src-lbl live';
    if(live.wikiUrl){wikiLink.href=live.wikiUrl;wikiLink.style.display='inline';}
    else{wikiLink.style.display='none';}
  }else{
    document.getElementById('fzt-sum').textContent=p.summary||'';
    srcLbl.textContent='SRC: STATIC // SYNCING…';
    srcLbl.className='fzt-src-lbl';
    wikiLink.style.display='none';
  }
  const mx=e.originalEvent.clientX,my=e.originalEvent.clientY;
  const tw=fzTip.offsetWidth||260,th=fzTip.offsetHeight||180;
  const vw=window.innerWidth,vh=window.innerHeight;
  let tx=mx+14,ty=my-10;
  if(tx+tw>vw-10)tx=mx-tw-14;
  if(ty+th>vh-10)ty=my-th+10;
  fzTip.style.left=tx+'px';fzTip.style.top=ty+'px';
  fzTip.classList.add('show');
});
// Hide tooltip when leaving the map canvas entirely
map.getCanvas().addEventListener('mouseleave',()=>{fzTip.classList.remove('show');fzActive=false;});

// STATS
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
}
