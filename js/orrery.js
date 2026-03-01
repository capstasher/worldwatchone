// ====== SOLAR SYSTEM ORRERY ======
// Keplerian orbital elements (J2000 epoch + rates per century)
// Source: JPL Solar System Dynamics / Standish (1992)
const PLANETS=[
  {name:'Mercury',symbol:'☿',a:0.38709927,e:0.20563593,I:7.00497902,L:252.25032350,
   lp:77.45779628,node:48.33076593,da:0.00000037,de:0.00001906,dI:-0.00594749,
   dL:149472.67411175,dlp:0.16047689,dnode:-0.12534081,
   radius:2440,distKm:57.9e6,
   desc:'Smallest planet, closest to the Sun. Extreme temperature swings.',
   facts:['Day: 176 Earth days','Year: 88 Earth days','Moons: 0','Surface temp: -180°C to 430°C'],
   dispR:0.07},// display radius as fraction of orbit spacing
  {name:'Venus',symbol:'♀',a:0.72333566,e:0.00677672,I:3.39467605,L:181.97909950,
   lp:131.60246718,node:76.67984255,da:0.00000390,de:-0.00004107,dI:-0.00078890,
   dL:58517.81538729,dlp:0.00268329,dnode:-0.27769418,
   radius:6052,distKm:108.2e6,
   desc:'Hottest planet due to runaway greenhouse effect. Retrograde rotation.',
   facts:['Day: 243 Earth days','Year: 225 Earth days','Moons: 0','Surface temp: 465°C'],
   dispR:0.08},
  {name:'Earth',symbol:'⊕',a:1.00000261,e:0.01671123,I:-0.00001531,L:100.46457166,
   lp:102.93768193,node:0.0,da:0.00000562,de:-0.00004392,dI:-0.01294668,
   dL:35999.37244981,dlp:0.32327364,dnode:0.0,
   radius:6371,distKm:149.6e6,
   desc:'Our home. The only known planet with life.',
   facts:['Day: 24 hours','Year: 365.25 days','Moons: 1','Surface temp: -89°C to 57°C'],
   dispR:0.085},
  {name:'Mars',symbol:'♂',a:1.52371034,e:0.09339410,I:1.84969142,L:-4.55343205,
   lp:-23.94362959,node:49.55953891,da:0.00001847,de:0.00007882,dI:-0.00813131,
   dL:19140.30268499,dlp:0.44441088,dnode:-0.29257343,
   radius:3390,distKm:227.9e6,
   desc:'The Red Planet. Target of human colonisation efforts.',
   facts:['Day: 24h 37m','Year: 687 Earth days','Moons: 2 (Phobos, Deimos)','Surface temp: -140°C to 20°C'],
   dispR:0.07},
  {name:'Jupiter',symbol:'♃',a:5.20288700,e:0.04838624,I:1.30439695,L:34.39644051,
   lp:14.72847983,node:100.47390909,da:-0.00011607,de:-0.00013253,dI:-0.00183714,
   dL:3034.74612775,dlp:0.21252668,dnode:0.20469106,
   radius:69911,distKm:778.5e6,
   desc:'Largest planet. Great Red Spot storm larger than Earth.',
   facts:['Day: 9h 56m','Year: 11.86 Earth years','Moons: 95+','Mass: 318× Earth'],
   dispR:0.13},
  {name:'Saturn',symbol:'♄',a:9.53667594,e:0.05386179,I:2.48599187,L:49.95424423,
   lp:92.59887831,node:113.66242448,da:-0.00125060,de:-0.00050991,dI:0.00193609,
   dL:1222.49362201,dlp:-0.41897216,dnode:-0.28867794,
   radius:58232,distKm:1.434e9,
   desc:'Famous for its spectacular ring system. Least dense planet.',
   facts:['Day: 10h 42m','Year: 29.46 Earth years','Moons: 146+','Rings: 7 main groups'],
   dispR:0.12},
  {name:'Uranus',symbol:'♅',a:19.18916464,e:0.04725744,I:0.77263783,L:313.23810451,
   lp:170.95427630,node:74.01692503,da:-0.00196176,de:-0.00004397,dI:-0.00242939,
   dL:428.48202785,dlp:0.40805281,dnode:0.04240589,
   radius:25362,distKm:2.871e9,
   desc:'Ice giant tilted 98°. Rolls on its side around the Sun.',
   facts:['Day: 17h 14m','Year: 84 Earth years','Moons: 28+','Axial tilt: 97.77°'],
   dispR:0.09},
  {name:'Neptune',symbol:'♆',a:30.06992276,e:0.00859048,I:1.77004347,L:-55.12002969,
   lp:44.96476227,node:131.78422574,da:0.00026291,de:0.00005105,dI:0.00035372,
   dL:218.45945325,dlp:-0.32241464,dnode:-0.00508664,
   radius:24622,distKm:4.495e9,
   desc:'Windiest planet. Supersonic storms of 2100 km/h.',
   facts:['Day: 16h 6m','Year: 164.8 Earth years','Moons: 16+','Wind speed: 2100 km/h'],
   dispR:0.09},
];

const MOON={name:'Moon',symbol:'☽',a:0.00257,period:27.321661,e:0.0549,I:5.145,
  radius:1737,desc:'Earth\'s only natural satellite. Tidally locked.',
  facts:['Distance: 384,400 km','Orbital period: 27.3 days','Diameter: 3,474 km','Surface gravity: 0.166g']
};

const J2000=2451545.0;
function jdNow(){return 2440587.5+Date.now()/86400000;}
function centuriesSinceJ2000(jd){return(jd-J2000)/36525;}

function planetPosition(p,T){
  const a=p.a+p.da*T,e=p.e+p.de*T;
  const L=(p.L+p.dL*T)%360,lp=(p.lp+p.dlp*T)%360;
  let M=((L-lp)%360+360)%360*Math.PI/180;
  let E=M;
  for(let i=0;i<12;i++){const dE=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=dE;if(Math.abs(dE)<1e-10)break;}
  const v=2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2),Math.sqrt(1-e)*Math.cos(E/2));
  const r=a*(1-e*Math.cos(E));
  const x=r*Math.cos(v+lp*Math.PI/180),y=r*Math.sin(v+lp*Math.PI/180);
  return{x,y,r,a};
}

function moonPosition(earthPos,jd){
  const d=jd-J2000;
  // Visual speedup: real moon barely moves on human timescales
  // Use 1000x speed for display so a full orbit takes ~39 minutes instead of 27 days
  const moonSpeedFactor=1000;
  const lng=(218.316+13.176396*d*moonSpeedFactor)%360;
  const Mm=(134.963+13.064993*d*moonSpeedFactor)%360;
  const l2=lng+6.289*Math.sin(Mm*Math.PI/180);
  const dist=0.00257;
  return{x:earthPos.x+dist*Math.cos(l2*Math.PI/180),y:earthPos.y+dist*Math.sin(l2*Math.PI/180)};
}

// ── Non-proportional orbit layout (fits screen) ──────────────────────────────
// Each planet gets an evenly spaced ring so everything is visible
function orbitRadius(idx,maxR){
  // Sun=0, Mercury=1..Neptune=8, with some spacing
  const spacing=maxR/(PLANETS.length+1.5);
  return spacing*(idx+1.2);
}

// ── Orrery state ─────────────────────────────────────────────────────────────
let orreryActive=false,orreryCtx=null,orreryAnimId=null;
let planetScreenPos=[];
let hoveredBody=null,selectedBody=null;
let hoverAnimProgress={};
let transitionPhase=0;

// Orrery reveal state
let orreryReveal={
  phase:'idle',// idle|shrinkCircle|moveToOrbit|flashOrbit|flashBodies|spinning|done
  visibleBodies:new Set(),
  spinAngle:0,// current spin offset in radians
  spinSpeed:0,// radians per frame
  targetAngles:null,// real angles for each planet
  lineupAngles:null,// lineup angles (all left of sun)
  spinProgress:0,// 0→1 for deceleration
  bodyAngles:{},// current animated angle per planet
};

