// ====== ANIMATED WIND PARTICLES ======
// Data source: NOAA GFS wind vector fields (U/V components at 10m)
// Served pre-processed as JSON wind fields via WWO Worker (/api/wind)
// Worker fetches NOMADS GRIB2, extracts U/V grids, returns {width,height,uMin,uMax,vMin,vMax,u[],v[]}
// Rendering: Canvas2D overlay, particles flow along wind vectors (Beccario technique)
// NERV mode: amber particles; CTRL mode: cyan particles

const WIND_PARTICLE_COUNT  = 4000;    // active particles
const WIND_FADE_OPACITY    = 0.92;    // trail fade per frame (lower = longer trails)
const WIND_SPEED_SCALE     = 0.12;    // pixels per unit wind speed per frame
const WIND_REFRESH_MS      = 3 * 60 * 60 * 1000; // GFS updates every 3h
const WIND_PARTICLE_AGE    = 80;      // frames before particle resets to random position

let _windCanvas   = null;
let _windCtx      = null;
let _windField    = null;    // { width, height, u[], v[], uMin, uMax, vMin, vMax, bbox }
let _windParticles = [];
let _windAnimId   = null;
let _windVisible  = false;
let _windMap      = null;

// ── Canvas setup ──────────────────────────────────────────────────────────────
function _createWindCanvas(map) {
  const existing = document.getElementById('wind-canvas');
  if (existing) existing.remove();

  const canvas = document.createElement('canvas');
  canvas.id = 'wind-canvas';
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;mix-blend-mode:screen;';
  document.getElementById('map').appendChild(canvas);

  const resize = () => {
    const rect = document.getElementById('map').getBoundingClientRect();
    canvas.width  = rect.width  * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    canvas.style.width  = rect.width  + 'px';
    canvas.style.height = rect.height + 'px';
  };
  resize();
  window.addEventListener('resize', resize);

  _windCanvas = canvas;
  _windCtx = canvas.getContext('2d');
}

// ── Particle init ─────────────────────────────────────────────────────────────
function _initParticles() {
  _windParticles = Array.from({ length: WIND_PARTICLE_COUNT }, () => ({
    x: Math.random(),   // normalised 0-1 over field width
    y: Math.random(),   // normalised 0-1 over field height
    age: Math.floor(Math.random() * WIND_PARTICLE_AGE),
  }));
}

// ── Bilinear interpolation of wind field at normalised (x,y) ─────────────────
function _windAt(nx, ny) {
  if (!_windField) return { u: 0, v: 0 };
  const { width, height, u, v } = _windField;
  const fx = nx * (width  - 1);
  const fy = ny * (height - 1);
  const x0 = Math.floor(fx), x1 = Math.min(x0 + 1, width  - 1);
  const y0 = Math.floor(fy), y1 = Math.min(y0 + 1, height - 1);
  const tx = fx - x0, ty = fy - y0;
  const idx = (r, c) => r * width + c;
  const lerp = (a, b, t) => a + (b - a) * t;
  const uVal = lerp(lerp(u[idx(y0,x0)], u[idx(y0,x1)], tx), lerp(u[idx(y1,x0)], u[idx(y1,x1)], tx), ty);
  const vVal = lerp(lerp(v[idx(y0,x0)], v[idx(y0,x1)], tx), lerp(v[idx(y1,x0)], v[idx(y1,x1)], tx), ty);
  return { u: uVal, v: vVal };
}

// ── Map screen coords ↔ normalised wind field coords ─────────────────────────
function _screenToNorm(px, py) {
  if (!_windMap || !_windField) return null;
  const { west, east, south, north } = _windField.bbox;
  // Screen pixel → map LngLat
  const lngLat = _windMap.unproject([px / (window.devicePixelRatio||1), py / (window.devicePixelRatio||1)]);
  const nx = (lngLat.lng - west)  / (east  - west);
  const ny = 1 - (lngLat.lat - south) / (north - south);
  return { nx, ny };
}

function _normToScreen(nx, ny) {
  if (!_windMap || !_windField) return null;
  const { west, east, south, north } = _windField.bbox;
  const lng = west  + nx * (east  - west);
  const lat = south + (1 - ny) * (north - south);
  const pt = _windMap.project([lng, lat]);
  return {
    px: pt.x * (window.devicePixelRatio||1),
    py: pt.y * (window.devicePixelRatio||1),
  };
}

