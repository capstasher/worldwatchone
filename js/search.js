// ====== SEARCH ======
const si=document.getElementById('si'),srE=document.getElementById('sr');let sIdx=[];
function buildSI(){
  sIdx=[];
  // Live aircraft from OpenSky
  liveAC.forEach((ac,icao)=>{
    const cs=(ac.callsign||'').trim()||icao;
    const mil=isMilitary(ac.callsign);
    sIdx.push({ty:mil?'ml':'fl',lb:`${cs} (${ac.origin_country||'?'})`,sub:icao,icao});
  });
  SATS.forEach((s,i)=>sIdx.push({ty:'st',lb:s.name,sub:`NORAD ${s.norad}`,id:s.norad}));
  // Also add all CelesTrak-fetched sats not in SATS
  tleData.forEach((td,norad)=>{
    if(SATS.some(s=>s.norad===norad))return;
    sIdx.push({ty:'st',lb:td.name,sub:`NORAD ${norad}`,id:norad});
  });
  CONF.forEach((c,i)=>sIdx.push({ty:'cn',lb:c.name,sub:c.type,id:i}));
  CAMS.forEach((c,i)=>sIdx.push({ty:'cm',lb:`${c.name} (${c.city})`,sub:c.id,id:i}));
}
buildSI();
si.addEventListener('input',()=>{const q=si.value.toLowerCase().trim();if(!q){srE.style.display='none';return;}const m=sIdx.filter(s=>s.lb.toLowerCase().includes(q)||s.sub.toLowerCase().includes(q)).slice(0,12);if(!m.length){srE.style.display='none';return;}srE.innerHTML=m.map(x=>`<div class="sri" data-t="${x.ty}" data-i="${x.id||''}" data-icao="${x.icao||''}" data-mmsi="${x.mmsi||''}"><span class="stag ${x.ty}">${{fl:'FLIGHT',ml:'MIL',st:'SAT',cn:'CONFLICT',cm:'CAM'}[x.ty]||x.ty}</span>${x.lb}</div>`).join('');srE.style.display='block';srE.querySelectorAll('.sri').forEach(el=>el.addEventListener('click',()=>{const t=el.dataset.t,id=+el.dataset.i,icao=el.dataset.icao,mmsi=el.dataset.mmsi;srE.style.display='none';si.value='';if(t==='fl'||t==='ml'){const ac=liveAC.get(icao);if(ac&&ac.lon!=null)map.flyTo({center:[ac.lon,ac.lat],zoom:6,duration:1200});setTimeout(()=>showFlightD(icao),1300);}else if(t==='st'){const sp=realSatPos({norad:id});if(sp)map.flyTo({center:sp,zoom:4,duration:1200});setTimeout(()=>showSatD(id),1300);}else if(t==='cn'){map.flyTo({center:[CONF[id].lng,CONF[id].lat],zoom:6,duration:1200});setTimeout(()=>showConfD(id),1300);}else if(t==='cm'){map.flyTo({center:[CAMS[id].lng,CAMS[id].lat],zoom:12,duration:1200});setTimeout(()=>showCamD(id),1300);}}));});
si.addEventListener('blur',()=>setTimeout(()=>srE.style.display='none',200));