function toggleSpaceTab(){
  if(orreryActive){closeOrrery();return;}
  startTransitionToSpace();
}

// ── TRANSITION: Earth → Space ────────────────────────────────────────────────
function startTransitionToSpace(){
  transitionPhase=1;
  orreryReveal={phase:'idle',visibleBodies:new Set(),spinAngle:0,spinSpeed:0,targetAngles:null,lineupAngles:null,spinProgress:0,bodyAngles:{}};

  // Compute real planet angles now (we'll spin to these later)
  const jd=jdNow(),T=centuriesSinceJ2000(jd);
  const realAngles={};
  PLANETS.forEach(p=>{
    const pos=planetPosition(p,T);
    realAngles[p.name]=Math.atan2(pos.y,pos.x);
  });
  // Moon angle relative to Earth
  const earthPos=planetPosition(PLANETS[2],T);
  const mpos=moonPosition(earthPos,jd);
  realAngles['Moon']=Math.atan2(mpos.y-earthPos.y,mpos.x-earthPos.x);
  orreryReveal.targetAngles=realAngles;

  // ── Phase 1: Flash-off data layers ──
  const statusDots=document.querySelectorAll('.sys-info .sd');
  const statusDivs=document.querySelectorAll('.sys-info > div');
  statusDots.forEach(dot=>{
    dot.dataset.origClass=dot.className;
    dot.classList.remove('g','a');dot.style.background='var(--danger)';dot.style.boxShadow='0 0 6px var(--danger)';
  });
  const statEls=['wiki-status','sky-status','net-status','sat-status'];
  statEls.forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.dataset.orig=el.textContent;el.textContent='DISCONNECTING';el.style.color='var(--danger)';el.classList.add('disco');}
  });
  statusDivs.forEach(div=>{
    if(!div.id&&!div.querySelector('button')&&!div.querySelector('#utc')){
      div.dataset.origColor=div.style.color||'';div.style.color='var(--danger)';div.style.transition='color 0.3s';
    }
  });

  const layerKeys=Object.keys(layerVis).filter(k=>layerVis[k]);
  let layerIdx=0;
  function flashOffLayer(){
    if(layerIdx>=layerKeys.length){setTimeout(startPhase2,300);return;}
    const key=layerKeys[layerIdx];
    let flashes=0;
    function doFlash(){
      if(flashes>=4){
        if(layerVis[key]){const el=document.querySelector(`.lt[data-l="${key}"]`);if(el)togL(el);}
        layerIdx++;
        setTimeout(flashOffLayer,80);
        return;
      }
      const vis=flashes%2===0?'none':'visible';
      if(lMap[key])lMap[key].forEach(id=>{try{map.setLayoutProperty(id,'visibility',vis);}catch(e){}});
      flashes++;
      setTimeout(doFlash,60);
    }
    doFlash();
  }
  flashOffLayer();

  function startPhase2(){
    transitionPhase=2;
    document.getElementById('pl')?.classList.add('slide-out');
    document.getElementById('pr')?.classList.add('slide-out');
    document.getElementById('search-box')?.classList.add('slide-out');
    document.getElementById('bb')?.classList.add('slide-out');
    // Sync orrery bottom bar NERV/CTRL label
    const oBtn=document.getElementById('nerv-btn-orr');
    if(oBtn)oBtn.textContent=nervMode?'CTRL':'NERV';

    statEls.forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.textContent='OFFLINE';el.style.color='var(--text-dim)';el.classList.remove('disco');}
    });
    statusDots.forEach(dot=>{dot.style.background='var(--text-dim)';dot.style.boxShadow='none';});
    statusDivs.forEach(div=>{
      if(!div.id&&!div.querySelector('button')&&!div.querySelector('#utc'))div.style.color='var(--text-dim)';
    });

    animateTitle(true);
    const btn=document.getElementById('space-btn');
    if(btn)btn.textContent='⊕ EARTH';

    map.easeTo({zoom:0.8,center:[0,10],duration:2000});

    setTimeout(()=>{
      // ── Phase 3: Globe → amber circle ──
      transitionPhase=3;
      const tc=document.getElementById('transition-circle');
      const cx=window.innerWidth/2,cy=(window.innerHeight-42)/2+42;
      const globeR=Math.min(window.innerWidth,window.innerHeight-42)*0.32;
      tc.style.display='block';
      tc.style.left=(cx-globeR)+'px';tc.style.top=(cy-globeR)+'px';
      tc.style.width=(globeR*2)+'px';tc.style.height=(globeR*2)+'px';
      tc.style.opacity='1';
      document.getElementById('map').style.opacity='0';

      // Hide status indicators after they served their purpose
      setTimeout(()=>{
        statEls.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
        statusDots.forEach(dot=>dot.style.display='none');
        statusDivs.forEach(div=>{
          if(!div.id&&!div.querySelector('button')&&!div.querySelector('#utc'))div.style.display='none';
        });
      },500);

      setTimeout(()=>{
        // ── Phase 4: Start orrery canvas, shrink circle to Earth's FINAL size ──
        transitionPhase=4;
        orreryReveal.phase='shrinkCircle';
        orreryActive=true;
        const overlay=document.getElementById('orrery-overlay');
        overlay.classList.add('active');
        overlay.style.background='transparent';
        const canvas=document.getElementById('orrery-canvas');
        canvas.width=window.innerWidth;canvas.height=window.innerHeight-42;
        orreryCtx=canvas.getContext('2d');
        hoveredBody=null;selectedBody=null;hoverAnimProgress={};
        closePlanetDetail();
        setupOrreryInput(canvas);

        const W=canvas.width,H=canvas.height;
        const maxR=Math.min(W,H)*0.44;
        // Earth's final position: orbit ring 3 (index 2), at the SCREEN CENTER initially
        // We'll move it LEFT to its orbit
        const earthOrbitR=orbitRadius(2,maxR);
        const earthFinalR=5.5;// planet display radius
        const canvasCX=W/2,canvasCY=H/2;

        // Step A: Shrink circle to Earth's final pixel size at screen center
        const shrinkDur=1200;
        const t0=performance.now();
        const s0={x:cx-globeR,y:cy-globeR,sz:globeR*2};
        // Target: Earth-sized circle at screen center (accounting for header offset)
        const earthPixelSz=earthFinalR*2+4;
        const targetCenterX=cx;
        const targetCenterY=cy;

        function shrinkToEarth(now){
          const p=Math.min(1,(now-t0)/shrinkDur);
          const ease=1-(1-p)*(1-p)*(1-p);
          const curSz=s0.sz+(earthPixelSz-s0.sz)*ease;
          const curX=s0.x+(targetCenterX-earthPixelSz/2-s0.x)*ease;
          const curY=s0.y+(targetCenterY-earthPixelSz/2-s0.y)*ease;
          tc.style.width=curSz+'px';tc.style.height=curSz+'px';
          tc.style.left=curX+'px';tc.style.top=curY+'px';
          if(p<1){requestAnimationFrame(shrinkToEarth);return;}

          // Step B: Move circle LEFT to Earth's orbit position
          orreryReveal.phase='moveToOrbit';
          overlay.style.background='#06080e';
          // Canvas running but NO bodies visible yet — circle IS the Earth
          orreryReveal.visibleBodies=new Set();
          const earthLineupX=canvasCX-earthOrbitR;
          const earthLineupY=canvasCY;
          const moveTargetX=earthLineupX-earthPixelSz/2;
          const moveTargetY=earthLineupY+42-earthPixelSz/2;
          const moveDur=1000;
          const mt0=performance.now();
          const ms0={x:targetCenterX-earthPixelSz/2,y:targetCenterY-earthPixelSz/2};

          // Set all display angles to π (left) for lineup
          orreryReveal.bodyAngles={};
          PLANETS.forEach(p=>{orreryReveal.bodyAngles[p.name]=Math.PI;});
          orreryReveal.bodyAngles['Moon']=Math.PI;
          orreryLoop();// start render loop (draws stars/bg only)

          function moveToOrbit(now2){
            const p2=Math.min(1,(now2-mt0)/moveDur);
            const ease2=p2*p2*(3-2*p2);
            const curX2=ms0.x+(moveTargetX-ms0.x)*ease2;
            const curY2=ms0.y+(moveTargetY-ms0.y)*ease2;
            tc.style.left=curX2+'px';tc.style.top=curY2+'px';
            if(p2<1){requestAnimationFrame(moveToOrbit);return;}

            // Circle arrived. Hide it, NOW show Earth via canvas
            tc.style.display='none';
            orreryReveal.visibleBodies.add('Earth');

            // Step C: Flash Earth's orbit ring
            orreryReveal.phase='flashOrbit';
            let orbitFlashes=0;
            orreryReveal.showEarthOrbit=false;
            function flashOrbit(){
              if(orbitFlashes>=6){
                orreryReveal.showEarthOrbit=true;
                // Step D: Flash in other bodies one by one, lined up left
                setTimeout(flashInBodies,200);
                return;
              }
              orreryReveal.showEarthOrbit=orbitFlashes%2===0;
              orbitFlashes++;
              setTimeout(flashOrbit,70);
            }
            flashOrbit();
          }
          requestAnimationFrame(moveToOrbit);
        }
        requestAnimationFrame(shrinkToEarth);
      },300);
    },2200);
  }
}

