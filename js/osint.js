// ====== LIVE OSINT FEED ======
// RSS parsing done in-browser via allorigins proxy (rss2json deprecated)
const GN_BASE='https://news.google.com/rss/search?q=';
const GN_PARAMS='&hl=en-US&gl=US&ceid=US:en';

// ── Google News queries ──────────────────────────────────────────────────────
const FEED_QUERIES=[
  // ── ACTIVE CONFLICTS ──
  {q:'Ukraine+war+frontline',          zone:'Ukraine',   ty:'al'},
  {q:'Gaza+war+ceasefire',             zone:'Gaza',      ty:'al'},
  {q:'Sudan+civil+war+RSF+SAF',        zone:'Sudan',     ty:'al'},
  {q:'DRC+M23+Goma+Congo',             zone:'DRC',       ty:'al'},
  {q:'Myanmar+civil+war+junta',        zone:'Myanmar',   ty:'wa'},
  {q:'Yemen+Houthi+attack+Red+Sea',    zone:'Yemen',     ty:'wa'},
  {q:'Lebanon+Hezbollah+IDF',          zone:'Lebanon',   ty:'wa'},
  {q:'West+Bank+IDF+Jenin+Tulkarm',    zone:'West Bank', ty:'wa'},
  {q:'Burkina+Faso+JNIM+insurgency',   zone:'Sahel',     ty:'in'},
  {q:'Mexico+cartel+violence+attack',  zone:'Mexico',    ty:'al'},
  {q:'Iran+IRGC+military+nuclear',     zone:'Iran',      ty:'wa'},
  {q:'Taiwan+Strait+China+military',   zone:'Taiwan',    ty:'wa'},
  {q:'North+Korea+missile+launch',     zone:'DPRK',      ty:'al'},
  {q:'Pakistan+India+border+incident', zone:'S.Asia',    ty:'wa'},
  // ── Pakistan–Afghanistan conflict ──
  {q:'Pakistan+Afghanistan+TTP+attack',          zone:'Pak-Afghan', ty:'al'},
  {q:'Pakistan+airstrike+Afghanistan+Durand',    zone:'Pak-Afghan', ty:'al'},
  {q:'TTP+Tehrik+Taliban+Pakistan+operation',    zone:'Pak-Afghan', ty:'al'},
  {q:'Khyber+Pakhtunkhwa+KPK+military+attack',  zone:'Pak-Afghan', ty:'wa'},
  {q:'Pakistan+Afghanistan+border+closure',      zone:'Pak-Afghan', ty:'wa'},
  {q:'Balochistan+BLA+attack+military',          zone:'Pak-Afghan', ty:'wa'},
  {q:'Afghan+Taliban+Pakistan+expel+militants',  zone:'Pak-Afghan', ty:'in'},
  // ── NATURAL DISASTERS ──
  {q:'volcano+eruption+alert',         zone:'GEO',       ty:'al'},
  {q:'earthquake+magnitude+tsunami',   zone:'GEO',       ty:'al'},
  {q:'hurricane+typhoon+cyclone',      zone:'GEO',       ty:'wa'},
  {q:'wildfire+evacuation+emergency',  zone:'GEO',       ty:'wa'},
  {q:'flood+disaster+emergency',       zone:'GEO',       ty:'wa'},
  // ── CYBER / INFRASTRUCTURE ──
  {q:'cyberattack+infrastructure+hack',zone:'CYBER',     ty:'al'},
  {q:'ransomware+attack+government',   zone:'CYBER',     ty:'al'},
  {q:'power+grid+outage+attack',       zone:'CYBER',     ty:'wa'},
  // ── GEOPOLITICAL ──
  {q:'nuclear+threat+weapon+launch',   zone:'NUKE',      ty:'al'},
  {q:'coup+military+takeover',         zone:'GEO',       ty:'al'},
  {q:'sanctions+embargo+SWIFT',        zone:'GEO',       ty:'in'},
  {q:'space+launch+satellite+missile', zone:'SPACE',     ty:'in'},
];

// ── LIVE TELEGRAM CHANNEL SOURCES ────────────────────────────────────────────
// Nitter is dead (Twitter killed all public instances 2024).
// These OSINT accounts cross-post to public Telegram channels.
// We pull REAL posts via tg.i-c-a.su (free Telegram→JSON API, no auth, CORS-ok)
// and RSSHub as fallback. Zero fake data.

