// Low-poly humanoid meshes shared by the player, pedestrians, gang members and police.
const THREE = window.THREE;
const geoCache = {};
function geo(name, make) { return geoCache[name] || (geoCache[name] = make()); }

const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}

export function makeHumanoid({ shirt = 0xff5f9e, pants = 0x2b2d42, skin = 0xc68e6a, hair = 0x2a1a10, hat = null }) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(geo('torso', () => new THREE.BoxGeometry(0.62, 0.72, 0.34)), mat(shirt));
  torso.position.y = 1.18;
  const head = new THREE.Mesh(geo('head', () => new THREE.BoxGeometry(0.34, 0.36, 0.34)), mat(skin));
  head.position.y = 1.75;
  const hairM = new THREE.Mesh(geo('hair', () => new THREE.BoxGeometry(0.36, 0.12, 0.36)), mat(hair));
  hairM.position.y = 1.96;
  body.add(torso, head, hairM);
  if (hat) {
    const cap = new THREE.Mesh(geo('cap', () => new THREE.BoxGeometry(0.4, 0.1, 0.5)), mat(hat));
    cap.position.set(0, 2.02, 0.05);
    body.add(cap);
  }
  const limb = (w, h, color, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(geo(`limb${w}${h}`, () => { const g = new THREE.BoxGeometry(w, h, w); g.translate(0, -h / 2, 0); return g; }), mat(color));
    pivot.add(m);
    body.add(pivot);
    return pivot;
  };
  const legL = limb(0.24, 0.82, pants, -0.16, 0.82);
  const legR = limb(0.24, 0.82, pants, 0.16, 0.82);
  const armL = limb(0.18, 0.66, shirt, -0.42, 1.5);
  const armR = limb(0.18, 0.66, shirt, 0.42, 1.5);
  const handGeo = geo('hand', () => new THREE.BoxGeometry(0.16, 0.16, 0.16));
  const hl = new THREE.Mesh(handGeo, mat(skin)); hl.position.y = -0.7; armL.add(hl);
  const hr = new THREE.Mesh(handGeo, mat(skin)); hr.position.y = -0.7; armR.add(hr);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.userData.parts = { body, legL, legR, armL, armR };
  return root;
}

// Swing limbs by gait phase; pose: 'walk' | 'aim' | 'punch' | 'dead'
export function animateHumanoid(h, phase, amount, pose = 'walk', punchT = 0) {
  const p = h.userData.parts;
  const s = Math.sin(phase) * 0.8 * amount;
  p.legL.rotation.x = s; p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
  p.body.rotation.x = 0; p.body.position.y = 0;
  if (pose === 'aim') { p.armR.rotation.x = -Math.PI / 2; p.armL.rotation.x = -Math.PI / 2.4; }
  if (pose === 'punch') p.armR.rotation.x = -Math.PI / 2 * Math.sin(Math.min(1, punchT) * Math.PI);
  if (pose === 'dead') { p.body.rotation.x = -Math.PI / 2; p.body.position.y = 0.2; p.legL.rotation.x = 0; p.legR.rotation.x = 0; }
  if (pose === 'hands') { p.armL.rotation.z = 2.6; p.armR.rotation.z = -2.6; }
  else { p.armL.rotation.z = 0; p.armR.rotation.z = 0; }
}

export function makePistolMesh() {
  const g = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.34), mat(0x1b1b1f));
  g.position.set(0, -0.72, 0.12);
  return g;
}