// Flash planets in one by one, all lined up to the left of the Sun
function flashInBodies(){
  orreryReveal.phase='flashBodies';
  const flashOrder=['Moon','Mars','Venus','Jupiter','Mercury','Saturn','Sun','Uranus','Neptune'];
  let bi=0;

  // All start at angle π (left of sun)
  PLANETS.forEach(p=>{orreryReveal.bodyAngles[p.name]=Math.PI;});
  orreryReveal.bodyAngles['Moon']=Math.PI;

  function flashNext(){
    if(bi>=flashOrder.length){
      setTimeout(startSpin,400);
      return;
    }
    const name=flashOrder[bi];
    let flicks=0;
    function flick(){
      if(flicks>=6){
        orreryReveal.visibleBodies.add(name);
        bi++;
        setTimeout(flashNext,80);
        return;
      }
      if(flicks%2===0)orreryReveal.visibleBodies.add(name);
      else orreryReveal.visibleBodies.delete(name);
      flicks++;
      setTimeout(flick,50);
    }
    flick();
  }
  flashNext();
}

// Spin all planets CLOCKWISE, each at its own speed, decelerating smoothly into exact position
function startSpin(){
  orreryReveal.phase='spinning';
  const totalDur=22000;
  const t0=performance.now();
  const startAngle=Math.PI;// all start at π (left)

  // Approximate revolution counts: Mercury=30, graduated down to Neptune=5
  // These are the BASE full revolutions. We'll adjust fractionally so each
  // planet lands EXACTLY on its real angle with no snapping.
  const baseRevsByPlanet={Mercury:30,Venus:22,Earth:16,Mars:12,Jupiter:9,Saturn:7,Uranus:6,Neptune:5};

  // For each planet, compute the EXACT total sweep so that:
  //   startAngle - totalSweep = targetAngle (mod 2π)
  // → totalSweep = N*2π + (startAngle - target) normalised to [0, 2π)
  // where N is our desired number of FULL revolutions
  const sweeps={};
  PLANETS.forEach(pl=>{
    const target=orreryReveal.targetAngles[pl.name];
    const N=baseRevsByPlanet[pl.name]||10;
    // How far clockwise from startAngle to target? (positive = clockwise sweep)
    let remainder=startAngle-target;
    // Normalise remainder to (0, 2π] so we always go past, not backwards
    remainder=((remainder%(2*Math.PI))+(2*Math.PI))%(2*Math.PI);
    if(remainder<0.01)remainder+=2*Math.PI;// avoid landing on zero sweep for the fractional part
    sweeps[pl.name]=N*2*Math.PI+remainder;
  });

  // Moon: lots of revs around Earth
  const moonN=35;
  {
    const mt=orreryReveal.targetAngles['Moon'];
    let mr=startAngle-mt;
    mr=((mr%(2*Math.PI))+(2*Math.PI))%(2*Math.PI);
    if(mr<0.01)mr+=2*Math.PI;
    sweeps['Moon']=moonN*2*Math.PI+mr;
  }

  // Per-planet timing: faster planets (more revs) use the full duration,
  // slower planets also use full duration but sweep less distance → appear slower.
  // Add staggered timing so they don't all stop at once:
  // Mercury finishes at ~75% of duration, Neptune at 100%
  const finishTimes={Mercury:0.70,Venus:0.75,Earth:0.80,Mars:0.83,Jupiter:0.88,Saturn:0.92,Uranus:0.96,Neptune:1.0};
  const moonFinish=0.78;

  function spinFrame(now){
    const elapsed=now-t0;
    const rawP=Math.min(1,elapsed/totalDur);
    let anyActive=false;

    PLANETS.forEach(pl=>{
      const finish=finishTimes[pl.name]||1.0;
      // This planet's local progress: 0→1 mapped within [0, finish]
      // Custom ease: slow start → fast middle → smooth deceleration
      // Combines ease-in for the first 20% with ease-out for the rest
      const localP=Math.min(1,rawP/finish);
      let ease;
      if(localP<0.15){
        // Slow start: quadratic ease-in
        const t=localP/0.15;
        ease=t*t*0.08;// maps 0→0.08 over first 15%
      }else{
        // Remap remaining 85% to quintic ease-out
        const t2=(localP-0.15)/0.85;
        const inv=1-t2;
        ease=0.08+(1-0.08)*(1-inv*inv*inv*inv*inv);
      }
      // Current angle: start minus swept distance
      orreryReveal.bodyAngles[pl.name]=startAngle-sweeps[pl.name]*ease;
      if(localP<1)anyActive=true;
    });

    // Moon
    {
      const localP=Math.min(1,rawP/moonFinish);
      let ease;
      if(localP<0.15){
        const t=localP/0.15;
        ease=t*t*0.08;
      }else{
        const t2=(localP-0.15)/0.85;
        const inv=1-t2;
        ease=0.08+(1-0.08)*(1-inv*inv*inv*inv*inv);
      }
      orreryReveal.bodyAngles['Moon']=startAngle-sweeps['Moon']*ease;
      if(localP<1)anyActive=true;
    }

    if(anyActive){
      requestAnimationFrame(spinFrame);
    }else{
      // All planets at their exact targets — switch to real-time mode
      orreryReveal.phase='done';
      orreryReveal.visibleBodies=null;
      document.getElementById('orrery-info')?.classList.add('visible');
    }
  }
  requestAnimationFrame(spinFrame);
}

function animateTitle(toSpace){
  const logoEl=document.querySelector('#header .logo');
  if(!logoEl)return;
  const spanEl=logoEl.querySelector('span');
  const origWord=toSpace?'WORLD':'SPACE';
  const newWord=toSpace?'SPACE':'WORLD';
  const subtitle=toSpace?'SOLAR SYSTEM // REAL-TIME ORBITAL POSITIONS':'GLOBAL MONITORING v4.0.0 // SPACE+OSINT+SIGINT';
  let i=origWord.length;
  // Delete letters
  function deleteLetter(){
    if(i<=0){
      // Now type new word
      let j=0;
      function typeLetter(){
        if(j>newWord.length){
          if(spanEl)spanEl.textContent=subtitle;
          return;
        }
        logoEl.childNodes[0].textContent=newWord.slice(0,j)+' WATCH ONE ';
        j++;
        setTimeout(typeLetter,80);
      }
      logoEl.childNodes[0].textContent=' WATCH ONE ';
      if(spanEl)spanEl.textContent='...';
      setTimeout(typeLetter,200);
      return;
    }
    logoEl.childNodes[0].textContent=origWord.slice(0,i-1)+' WATCH ONE ';
    i--;
    setTimeout(deleteLetter,60);
  }
  // Ensure the logo has the right text structure
  logoEl.childNodes[0].textContent=origWord+' WATCH ONE ';
  setTimeout(deleteLetter,100);
}