// ── Animation loop ────────────────────────────────────────────────────────────
function _animateWind() {
  if (!_windVisible || !_windCtx || !_windField) {
    _windAnimId = null;
    return;
  }
  _windAnimId = requestAnimationFrame(_animateWind);

  const ctx = _windCtx;
  const W = _windCanvas.width, H = _windCanvas.height;
  const isNerv = document.body.classList.contains('nerv-mode');
  const particleColor = isNerv ? 'rgba(255,170,0,' : 'rgba(0,200,255,';

  // Fade existing trails
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${1 - WIND_FADE_OPACITY})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // Draw each particle
  ctx.lineWidth = 1.2;
  for (const p of _windParticles) {
    p.age++;

    if (p.age >= WIND_PARTICLE_AGE || p.nx < 0 || p.nx > 1 || p.ny < 0 || p.ny > 1) {
      // Reset to random position
      p.nx = Math.random();
      p.ny = Math.random();
      p.age = 0;
      continue;
    }

    const { u, v } = _windAt(p.nx, p.ny);
    const speed = Math.sqrt(u*u + v*v);
    if (speed < 0.01) { p.age++; continue; }

    // Previous screen position
    const prev = _normToScreen(p.nx, p.ny);

    // Advance particle along wind vector
    const fieldW = _windField.width, fieldH = _windField.height;
    p.nx += (u / fieldW) * WIND_SPEED_SCALE;
    p.ny -= (v / fieldH) * WIND_SPEED_SCALE; // v positive = north = up

    // New screen position
    const next = _normToScreen(p.nx, p.ny);
    if (!prev || !next) continue;

    // Speed-based opacity and width
    const alpha = Math.min(0.8, 0.3 + speed / 20);
    ctx.strokeStyle = particleColor + alpha + ')';
    ctx.beginPath();
    ctx.moveTo(prev.px, prev.py);
    ctx.lineTo(next.px, next.py);
    ctx.stroke();
  }
}

// ── Fetch wind field from Worker ──────────────────────────────────────────────
async function _fetchWindField() {
  try {
    const r = await fetch(`${PROXY_BASE}/api/wind`, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error('Wind Worker ' + r.status);
    const data = await r.json();
    if (!data.u || !data.v) throw new Error('Invalid wind field response');
    _windField = data;
    console.log(`[WWO] Wind field: ${data.width}×${data.height} grid, bbox:`, data.bbox);
    if (_windVisible) {
      _initParticles();
      if (!_windAnimId) _animateWind();
    }
  } catch(e) {
    console.warn('[WWO] Wind field fetch failed:', e.message);
    // Fallback: use a minimal synthetic field so particles still animate gracefully
    _windField = _syntheticWindField();
    if (_windVisible && !_windAnimId) _animateWind();
  }
}

// Synthetic fallback field — westerly flow with gentle polar jet curve
function _syntheticWindField() {
  const W = 72, H = 37; // ~5° resolution
  const u = new Float32Array(W * H);
  const v = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lat = 90 - (y / (H-1)) * 180;
      const jetStr = Math.exp(-((Math.abs(lat) - 45)**2) / 200);
      u[y*W+x] = 8 * jetStr + Math.sin(x/5) * 2;
      v[y*W+x] = Math.sin(y/4) * 1.5;
    }
  }
  return { width: W, height: H, u, v, bbox: { west: -180, east: 180, south: -90, north: 90 }, synthetic: true };
}

// ── Public API ────────────────────────────────────────────────────────────────
function initWindParticles(map) {
  _windMap = map;
  _createWindCanvas(map);
  _initParticles();
  _fetchWindField();
  setInterval(_fetchWindField, WIND_REFRESH_MS);
  console.log('[WWO] Wind particles initialised');
}

function setWindParticlesVisible(vis) {
  _windVisible = vis;
  if (_windCanvas) _windCanvas.style.display = vis ? 'block' : 'none';
  if (vis && !_windAnimId && _windField) {
    _initParticles();
    _animateWind();
  }
  if (!vis && _windAnimId) {
    cancelAnimationFrame(_windAnimId);
    _windAnimId = null;
    if (_windCtx) _windCtx.clearRect(0, 0, _windCanvas.width, _windCanvas.height);
  }
}
