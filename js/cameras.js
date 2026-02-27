// ====== CAMERAS — Feature builder and detail panel ======

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
const confPts=CONF.map((c,i)=>({type:"Feature",geometry:{type:"Point",coordinates:[c.lng,c.lat]},properties:{id:i,name:c.name,int:c.int,type:c.type,region:c.region}}));

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