function closeOrrery(){
  orreryActive=false;
  transitionPhase=0;
  if(orreryAnimId)cancelAnimationFrame(orreryAnimId);
  closePlanetDetail();
  // Hide sunspot panel
  const ssnP=document.getElementById('ssn-panel');
  if(ssnP){ssnP.style.display='none';_ssnVisible=false;}
  document.getElementById('orrery-overlay').classList.remove('active');
  document.getElementById('orrery-info')?.classList.remove('visible');
  document.getElementById('transition-circle').style.display='none';
  document.getElementById('map').style.opacity='1';

  // Restore sidebars
  document.getElementById('pl')?.classList.remove('slide-out');
  document.getElementById('pr')?.classList.remove('slide-out');
  document.getElementById('search-box')?.classList.remove('slide-out');
  const bbEl=document.getElementById('bb');
  if(bbEl){bbEl.classList.remove('slide-out');bbEl.style.opacity='1';bbEl.style.transform='translateY(0)';}

  // Restore data layers
  Object.keys(layerVis).forEach(k=>{
    const el=document.querySelector(`.lt[data-l="${k}"]`);
    if(el&&!el.classList.contains('on'))togL(el);
  });

  // Restore status indicators — show them again and restore state
  document.querySelectorAll('.sys-info .sd').forEach(dot=>{
    dot.style.display='';
    if(dot.dataset.origClass){dot.className=dot.dataset.origClass;dot.style.background='';dot.style.boxShadow='';}
  });
  document.querySelectorAll('.sys-info > div').forEach(div=>{
    div.style.display='';
    if(div.dataset.origColor!==undefined)div.style.color=div.dataset.origColor;
  });
  ['wiki-status','sky-status','net-status','sat-status'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.style.display='';if(el.dataset.orig){el.textContent=el.dataset.orig;el.style.color='';el.classList.remove('disco');}}
  });

  animateTitle(false);
  const btn=document.getElementById('space-btn');
  if(btn)btn.textContent='☀ SPACE';
  map.easeTo({zoom:3,center:[0,30],duration:1000});
}

function closePlanetDetail(){
  document.getElementById('planet-detail').classList.remove('open');
  selectedBody=null;
}

// ── Orrery input ─────────────────────────────────────────────────────────────
function setupOrreryInput(canvas){
  const nc=canvas.cloneNode(true);
  canvas.parentNode.replaceChild(nc,canvas);
  nc.width=window.innerWidth;nc.height=window.innerHeight-42;
  orreryCtx=nc.getContext('2d');

  nc.addEventListener('mousemove',(e)=>{
    const mx=e.clientX,my=e.clientY-42;// offset for header
    hoveredBody=null;
    for(const pp of planetScreenPos){
      const dx=mx-pp.sx,dy=my-pp.sy;
      if(Math.sqrt(dx*dx+dy*dy)<pp.hitR){hoveredBody=pp.name;break;}
    }
    nc.style.cursor=hoveredBody?'pointer':'crosshair';
  });
  nc.addEventListener('click',()=>{
    if(hoveredBody){selectedBody=hoveredBody;showPlanetDetail(hoveredBody);}
  });
  window.addEventListener('resize',()=>{
    if(!orreryActive)return;
    nc.width=window.innerWidth;nc.height=window.innerHeight-42;
  });
}

// ── Animation loop ───────────────────────────────────────────────────────────
function orreryLoop(){
  if(!orreryActive)return;
  const allBodies=['Sun',...PLANETS.map(p=>p.name),'Moon'];
  allBodies.forEach(n=>{
    if(hoverAnimProgress[n]===undefined)hoverAnimProgress[n]=0;
    const target=(hoveredBody===n||selectedBody===n)?1:0;
    hoverAnimProgress[n]+=(target-hoverAnimProgress[n])*0.12;
    if(Math.abs(hoverAnimProgress[n]-target)<0.003)hoverAnimProgress[n]=target;
  });
  drawOrrery();
  orreryAnimId=requestAnimationFrame(orreryLoop);
}

function drawOrrery(){
  const ctx=orreryCtx;
  if(!ctx)return;
  const W=ctx.canvas.width,H=ctx.canvas.height;
  const CX=W/2,CY=H/2;
  const maxR=Math.min(W,H)*0.44;
  const rev=orreryReveal;
  const isDone=rev.phase==='done';
  const isSpinning=rev.phase==='spinning';

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#06080e';ctx.fillRect(0,0,W,H);

  // Theme colour — CTRL=green, NERV=amber
  const OC = nervMode ? '#ffaa00' : '#00ff88';
  const OC_DIM = nervMode ? 'rgba(255,170,0,' : 'rgba(0,255,136,';
  const ocA = a => OC_DIM + a + ')';

  // Stars
  let sr=42;const rng=()=>{sr=(sr*16807)%2147483647;return(sr-1)/2147483646;};
  ctx.fillStyle='rgba(180,160,120,0.25)';
  for(let i=0;i<180;i++){ctx.beginPath();ctx.arc(rng()*W,rng()*H,rng()*1.2,0,Math.PI*2);ctx.fill();}

  const jd=jdNow(),T=centuriesSinceJ2000(jd);
  const LW=1.5;
  planetScreenPos=[];
  const relSizes={Mercury:3,Venus:5,Earth:5.5,Mars:4,Jupiter:11,Saturn:9.5,Uranus:7,Neptune:6.5,Sun:14,Moon:2};

  function isVisible(name){
    if(isDone)return true;
    return rev.visibleBodies&&rev.visibleBodies.has(name);
  }

  // Get angle for planet: animated during spin, real when done
  function getAngle(name,realAngle){
    if(isDone)return realAngle;
    if(rev.bodyAngles&&rev.bodyAngles[name]!==undefined)return rev.bodyAngles[name];
    return realAngle;
  }

  // ── Orbit rings ──
  for(let i=0;i<PLANETS.length;i++){
    const oR=orbitRadius(i,maxR);
    const pName=PLANETS[i].name;
    // Show orbit if: done, or planet visible, or Earth orbit during flash
    const showOrbit=isDone||isVisible(pName)||(pName==='Earth'&&rev.showEarthOrbit);
    if(showOrbit){
      ctx.strokeStyle=ocA('0.12');ctx.lineWidth=0.8;
      ctx.beginPath();ctx.arc(CX,CY,oR,0,Math.PI*2);ctx.stroke();
    }
  }

  // ── Sun ──
  if(isVisible('Sun')){
    const sunR=relSizes.Sun;
    const sg=ctx.createRadialGradient(CX,CY,sunR,CX,CY,sunR*4);
    sg.addColorStop(0,ocA('0.06'));sg.addColorStop(1,ocA('0'));
    ctx.fillStyle=sg;ctx.beginPath();ctx.arc(CX,CY,sunR*4,0,Math.PI*2);ctx.fill();
    drawBody(ctx,CX,CY,sunR,'Sun',hoverAnimProgress['Sun']||0,LW);
  }
  planetScreenPos.push({name:'Sun',sx:CX,sy:CY,hitR:relSizes.Sun+14});

  // ── Planets ──
  for(let i=0;i<PLANETS.length;i++){
    const p=PLANETS[i];
    const pos=planetPosition(p,T);
    const oR=orbitRadius(i,maxR);
    const realAngle=Math.atan2(pos.y,pos.x);
    const angle=getAngle(p.name,realAngle);
    const sx=CX+oR*Math.cos(angle);
    const sy=CY-oR*Math.sin(angle);
    const pr=relSizes[p.name]||5;
    planetScreenPos.push({name:p.name,sx,sy,hitR:Math.max(pr+12,20)});

    if(isVisible(p.name)){
      drawBody(ctx,sx,sy,pr,p.name,hoverAnimProgress[p.name]||0,LW);
    }

    // Moon
    if(p.name==='Earth'){
      const mpos=moonPosition(pos,jd);
      const realMoonAngle=Math.atan2(mpos.y-pos.y,mpos.x-pos.x);
      const moonAngle=getAngle('Moon',realMoonAngle);
      const moonDist=maxR*0.04;
      const mx=sx+moonDist*Math.cos(moonAngle);
      const my=sy-moonDist*Math.sin(moonAngle);
      const mr=relSizes.Moon;
      planetScreenPos.push({name:'Moon',sx:mx,sy:my,hitR:Math.max(mr+12,18)});
      if(isVisible('Moon')){
        ctx.strokeStyle=ocA('0.08');ctx.lineWidth=0.5;
        ctx.beginPath();ctx.arc(sx,sy,moonDist,0,Math.PI*2);ctx.stroke();
        drawBody(ctx,mx,my,mr,'Moon',hoverAnimProgress['Moon']||0,LW);
      }
    }
  }
}

