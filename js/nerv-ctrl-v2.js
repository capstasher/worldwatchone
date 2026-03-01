// ====== NERV / CTRL MODE ======
// NERV: amber/orange theme. CTRL: green theme. Both repaint Carto base layers.
const nervPaints={
  fill:{'fill-color':'#1a0e02','fill-outline-color':'#a05818'},
  line:{'line-color':'rgba(240,150,30,0.75)','line-width':1.5},
  background:{'background-color':'#1c0d00'},
  symbol:{'text-color':'rgba(220,150,50,0.55)','text-halo-color':'rgba(8,5,0,0.9)','icon-color':'rgba(220,150,50,0.55)'},
};
const ctrlPaints={
  fill:{'fill-color':'#021a08','fill-outline-color':'#18a058'},
  line:{'line-color':'rgba(1,168,52,0.75)','line-width':1.5},
  background:{'background-color':'#001c0d'},
  symbol:{'text-color':'rgba(1,200,70,0.55)','text-halo-color':'rgba(0,5,2,0.9)','icon-color':'rgba(1,200,70,0.55)'},
};
let nervCached=false;
function togNerv(){
  nervMode=!nervMode;document.body.classList.toggle('nerv',nervMode);
  // Update overlay text
  const ntEl=document.querySelector('#no .nt');
  const nsEl=document.querySelector('#no .ns');
  const ncTL=document.querySelector('#no .nc.tl');
  const ncTR=document.querySelector('#no .nc.tr');
  const ncBL=document.querySelector('#no .nc.bl');
  const ncBR=document.querySelector('#no .nc.br');
  if(nervMode){
    if(ntEl)ntEl.textContent='NERV';
    if(nsEl)nsEl.textContent="GOD'S IN HIS HEAVEN. ALL'S RIGHT WITH THE WORLD.";
    if(ncTL)ncTL.textContent='SEC-01 // MAGI SURVEILLANCE SYSTEM';
    if(ncTR)ncTR.textContent='PATTERN BLUE // ALL SYSTEMS NOMINAL';
    if(ncBL)ncBL.textContent='CASPER-3 // BALTHASAR-2 // MELCHIOR-1';
    if(ncBR)ncBR.textContent='PRIBNOW LINE: STABLE';
  }else{
    if(ntEl)ntEl.textContent='CTRL';
    if(nsEl)nsEl.textContent='YOU CAN JUST DO THINGS. DIVINE WILL FLOWS WITHIN YOU.';
    if(ncTL)ncTL.textContent='SEC-01 // DIVERGENCE METER ONLINE';
    if(ncTR)ncTR.textContent='ATTRACTOR FIELD // DIVERGENCE '+liveDivergence;
    if(ncBL)ncBL.textContent='IBN-5100 // PHONEWAVE (TEMP) // D-MAIL';
    if(ncBR)ncBR.textContent='WORLDLINE: STABLE';
  }
  // Update button label
  const btn=document.querySelector('.nerv-btn');
  if(btn)btn.textContent=nervMode?'CTRL':'NERV';
  // Recolour outage overlay to match NERV/CTRL theme
  if(typeof outageThemeUpdate === 'function') outageThemeUpdate();
  // Cache normal paints on first toggle
  if(!nervCached){
    baseLayerIds.forEach(id=>{try{const l=map.getLayer(id);if(!l)return;const t=l.type;
    // We're caching CTRL mode paints as the "base" since CTRL applies on map load
    // But actually we need to cache the raw Carto paints before any mode is applied
    // Since CTRL paints are applied at init, we don't cache — we just use ctrlPaints to restore
    }catch(e){}});nervCached=true;}
  const activePaints=nervMode?nervPaints:ctrlPaints;
  baseLayerIds.forEach(id=>{try{const l=map.getLayer(id);if(!l)return;const t=l.type;
    const np=activePaints[t];if(np)Object.entries(np).forEach(([k,v])=>{try{map.setPaintProperty(id,k,v);}catch(e){}});
    if(id.includes('water')||t==='fill'&&id.includes('ocean')){
      try{map.setPaintProperty(id,'fill-color',nervMode?'#3d1e04':'#043d1e');}catch(e){}}
  }catch(e){}});
  try{map.setFog(nervMode?
    {color:'rgba(255,90,0,0.9)',"high-color":'rgba(0,120,40,0.85)',"horizon-blend":0.08,"space-color":'#000000',"star-intensity":0.3}:
    {color:'rgba(255,80,0,0.9)',"high-color":'rgba(0,100,40,0.9)',"horizon-blend":0.08,"space-color":'#000000',"star-intensity":0.3}
  );}catch(e){}
}

// ====== DIVERGENCE METER ======
let liveDivergence='1.048596';
async function fetchDivergence(){
  try{
    const r=await fetch('https://divergence.nyarchlinux.moe/api/divergence',{signal:AbortSignal.timeout(8000)});
    if(!r.ok)return;
    const d=await r.json();
    let v=String(d.divergence);
    if(v.includes('.')){const[i,dec]=v.split('.');v=i+'.'+dec.slice(0,6);}
    liveDivergence=v;
    // Update the corner if in CTRL mode
    if(!nervMode){
      const el=document.querySelector('#no .nc.tr');
      if(el)el.textContent='ATTRACTOR FIELD // DIVERGENCE '+liveDivergence;
    }
  }catch(e){}
}
fetchDivergence();
setInterval(fetchDivergence,60*1000);// refresh every minute


// ====== CRT COLOUR FILTER ======
let crtMode = false;
function togCRT() {
  crtMode = !crtMode;
  const wrap = document.getElementById('crt-wrap');
  if (wrap) wrap.classList.toggle('crt', crtMode);
  // Persist preference
  try { localStorage.setItem('wwo_crt', crtMode ? '1' : '0'); } catch(e) {}
}
// Restore on load
try { if (localStorage.getItem('wwo_crt') === '1') { crtMode = true; const w=document.getElementById('crt-wrap'); if(w)w.classList.add('crt'); } } catch(e) {}