// tg.i-c-a.su JSON API: https://tg.i-c-a.su/json/{channel}?limit=N
// Rate limit: 15 req/min — we stay well under with staggered fetches
const TG_JSON_API='https://tg.i-c-a.su/json/';

// RSSHub fallback: https://rsshub.app/telegram/channel/{channel}
const RSSHUB_TG='https://rsshub.app/telegram/channel/';

// Telegram channels that mirror the requested Twitter OSINT accounts
// @sentdefender → t.me/OSINTdefender (confirmed cross-post, same person)
// @osinttechnical → t.me/osinttechnical (confirmed channel)
// Additional high-value OSINT Telegram channels for broader coverage
const TELEGRAM_OSINT_CHANNELS=[
  // Channels confirmed to have public t.me/s/ preview enabled
  // OSINT / INVESTIGATIONS
  {channel:'OSINTdefender',     label:'OSINT Defender',       zone:'OSINT',   ty:'al', twitter:'sentdefender'},
  {channel:'Intel_Alert',       label:'Intel Alert',          zone:'OSINT',   ty:'al', twitter:null},
  {channel:'intelnews',         label:'Intel News',           zone:'OSINT',   ty:'in', twitter:null},
  {channel:'osint_daily',       label:'OSINT Daily',          zone:'OSINT',   ty:'in', twitter:null},
  {channel:'conflictnews',      label:'Conflict News',        zone:'OSINT',   ty:'al', twitter:null},
  {channel:'theinsider',        label:'The Insider',          zone:'OSINT',   ty:'in', twitter:'theins_en'},
  // GLOBAL MONITORING
  {channel:'IntelSlava',        label:'Intel Slava',          zone:'OSINT',   ty:'al', twitter:null},
  {channel:'MiddleEastSpectator', label:'ME Spectator',       zone:'MENA',    ty:'wa', twitter:null},
  {channel:'globalcrisismedia', label:'Global Crisis',        zone:'OSINT',   ty:'al', twitter:null},
  {channel:'IranIntl_En',       label:'Iran Intl',            zone:'MENA',    ty:'wa', twitter:'IranIntl_En'},
  {channel:'africanosint',      label:'Africa OSINT',         zone:'Africa',  ty:'al', twitter:null},
  // Pak-Afghan conflict channels
  {channel:'PakistanMilitaryForum',  label:'Pakistan Military Forum',     zone:'Pak-Afghan'},
  {channel:'AfghanistanLiveUpdate',  label:'Afghanistan Live Updates',    zone:'Pak-Afghan'},
  {channel:'pak_afghan_conflict',    label:'Pak-Afghan Conflict Monitor', zone:'Pak-Afghan'},
];

// Master store: all real posts pulled from Telegram, used by both OSINT feed AND conflict trackers
const liveTelegramPosts=[];
const MAX_TG_POSTS=2000;