function drawBody(ctx,x,y,r,name,hp,lw){
  const OC = nervMode ? '#ffaa00' : '#00ff88';
  // Outline always
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  ctx.strokeStyle=OC;ctx.lineWidth=lw;ctx.stroke();

  // Fill bottom-to-top
  if(hp>0.01){
    ctx.save();
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
    const fillH=r*2*hp;
    ctx.fillStyle=OC;
    ctx.fillRect(x-r,y+r-fillH,r*2,fillH);
    ctx.restore();
  }

  // Label only on hover/select
  if(hp>0.05)drawLabel(ctx,x,y,r,name,hp,lw,OC);
}

function drawLabel(ctx,x,y,r,name,hp,lw,OC){
  OC = OC || (nervMode ? '#ffaa00' : '#00ff88');
  const gap=4;
  const lineLen=18;
  ctx.save();
  ctx.font='600 10px Orbitron, sans-serif';
  const text=name.toUpperCase();
  const tw=ctx.measureText(text).width;
  const padX=7,padY=3;
  const bw=tw+padX*2,bh=14;

  // Positions: line starts at circle right edge, goes to box
  const lineStartX=x+r+2;
  const lineEndX=lineStartX+gap+lineLen;
  const boxX=lineEndX;
  const boxY=y-bh/2;// vertically centred on the circle centre
  const lineY=y;// horizontal line at circle centre

  // Total width of the unit for left-to-right reveal
  const totalW=2+gap+lineLen+bw;
  const revealW=totalW*Math.min(1,hp*1.8);

  // Clip: reveal region from circle's right edge
  ctx.beginPath();
  ctx.rect(x+r,y-bh-4,revealW+2,bh*2+8);
  ctx.clip();

  // Connecting line — horizontal from circle edge to box
  ctx.beginPath();
  ctx.moveTo(lineStartX,lineY);
  ctx.lineTo(lineEndX,lineY);
  ctx.strokeStyle=OC;ctx.lineWidth=lw;ctx.stroke();

  // Box
  ctx.fillStyle='rgba(6,8,14,0.92)';
  ctx.strokeStyle=OC;ctx.lineWidth=lw;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(boxX,boxY,bw,bh,2);
  else ctx.rect(boxX,boxY,bw,bh);
  ctx.fill();ctx.stroke();

  // Text
  ctx.fillStyle=OC;
  ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.globalAlpha=Math.min(1,hp*2.5);
  ctx.fillText(text,boxX+padX,boxY+bh/2);
  ctx.globalAlpha=1;
  ctx.restore();
}

async function fetchBodyNews(query){
  const box=document.getElementById('pd-news');if(!box)return;
  const rssUrl=GN_BASE+query.replace(/\s+/g,'+')+GN_PARAMS;
  const proxyUrls=[
    PROXY(rssUrl),
    
  ];
  for(const url of proxyUrls){
    try{
      const r=await fetch(url,{signal:(()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),10000); return _c.signal; })()});
      if(!r.ok)continue;
      const xml=await r.text();
      const items=parseRSSXml(xml);
      if(items.length>0){
        box.innerHTML='';
        items.slice(0,4).forEach(item=>{
          const div=document.createElement('div');div.className='pd-news';
          div.innerHTML=`<div class="nt"><a href="${item.link}" target="_blank" style="color:var(--warning);text-decoration:none">${(item.title||'').slice(0,100)}</a></div><div class="ns">${item.source||'News'} // ${timeAgo(item.pubDate)}</div>`;
          box.appendChild(div);
        });
        return;
      }
    }catch(e){continue;}
  }
  box.innerHTML='<div style="color:var(--text-dim);font-size:10px">No recent news</div>';
}


// ── Planet detail panel ──────────────────────────────────────────────────────
async function showPlanetDetail(name){
  const panel=document.getElementById('planet-detail');
  // Position below floating music player if visible
  const fl=document.getElementById('mp-float');
  if(fl&&fl.classList.contains('visible')){
    const flRect=fl.getBoundingClientRect();
    panel.style.top=(flRect.bottom+6)+'px';
    panel.style.maxHeight='calc(100vh - '+(flRect.bottom+16)+'px)';
  }
  const nameEl=document.getElementById('pd-name');
  const body=document.getElementById('pd-body');
  nameEl.textContent=name.toUpperCase();
  panel.classList.add('open');
  const jd=jdNow(),T=centuriesSinceJ2000(jd);
  if(name==='Sun'){body.innerHTML=buildSunDetail();fetchSunData();return;}
  if(name==='Moon'){body.innerHTML=buildMoonDetail(jd);fetchBodyNews('Moon lunar');return;}
  const p=PLANETS.find(pl=>pl.name===name);
  if(!p)return;
  const pos=planetPosition(p,T);
  const earthPos=planetPosition(PLANETS[2],T);
  const dx=pos.x-earthPos.x,dy=pos.y-earthPos.y;
  const distAU=Math.sqrt(dx*dx+dy*dy);
  body.innerHTML=`<div class="pd-section"><div class="pd-label">PROFILE</div>
    <div style="color:var(--text-dim);font-size:10px;margin-bottom:8px">${p.desc}</div>
    ${p.facts.map(f=>`<div class="pd-row"><span class="k">${f.split(':')[0]}</span><span class="v">${f.split(':').slice(1).join(':')}</span></div>`).join('')}
  </div>
  <div class="pd-section"><div class="pd-label">CURRENT POSITION</div>
    <div class="pd-row"><span class="k">DIST FROM SUN</span><span class="v">${pos.r.toFixed(3)} AU</span></div>
    <div class="pd-row"><span class="k">DIST FROM EARTH</span><span class="v">${distAU.toFixed(3)} AU</span></div>
    <div class="pd-row"><span class="k">KM FROM EARTH</span><span class="v">${(distAU*149597870.7).toExponential(2)} km</span></div>
    <div class="pd-row"><span class="k">HELIO X</span><span class="v">${pos.x.toFixed(4)} AU</span></div>
    <div class="pd-row"><span class="k">HELIO Y</span><span class="v">${pos.y.toFixed(4)} AU</span></div>
    <div class="pd-row"><span class="k">SEMI-MAJOR AXIS</span><span class="v">${p.a.toFixed(4)} AU</span></div>
    <div class="pd-row"><span class="k">ECCENTRICITY</span><span class="v">${p.e.toFixed(6)}</span></div>
  </div>
  <div class="pd-section"><div class="pd-label">LATEST NEWS</div>
    <div id="pd-news"><div style="color:var(--text-dim);font-size:10px">Loading...</div></div>
  </div>`;
  fetchBodyNews(name+' planet space');
}

