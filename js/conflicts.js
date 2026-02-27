// ====== DETAIL PANELS ======
function showD(type,title,style,html){document.getElementById('dt').textContent=type;document.getElementById('dt').style.cssText=style;document.getElementById('dtl').textContent=title;document.getElementById('dpb').innerHTML=html;document.getElementById('dp').classList.add('show');}
function closeD(){document.getElementById('dp').classList.remove('show');}

// showFlightD is defined above in the OpenSky section

function showSatD(norad){const td=tleData.get(norad);if(!td)return;const alt=td.altKm!=null?td.altKm+' km':'N/A';const inc=td.inc!=null?td.inc.toFixed(1)+'\u00b0':'N/A';const per=td.per!=null?td.per.toFixed(1)+' min':'N/A';showD('SATELLITE',td.name,'background:rgba(80,120,220,0.15);color:#5588dd',`<div class="dr"><span class="dl">NAME</span><span class="dv2">${td.name}</span></div><div class="dr"><span class="dl">NORAD ID</span><span class="dv2">${norad}</span></div><div class="dr"><span class="dl">OPERATOR</span><span class="dv2">${td.op||'Unknown'}</span></div><div class="dr"><span class="dl">PURPOSE</span><span class="dv2">${td.pur||'Satellite'}</span></div><div class="dr"><span class="dl">ALTITUDE</span><span class="dv2">${alt}</span></div><div class="dr"><span class="dl">INCLINATION</span><span class="dv2">${inc}</span></div><div class="dr"><span class="dl">PERIOD</span><span class="dv2">${per}</span></div><div class="dr"><span class="dl">SOURCE</span><span class="dv2" style="color:var(--accent2)">CELESTRAK TLE \u2192 SGP4</span></div><div class="dr"><span class="dl">STATUS</span><span class="dv2" style="color:#00ff88">TRACKED</span></div>`);}