// Zone-keyword mapping: routes real posts into the correct conflict tracker
const ZONE_KEYWORDS={
  'Ukraine':[/ukrain/i,/donbas/i,/bakhmut/i,/avdiiv/i,/chasiv/i,/kherson/i,/zapori/i,/kharkiv/i,/drone/i,/frontline/i,/pokrovsk/i,/kupyansk/i,/toretsk/i,/donetsk/i,/luhansk/i,/mariupol/i,/zelensky/i,/dnipro/i,/odesa/i,/sumy/i],
  'Kursk':[/kursk/i,/sudzha/i,/russian.?border/i,/belgorod/i,/bryansk/i],
  'Gaza':[/gaza/i,/hamas/i,/idf/i,/palesti/i,/rafah/i,/ceasefire/i,/hostage/i,/jabalia/i,/khan.?younis/i,/nuseirat/i],
  'West Bank':[/west.?bank/i,/jenin/i,/tulkarm/i,/nablus/i,/settler/i,/ramallah/i],
  'Lebanon':[/lebanon/i,/hezbollah/i,/litani/i,/beirut/i,/nasrallah/i],
  'Iran':[/iran/i,/irgc/i,/tehran/i,/hormuz/i,/natanz/i,/isfahan/i,/bushehr/i,/fordow/i,/khamenei/i],
  'Sudan':[/sudan/i,/khartoum/i,/rsf/i,/darfur/i,/fasher/i,/hemedti/i,/burhan/i],
  'DRC':[/congo/i,/drc/i,/m23/i,/goma/i,/kivu/i],
  'Myanmar':[/myanmar/i,/burma/i,/junta/i,/shan/i,/kayah/i,/kachin/i],
  'Yemen':[/yemen/i,/houthi/i,/red.?sea/i,/ansar.?allah/i,/sanaa/i],
  'Sahel':[/sahel/i,/burkina/i,/mali/i,/jnim/i,/isgs/i,/wagner/i,/niger/i],
  'Somalia':[/somalia/i,/shabaab/i,/mogadishu/i],
  'Red Sea':[/red.?sea/i,/houthi/i,/shipping/i,/vessel/i,/bab.?al/i,/maritime/i],
  'Taiwan Strait':[/taiwan/i,/strait/i,/pla\b/i,/beijing/i,/xi.?jinping/i],
  'SCS':[/south.china.sea/i,/spratly/i,/scarborough/i,/philippines/i],
  'India-Pakistan':[/india.?pakistan/i,/kashmir/i,/loc\b/i,/sindoor/i,/pahalgam/i],
  'Pak-Afghan':[/\bttp\b/i,/tehrik.?i.?taliban/i,/pakistan.?afghan/i,/afghan.?pakistan/i,/durand/i,/waziristan/i,/khyber/i,/\/kpk\b/i,/balochistan/i,/\/bla\b/i,/bajaur/i,/mohmand/i,/kunar/i,/nangarhar/i,/kandahar.?pakistan/i,/cross.?border.?strike/i,/pakistan.?airstrike/i,/afghan.?border/i],
  'Mexico':[/mexico/i,/cjng/i,/jalisco/i,/cartel/i,/mencho/i,/guadalajara/i,/puerto.?vallarta/i,/michoacan/i,/tamaulipas/i,/narcobloqueo/i,/fentanyl/i,/sinaloa/i],
};

// ── Shared utilities ─────────────────────────────────────────────────────────
const ofE=document.getElementById('of');

// Fetch news: try allorigins to get raw RSS XML, parse in-browser

// ── DIRECT RSS FEEDS — broad monitoring sources ───────────────────────────────
// These bypass Google News and pull directly from authoritative sources
const RSS_FEEDS=[
  {url:'https://www.gdacs.org/xml/rss.xml',          label:'GDACS',        zone:'GEO',   ty:'al'},
  {url:'https://feeds.reuters.com/reuters/worldNews', label:'Reuters World',zone:'GEO',   ty:'in'},
  {url:'https://feeds.bbci.co.uk/news/world/rss.xml', label:'BBC World',   zone:'GEO',   ty:'in'},
  {url:'https://rss.dw.com/rdf/rss-en-world',         label:'DW World',    zone:'GEO',   ty:'in'},
  {url:'https://www.aljazeera.com/xml/rss/all.xml',   label:'Al Jazeera',  zone:'GEO',   ty:'in'},
  {url:'https://feeds.washingtonpost.com/rss/world',  label:'WaPo World',  zone:'GEO',   ty:'in'},
];

async function fetchNewsQuery(qObj){
  const rssUrl=GN_BASE+qObj.q+GN_PARAMS;
  const proxyUrls=[
    PROXY(rssUrl),
  ];
  for(const url of proxyUrls){
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
      if(!r.ok)continue;
      const xml=await r.text();
      const items=parseRSSXml(xml);
      if(items.length>0){
        items.slice(0,5).reverse().forEach(item=>{
          const src=item.source||'Google News';
          addLiveItem(item.title,src,item.pubDate,item.link,qObj.zone,qObj.ty,false);
        });
        return;
      }
    }catch(e){continue;}
  }
}


// ── Direct RSS feed fetcher ──────────────────────────────────────────────────
async function fetchRSSFeed(feed){
  try{
    const r=await fetch(PROXY(feed.url),{signal:AbortSignal.timeout(10000)});
    if(!r.ok)return;
    const xml=await r.text();
    const items=parseRSSXml(xml);
    items.slice(0,6).reverse().forEach(item=>{
      if(!item.title||item.title.length<10)return;
      addLiveItem(item.title,feed.label,item.pubDate,item.link,feed.zone,feed.ty,false);
    });
  }catch(e){}
}

