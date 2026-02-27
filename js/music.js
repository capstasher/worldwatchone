// ====== MUSIC PLAYER ======
const MP_TRACKS=[
  {url:'https://files.catbox.moe/xgbu31.mp3',title:'Track 01',artist:'Unknown'},
  {url:'https://files.catbox.moe/geu3j2.mp3',title:'Track 02',artist:'Unknown'},
  {url:'https://files.catbox.moe/0x5hts.mp3',title:'Track 03',artist:'Unknown'},
  {url:'https://files.catbox.moe/7wb85p.mp3',title:'Track 04',artist:'Unknown'},
  {url:'https://files.catbox.moe/tmv1gj.mp3',title:'Track 05',artist:'Unknown'},
  {url:'https://files.catbox.moe/oznoq2.mp3',title:'Track 06',artist:'Unknown'},


];
let mpAudio=new Audio();
mpAudio.preload='metadata';
let mpQueue=[];
let mpIdx=-1;
let mpPlaying=false;

// Shuffle without repeats
function mpShuffle(){
  mpQueue=[...Array(MP_TRACKS.length).keys()];
  for(let i=mpQueue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[mpQueue[i],mpQueue[j]]=[mpQueue[j],mpQueue[i]];}
}
mpShuffle();

function mpFmt(s){
  if(!s||!isFinite(s))return '0:00';
  const m=Math.floor(s/60),sec=Math.floor(s%60);
  return m+':'+(sec<10?'0':'')+sec;
}

function mpSetScroll(el,wrapEl){
  el.classList.remove('scrolling');
  el.style.removeProperty('--scroll-dur');
  el.style.removeProperty('--scroll-dist');
  requestAnimationFrame(()=>{
    const tw=el.scrollWidth, ww=wrapEl.clientWidth;
    if(tw>ww+4){
      const dist=tw-ww+20;
      const dur=Math.max(4,dist/30);
      el.style.setProperty('--scroll-dist','-'+dist+'px');
      el.style.setProperty('--scroll-dur',dur+'s');
      el.classList.add('scrolling');
    }
  });
}

function mpUpdateUI(){
  const track=mpIdx>=0&&mpIdx<mpQueue.length?MP_TRACKS[mpQueue[mpIdx]]:null;
  const title=track?track.title:'—';
  const artist=track?track.artist:'—';
  const icon=mpPlaying?'⏸':'▶';
  // Update sidebar player
  const tEl=document.getElementById('mp-title');
  const aEl=document.getElementById('mp-artist');
  if(tEl){tEl.textContent=title;mpSetScroll(tEl,tEl.parentElement);}
  if(aEl){aEl.textContent=artist;mpSetScroll(aEl,aEl.parentElement);}
  const pb=document.getElementById('mp-play');
  if(pb)pb.innerHTML='<span>'+icon+'</span>';
  // Update float player
  const tElF=document.getElementById('mp-title-f');
  const aElF=document.getElementById('mp-artist-f');
  if(tElF){tElF.textContent=title;mpSetScroll(tElF,tElF.parentElement);}
  if(aElF){aElF.textContent=artist;mpSetScroll(aElF,aElF.parentElement);}
  const pbF=document.getElementById('mp-play-f');
  if(pbF)pbF.innerHTML='<span>'+icon+'</span>';
}

function mpUpdateProgress(){
  const cur=mpAudio.currentTime||0;
  const dur=mpAudio.duration||0;
  const pct=dur>0?(cur/dur)*100:0;
  // Sidebar
  const fill=document.getElementById('mp-bar-fill');
  if(fill)fill.style.width=pct+'%';
  const tc=document.getElementById('mp-time-cur');
  if(tc)tc.textContent=mpFmt(cur);
  const td=document.getElementById('mp-time-dur');
  if(td)td.textContent=mpFmt(dur);
  // Float
  const fillF=document.getElementById('mp-bar-fill-f');
  if(fillF)fillF.style.width=pct+'%';
  const tcF=document.getElementById('mp-time-cur-f');
  if(tcF)tcF.textContent=mpFmt(cur);
  const tdF=document.getElementById('mp-time-dur-f');
  if(tdF)tdF.textContent=mpFmt(dur);
}

function mpLoad(idx){
  mpIdx=idx;
  const track=MP_TRACKS[mpQueue[mpIdx]];
  mpAudio.src=track.url;
  mpAudio.load();
  mpUpdateUI();
  mpUpdateProgress();
  // Try to read ID3 metadata
  mpReadMeta(track.url, mpQueue[mpIdx]);
}

function mpPlay(){
  mpAudio.play().then(()=>{mpPlaying=true;mpUpdateUI();}).catch(e=>console.warn('[MP]',e));
}

function mpPause(){
  mpAudio.pause();mpPlaying=false;mpUpdateUI();
}

function mpToggle(){
  if(mpIdx<0){mpLoad(0);mpPlay();return;}
  if(mpPlaying)mpPause();else mpPlay();
}

function mpNext(){
  let next=mpIdx+1;
  if(next>=mpQueue.length){mpShuffle();next=0;}
  mpLoad(next);
  if(mpPlaying)mpPlay();
}

function mpPrev(){
  // If >3s in, restart; else go back
  if(mpAudio.currentTime>3){mpAudio.currentTime=0;return;}
  let prev=mpIdx-1;
  if(prev<0)prev=mpQueue.length-1;
  mpLoad(prev);
  if(mpPlaying)mpPlay();
}

mpAudio.addEventListener('ended',()=>mpNext());
mpAudio.addEventListener('timeupdate',mpUpdateProgress);
mpAudio.addEventListener('loadedmetadata',mpUpdateProgress);

