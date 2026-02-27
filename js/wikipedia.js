// ====== WIKIPEDIA LIVE FEED ======
// Fetches lead summaries from Wikipedia REST API (no API key, CORS-open)
// Results cached in wikiCache; tooltip shows live data when available
const WIKI_API='https://en.wikipedia.org/api/rest_v1/page/summary/';
let wikiLoaded=0,wikiTotal=0;

function updateDataBadge(){
  const el=document.getElementById('wiki-status');
  if(!el)return;
  if(wikiLoaded>=wikiTotal){el.textContent='WIKI: SYNCED';el.style.color='var(--accent2)';}
  else{el.textContent=`WIKI: ${wikiLoaded}/${wikiTotal}`;el.style.color='var(--warning)';}
}

async function fetchWikiSummaries(){
  const features=FRONTLINES.features;
  wikiTotal=features.length;
  updateDataBadge();
  const fetches=features.map(async f=>{
    const key=f.properties.wikiKey;
    if(!key)return;
    try{
      const r=await fetch(WIKI_API+encodeURIComponent(key),{headers:{'Api-User-Agent':'ARGUS-Monitor/1.0'}});
      if(!r.ok)throw new Error(r.status);
      const d=await r.json();
      // Truncate to ~350 chars to keep tooltip compact
      let extract=(d.extract||'').replace(/\n/g,' ').trim();
      if(extract.length>350)extract=extract.slice(0,347)+'…';
      wikiCache[key]={
        summary:extract,
        timestamp:new Date(d.timestamp||Date.now()).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),
        wikiUrl:d.content_urls?.desktop?.page||''
      };
      wikiLoaded++;
      updateDataBadge();
    }catch(e){
      // Silently fall back to hardcoded summary
      wikiLoaded++;
      updateDataBadge();
    }
  });
  await Promise.allSettled(fetches);
}

