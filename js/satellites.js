// ====== CELESTRAK LIVE SATELLITE TRACKING ======
// Fetches real TLEs from CelesTrak GP API (free, no key, CORS-enabled)
// Uses satellite.js SGP4 propagator for mathematically accurate positions
// NO simulation fallback — if CelesTrak fails, satellites simply don't show
const tleData=new Map(); // norad → {name, tle1, tle2, satrec, altKm, inc, per}

// CelesTrak GP API: fetch by GROUP (returns all sats in category as 3-line TLE)
// Groups: stations, visual, active, military, gps-ops, noaa, starlink, resource, weather
// Also fetch individual CATNR for specific known sats not in small groups
const CELESTRAK_GROUPS=['stations','visual','military','gps-ops','noaa','resource'];
const CELESTRAK_BASE='https://celestrak.org/NORAD/elements/gp.php';

// Purpose labels for known operators/names
function guessPurpose(name){
  const n=name.toUpperCase();
  if(n.includes('STARLINK'))return'Comms (Starlink)';
  if(n.includes('GPS')||n.includes('NAVSTAR'))return'Navigation';
  if(n.includes('GOES')||n.includes('NOAA')||n.includes('METEOSAT')||n.includes('HIMAWARI'))return'Weather';
  if(n.includes('COSMOS')||n.includes('USA ')||n.includes('NROL'))return'Military/Intel';
  if(n.includes('LANDSAT')||n.includes('SENTINEL')||n.includes('WORLDVIEW'))return'Earth Obs';
  if(n.includes('HUBBLE')||n.includes('JWST')||n.includes('CHANDRA'))return'Space Telescope';
  if(n.includes('ISS')||n.includes('ZARYA')||n.includes('TIANGONG')||n.includes('CSS'))return'Space Station';
  if(n.includes('IRIDIUM'))return'Comms (Iridium)';
  if(n.includes('ONEWEB'))return'Comms (OneWeb)';
  if(n.includes('GLOBALSTAR')||n.includes('ORBCOMM'))return'Comms';
  if(n.includes('RADARSAT')||n.includes('COSMO'))return'SAR Imaging';
  if(n.includes('GALILEO'))return'Navigation (EU)';
  if(n.includes('BEIDOU'))return'Navigation (CN)';
  if(n.includes('GLONASS'))return'Navigation (RU)';
  return'Satellite';
}
function guessOp(name){
  const n=name.toUpperCase();
  if(n.includes('STARLINK'))return'SpaceX';
  if(n.includes('GPS')||n.includes('NAVSTAR')||n.includes('USA '))return'USSF/NRO';
  if(n.includes('GOES')||n.includes('NOAA'))return'NOAA';
  if(n.includes('COSMOS')||n.includes('GLONASS'))return'Russian MoD';
  if(n.includes('ISS')||n.includes('ZARYA'))return'NASA/Roscosmos';
  if(n.includes('TIANGONG')||n.includes('CSS')||n.includes('BEIDOU'))return'CNSA';
  if(n.includes('SENTINEL')||n.includes('GALILEO'))return'ESA';
  if(n.includes('LANDSAT'))return'USGS/NASA';
  if(n.includes('HUBBLE'))return'NASA/ESA';
  if(n.includes('IRIDIUM'))return'Iridium';
  if(n.includes('ONEWEB'))return'OneWeb';
  return'';
}

function realSatPos(s){
  const td=tleData.get(s.norad);
  if(!td||!td.satrec)return null; // No data = don't show
  try{
    const now=new Date();
    const pv=satellite.propagate(td.satrec,now);
    if(!pv||!pv.position)return null;
    const gmst=satellite.gstime(now);
    const geo=satellite.eciToGeodetic(pv.position,gmst);
    td.altKm=Math.round(geo.height);
    return[satellite.degreesLong(geo.longitude),satellite.degreesLat(geo.latitude)];
  }catch(e){return null;}
}

// Parse 3-line TLE text into tleData map
function parseTLEText(text){
  const lines=text.trim().split('\n').map(l=>l.trim()).filter(l=>l);
  let loaded=0;
  for(let i=0;i+2<lines.length;i+=3){
    const name=lines[i],tle1=lines[i+1],tle2=lines[i+2];
    if(!tle1.startsWith('1 ')||!tle2.startsWith('2 '))continue;
    const norad=parseInt(tle2.substring(2,7));
    if(tleData.has(norad))continue; // skip duplicates
    try{
      const satrec=satellite.twoline2satrec(tle1,tle2);
      // Extract orbital elements from TLE line 2
      const inc=parseFloat(tle2.substring(8,16));
      const mm=parseFloat(tle2.substring(52,63)); // mean motion rev/day
      const per=1440/mm; // period in minutes
      tleData.set(norad,{name:name.trim(),tle1,tle2,satrec,altKm:null,inc,per});
      loaded++;
    }catch(e){}
  }
  return loaded;
}

async function fetchCelesTrak(){
  const badge=document.getElementById('sat-status');
  let totalLoaded=0;
  // Fetch groups in parallel
  const groupFetches=CELESTRAK_GROUPS.map(async g=>{
    try{
      const r=await fetch(PROXY(`${CELESTRAK_BASE}?GROUP=${g.toUpperCase()}&FORMAT=TLE`),{signal:(()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),20000); return _c.signal; })()});
      if(!r.ok)return 0;
      return parseTLEText(await r.text());
    }catch(e){return 0;}
  });
  // Also fetch specific NORAD IDs from SATS array that might not be in groups
  const catnrFetches=SATS.map(async s=>{
    if(tleData.has(s.norad))return 0;
    try{
      const r=await fetch(PROXY(`${CELESTRAK_BASE}?CATNR=${s.norad}&FORMAT=TLE`),{signal:(()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),15000); return _c.signal; })()});
      if(!r.ok)return 0;
      return parseTLEText(await r.text());
    }catch(e){return 0;}
  });
  const results=await Promise.allSettled([...groupFetches,...catnrFetches]);
  results.forEach(r=>{if(r.status==='fulfilled')totalLoaded+=r.value;});
  // Merge SATS metadata with fetched TLE data
  SATS.forEach(s=>{
    const td=tleData.get(s.norad);
    if(td){td.op=s.op||guessOp(td.name);td.pur=s.pur||guessPurpose(td.name);}
  });
  // Auto-populate op/pur for group-fetched sats not in SATS array
  tleData.forEach((td,norad)=>{
    if(!td.op)td.op=guessOp(td.name);
    if(!td.pur)td.pur=guessPurpose(td.name);
  });
  if(badge){
    badge.textContent=`TLE: ${totalLoaded} LIVE (SGP4)`;
    badge.style.color=totalLoaded>0?'var(--accent2)':'var(--warning)';
  }
  // Update sidebar counts
  const satCount=tleData.size;
  const sc2=document.getElementById('sc2');if(sc2)sc2.textContent=satCount;
  const ss2=document.getElementById('ss2');if(ss2)ss2.textContent=satCount;
  // Rebuild search index with all satellites
  if(typeof buildSI==='function')buildSI();
}