function showCamD(i){
  const c=CAMS[i];
  if(window._camRefresh){clearInterval(window._camRefresh);window._camRefresh=null;}
  const hasFeed=c.type==='img'&&!!c.feed;
  const isUKCam=c.type==='ukcam';
  const isLink=c.type==='link'&&!!c.feed;
  const isUK=c.region==='uk';
  let fh,statusColor,statusText,sourceText,extLink='';
  if(isUKCam){
    // Live image from trafficcameras.uk — loads on demand
    const imgUrl=c.feed+'?t='+Date.now();
    fh=`<img id="cam-live-img" src="${imgUrl}" style="width:100%;height:100%;object-fit:contain;background:#000" onerror="this.onerror=null;this.style.display='none';this.parentElement.querySelector('.cf-err').style.display='block'"><div class="cf-err" style="display:none;text-align:center;padding:20px;color:#ffaa00;font-size:10px">\u26a0 Image unavailable<br><span style="font-size:8px;color:var(--text-dim)">Camera may be offline or under maintenance</span></div>`;
    statusColor='#ffaa00';statusText='LIVE (5min refresh)';sourceText='National Highways via trafficcameras.uk';
    const roadSlug=c.city.replace('UK ','').toLowerCase();
    extLink=`<div class="dr"><span class="dl">VIEW ON SITE</span><span class="dv2"><a href="https://trafficcameras.uk/${roadSlug}" target="_blank" style="color:var(--accent2);text-decoration:underline">\u2197 trafficcameras.uk/${roadSlug}</a></span></div>`+
      `<div class="dr"><span class="dl">DIRECT IMAGE</span><span class="dv2"><a href="${c.feed}" target="_blank" style="color:var(--accent2);text-decoration:underline">\u2197 Open image</a></span></div>`+
      `<div style="text-align:center;margin-top:6px"><button onclick="document.getElementById('cam-live-img').src='${c.feed}?t='+Date.now();document.getElementById('cam-ts').textContent=new Date().toISOString().slice(11,19)+' UTC'" style="background:rgba(255,170,0,0.15);color:#ffaa00;border:1px solid #ffaa0044;padding:4px 16px;cursor:pointer;font-family:var(--ft);font-size:9px;letter-spacing:1px">\u21bb REFRESH IMAGE</button></div>`;
  }else if(hasFeed){
    fh=`<img id="cam-live-img" src="${c.feed}?t=${Date.now()}" style="width:100%;height:100%;object-fit:contain;background:#000" onerror="this.style.display='none'">`;
    statusColor='#00ff88';statusText='LIVE (DOT)';sourceText='NYC DOT / NYCTMC';
    extLink=`<div class="dr"><span class="dl">OPEN FEED</span><span class="dv2"><a href="${c.feed}" target="_blank" style="color:var(--accent2);text-decoration:underline">\u2197 Direct Image</a></span></div>`;
  }else if(isLink){
    fh=`<div class="cf-offline" style="background:#0a1a0e"><div style="color:#ffaa00">\u26a0 UK TRAFFIC CAM</div><div style="font-size:8px;margin-top:4px;color:var(--text-dim)">${c.id}</div><div style="font-size:7px;margin-top:2px;color:var(--text)">National Highways feed</div></div>`;
    statusColor='#ffaa00';statusText='EXTERNAL LINK';sourceText='National Highways via trafficcameras.uk';
    extLink=`<div class="dr"><span class="dl">VIEW CAMERAS</span><span class="dv2"><a href="${c.feed}" target="_blank" style="color:var(--accent2);text-decoration:underline">\u2197 trafficcameras.uk</a></span></div>`;
  }else{
    fh=`<div class="cf-offline"><div>NO LIVE FEED</div><div style="font-size:8px;margin-top:4px;color:var(--text-dim)">${c.id}</div><div style="font-size:7px;margin-top:2px;color:var(--text-dim)">Camera marker only</div><div class="cf-noise"></div></div>`;
    statusColor='var(--warning)';statusText='MARKER';sourceText='Map Marker';
  }
  const panelColor=isUK?'background:rgba(255,170,0,0.1);color:#ffaa00':'background:rgba(0,255,136,0.15);color:#00ff88';
  showD(isUK?'UK TRAFFIC':'CCTV',c.name,panelColor,
    `<div class="cam-feed">${fh}<div class="cf-rec">${hasFeed?'\u25cf LIVE':isUKCam?'\u25cf UK LIVE':isLink?'\u25cb EXT':'\u25cb OFF'}</div><div class="cf-ts" id="cam-ts">${new Date().toISOString().slice(11,19)} UTC</div><div class="cf-id">${c.id}</div></div>`+
    `<div class="dr"><span class="dl">LOCATION</span><span class="dv2">${c.city}</span></div>`+
    `<div class="dr"><span class="dl">ROAD</span><span class="dv2">${c.city.replace('UK ','')}</span></div>`+
    `<div class="dr"><span class="dl">FEED ID</span><span class="dv2">${c.id}${c.tcId?' (TC#'+c.tcId+')':''}</span></div>`+
    `<div class="dr"><span class="dl">STATUS</span><span class="dv2" style="color:${statusColor}">${statusText}</span></div>`+
    `<div class="dr"><span class="dl">SOURCE</span><span class="dv2">${sourceText}</span></div>`+
    extLink
  );
  if(hasFeed){
    window._camRefresh=setInterval(()=>{
      const img=document.getElementById('cam-live-img');if(img)img.src=c.feed+'?t='+Date.now();
      const ts=document.getElementById('cam-ts');if(ts)ts.textContent=new Date().toISOString().slice(11,19)+' UTC';
    },3000);
  }
}

