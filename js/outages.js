// ====== INTERNET OUTAGE MONITORING ======
// Cloudflare Radar Outage Center via RSS → rss2json (same pipeline as news)
// Plus IODA (Internet Outage Detection and Analysis) alerts
const outageMarkers=[];
const OUTAGE_RSS='https://radar.cloudflare.com/outage-center/rss';

// Country centroid coordinates for outage mapping
const COUNTRY_COORDS={
  AF:[33,65],AL:[41,20],DZ:[28,3],AO:[-12.5,18.5],AR:[-34,-64],AU:[-27,133],AT:[47.5,13.5],AZ:[40.5,47.5],
  BD:[24,90],BY:[53,28],BE:[50.8,4.3],BJ:[9.5,2.3],BO:[-17,-65],BR:[-10,-55],BG:[43,25],BF:[13,-1.5],
  BI:[-3.5,30],KH:[13,105],CM:[6,12],CA:[60,-95],CF:[7,21],TD:[15,19],CL:[-30,-71],CN:[35,105],
  CO:[4,-72],CD:[-2.5,23.5],CG:[-1,15.8],CR:[10,-84],CI:[8,-5.5],HR:[45.2,15.5],CU:[22,-80],CY:[35,33],
  CZ:[49.8,15.5],DK:[56,10],DJ:[11.5,43],DO:[19,-70.7],EC:[-2,-77.5],EG:[27,30],SV:[13.8,-88.9],
  ER:[15,39],EE:[59,26],ET:[8,38],FJ:[-18,175],FI:[64,26],FR:[47,2],GA:[-1,11.6],GM:[13.5,-16.6],
  GE:[42,43.5],DE:[51,9],GH:[8,-1.1],GR:[39,22],GT:[15.5,-90.3],GN:[11,-12],GW:[12,-15],GY:[5,-59],
  HT:[19,-72],HN:[15,-86.5],HU:[47,20],IS:[65,-18],IN:[22,79],ID:[-5,120],IR:[32,53],IQ:[33,44],
  IE:[53,-8],IL:[31.5,35],IT:[42.8,12.8],JM:[18.3,-77.3],JP:[36,138],JO:[31,36],KZ:[48,68],
  KE:[1,38],KP:[40,127],KR:[37,127.5],KW:[29.5,47.7],KG:[41,75],LA:[18,105],LV:[57,25],
  LB:[33.8,35.8],LS:[-29.5,28.5],LR:[6.5,-9.5],LY:[27,17],LT:[56,24],LU:[49.8,6.2],
  MG:[-20,47],MW:[-13.5,34],MY:[3,112],ML:[17,-4],MR:[20,-12],MX:[23,-102],MD:[47,29],
  MN:[46,105],ME:[42.5,19.3],MA:[32,-5],MZ:[-18.3,35],MM:[22,98],NA:[-22,17],NP:[28,84],
  NL:[52.5,5.8],NZ:[-42,174],NI:[13,-85.2],NE:[16,8],NG:[10,8],NO:[62,10],OM:[21,57],
  PK:[30,70],PA:[9,-80],PG:[-6,147],PY:[-23,-58],PE:[-10,-76],PH:[12,122],PL:[52,20],
  PT:[39.5,-8],QA:[25.5,51.2],RO:[46,25],RU:[60,100],RW:[-2,30],SA:[25,45],SN:[14,-14],
  RS:[44,21],SL:[8.5,-11.8],SG:[1.4,103.8],SK:[48.7,19.7],SI:[46.1,14.9],SO:[6,46],
  ZA:[-30,25],ES:[40,-4],LK:[7.9,80.8],SD:[16,30],SS:[7,30],SE:[62,15],CH:[47,8.2],
  SY:[35,38],TW:[23.5,121],TJ:[39,71],TZ:[-6,35],TH:[15,100],TL:[-8.5,126],TG:[8,1.2],
  TN:[34,9],TR:[39,35],TM:[40,60],UG:[1,32],UA:[49,32],AE:[24,54],GB:[54,-2],US:[38,-97],
  UY:[-33,-56],UZ:[41,64],VE:[8,-66],VN:[16,106],YE:[15,48],ZM:[-15,28],ZW:[-20,30],
  AF:[33,65],PS:[31.9,35.2],XK:[42.6,21],
};

async function fetchOutages(){
  const results=[];
  // Method 1: Cloudflare Radar RSS via rss2json
  try{
    const url=PROXY(OUTAGE_RSS);
    const r=await fetch(url,{signal:AbortSignal.timeout(10000)});
    if(r.ok){
      const d=await r.json();
      if(d.status==='ok'&&Array.isArray(d.items)){
        d.items.forEach(item=>{
          // Try to extract country from title (usually "Internet outage in <country>")
          const m=item.title?.match(/in\s+([A-Z]{2})(?:\s|$|,)/i)||item.title?.match(/([A-Z]{2})\s*[-–]/);
          const cc=m?m[1].toUpperCase():null;
          const coords=cc?COUNTRY_COORDS[cc]:null;
          if(coords){
            results.push({
              lat:coords[0],lng:coords[1],
              title:item.title,
              link:item.link,
              pubDate:item.pubDate,
              country:cc,
              source:'Cloudflare Radar'
            });
          }
          // Also inject into OSINT feed
          addLiveItem('🌐 NET OUTAGE: '+(item.title||'Unknown'),'Cloudflare Radar',item.pubDate||new Date().toISOString(),item.link||'#','MULTI','al',false);
        });
      }
    }
  }catch(e){console.warn('[WWO] Outage RSS failed:',e.message);}

  // Method 2: Google News search for internet outages/shutdowns
  try{
    const url=PROXY(GN_BASE+'internet+outage+shutdown+country'+GN_PARAMS);
    const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
    if(r.ok){
      const d=await r.json();
      if(d.status==='ok'&&Array.isArray(d.items)){
        d.items.slice(0,3).forEach(item=>{
          addLiveItem('🌐 '+item.title,item.author||'News',item.pubDate,item.link,'MULTI','wa',false);
        });
      }
    }
  }catch(e){}

  // Update map source
  if(map.getSource('outages')){
    const feats=results.map(o=>({
      type:'Feature',
      geometry:{type:'Point',coordinates:[o.lng,o.lat]},
      properties:{title:o.title,country:o.country,source:o.source,link:o.link,pubDate:o.pubDate}
    }));
    map.getSource('outages').setData({type:'FeatureCollection',features:feats});
    const el=document.getElementById('outc');
    if(el)el.textContent=results.length;
  }
  console.log('[WWO] Outages: '+results.length+' active');
}