function buildSunDetail(){
  return `<div class="pd-section"><div class="pd-label">SOLAR PROFILE</div>
    <div style="color:var(--text-dim);font-size:10px;margin-bottom:8px">G-type main sequence star. Age: 4.6 billion years. Solar Cycle 25.</div>
    <div class="pd-row"><span class="k">TYPE</span><span class="v">G2V Yellow Dwarf</span></div>
    <div class="pd-row"><span class="k">DIAMETER</span><span class="v">1,392,700 km</span></div>
    <div class="pd-row"><span class="k">MASS</span><span class="v">1.989 × 10³⁰ kg</span></div>
    <div class="pd-row"><span class="k">SURFACE TEMP</span><span class="v">5,778 K</span></div>
    <div class="pd-row"><span class="k">CORE TEMP</span><span class="v">~15.7 million K</span></div>
  </div>
  <div class="pd-section"><div class="pd-label">LATEST SOLAR IMAGE (NASA SDO)</div>
    <img class="pd-img" id="sdo-img" src="https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_0193.jpg" alt="SDO">
    <div style="font-size:9px;color:var(--text-dim);text-align:center">AIA 193Å (Corona) // Updated ~10 min</div>
    <div style="display:flex;gap:4px;margin-top:6px;justify-content:center">
      <button onclick="document.getElementById('sdo-img').src='https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_0193.jpg'" style="background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.25);color:var(--warning);font-size:8px;padding:2px 6px;cursor:pointer;font-family:var(--ft)">193Å</button>
      <button onclick="document.getElementById('sdo-img').src='https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_0171.jpg'" style="background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.25);color:var(--warning);font-size:8px;padding:2px 6px;cursor:pointer;font-family:var(--ft)">171Å</button>
      <button onclick="document.getElementById('sdo-img').src='https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_0304.jpg'" style="background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.25);color:var(--warning);font-size:8px;padding:2px 6px;cursor:pointer;font-family:var(--ft)">304Å</button>
      <button onclick="document.getElementById('sdo-img').src='https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_HMIIC.jpg'" style="background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.25);color:var(--warning);font-size:8px;padding:2px 6px;cursor:pointer;font-family:var(--ft)">HMI</button>
      <button onclick="document.getElementById('sdo-img').src='https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_HMIB.jpg'" style="background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.25);color:var(--warning);font-size:8px;padding:2px 6px;cursor:pointer;font-family:var(--ft)">MAG</button>
    </div>
  </div>
  <div class="pd-section"><div class="pd-label">SPACE WEATHER (NOAA SWPC)</div>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-bottom:8px">
      <div style="flex:1;text-align:center"><div style="font-size:8px;color:var(--text-dim);font-family:var(--ft)">GEOMAG</div><div id="sun-g" style="font-size:18px;font-family:var(--ft);color:#00ff88;font-weight:700">--</div></div>
      <div style="flex:1;text-align:center"><div style="font-size:8px;color:var(--text-dim);font-family:var(--ft)">SOLAR RAD</div><div id="sun-s" style="font-size:18px;font-family:var(--ft);color:#00ff88;font-weight:700">--</div></div>
      <div style="flex:1;text-align:center"><div style="font-size:8px;color:var(--text-dim);font-family:var(--ft)">RADIO</div><div id="sun-r" style="font-size:18px;font-family:var(--ft);color:#00ff88;font-weight:700">--</div></div>
    </div>
    <div class="pd-row"><span class="k">SOLAR WIND</span><span class="v" id="sun-wind">-- km/s</span></div>
    <div class="pd-row"><span class="k">Bz (IMF)</span><span class="v" id="sun-bz">-- nT</span></div>
    <div class="pd-row"><span class="k">10.7cm FLUX</span><span class="v" id="sun-flux">-- sfu</span></div>
    <div class="pd-row"><span class="k">Kp INDEX</span><span class="v" id="sun-kp">--</span></div>
    <div id="kp-bars" style="display:flex;flex-wrap:wrap;gap:1px;margin:6px 0"></div>
  </div>
  <div class="pd-section"><div class="pd-label">SWPC ALERTS</div>
    <div id="sun-alerts"><div style="color:var(--text-dim);font-size:10px">Loading...</div></div>
  </div>
  <div class="pd-section">
    <button onclick="toggleSunspotChart()" style="width:100%;background:rgba(255,170,0,0.08);border:1px solid var(--accent);color:var(--accent);font-family:var(--ft);font-size:9px;letter-spacing:2px;padding:7px 0;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,170,0,0.18)'" onmouseout="this.style.background='rgba(255,170,0,0.08)'">☀ SUNSPOT NUMBER CHART</button>
  </div>
  <div class="pd-section"><div class="pd-label">LATEST NEWS</div>
    <div id="pd-news"><div style="color:var(--text-dim);font-size:10px">Loading...</div></div>
  </div>`;
}

function buildMoonDetail(jd){
  const phase=((jd-2451550.1)/29.53058886)%1;
  const phaseNames=['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
  const phaseIdx=Math.round(phase*8)%8;
  const illumination=Math.round((1-Math.cos(phase*2*Math.PI))/2*100);
  return `<div class="pd-section"><div class="pd-label">LUNAR PROFILE</div>
    <div style="color:var(--text-dim);font-size:10px;margin-bottom:8px">${MOON.desc}</div>
    ${MOON.facts.map(f=>`<div class="pd-row"><span class="k">${f.split(':')[0]}</span><span class="v">${f.split(':').slice(1).join(':')}</span></div>`).join('')}
  </div>
  <div class="pd-section"><div class="pd-label">CURRENT PHASE</div>
    <div class="pd-row"><span class="k">PHASE</span><span class="v" style="color:var(--warning)">${phaseNames[phaseIdx]}</span></div>
    <div class="pd-row"><span class="k">ILLUMINATION</span><span class="v">${illumination}%</span></div>
    <div class="pd-row"><span class="k">CYCLE</span><span class="v">${(phase*100).toFixed(1)}%</span></div>
  </div>
  <div class="pd-section"><div class="pd-label">LATEST NEWS</div>
    <div id="pd-news"><div style="color:var(--text-dim);font-size:10px">Loading...</div></div>
  </div>`;
}

async function fetchJSON(url){
  const methods=[
    async()=>{const r=await fetch(url,{signal:(()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),8000); return _c.signal; })()});if(!r.ok)throw new Error(r.status);return r.json();},
    async()=>{const r=await fetch(PROXY(url),{signal:(()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),10000); return _c.signal; })()});if(!r.ok)throw new Error('proxy');return r.json();},
      ];
  for(const m of methods){try{return await m();}catch(e){continue;}}
  return null;
}