// ── Telegram channel fetcher — MULTI-METHOD with CORS proxy fallbacks ────────
// Problem: file:// origin gets blocked by CORS on most APIs.
// Solution: try direct first, then CORS proxies, then Telegram web preview scraping.
//
// Method 1: tg.i-c-a.su JSON API (works from https:// sites)
// Method 2: CORS-proxied tg.i-c-a.su (works from file:// via corsproxy.io / allorigins)
// Method 3: Telegram web preview HTML scraping via CORS proxy (t.me/s/channel)
// Method 4: RSSHub via rss2json (existing pipeline)


// Parse Telegram web preview HTML (t.me/s/channel) into messages
function parseTelegramHTML(html,ch){
  const msgs=[];
  const postRegex=/<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const idRegex=/data-post="[^/]+\/(\d+)"/g;
  const dateRegex=/<time[^>]*datetime="([^"]+)"/g;
  // Photo: tgme_widget_message_photo_wrap with style containing background-image url
  const photoRegex=/tgme_widget_message_photo_wrap[^>]*style="[^"]*background-image:url\('([^']+)'\)/gi;
  // Video: tgme_widget_message_video src
  const videoRegex=/<video[^>]*src="([^"]+)"/gi;
  // Also grab og-style preview images
  const previewRegex=/tgme_widget_message_link_preview[^>]*>[\s\S]*?<i[^>]*style="[^"]*background-image:url\('([^']+)'\)/gi;

  const ids=[];let idm;
  while((idm=idRegex.exec(html))!==null)ids.push(idm[1]);
  const dates=[];let dm;
  while((dm=dateRegex.exec(html))!==null)dates.push(dm[1]);
  const texts=[];let tm;
  while((tm=postRegex.exec(html))!==null)texts.push(stripHtml(tm[1]));

  // Build per-message media by splitting HTML into message blocks first
  const blockRegex=/<div[^>]*class="[^"]*tgme_widget_message_wrap[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  const blocks=[];let bm;
  while((bm=blockRegex.exec(html))!==null)blocks.push(bm[1]);

  for(let i=0;i<texts.length;i++){
    if(!texts[i]||texts[i].length<15)continue;
    const media=[];
    const block=blocks[i]||'';
    // Photos in this block
    const pr=new RegExp(photoRegex.source,'gi');
    let pm;while((pm=pr.exec(block))!==null)media.push({type:'photo',url:pm[1],thumb:pm[1]});
    // Videos in this block
    const vr=new RegExp(videoRegex.source,'gi');
    let vm;while((vm=vr.exec(block))!==null)media.push({type:'video',url:vm[1],thumb:null});
    msgs.push({text:texts[i],id:ids[i]||'',date:dates[i]||new Date().toISOString(),media});
  }
  return msgs;
}

// Extract images from RSS item description HTML (RSSHub includes <img> tags)
function extractRSSMedia(html){
  const media=[];
  const imgRe=/<img[^>]+src="([^"]+)"/gi;
  let m;
  while((m=imgRe.exec(html))!==null){
    const url=m[1];
    if(url&&!url.includes('emoji')&&!url.includes('icon'))
      media.push({type:'photo',url,thumb:url});
  }
  return media;
}

