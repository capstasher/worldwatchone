// ====== UTIL — Shared helpers, math constants, canvas icon generators ======

const Rd=Math.PI/180,Dg=180/Math.PI;
function gcArc(a,b,n=80){const[la,lo]=[a[0]*Rd,a[1]*Rd],[lb,lob]=[b[0]*Rd,b[1]*Rd];const d=2*Math.asin(Math.sqrt(Math.sin((la-lb)/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin((lo-lob)/2)**2));if(d<1e-6)return[[a[1],a[0]],[b[1],b[0]]];const p=[];for(let i=0;i<=n;i++){const f=i/n,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d),x=A*Math.cos(la)*Math.cos(lo)+B*Math.cos(lb)*Math.cos(lob),y=A*Math.cos(la)*Math.sin(lo)+B*Math.cos(lb)*Math.sin(lob),z=A*Math.sin(la)+B*Math.sin(lb);p.push([Math.atan2(y,x)*Dg,Math.atan2(z,Math.sqrt(x*x+y*y))*Dg]);}return p;}


function brng(a,b){return Math.atan2(b[0]-a[0],b[1]-a[1])*Dg;}
function confCol(i){return i>0.75?'#ee1100':i>0.5?'#dd5500':'#cc8800';}

function mkImg(draw,sz=32){const c=document.createElement('canvas');c.width=sz;c.height=sz;draw(c.getContext('2d'),sz);return{width:sz,height:sz,data:new Uint8Array(c.getContext('2d').getImageData(0,0,sz,sz).data)};}
function planeImg(col){return mkImg((x,s)=>{x.translate(s/2,s/2);x.fillStyle=col;x.beginPath();x.moveTo(0,-13);x.lineTo(3.5,-6);x.lineTo(3.5,0);x.lineTo(12,6.5);x.lineTo(12,8.5);x.lineTo(3.5,4);x.lineTo(3.5,8.5);x.lineTo(6.5,11.5);x.lineTo(6.5,13);x.lineTo(0,11);x.lineTo(-6.5,13);x.lineTo(-6.5,11.5);x.lineTo(-3.5,8.5);x.lineTo(-3.5,4);x.lineTo(-12,8.5);x.lineTo(-12,6.5);x.lineTo(-3.5,0);x.lineTo(-3.5,-6);x.closePath();x.fill();});}
function satImg(col){return mkImg((x,s)=>{x.translate(s/2,s/2);x.fillStyle=col;x.globalAlpha=0.85;x.fillRect(-2.5,-6,5,12);x.globalAlpha=0.65;x.fillRect(-11,-4,8,8);x.fillRect(3,-4,8,8);x.globalAlpha=1;x.strokeStyle=col;x.lineWidth=0.8;x.beginPath();x.moveTo(-7,-4);x.lineTo(-7,4);x.moveTo(7,-4);x.lineTo(7,4);x.stroke();x.beginPath();x.arc(0,-7.5,2,0,Math.PI*2);x.stroke();},28);}


function timeAgo(dateStr){
  const diff=Date.now()-new Date(dateStr).getTime();
  const m=Math.floor(diff/60000);
  if(isNaN(m)||m<0)return'just now';
  if(m<1)return'<1m ago';
  if(m<60)return m+'m ago';
  const h=Math.floor(m/60);
  if(h<24)return h+'h ago';
  return Math.floor(h/24)+'d ago';
}

// Strip HTML tags from tweet excerpts
function stripHtml(s){return s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}



// Feed dedup set and classifier — shared by addLiveItem and osint.js
const liveFeedItems=new Set();

function classifyTy(title){
  const t=(title||'').toLowerCase();
  if(/kill|dead|attack|strike|bomb|missile|blast|casualt|shot|fire|explo|intercept|drone/.test(t))return'al';
  if(/warn|threat|concern|escalat|tension|risk|alert|sanction|seize|arrest|nuclear/.test(t))return'wa';
  return'in';
}