async function fetchSunData(){
  const S='https://services.swpc.noaa.gov';
  const sc=l=>(l>=4?'#ff0000':l>=3?'#ff4400':l>=2?'#ff8800':l>=1?'#ffaa00':'#00ff88');
  try{const d=await fetchJSON(S+'/products/noaa-scales.json');
    if(d){const g=d['-1']?.G?.Scale||d['0']?.G?.Scale||0,s=d['-1']?.S?.Scale||d['0']?.S?.Scale||0,r=d['-1']?.R?.Scale||d['0']?.R?.Scale||0;
    const gE=document.getElementById('sun-g');if(gE){gE.textContent='G'+g;gE.style.color=sc(g);}
    const sE=document.getElementById('sun-s');if(sE){sE.textContent='S'+s;sE.style.color=sc(s);}
    const rE=document.getElementById('sun-r');if(rE){rE.textContent='R'+r;rE.style.color=sc(r);}}}catch(e){}
  try{const d=await fetchJSON(S+'/products/solar-wind/plasma-2-hour.json');
    if(d&&d.length>1){for(let i=d.length-1;i>0;i--){if(d[i][2]&&d[i][2]!=='-999.9'){const el=document.getElementById('sun-wind');if(el){el.textContent=Math.round(+d[i][2])+' km/s';el.style.color=+d[i][2]>600?'#ff4400':+d[i][2]>500?'#ffaa00':'var(--text)';}break;}}}}catch(e){}
  try{const d=await fetchJSON(S+'/products/solar-wind/mag-2-hour.json');
    if(d&&d.length>1){for(let i=d.length-1;i>0;i--){if(d[i][3]&&d[i][3]!=='-999.9'){const bz=+d[i][3];const el=document.getElementById('sun-bz');if(el){el.textContent=bz.toFixed(1)+' nT';el.style.color=bz<-10?'#ff0000':bz<-5?'#ff8800':bz<0?'#ffcc00':'#00ff88';}break;}}}}catch(e){}
  try{const d=await fetchJSON(S+'/products/noaa-planetary-k-index.json');
    if(d&&d.length>1){const bars=document.getElementById('kp-bars');if(bars){bars.innerHTML='';const recent=d.slice(-9).filter((_,i)=>i>0);let lastKp=0;recent.forEach(row=>{const kp=+row[1];lastKp=kp;const bar=document.createElement('span');bar.className='kp-bar';bar.style.background=kpColor(kp);bar.textContent=kp;bars.appendChild(bar);});const kpEl=document.getElementById('sun-kp');if(kpEl){kpEl.textContent=lastKp.toFixed(1);kpEl.style.color=kpColor(lastKp);}}}}catch(e){}
  try{const d=await fetchJSON(S+'/products/10cm-flux-30-day.json');if(d&&d.length>1){const last=d[d.length-1];const el=document.getElementById('sun-flux');if(el)el.textContent=(last.flux||last[1]||'--')+' sfu';}}catch(e){}
  try{const d=await fetchJSON(S+'/products/alerts.json');if(d&&Array.isArray(d)){const ab=document.getElementById('sun-alerts');if(ab){ab.innerHTML='';d.slice(-4).reverse().forEach(a=>{const msg=a.message||'';const isW=msg.includes('WARNING')||msg.includes('WATCH');const isS=msg.includes('STORM')||msg.includes('G3')||msg.includes('G4')||msg.includes('G5');const lines=msg.split('\n').filter(l=>l.trim().length>10);const div=document.createElement('div');div.className='sp-alert '+(isS?'storm':isW?'watch':'info');div.innerHTML='<div style="font-size:8px;color:rgba(255,255,255,0.3)">'+timeAgo(a.issue_datetime||'')+'</div>'+((lines[0]||msg).slice(0,140));ab.appendChild(div);});if(d.length===0)ab.innerHTML='<div style="color:var(--text-dim);font-size:10px">No active alerts</div>';}}}catch(e){}
  fetchBodyNews('Sun solar flare CME sunspot');
}

function kpColor(kp){if(kp>=8)return'#ff0000';if(kp>=7)return'#ff2200';if(kp>=6)return'#ff4400';if(kp>=5)return'#ff6600';if(kp>=4)return'#ffaa00';if(kp>=3)return'#88cc00';if(kp>=2)return'#00cc44';return'#00aa66';}

// ====== SUNSPOT CHART ======
let _ssnData = null;      // full monthly dataset [{time, ssn, smooth}]
let _ssnRange = 'all';    // current selected range
let _ssnVisible = false;

const SSN_RANGES = [
  { key: 'all',   label: 'ALL TIME',   months: null },
  { key: '100y',  label: '100 YEARS',  months: 1200 },
  { key: '50y',   label: '50 YEARS',   months: 600  },
  { key: '10y',   label: '10 YEARS',   months: 120  },
  { key: '5y',    label: '5 YEARS',    months: 60   },
  { key: '1y',    label: 'PAST YEAR',  months: 12   },
  { key: '6m',    label: '6 MONTHS',   months: 6    },
  { key: '3m',    label: '3 MONTHS',   months: 3    },
];

function toggleSunspotChart() {
  const panel = document.getElementById('ssn-panel');
  if (!panel) { buildSsnPanel(); return; }
  _ssnVisible = !_ssnVisible;
  panel.style.display = _ssnVisible ? 'flex' : 'none';
}

function buildSsnPanel() {
  _ssnVisible = true;
  const el = document.createElement('div');
  el.id = 'ssn-panel';
  el.innerHTML = `
    <div id="ssn-header">
      <div style="font-family:var(--ft);font-size:10px;letter-spacing:3px;color:var(--accent)">☀ SUNSPOT NUMBER</div>
      <button id="ssn-close" onclick="toggleSunspotChart()">✕</button>
    </div>
    <div id="ssn-ranges"></div>
    <div id="ssn-stat-row">
      <div class="ssn-stat"><div class="ssn-stat-label">CURRENT</div><div class="ssn-stat-val" id="ssn-cur">--</div></div>
      <div class="ssn-stat"><div class="ssn-stat-label">PEAK (CYCLE 25)</div><div class="ssn-stat-val" id="ssn-peak">--</div></div>
      <div class="ssn-stat"><div class="ssn-stat-label">12-MO AVG</div><div class="ssn-stat-val" id="ssn-avg">--</div></div>
      <div class="ssn-stat"><div class="ssn-stat-label">SOLAR MAX</div><div class="ssn-stat-val" id="ssn-max">--</div></div>
    </div>
    <div id="ssn-canvas-wrap">
      <canvas id="ssn-canvas"></canvas>
      <div id="ssn-tooltip"></div>
    </div>
    <div id="ssn-source">SOURCE: NOAA SWPC // SIDC BRUSSELS // MONTHLY SSN</div>
  `;
  document.getElementById('orrery-overlay').appendChild(el);

  // Build range buttons
  const rb = document.getElementById('ssn-ranges');
  SSN_RANGES.forEach(r => {
    const b = document.createElement('button');
    b.className = 'ssn-rb' + (r.key === 'all' ? ' active' : '');
    b.dataset.key = r.key;
    b.textContent = r.label;
    b.onclick = () => setSsnRange(r.key);
    rb.appendChild(b);
  });

  loadSsnData();

  // Canvas mouse hover for tooltip
  const canvas = document.getElementById('ssn-canvas');
  canvas.addEventListener('mousemove', ssnHover);
  canvas.addEventListener('mouseleave', () => {
    document.getElementById('ssn-tooltip').style.display = 'none';
  });
}

async function loadSsnData() {
  const src = document.getElementById('ssn-source');
  if (src) src.textContent = 'LOADING DATA...';
  try {
    // observed-solar-cycle-indices.json: array of {time-tag, ssn, smoothed_ssn, ...}
    // Goes back to 1749 — full solar cycle record
    const url = 'https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json';
    let data = null;
    try {
      const r = await fetch(url, { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),12000); return _c.signal; })() });
      if (r.ok) data = await r.json();
    } catch(e) {}
    if (!data) {
      // try via proxy
      const r2 = await fetch(PROXY_BASE + '/api/proxy?url=' + encodeURIComponent(url), { signal: (()=>{ const _c=new AbortController(); setTimeout(()=>_c.abort(),14000); return _c.signal; })() });
      if (r2.ok) data = await r2.json();
    }
    if (!data || !Array.isArray(data)) throw new Error('No data');

    _ssnData = data
      .filter(d => d['time-tag'] && d.ssn !== undefined && d.ssn !== null && +d.ssn >= 0)
      .map(d => ({
        time: new Date(d['time-tag']),
        ssn:  +d.ssn,
        smooth: d.smoothed_ssn !== undefined ? +d.smoothed_ssn : null,
      }))
      .sort((a, b) => a.time - b.time);

    // Fill stats
    const cur = _ssnData[_ssnData.length - 1]?.ssn ?? '--';
    const c25 = _ssnData.filter(d => d.time >= new Date('2019-12-01'));
    const peak = c25.length ? Math.max(...c25.map(d => d.ssn)) : '--';
    const last12 = _ssnData.slice(-12);
    const avg = last12.length ? Math.round(last12.reduce((s,d)=>s+d.ssn,0)/last12.length) : '--';
    // find all-time max
    const allMax = Math.max(..._ssnData.map(d=>d.ssn));
    const allMaxRec = _ssnData.find(d=>d.ssn===allMax);

    document.getElementById('ssn-cur')?.textContent !== undefined && (document.getElementById('ssn-cur').textContent = cur);
    document.getElementById('ssn-peak')?.textContent !== undefined && (document.getElementById('ssn-peak').textContent = peak);
    document.getElementById('ssn-avg')?.textContent !== undefined && (document.getElementById('ssn-avg').textContent = avg);
    document.getElementById('ssn-max')?.textContent !== undefined && (document.getElementById('ssn-max').textContent = allMax + (allMaxRec ? ' (' + allMaxRec.time.getFullYear() + ')' : ''));

    if (src) src.textContent = 'SOURCE: NOAA SWPC // SIDC BRUSSELS // MONTHLY SSN // ' + _ssnData[0].time.getFullYear() + '–PRESENT';

    drawSsnChart();
  } catch(e) {
    if (src) src.textContent = 'DATA UNAVAILABLE — ' + e.message;
  }
}