// Progress bar click-to-seek
['mp-bar-wrap','mp-bar-wrap-f'].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener('click',e=>{
    const rect=el.getBoundingClientRect();
    const pct=(e.clientX-rect.left)/rect.width;
    if(mpAudio.duration)mpAudio.currentTime=pct*mpAudio.duration;
  });
});

// ID3 metadata reader (basic — reads title/artist from mp3 headers)
async function mpReadMeta(url, trackIdx){
  try{
    const resp=await fetch(url,{headers:{'Range':'bytes=0-4096'}});
    const buf=await resp.arrayBuffer();
    const view=new DataView(buf);
    // Check for ID3v2
    if(view.getUint8(0)===0x49&&view.getUint8(1)===0x44&&view.getUint8(2)===0x33){
      const bytes=new Uint8Array(buf);
      const text=new TextDecoder('utf-8',{fatal:false});
      // Find TIT2 (title)
      const tit2=findID3Frame(bytes,'TIT2');
      if(tit2)MP_TRACKS[trackIdx].title=tit2;
      // Find TPE1 (artist)
      const tpe1=findID3Frame(bytes,'TPE1');
      if(tpe1)MP_TRACKS[trackIdx].artist=tpe1;
      mpUpdateUI();
    }
  }catch(e){/* ignore metadata read failures */}
}

function findID3Frame(bytes,frameId){
  const needle=new TextEncoder().encode(frameId);
  for(let i=10;i<bytes.length-10;i++){
    if(bytes[i]===needle[0]&&bytes[i+1]===needle[1]&&bytes[i+2]===needle[2]&&bytes[i+3]===needle[3]){
      const size=(bytes[i+4]<<24)|(bytes[i+5]<<16)|(bytes[i+6]<<8)|bytes[i+7];
      if(size>0&&size<2000){
        // Skip frame header (10 bytes) + encoding byte
        const enc=bytes[i+10];
        let start=i+11,end=i+10+size;
        if(enc===1||enc===2){
          // UTF-16, skip BOM
          start+=2;
          let str='';
          for(let j=start;j<end-1;j+=2){
            const c=enc===2?(bytes[j]<<8)|bytes[j+1]:(bytes[j+1]<<8)|bytes[j];
            if(c===0)break;
            str+=String.fromCharCode(c);
          }
          return str.trim();
        }else if(enc===3){
          // UTF-8
          return new TextDecoder('utf-8').decode(bytes.slice(start,end)).replace(/\0/g,'').trim();
        }else{
          // ISO-8859-1
          let str='';
          for(let j=start;j<end;j++){if(bytes[j]===0)break;str+=String.fromCharCode(bytes[j]);}
          return str.trim();
        }
      }
    }
  }
  return null;
}

// Load first track metadata
mpLoad(0);
mpAudio.volume=0.8;

// Volume controls
function mpSetVol(v){
  mpAudio.volume=v/100;
  // Sync both sliders
  const s1=document.getElementById('mp-vol-slider');
  const s2=document.getElementById('mp-vol-slider-f');
  if(s1)s1.value=v;
  if(s2)s2.value=v;
}

let _mpVolJustOpened=false;
function mpVolToggle(which,evt){
  if(evt)evt.stopPropagation();
  const isFloat=which==='float';
  const tray=document.getElementById(isFloat?'mp-vol-tray-f':'mp-vol-tray');
  const strip=document.getElementById(isFloat?'mp-vol-strip-f':'mp-vol-strip');
  if(!tray||!strip)return;
  const isOpen=tray.classList.contains('open');
  // Close all trays
  document.querySelectorAll('.mp-vol-tray').forEach(t=>{t.classList.remove('open');t.style.display='none';});
  if(!isOpen){
    // Position tray next to the strip
    const r=strip.getBoundingClientRect();
    tray.style.display='flex';
    tray.style.top=r.top+'px';
    tray.style.height=r.height+'px';
    if(isFloat){
      // Float: tray to the LEFT of the strip
      tray.style.left=(r.left-33)+'px';
      tray.style.right='auto';
    }else{
      // Sidebar: tray to the RIGHT of the strip
      tray.style.left=(r.right+1)+'px';
      tray.style.right='auto';
    }
    // Force reflow then animate
    void tray.offsetWidth;
    tray.classList.add('open');
    _mpVolJustOpened=true;
    setTimeout(()=>{_mpVolJustOpened=false;},50);
  }
}

// Close volume tray when clicking elsewhere
document.addEventListener('click',e=>{
  if(_mpVolJustOpened)return;
  if(!e.target.closest('.mp-vol-strip')&&!e.target.closest('.mp-vol-tray')){
    document.querySelectorAll('.mp-vol-tray').forEach(t=>{t.classList.remove('open');t.style.display='none';});
  }
});

// Space mode: show floating player when orrery animation completes
(function(){
  const origPhaseSet=Object.getOwnPropertyDescriptor(Object.prototype,'phase');
  let lastPhase='';
  const checkOrrery=setInterval(()=>{
    if(typeof orreryReveal!=='undefined'&&orreryReveal.phase==='done'){
      const fl=document.getElementById('mp-float');
      if(fl&&!fl.classList.contains('visible')){
        fl.style.display='block';
        requestAnimationFrame(()=>requestAnimationFrame(()=>fl.classList.add('visible')));
        // Push planet-detail down
        const pd=document.getElementById('planet-detail');
        if(pd)pd.style.top='auto';
      }
    }
    if(typeof orreryActive!=='undefined'&&!orreryActive){
      const fl=document.getElementById('mp-float');
      if(fl&&fl.classList.contains('visible')){
        fl.classList.remove('visible');
        setTimeout(()=>{fl.style.display='none';},600);
        const pd=document.getElementById('planet-detail');
        if(pd)pd.style.top='52px';
      }
    }
  },500);
})();