async function fetchTelegramChannel(ch){
  const cutoff=Date.now()-24*60*60*1000;

  // ── METHOD 1: RSSHub via Worker proxy (primary — server IP doesn't matter) ──
  try{
    const rssUrl=RSSHUB_TG+ch.channel;
    const r=await fetch(PROXY(rssUrl),{signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('RSSHub '+r.status);
    const xml=await r.text();
    const items=parseRSSXml(xml);
    if(items.length>0){
      let added=0;
      items.slice(0,15).reverse().forEach(item=>{
        const text=stripHtml(item.title||item.description||'');
        if(!text||text.length<15)return;
        const pubDate=item.pubDate?new Date(item.pubDate):new Date();
        if(pubDate.getTime()<cutoff)return;
        const link=item.link||`https://t.me/${ch.channel}`;
        // Extract image from description enclosure if present
        const media=extractRSSMedia(item.description||'');
        const postObj={text,source:ch.label,pubDate:pubDate.toISOString(),link,zone:ch.zone,ty:ch.ty,channel:ch.channel,media};
        liveTelegramPosts.push(postObj);
        if(liveTelegramPosts.length>MAX_TG_POSTS)liveTelegramPosts.shift();
        addLiveItem(text,ch.label,pubDate.toISOString(),link,ch.zone,ch.ty,true,media);
        added++;
      });
      if(added>0){console.log(`[TG] ${ch.channel}: OK via RSSHub (${added} items)`);return;}
    }
  }catch(e){console.log(`[TG] ${ch.channel}: RSSHub failed (${e.message})`);}

  // ── METHOD 2: Telegram web preview HTML via Worker proxy ──
  try{
    const r=await fetch(PROXY('https://t.me/s/'+ch.channel),{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('t.me '+r.status);
    const html=await r.text();
    const msgs=parseTelegramHTML(html,ch);
    if(msgs.length>0){
      let added=0;
      msgs.slice(-15).forEach(msg=>{
        const pubDate=new Date(msg.date);
        if(pubDate.getTime()<cutoff)return;
        const link=msg.id?`https://t.me/${ch.channel}/${msg.id}`:`https://t.me/${ch.channel}`;
        const media=msg.media||[];
        const postObj={text:msg.text,source:ch.label,pubDate:pubDate.toISOString(),link,zone:ch.zone,ty:ch.ty,channel:ch.channel,media};
        liveTelegramPosts.push(postObj);
        if(liveTelegramPosts.length>MAX_TG_POSTS)liveTelegramPosts.shift();
        addLiveItem(msg.text,ch.label,pubDate.toISOString(),link,ch.zone,ch.ty,true,media);
        added++;
      });
      if(added>0){console.log(`[TG] ${ch.channel}: OK via HTML scrape (${added} msgs)`);return;}
    }
  }catch(e){console.log(`[TG] ${ch.channel}: HTML scrape failed (${e.message})`);}

  console.log(`[TG] ${ch.channel}: ALL METHODS FAILED`);
}

// Extract media attachments from a tg.i-c-a.su message object
// Returns array of {type:'photo'|'video', thumb, url} or empty array
function extractTgMedia(msg){
  const media=[];
  try{
    const m=msg.media;
    if(!m)return media;
    // Photo
    if(m._==='messageMediaPhoto'&&m.photo&&m.photo.sizes){
      // Pick largest size for url, second-largest for thumb
      const sizes=m.photo.sizes.filter(s=>s.bytes||s.url).sort((a,b)=>(b.w||0)-(a.w||0));
      if(sizes.length>0){
        const full=sizes[0];
        const thumb=sizes[sizes.length>1?1:0];
        // tg.i-c-a.su sometimes returns base64 bytes — build data URL
        const toUrl=s=>s.url||(s.bytes?'data:image/jpeg;base64,'+btoa(String.fromCharCode(...new Uint8Array(s.bytes))):null);
        const url=toUrl(full);
        const thumbUrl=toUrl(thumb);
        if(url||thumbUrl)media.push({type:'photo',url:url||thumbUrl,thumb:thumbUrl||url});
      }
    }
    // Video / GIF / Document with thumbnail
    if((m._==='messageMediaDocument'||m._==='messageMediaGif')&&m.document){
      const doc=m.document;
      const isVideo=doc.mime_type&&(doc.mime_type.startsWith('video/')||doc.mime_type==='image/gif');
      if(isVideo){
        let thumbUrl=null;
        if(doc.thumbs&&doc.thumbs.length>0){
          const t=doc.thumbs[0];
          if(t.bytes)thumbUrl='data:image/jpeg;base64,'+btoa(String.fromCharCode(...new Uint8Array(t.bytes)));
          else if(t.url)thumbUrl=t.url;
        }
        // Video URL from tg.i-c-a.su isn't directly accessible — link to post
        media.push({type:'video',url:null,thumb:thumbUrl});
      }
    }
    // Web page preview image
    if(m._==='messageMediaWebPage'&&m.webpage&&m.webpage.photo){
      const sizes=(m.webpage.photo.sizes||[]).filter(s=>s.url).sort((a,b)=>(b.w||0)-(a.w||0));
      if(sizes.length>0)media.push({type:'photo',url:sizes[0].url,thumb:(sizes[1]||sizes[0]).url});
    }
  }catch(e){}
  return media;
}

// Helper: inject tg.i-c-a.su JSON messages into feeds (with deduplication)
const seenPostIds=new Set();
function injectTgMessages(messages,ch,cutoff){
  let added=0;
  messages.forEach(msg=>{
    if(!msg.message&&!msg.text)return;
    const text=stripHtml(msg.message||msg.text||'');
    if(!text||text.length<15)return;
    let pubDate;
    if(msg.date){pubDate=typeof msg.date==='number'?new Date(msg.date*1000):new Date(msg.date);}
    else{pubDate=new Date();}
    if(pubDate.getTime()<cutoff)return;
    const postId=msg.id||'';
    const dedupeKey=ch.channel+'_'+postId+'_'+text.slice(0,50);
    if(seenPostIds.has(dedupeKey))return;
    seenPostIds.add(dedupeKey);
    if(seenPostIds.size>2000){const it=seenPostIds.values();for(let i=0;i<500;i++)seenPostIds.delete(it.next().value);}
    const link=postId?`https://t.me/${ch.channel}/${postId}`:`https://t.me/${ch.channel}`;
    const media=extractTgMedia(msg);
    const postObj={text,source:ch.label,pubDate:pubDate.toISOString(),link,zone:ch.zone,ty:ch.ty,channel:ch.channel,media};
    liveTelegramPosts.push(postObj);
    if(liveTelegramPosts.length>MAX_TG_POSTS)liveTelegramPosts.shift();
    addLiveItem(text,ch.label,pubDate.toISOString(),link,ch.zone,ch.ty,true,media);
    added++;
  });
  return added>0;
}

// ── Match a post to conflict zones by keyword ───────────────────────────────
function matchZones(text){
  const matches=[];
  for(const[zone,patterns]of Object.entries(ZONE_KEYWORDS)){
    if(patterns.some(re=>re.test(text)))matches.push(zone);
  }
  return matches;
}

// ── Get real posts relevant to a specific conflict zone ──────────────────────
function getPostsForZone(regionOrName){
  const zone=regionOrName;
  return liveTelegramPosts.filter(p=>{
    if(p.zone===zone)return true;
    const kw=ZONE_KEYWORDS[zone];
    if(kw&&kw.some(re=>re.test(p.text)))return true;
    return false;
  }).slice(-20);
}

// ── Master refresh ───────────────────────────────────────────────────────────
let tgFetchOk=false;
let feedRefreshing=false;
async function refreshLiveFeed(){
  if(feedRefreshing)return;// prevent overlapping refreshes
  feedRefreshing=true;
  const statusEl=document.getElementById('feed-status');
  statusEl.textContent='SYNCING…';
  statusEl.style.color='var(--warning)';

  const preCount=liveTelegramPosts.length;

  // Run news queries and Telegram channels in parallel batches for speed
  // News: all at once (different endpoints, no rate limit concern)
  const newsPromises=FEED_QUERIES.map((q,i)=>
    new Promise(r=>setTimeout(()=>fetchNewsQuery(q).then(r).catch(r),i*200))
  );
  const rssPromises=RSS_FEEDS.map((feed,i)=>
    new Promise(r=>setTimeout(()=>fetchRSSFeed(feed).then(r).catch(r),i*300))
  );

  // Telegram: stagger 400ms apart (respect rate limits but faster than 800ms)
  const tgPromises=TELEGRAM_OSINT_CHANNELS.map((ch,i)=>
    new Promise(r=>setTimeout(()=>fetchTelegramChannel(ch).then(r).catch(r),i*400))
  );

  await Promise.allSettled([...newsPromises,...rssPromises,...tgPromises]);

  const postCount=liveTelegramPosts.length;
  const newPosts=postCount-preCount;
  if(postCount>0){
    tgFetchOk=true;
    statusEl.textContent=`LIVE // ${postCount} POSTS`;
    statusEl.style.color='var(--accent2)';
    const osintDots=document.querySelectorAll('.sd.a');
    osintDots.forEach(d=>{d.classList.remove('a');d.classList.add('g');});
  }else{
    statusEl.textContent='NEWS ONLY // TG RETRY 60s';
    statusEl.style.color='var(--warning)';
  }
  console.log(`[WWO] Feed sync: ${newPosts} new Telegram posts, ${postCount} total, ${ofE.children.length} feed items`);
  feedRefreshing=false;
}

// Initial load, then rapid refresh every 60 seconds for near-real-time
refreshLiveFeed();
fetchOutages();
setInterval(fetchOutages,5*60*1000);
setInterval(refreshLiveFeed,60*1000);// 60s refresh for near-real-time

// Quick Telegram-only refresh every 30s (primary channels only)
setInterval(async()=>{
  if(feedRefreshing||orreryActive)return;
  const primaryChannels=TELEGRAM_OSINT_CHANNELS.slice(0,4);
  for(const ch of primaryChannels){
    await fetchTelegramChannel(ch);
    await new Promise(r=>setTimeout(r,300));
  }
},30*1000);