function showConfD(i){const c=CONF[i],col=confCol(c.int);
  // Get REAL posts matching this conflict zone
  const realPosts=getPostsForZone(c.region);
  let feed='';
  if(realPosts.length>0){
    realPosts.slice(-5).reverse().forEach(p=>{
      feed+=`<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:10px;line-height:1.4;cursor:pointer" onclick="window.open('${p.link}','_blank','noopener')"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#1d9bf0;font-size:9px;font-family:var(--fm)">${p.source}</span><span style="color:#1d9bf0;font-size:7px;font-family:var(--ft);letter-spacing:1px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px">TELEGRAM</span></div>${p.text.slice(0,200)}${p.text.length>200?'…':''}<div style="color:var(--text-dim);font-size:8px;margin-top:2px">${timeAgo(p.pubDate)}</div></div>`;
    });
  }else{
    feed='<div style="color:var(--text-dim);font-size:10px;font-family:var(--fm);padding:8px 0">No matched OSINT posts in last 24h. Feed syncing…</div>';
  }
  const summaryHtml=c.summary?`<div style="margin:8px 0;padding:8px;background:rgba(255,60,0,0.05);border-left:2px solid ${col};font-size:10px;line-height:1.5;font-family:var(--fm);color:var(--text)">${c.summary}</div>`:'';
  showD('CONFLICT',c.name,`background:rgba(255,60,0,0.15);color:${col}`,`<div class="dr"><span class="dl">ZONE</span><span class="dv2">${c.name}</span></div><div class="dr"><span class="dl">TYPE</span><span class="dv2">${c.type}</span></div><div class="dr"><span class="dl">REGION</span><span class="dv2">${c.region}</span></div><div class="dr"><span class="dl">INTENSITY</span><span class="dv2" style="color:${col}">${~~(c.int*100)}%</span></div><div class="dr"><span class="dl">EVENTS (24H)</span><span class="dv2">${c.events}</span></div><div class="dr"><span class="dl">DISPLACED</span><span class="dv2">${c.disp}</span></div><div class="dr"><span class="dl">THREAT LEVEL</span><span class="dv2" style="color:${col}">${c.int>0.75?'CRITICAL':c.int>0.5?'ELEVATED':'WATCH'}</span></div>${summaryHtml}<button class="track-btn" onclick="openCTO(${i})">OPEN DEDICATED TRACKER</button><div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px"><div style="font-family:var(--ft);font-size:9px;letter-spacing:2px;color:var(--accent);margin-bottom:6px">LIVE OSINT FEED <span style="color:#1d9bf0;font-size:7px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px;margin-left:6px">REAL DATA</span></div>${feed}</div>`);}

