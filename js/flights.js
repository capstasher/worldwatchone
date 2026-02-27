// ====== OPENSKY LIVE FLIGHT DATA ======
// OpenSky Network REST API — free, anonymous, no key, CORS-enabled
// Returns real ADS-B state vectors for all tracked aircraft worldwide
// Authenticated rate limit: 4000 credits/day (OAuth2 client credentials)
const OPENSKY_URL='https://opensky-network.org/api/states/all?extended=1';
const _k='wwo_salt_2026';function _d(e){const r=atob(e);let o='';for(let i=0;i<r.length;i++)o+=String.fromCharCode(r.charCodeAt(i)^_k.charCodeAt(i%_k.length));return o;}
const OSKY_CLIENT_ID=_d('FBYfLAcAHxw6QB1TRh5aDDMaBAIA');
const OSKY_CLIENT_SECRET=_d('MBYsPBcgGkJsZGkBT0QwABAKFik+KV5TZ0VEEAA2IyY=');
const OSKY_TOKEN_URL='https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
let oskyAccessToken=null;
let oskyTokenExpiry=0;

async function getOskyToken(){
  if(oskyAccessToken&&Date.now()<oskyTokenExpiry-30000)return oskyAccessToken;
  try{
    const body=new URLSearchParams({grant_type:'client_credentials',client_id:OSKY_CLIENT_ID,client_secret:OSKY_CLIENT_SECRET});
    // Direct POST to auth server blocked by CORS in browsers — use proxy
    const proxyUrls=[
      PROXY(OSKY_TOKEN_URL),
    ];
    let r=null;
    for(const pUrl of proxyUrls){
      try{r=await fetch(pUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(8000)});if(r.ok)break;}catch(e){r=null;}
    }
    if(!r)throw new Error('All proxy token fetches failed');
    if(!r.ok)throw new Error('Token HTTP '+r.status);
    const d=await r.json();
    oskyAccessToken=d.access_token;
    oskyTokenExpiry=Date.now()+(d.expires_in||300)*1000;
    console.log('[WWO] OpenSky OAuth2 token acquired, expires in '+d.expires_in+'s');
    return oskyAccessToken;
  }catch(e){
    console.warn('[WWO] OpenSky OAuth2 token failed:',e.message);
    oskyAccessToken=null;
    return null;
  }
}

// Military callsign prefix heuristic
const MIL_PREFIXES=/^(RCH|NAVY|USAF|RRR|LAGR|FORTE|REACH|JAKE|TOPCT|DARK|VIPER|ATLAS|USMC|SPAR|VENUS|SWORD|DUKE|EVIL|GHOST|RAGE|IRON|DOOM|BUCK|WOLF|LYNX|HAWK|EAGLE|FALCN|MAGMA|ROCKY|MOTOR|BISON|STRIX|BOXER|GRIM|GAF|CTM|IAF|RAF|FAF|MRTT|RFF|KAF|SAM0|SAM1|SAM2|SAM3|SAM4|SAM5|SAM6|SAM7|SAM8|SAM9)/i;

// Live aircraft store: icao24 → aircraft object
const liveAC=new Map();
let oskyStatus='CONNECTING';

function isMilitary(cs){return cs&&MIL_PREFIXES.test(cs.trim());}

function msToKts(ms){return ms?Math.round(ms*1.94384):0;}
function mToFt(m){return m?Math.round(m*3.28084):0;}