function setSsnRange(key) {
  _ssnRange = key;
  document.querySelectorAll('.ssn-rb').forEach(b => b.classList.toggle('active', b.dataset.key === key));
  drawSsnChart();
}

function ssnSlice() {
  if (!_ssnData) return [];
  const r = SSN_RANGES.find(r => r.key === _ssnRange);
  if (!r || !r.months) return _ssnData;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - r.months);
  return _ssnData.filter(d => d.time >= cutoff);
}

function drawSsnChart() {
  const canvas = document.getElementById('ssn-canvas');
  if (!canvas || !_ssnData) return;
  const wrap = document.getElementById('ssn-canvas-wrap');
  canvas.width  = wrap.clientWidth  || 600;
  canvas.height = wrap.clientHeight || 260;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 14, right: 18, bottom: 32, left: 42 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top  - pad.bottom;

  const pts = ssnSlice();
  if (!pts.length) return;

  ctx.clearRect(0, 0, W, H);

  const isCtrl = !nervMode; // CTRL = green, NERV = amber
  const lineCol   = isCtrl ? '#00ff88' : '#ffaa00';
  const smoothCol = isCtrl ? '#00cc66' : '#ff8800';
  const gridCol   = isCtrl ? 'rgba(0,255,136,0.08)' : 'rgba(255,170,0,0.08)';
  const axisCol   = isCtrl ? 'rgba(0,255,136,0.25)' : 'rgba(255,170,0,0.25)';
  const labelCol  = isCtrl ? 'rgba(0,255,136,0.5)'  : 'rgba(255,170,0,0.5)';
  const fillCol   = isCtrl ? 'rgba(0,255,136,0.06)' : 'rgba(255,170,0,0.06)';

  const tMin = pts[0].time.getTime();
  const tMax = pts[pts.length-1].time.getTime();
  const ssnMax = Math.max(...pts.map(d=>d.ssn), 1);

  const tx = t => pad.left + ((t - tMin) / (tMax - tMin)) * cw;
  const ty = v => pad.top  + ch - (v / (ssnMax * 1.08)) * ch;

  // Grid lines
  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1;
  const gridY = [0, 50, 100, 150, 200, 250, 300];
  gridY.forEach(v => {
    if (v > ssnMax * 1.08) return;
    const y = ty(v);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+cw, y); ctx.stroke();
  });

  // Y axis labels
  ctx.fillStyle = labelCol;
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  gridY.forEach(v => {
    if (v > ssnMax * 1.08) return;
    ctx.fillText(v, pad.left - 5, ty(v) + 3);
  });

  // X axis labels — pick good tick frequency based on range
  const spanYears = (tMax - tMin) / (1000*60*60*24*365.25);
  const tickStep = spanYears > 50 ? 20 : spanYears > 20 ? 10 : spanYears > 8 ? 5 : spanYears > 3 ? 2 : 1;
  ctx.textAlign = 'center';
  const startYear = new Date(tMin).getFullYear();
  const endYear   = new Date(tMax).getFullYear();
  for (let y = Math.ceil(startYear/tickStep)*tickStep; y <= endYear; y += tickStep) {
    const t = new Date(y, 0, 1).getTime();
    if (t < tMin || t > tMax) continue;
    const x = tx(t);
    ctx.strokeStyle = axisCol;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top+ch); ctx.stroke();
    ctx.fillStyle = labelCol;
    ctx.fillText(y, x, H - 6);
  }

  // Area fill under SSN line
  ctx.beginPath();
  ctx.moveTo(tx(tMin), ty(0));
  pts.forEach(d => ctx.lineTo(tx(d.time.getTime()), ty(d.ssn)));
  ctx.lineTo(tx(tMax), ty(0));
  ctx.closePath();
  ctx.fillStyle = fillCol;
  ctx.fill();

  // Raw SSN line
  ctx.beginPath();
  ctx.strokeStyle = lineCol;
  ctx.lineWidth = 1;
  pts.forEach((d, i) => {
    const x = tx(d.time.getTime()), y = ty(d.ssn);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Smoothed SSN line (thicker, slightly different shade)
  const smoothPts = pts.filter(d => d.smooth !== null && !isNaN(d.smooth) && d.smooth >= 0);
  if (smoothPts.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = smoothCol;
    ctx.lineWidth = 2;
    smoothPts.forEach((d, i) => {
      const x = tx(d.time.getTime()), y = ty(d.smooth);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Current marker dot
  const last = pts[pts.length-1];
  const lx = tx(last.time.getTime()), ly = ty(last.ssn);
  ctx.beginPath();
  ctx.arc(lx, ly, 3.5, 0, Math.PI*2);
  ctx.fillStyle = lineCol;
  ctx.fill();

  // Legend
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = lineCol;
  ctx.fillText('─ MONTHLY SSN', pad.left, pad.top + 10);
  if (smoothPts.length > 1) {
    ctx.fillStyle = smoothCol;
    ctx.fillText('─ SMOOTHED', pad.left + 105, pad.top + 10);
  }

  // Store for hover
  canvas._pts = pts;
  canvas._tx = tx;
  canvas._ty = ty;
  canvas._pad = pad;
}

function ssnHover(e) {
  const canvas = document.getElementById('ssn-canvas');
  if (!canvas || !canvas._pts) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const { _pts, _tx, _pad } = canvas;
  const W = canvas.width;
  const cw = W - _pad.left - _pad.right;

  // find closest point by x
  let closest = null, minDx = Infinity;
  _pts.forEach(d => {
    const x = _tx(d.time.getTime());
    const dx = Math.abs(x - mx);
    if (dx < minDx) { minDx = dx; closest = d; }
  });
  if (!closest || minDx > 30) { document.getElementById('ssn-tooltip').style.display='none'; return; }

  const tip = document.getElementById('ssn-tooltip');
  const isCtrl = !nervMode;
  const dateStr = closest.time.toLocaleDateString('en-GB', {month:'short', year:'numeric'});
  tip.innerHTML = `<div class="ssn-tip-date">${dateStr}</div><div class="ssn-tip-val">SSN: <b>${closest.ssn}</b></div>${closest.smooth !== null && !isNaN(closest.smooth) ? `<div class="ssn-tip-smooth">SMOOTH: ${(+closest.smooth).toFixed(1)}</div>` : ''}`;
  tip.style.display = 'block';
  const cx = _tx(closest.time.getTime());
  const tipW = 110;
  tip.style.left = (cx + tipW > W - _pad.right ? cx - tipW - 8 : cx + 8) + 'px';
  tip.style.top  = (e.clientY - rect.top - 10) + 'px';
}

// Redraw chart on window resize
window.addEventListener('resize', () => {
  if (_ssnVisible && _ssnData) drawSsnChart();
});

// Hook into theme toggle via the existing outageThemeUpdate pattern
// nerv-ctrl.js calls outageThemeUpdate() on every togNerv() — we piggyback
const _origOutageThemeUpdate = window.outageThemeUpdate;
window.outageThemeUpdate = function() {
  if (typeof _origOutageThemeUpdate === 'function') _origOutageThemeUpdate();
  if (_ssnVisible && _ssnData) setTimeout(drawSsnChart, 50);
  // Sync orrery-bb button label
  const oBtn = document.getElementById('nerv-btn-orr');
  if (oBtn) oBtn.textContent = nervMode ? 'CTRL' : 'NERV';
};