// ====== CONFLICT TRACKER ======
let ctoI=null;
let ctoRegion=null;// track which region is open for live updates
function openCTO(i){closeD();const c=CONF[i],col=confCol(c.int);
ctoRegion=c.region;
document.getElementById('cto-name').textContent='TRACKER // '+c.name.toUpperCase();document.getElementById('cto-name').style.color=col;
const rel=CONF.filter(x=>x.region===c.region);
let st=`<h3>SITUATION OVERVIEW</h3><div class="cto-stat"><span>Zone</span><span class="csv">${c.name}</span></div><div class="cto-stat"><span>Classification</span><span class="csv">${c.type}</span></div><div class="cto-stat"><span>Intensity</span><span class="csv" style="color:${col}">${~~(c.int*100)}%</span></div><div class="cto-stat"><span>Threat Level</span><span class="csv" style="color:${col}">${c.int>0.75?'CRITICAL':c.int>0.5?'ELEVATED':'WATCH'}</span></div><div class="cto-stat"><span>24hr Events</span><span class="csv">${c.events}</span></div><div class="cto-stat"><span>Displaced</span><span class="csv">${c.disp}</span></div>`;
if(rel.length>1){st+=`<h3 style="margin-top:12px">RELATED ZONES (${c.region})</h3>`;rel.forEach(r=>{const rc=confCol(r.int);st+=`<div class="cto-stat"><span style="color:${rc}">${r.name}</span><span class="csv">${~~(r.int*100)}%</span></div>`;});}

// Real posts for timeline
const zonePosts=getPostsForZone(c.region);
let tl='<h3>LIVE EVENT TIMELINE <span style="color:#1d9bf0;font-size:7px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px;margin-left:4px">REAL DATA</span></h3>';
if(zonePosts.length>0){
  zonePosts.slice(-8).reverse().forEach(p=>{
    tl+=`<div class="tli" style="cursor:pointer" onclick="window.open('${p.link}','_blank','noopener')"><span class="tld">${timeAgo(p.pubDate)}</span><span><span style="color:#1d9bf0;font-size:8px">${p.source}</span> ${p.text.slice(0,120)}${p.text.length>120?'…':''}</span></div>`;
  });
}else{
  tl+='<div style="color:var(--text-dim);font-size:10px;font-family:var(--fm);padding:8px 0">Awaiting matched posts for this zone. Feed refreshes every 3 min.</div>';
}

let sr='<h3>MONITORED SOURCES</h3>';
sr+='<div style="font-size:8px;color:var(--text-dim);margin-bottom:6px;font-family:var(--fm)">LIVE TELEGRAM CHANNELS</div>';
TELEGRAM_OSINT_CHANNELS.forEach(ch=>sr+=`<div style="padding:3px 0;font-family:var(--fm);font-size:10px;border-bottom:1px solid rgba(40,80,140,0.04)"><span style="color:#1d9bf0">t.me/${ch.channel}</span> ${ch.label}${ch.twitter?' <span style="color:var(--text-dim);font-size:8px">(X: @'+ch.twitter+')</span>':''}</div>`);
sr+='<div style="font-size:8px;color:var(--text-dim);margin:8px 0 6px;font-family:var(--fm)">NEWS FEEDS</div>';
FEED_QUERIES.filter(q=>q.zone===c.region||c.region==='MULTI').slice(0,5).forEach(q=>sr+=`<div style="padding:3px 0;font-family:var(--fm);font-size:10px;border-bottom:1px solid rgba(40,80,140,0.04)">Google News: ${q.q.replace(/\+/g,' ')}</div>`);

document.getElementById('cto-body').innerHTML=`<div class="cto-s">${st}</div><div class="cto-s"><h3>LIVE INTELLIGENCE <span style="color:var(--danger);font-size:8px">&#9679; LIVE</span> <span style="color:#1d9bf0;font-size:7px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px;margin-left:4px">REAL DATA</span></h3><div id="cto-feed"></div></div><div class="cto-s">${tl}</div><div class="cto-s">${sr}</div>`;
document.getElementById('cto').classList.add('show');

// Populate live intelligence feed with real posts
const fe=document.getElementById('cto-feed');
function renderCTOFeed(){
  fe.innerHTML='';
  const posts=getPostsForZone(c.region);
  if(posts.length===0){
    fe.innerHTML='<div style="color:var(--text-dim);font-size:10px;font-family:var(--fm);padding:8px 0">Scanning Telegram channels for ${c.region} intel… Feed refreshes every 3 min.</div>';
    return;
  }
  posts.slice(-12).reverse().forEach(p=>{
    const el=document.createElement('div');
    el.className='cto-ev';
    el.style.cursor='pointer';
    el.onclick=()=>window.open(p.link,'_blank','noopener');
    el.innerHTML=`<div class="ces" style="display:flex;justify-content:space-between"><span style="color:#1d9bf0">${p.source}</span><span style="color:#1d9bf0;font-size:7px;font-family:var(--ft);letter-spacing:1px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px">TELEGRAM</span></div>${p.text.slice(0,200)}${p.text.length>200?'…':''}<div class="cet">${timeAgo(p.pubDate)}</div>`;
    fe.appendChild(el);
  });
}
renderCTOFeed();

// Live update: re-render CTO feed every 30 seconds with latest posts
if(ctoI)clearInterval(ctoI);
ctoI=setInterval(renderCTOFeed,30000);
map.flyTo({center:[c.lng,c.lat],zoom:6,duration:1000});}
function closeCTO(){document.getElementById('cto').classList.remove('show');ctoRegion=null;if(ctoI){clearInterval(ctoI);ctoI=null;}}

// ── Open tracker directly by region name (for sidebar shortcut buttons) ──────
function openCTOByRegion(region){
  // Find the highest-intensity CONF entry for this region
  const matches = CONF.map((c,i)=>({c,i})).filter(({c})=>c.region===region);
  if(!matches.length){ console.warn('[WWO] No CONF entry for region:', region); return; }
  const best = matches.reduce((a,b)=> b.c.int > a.c.int ? b : a);
  openCTO(best.i);
}