function mkOpenSkyFeatures(){
  const feats=[];
  const flt=window.flightFilter||{com:true,mil:true,light:true};
  liveAC.forEach((ac,icao)=>{
    if(ac.lon==null||ac.lat==null||ac.on_ground)return;
    const mil=isMilitary(ac.callsign)?1:0;
    // Category from OpenSky: 2=Light<15500lb, 3=Small<75000lb, 8=Rotorcraft — "light aircraft"
    const cat=ac.category||0;
    const isLight=(cat>=2&&cat<=3)||cat===8;
    // Apply filter
    if(mil&&!flt.mil)return;
    if(!mil&&isLight&&!flt.light)return;
    if(!mil&&!isLight&&!flt.com)return;
    feats.push({
      type:'Feature',
      geometry:{type:'Point',coordinates:[ac.lon,ac.lat]},
      properties:{
        icao,
        cs:(ac.callsign||'').trim()||icao,
        country:ac.origin_country||'',
        alt_ft:mToFt(ac.geo_altitude||ac.baro_altitude),
        gs_kts:msToKts(ac.velocity),
        bearing:ac.true_track||0,
        mil,isLight:isLight?1:0,
        squawk:ac.squawk||'----',
        emergency:EMERGENCY_SQUAWKS[(ac.squawk||'').trim()]?1:0,
        last_contact:ac.last_contact||0,
      }
    });
  });
  return feats;
}

