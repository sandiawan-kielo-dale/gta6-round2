// Procedural canvas textures: building facades, glass towers, sand and the sunset sky.
const THREE = window.THREE;

function canvasTexture(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One "tile" = one floor x one window bay of stucco wall; materials tint it.
export function makeFacadeTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 56, w, 8);
    g.fillStyle = '#34465c'; g.fillRect(14, 14, 36, 32);
    g.fillStyle = 'rgba(255,214,150,0.55)'; g.fillRect(14, 14, 36, 10);
    g.fillStyle = '#e8e0d6'; g.fillRect(12, 46, 40, 4);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(30, 14, 3, 32);
  });
}

export function makeGlassTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#9ec8e8'); grd.addColorStop(0.6, '#ffc9a0'); grd.addColorStop(1, '#5c7aa0');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 3, h);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(8, 8, 20, 40);
  });
}

export function makeSandTexture(rng) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#f2d6a2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = rng.next();
      g.fillStyle = v > 0.5 ? 'rgba(255,240,210,0.5)' : 'rgba(190,150,100,0.35)';
      g.fillRect(rng.next() * w, rng.next() * h, 2, 2);
    }
  });
}

export function makeAsphaltTexture(rng) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#44434d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = rng.next() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(rng.next() * w, rng.next() * h, 1.5, 1.5);
    }
  });
}

export function makeSkyTexture() {
  const tex = canvasTexture(8, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0.0, '#2b1d5c');
    grd.addColorStop(0.35, '#7b3f8c');
    grd.addColorStop(0.55, '#ff7a6b');
    grd.addColorStop(0.68, '#ffc26b');
    grd.addColorStop(0.75, '#ffe7b0');
    grd.addColorStop(1.0, '#ffe7b0');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
