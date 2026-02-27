// ====== APP — Clock and init orchestrator ======
// CONF, CAMS, FRONTLINES, SATS etc are defined in data/data.js (loaded before this)

window.WWO = { eqData: [] };

// UTC Clock
setInterval(()=>{
  const n=new Date();
  document.getElementById('utc').textContent=n.toISOString().slice(11,19)+' UTC';
  document.getElementById('ltn').textContent=~~(18+Math.random()*15);
  const ts=document.getElementById('cam-ts');
  if(ts)ts.textContent=n.toISOString().slice(11,19)+' UTC';
},1000);