async function fetchOpenSky(){
  const methods=[
    // Method 1: Authenticated via OAuth2 (4000 credits/day)
    async()=>{
      const token=await getOskyToken();
      if(!token)throw new Error('No OAuth2 token');
      const r=await fetch(OPENSKY_URL,{headers:{'Authorization':'Bearer '+token},signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw new Error('Auth HTTP '+r.status);
      return r.json();
    },
    // Method 2: Worker proxy (anonymous fallback, no auth headers needed)
    async()=>{const r=await fetch(OPENSKY_ENDPOINT,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('worker '+r.status);return r.json();},
  ];
  for(const method of methods){
    try{
      const d=await method();
      if(!d.states||!d.states.length)continue;
      liveAC.clear();
      d.states.forEach(s=>{
        const[icao24,callsign,origin_country,,last_contact,lon,lat,baro_altitude,on_ground,velocity,true_track,,, geo_altitude,squawk,,,category]=s;
        if(lon==null||lat==null)return;
        liveAC.set(icao24,{callsign,origin_country,last_contact,lon,lat,baro_altitude,on_ground,velocity,true_track,geo_altitude,squawk,category:category||0});
      });
      const feats=mkOpenSkyFeatures();
      const src=map.getSource('flights');
      if(src)src.setData({type:'FeatureCollection',features:feats});
      const total=feats.length;
      document.getElementById('fc').textContent=total.toLocaleString();
      document.getElementById('sf').textContent=total.toLocaleString();
      buildSI();
      const badge=document.getElementById('sky-status');
      if(badge){badge.textContent='SKY: '+total.toLocaleString()+' AC';badge.style.color='var(--accent2)';}
      checkEmergencySquawks();
      console.log(`[WWO] OpenSky OK: ${total} aircraft`);
      if(typeof oskySchedule==='function')oskySchedule(true);
      return;// success
    }catch(e){
      console.warn('[WWO] OpenSky method failed:',e.message);
      continue;
    }
  }
  // ALL methods failed — DON'T clear existing data (keep last good state on map)
  const badge=document.getElementById('sky-status');
  const acCount=liveAC.size;
  if(badge){
    if(acCount>0){badge.textContent='SKY: '+acCount.toLocaleString()+' AC (CACHED)';badge.style.color='var(--warning)';}
    else{badge.textContent='SKY: RETRY';badge.style.color='var(--danger)';}
  }
  console.warn('[WWO] OpenSky all methods failed, keeping cached data ('+acCount+' aircraft)');
  if(typeof oskySchedule==='function')oskySchedule(false);
}


// ── EMERGENCY SQUAWK DETECTOR ──────────────────────────────────────────────
const EMERGENCY_SQUAWKS={
  '7500':{label:'HIJACK',color:'#ff0000',desc:'Aircraft hijacking in progress'},
  '7600':{label:'COMMS FAILURE',color:'#ff8800',desc:'Radio communication failure'},
  '7700':{label:'EMERGENCY',color:'#ff0000',desc:'General emergency declared'},
};
const activeEmergencies=new Map(); // icao→{squawk,alertedAt}
const pendingEmergencies=new Map(); // icao→{squawk,firstSeen,polls} — require persistence before alerting
const SQUAWK_POLLS_REQUIRED=2; // must appear in N consecutive polls before alert fires

function checkEmergencySquawks(){
  const now=Date.now();
  // Track which icaos have emergency squawks THIS poll
  const currentEmergencyIcaos=new Set();

  liveAC.forEach((ac,icao)=>{
    const sq=(ac.squawk||'').trim();
    const info=EMERGENCY_SQUAWKS[sq];
    if(!info)return;
    currentEmergencyIcaos.add(icao);

    // Already alerted — just update last seen
    if(activeEmergencies.has(icao)){
      activeEmergencies.get(icao).lastSeen=now;
      return;
    }

    // Check pending persistence
    const pending=pendingEmergencies.get(icao);
    if(pending&&pending.squawk===sq){
      pending.polls++;
      pending.lastSeen=now;
      if(pending.polls>=SQUAWK_POLLS_REQUIRED){
        // Persisted — fire the alert
        pendingEmergencies.delete(icao);
        activeEmergencies.set(icao,{squawk:sq,alertedAt:now,lastSeen:now});
        const cs=(ac.callsign||'').trim()||icao.toUpperCase();
        const alt=mToFt(ac.geo_altitude||ac.baro_altitude);
        const title='\u26a0 SQUAWK '+sq+' ('+info.label+') — '+cs+' // '+info.desc+' // '+(ac.origin_country||'UNK')+' @ '+(alt?alt.toLocaleString()+'ft':'UNK');
        addLiveItem(title,'EMERGENCY TRANSPONDER',new Date().toISOString(),'#',ac.origin_country||'MULTI','al',false);
        console.warn('[WWO] EMERGENCY SQUAWK CONFIRMED: '+sq+' '+info.label+' from '+cs+' (persisted '+pending.polls+' polls)');
      }
    }else{
      // First sighting or squawk changed — start pending
      pendingEmergencies.set(icao,{squawk:sq,firstSeen:now,lastSeen:now,polls:1});
      console.log('[WWO] Emergency squawk pending: '+sq+' from '+(ac.callsign||icao)+' (poll 1/'+SQUAWK_POLLS_REQUIRED+')');
    }
  });

  // Clear pending entries that disappeared (squawk changed or aircraft gone) — transient glitch filtered
  pendingEmergencies.forEach((v,k)=>{
    if(!currentEmergencyIcaos.has(k)){
      console.log('[WWO] Squawk glitch filtered: '+v.squawk+' from '+k+' (lasted '+v.polls+' poll(s))');
      pendingEmergencies.delete(k);
    }
  });

  // Clean stale confirmed emergencies (>5 min since last seen)
  activeEmergencies.forEach((v,k)=>{if(now-v.lastSeen>300000)activeEmergencies.delete(k);});
}

function showFlightD(icao){
  const ac=liveAC.get(icao);
  if(!ac)return;
  const cs=(ac.callsign||'').trim()||icao;
  const mil=isMilitary(ac.callsign);
  const cat=ac.category||0;
  const isLight=(cat>=2&&cat<=3)||cat===8;
  const alt=mToFt(ac.geo_altitude||ac.baro_altitude);
  const gs=msToKts(ac.velocity);
  const lastSeen=ac.last_contact?new Date(ac.last_contact*1000).toISOString().slice(11,19)+' UTC':'--';
  const sq=(ac.squawk||'').trim();
  const isEmergency=EMERGENCY_SQUAWKS[sq];
  const typeLabel=isEmergency?'⚠ '+isEmergency.label:mil?'GOV/MIL':isLight?'LIGHT AIRCRAFT':'COMMERCIAL';
  const typeColor=isEmergency?isEmergency.color:mil?'#ff3a3a':isLight?'#00ccff':'#00cc66';
  const panelStyle=isEmergency?'background:rgba(255,0,0,0.25);color:#ff0000;border:1px solid #ff0000':mil?'background:rgba(255,50,50,0.15);color:#ff3a3a':isLight?'background:rgba(0,200,255,0.15);color:#00ccff':'background:rgba(0,200,100,0.15);color:#00cc66';
  const catNames={0:'Unknown',1:'No Info',2:'Light (<15,500lb)',3:'Small (<75,000lb)',4:'Large',5:'High Vortex Large',6:'Heavy (>300,000lb)',7:'High Performance',8:'Rotorcraft',9:'Glider/Sailplane',10:'Lighter-than-air',11:'Parachutist',12:'Ultralight',13:'Reserved',14:'UAV',15:'Space Vehicle',16:'Emergency Surface',17:'Service Surface',18:'Point Obstacle',19:'Cluster Obstacle',20:'Line Obstacle'};
  showD(typeLabel,cs,panelStyle,
    `<div class="dr"><span class="dl">CALLSIGN</span><span class="dv2">${cs}</span></div>`+
    `<div class="dr"><span class="dl">ICAO24</span><span class="dv2">${icao.toUpperCase()}</span></div>`+
    `<div class="dr"><span class="dl">TYPE</span><span class="dv2" style="color:${typeColor}">${typeLabel}</span></div>`+
    `<div class="dr"><span class="dl">CATEGORY</span><span class="dv2">${catNames[cat]||'Cat '+cat}</span></div>`+
    `<div class="dr"><span class="dl">ORIGIN COUNTRY</span><span class="dv2">${ac.origin_country||'--'}</span></div>`+
    `<div class="dr"><span class="dl">ALTITUDE</span><span class="dv2">${alt?alt.toLocaleString()+' ft':'--'}</span></div>`+
    `<div class="dr"><span class="dl">GROUND SPEED</span><span class="dv2">${gs?gs+' kts':'--'}</span></div>`+
    `<div class="dr"><span class="dl">HEADING</span><span class="dv2">${ac.true_track!=null?Math.round(ac.true_track)+'°':'--'}</span></div>`+
    `<div class="dr"><span class="dl">SQUAWK</span><span class="dv2">${ac.squawk||'----'}</span></div>`+
    `<div class="dr"><span class="dl">LAST CONTACT</span><span class="dv2">${lastSeen}</span></div>`+
    `<div class="dr"><span class="dl">STATUS</span><span class="dv2" style="color:${mil?'#ff3a3a':'#00ff88'}">AIRBORNE</span></div>`+
    `<div class="dr"><span class="dl">SOURCE</span><span class="dv2">OPENSKY ADS-B LIVE</span></div>`
  );
}
function mkSP(){const feats=[];tleData.forEach((td,norad)=>{const pos=realSatPos({norad});if(!pos)return;feats.push({type:"Feature",geometry:{type:"Point",coordinates:pos},properties:{norad,name:td.name,alt:td.altKm||0,inc:td.inc?td.inc.toFixed(1):'?',per:td.per?td.per.toFixed(1):'?',op:td.op||'',pur:td.pur||'Satellite'}});});return feats;}
function mkCP(){
  const showGlobal=document.getElementById('cam-global')?.checked??true;
  const showUK=document.getElementById('cam-uk')?.checked??true;
  return CAMS.filter(c=>{
    if(c.region==='uk')return showUK;
    return showGlobal;
  }).map((c,i)=>{
    const origIdx=CAMS.indexOf(c);
    return{type:"Feature",geometry:{type:"Point",coordinates:[c.lng,c.lat]},properties:{id:origIdx,name:c.name,city:c.city,fid:c.id,res:c.res,fps:c.fps,hasFeed:c.type==='img'?1:c.type==='ukcam'?3:c.type==='link'?2:0,region:c.region||''}};
  });
}