function addLiveItem(title,source,pubDate,link,zone,ty,isTweet=false,media=[]){
  // Dedup key: source + first 80 chars
  const key=(source||'')+'|'+(title||'').slice(0,80);
  if(!key||liveFeedItems.has(key))return;
  liveFeedItems.add(key);
  if(liveFeedItems.size>500){const first=liveFeedItems.values().next().value;liveFeedItems.delete(first);}

  const el=document.createElement('div');
  const itemTy=classifyTy(title)||ty||'in';
  el.className='fi '+itemTy;

  const ts=pubDate?new Date(pubDate).getTime():0;
  el.dataset.ts=ts;

  const badge=isTweet
    ? `<span style="color:#1d9bf0;font-size:8px;font-family:var(--ft);letter-spacing:1px;border:1px solid rgba(29,155,240,0.3);padding:1px 4px;border-radius:2px">TELEGRAM</span>`
    : `<span style="color:var(--text-dim);font-size:9px;font-family:var(--fm)">${zone.toUpperCase()}</span>`;

  // Media strip — thumbnails that expand on click
  let mediaHtml='';
  if(media&&media.length>0){
    const thumbs=media.map((m,i)=>{
      const isVideo=m.type==='video';
      const hasThumb=!!(m.thumb||m.url);
      // Video with no thumbnail: show a styled placeholder instead of broken img
      const imgOrPlaceholder=hasThumb
        ? `<img src="${m.thumb||m.url}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy" onerror="this.style.display='none';this.nextSibling&&(this.nextSibling.style.background='rgba(0,0,0,0.5)')">` 
        : `<div style="width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center"></div>`;
      const overlay=isVideo?`<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:18px;pointer-events:none;text-shadow:0 0 6px rgba(0,0,0,0.8)">▶</span>`:'';
      return `<div class="fi-thumb" data-idx="${i}" style="position:relative;display:inline-block;width:60px;height:45px;overflow:hidden;border-radius:2px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;background:#0a0a0a">` +
        imgOrPlaceholder +
        overlay + `</div>`;
    }).join('');
    mediaHtml=`<div class="fi-media" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px">${thumbs}</div>`;
  }

  el.innerHTML=
    `<div class="fs" style="display:flex;justify-content:space-between;align-items:center">`+
      `<span>${source}</span>${badge}`+
    `</div>`+
    `<div style="font-size:10px;line-height:1.45">${title}</div>`+
    mediaHtml+
    `<div class="ft">${timeAgo(pubDate)}</div>`;

  // Click: if has media, clicking text opens link; clicking thumb opens lightbox
  if(media&&media.length>0){
    el.querySelectorAll('.fi-thumb').forEach(thumb=>{
      thumb.addEventListener('click',e=>{
        e.stopPropagation();
        openMediaLightbox(media,parseInt(thumb.dataset.idx));
      });
    });
    if(link){
      el.style.cursor='pointer';
      el.addEventListener('click',()=>window.open(link,'_blank','noopener'));
    }
  } else if(link){
    el.style.cursor='pointer';
    el.addEventListener('click',()=>window.open(link,'_blank','noopener'));
  }

  // Insert sorted newest first
  let inserted=false;
  if(ts>0){
    const ofE=document.getElementById('of');
    if(!ofE)return;
    for(const child of ofE.children){
      const childTs=Number(child.dataset.ts)||0;
      if(ts>childTs){ofE.insertBefore(el,child);inserted=true;break;}
    }
  }
  if(!inserted){const ofE=document.getElementById('of');if(ofE)ofE.appendChild(el);}
  const ofE=document.getElementById('of');
  if(ofE)while(ofE.children.length>2000)ofE.removeChild(ofE.lastChild);
}

// ── Media lightbox ──────────────────────────────────────────────────────────
function openMediaLightbox(media,startIdx=0){
  // Remove any existing lightbox
  const existing=document.getElementById('media-lb');
  if(existing)existing.remove();

  let idx=startIdx;
  const lb=document.createElement('div');
  lb.id='media-lb';
  lb.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px';

  function render(){
    const m=media[idx];
    const isVideo=m.type==='video';
    const counter=media.length>1?`<div style="color:rgba(255,255,255,0.5);font-family:var(--ft);font-size:10px;letter-spacing:2px">${idx+1} / ${media.length}</div>`:'';
    const nav=media.length>1
      ? `<div style="display:flex;gap:20px;margin-top:8px">
           <button class="lb-prev" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;font-family:var(--ft);padding:4px 14px;cursor:pointer;border-radius:2px">◀</button>
           <button class="lb-next" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;font-family:var(--ft);padding:4px 14px;cursor:pointer;border-radius:2px">▶</button>
         </div>` : '';
    lb.innerHTML=
      `<div style="position:absolute;top:16px;right:20px;color:rgba(255,255,255,0.4);font-size:20px;cursor:pointer;font-family:var(--ft)" id="lb-close">✕</div>`+
      counter+
      (isVideo
        ? `<video src="${m.url}" controls autoplay style="max-width:90vw;max-height:75vh;border-radius:3px"></video>`
        : `<img src="${m.url||m.thumb}" style="max-width:90vw;max-height:75vh;border-radius:3px;object-fit:contain">`)+
      nav;
    lb.querySelector('#lb-close').onclick=()=>lb.remove();
    lb.onclick=e=>{if(e.target===lb)lb.remove();};
    const prev=lb.querySelector('.lb-prev');
    const next=lb.querySelector('.lb-next');
    if(prev)prev.onclick=e=>{e.stopPropagation();idx=(idx-1+media.length)%media.length;render();};
    if(next)next.onclick=e=>{e.stopPropagation();idx=(idx+1)%media.length;render();};
  }

  render();
  document.body.appendChild(lb);

  // Keyboard nav
  function onKey(e){
    if(e.key==='Escape'){lb.remove();document.removeEventListener('keydown',onKey);}
    if(e.key==='ArrowLeft'&&media.length>1){idx=(idx-1+media.length)%media.length;render();}
    if(e.key==='ArrowRight'&&media.length>1){idx=(idx+1)%media.length;render();}
  }
  document.addEventListener('keydown',onKey);
}

// ── News fetcher ─────────────────────────────────────────────────────────────
// Parse RSS XML string into array of {title, link, pubDate, source}

function parseRSSXml(xmlStr){
  try{
    const parser=new DOMParser();
    const doc=parser.parseFromString(xmlStr,'text/xml');
    const items=doc.querySelectorAll('item');
    const results=[];
    items.forEach(item=>{
      const title=item.querySelector('title')?.textContent||'';
      const link=item.querySelector('link')?.textContent||'';
      const pubDate=item.querySelector('pubDate')?.textContent||'';
      const source=item.querySelector('source')?.textContent||'';
      if(title)results.push({title,link,pubDate,source});
    });
    return results;
  }catch(e){return[];}
}
