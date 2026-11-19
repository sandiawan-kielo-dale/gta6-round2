// City generation for Vista Coral: road grid, lots, buildings, beach, pier, palms and landmarks.
import { CITY, PALETTE } from './config.js';
import { makeFacadeTexture, makeGlassTexture, makeSandTexture, makeAsphaltTexture, makeSkyTexture } from './textures.js';

const THREE = window.THREE;

export const LANDMARKS = {
  safehouse: { label: "Rae's Safehouse", lot: [-3, 1], x: -144, z: 108, color: '#ff5f9e' },
  diner: { label: "Marisol's Diner", lot: [0, -1], x: 36, z: 0, color: '#ffd24a' },
  garage: { label: 'Bayside Auto Body', lot: [2, 0], x: 216, z: 36, color: '#7ff3ff' },
  pier: { label: 'Gull Pier', lot: null, x: CITY.pierX, z: CITY.shoreZ + CITY.pierLength - 12, color: '#ffffff' },
  lot: { label: 'Sunrise Parking', lot: [-2, -3], x: -108, z: -180, color: '#ff8c42' },
  marina: { label: 'Coral Marina', lot: null, x: 252, z: 250, color: '#06d6a0' },
};

const roadXs = [];
const roadZs = [];
for (let i = CITY.colsMin; i <= CITY.colsMax; i++) roadXs.push(i * CITY.cell);
for (let j = CITY.rowsMin; j <= CITY.rowsMax; j++) roadZs.push(j * CITY.cell);
export const BOUNDS = {
  minX: roadXs[0] - 20, maxX: roadXs[roadXs.length - 1] + 20,
  minZ: roadZs[0] - 20, maxZ: CITY.shoreZ + CITY.pierLength,
};

export function isOnRoad(x, z) {
  const h = CITY.road / 2;
  const inX = z >= roadZs[0] - h && z <= roadZs[roadZs.length - 1] + h && roadXs.some((rx) => Math.abs(x - rx) <= h);
  const inZ = x >= roadXs[0] - h && x <= roadXs[roadXs.length - 1] + h && roadZs.some((rz) => Math.abs(z - rz) <= h);
  return inX || inZ;
}

export function onPier(x, z) {
  return Math.abs(x - CITY.pierX) < CITY.pierWidth / 2 && z > CITY.shoreZ - 6 && z < CITY.shoreZ + CITY.pierLength;
}

export function groundAt(x, z) {
  if (onPier(x, z) && z > CITY.shoreZ - 2) return 0.9;
  if (isOnRoad(x, z) || z > CITY.beachStart) return 0;
  return 0.25;
}

// Solid areas a body may not enter: building boxes, the sea and the map edge.
export function isBlockedArea(x, z) {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ) return true;
  if (z > CITY.shoreZ + 3 && !onPier(x, z)) return true;
  return z >= BOUNDS.maxZ;
}

function lotCenter(i, j) {
  return { x: (i + 0.5) * CITY.cell, z: (j + 0.5) * CITY.cell };
}

function boxWithUv(w, h, d, tileW, tileH) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z (4 verts each)
  for (let f = 0; f < 6; f++) {
    const span = f < 2 ? d : w;
    for (let k = 0; k < 4; k++) {
      const idx = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(idx, 0.02, 0.02); continue; }
      uv.setXY(idx, uv.getX(idx) * Math.max(1, Math.round(span / tileW)), uv.getY(idx) * Math.max(1, Math.round(h / tileH)));
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg; g.font = 'bold 58px Trebuchet MS, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const buildings = [];
  const palms = [];
  const facadeTex = makeFacadeTexture();
  const glassTex = makeGlassTexture();
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a8076 });
  const wallMats = PALETTE.walls.map((c) => new THREE.MeshLambertMaterial({ color: c, map: facadeTex }));
  const towerMats = PALETTE.towers.map((c) => new THREE.MeshLambertMaterial({ color: c, map: glassTex }));

  // Sky dome and sun
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(38, 32), new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sun.position.set(-260, 120, 820); sun.lookAt(0, 0, 0);
  scene.add(sun);

  // Ground layers: asphalt, sand, sea
  const asphalt = makeAsphaltTexture(rng);
  asphalt.repeat.set(80, 80);
  const groundW = BOUNDS.maxX - BOUNDS.minX + 80;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundW, CITY.beachStart - BOUNDS.minZ + 40), new THREE.MeshLambertMaterial({ map: asphalt }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (CITY.beachStart + BOUNDS.minZ - 40) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const sandTex = makeSandTexture(rng);
  sandTex.repeat.set(30, 4);
  const sandDepth = CITY.shoreZ - CITY.beachStart + 12;
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(groundW + 400, sandDepth), new THREE.MeshLambertMaterial({ map: sandTex }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachStart + sandDepth / 2);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1400), new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.3, CITY.shoreZ + 700);
  scene.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(3000, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.05, CITY.shoreZ + 1);
  scene.add(foam);

  addLaneMarkings(scene);

  // Lots
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const grassMat = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
  const lotSize = CITY.cell - CITY.road;
  const special = {};
  for (const [key, lm] of Object.entries(LANDMARKS)) if (lm.lot) special[lm.lot.join(',')] = key;

  for (let i = CITY.colsMin; i < CITY.colsMax; i++) {
    for (let j = CITY.rowsMin; j < CITY.rowsMax; j++) {
      const c = lotCenter(i, j);
      const isPark = (i === -1 && j === 0) || (i === 3 && j === -3) || (i === -4 && j === -1);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(lotSize, 0.25, lotSize), isPark ? grassMat : sidewalkMat);
      slab.position.set(c.x, 0.125, c.z);
      slab.receiveShadow = true;
      scene.add(slab);
      const key = special[`${i},${j}`];
      if (key) { buildLandmark(scene, key, c, colliders, buildings, wallMats); continue; }
      if (isPark) { for (let k = 0; k < 7; k++) palms.push({ x: c.x + rng.range(-22, 22), z: c.z + rng.range(-22, 22), h: rng.range(7, 11) }); continue; }
      fillLot(scene, c, i, j, rng, wallMats, towerMats, roofMat, colliders, buildings);
    }
  }

  // Beach-front palms and boulevard palms
  for (let x = BOUNDS.minX + 10; x < BOUNDS.maxX; x += 16) palms.push({ x: x + rng.range(-2, 2), z: CITY.beachStart + 6, h: rng.range(8, 12) });
  for (let z = -260; z < 200; z += 24) { palms.push({ x: -10.5, z, h: 9 }); palms.push({ x: 10.5, z: z + 12, h: 9 }); }
  for (let k = 0; k < 26; k++) palms.push({ x: rng.range(BOUNDS.minX, BOUNDS.maxX), z: rng.range(CITY.beachStart + 14, CITY.shoreZ - 12), h: rng.range(7, 12) });
  addPalms(scene, palms, rng);
  addBeachProps(scene, rng);
  addPier(scene);
  addHills(scene, rng);

  return {
    colliders, buildings, roadXs, roadZs, sea,
    update(t) { sea.position.y = -0.3 + Math.sin(t * 0.8) * 0.08; foam.material.opacity = 0.5 + 0.3 * Math.sin(t * 1.3); },
  };
}

function addBuilding(scene, x, z, w, d, h, mat, roofMat, colliders, buildings, tile = [6, 4]) {
  const geo = boxWithUv(w, h, d, tile[0], tile[1]);
  const mesh = new THREE.Mesh(geo, [mat, mat, roofMat, roofMat, mat, mat]);
  mesh.position.set(x, h / 2 + 0.25, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
  buildings.push({ x, z, w, d, h });
  return mesh;
}

function fillLot(scene, c, i, j, rng, wallMats, towerMats, roofMat, colliders, buildings) {
  const downtown = Math.abs(c.x) < 150 && c.z < 80 && c.z > -160;
  const beachfront = j === CITY.rowsMax - 1;
  const usable = CITY.cell - CITY.road - CITY.sidewalk * 2;
  if (downtown) {
    const h = rng.range(40, 95);
    const w = rng.range(26, 38);
    const m = addBuilding(scene, c.x, c.z, w, w, h, rng.pick(towerMats), roofMat, colliders, buildings, [5, 5]);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 6, w * 0.6), roofMat);
    crown.position.set(0, h / 2 + 3, 0);
    m.add(crown);
    if (rng.chance(0.6)) {
      const side = rng.range(10, 14);
      addBuilding(scene, c.x + usable / 2 - side / 2, c.z - usable / 2 + side / 2, side, side, rng.range(10, 20), rng.pick(wallMats), roofMat, colliders, buildings);
    }
    return;
  }
  // Split the lot into a 2x2 of mid-rise or low houses
  const q = usable / 2;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      if (rng.chance(0.18)) continue;
      const w = q - rng.range(2, 6);
      const d = q - rng.range(2, 6);
      const h = beachfront ? rng.range(14, 32) : rng.range(6, 22);
      const bx = c.x - usable / 4 + a * q;
      const bz = c.z - usable / 4 + b * q;
      const mesh = addBuilding(scene, bx, bz, w, d, h, rng.pick(wallMats), roofMat, colliders, buildings);
      if (rng.chance(0.4)) {
        const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.3, 2.2), new THREE.MeshLambertMaterial({ color: rng.pick([0xff5f9e, 0x2ec4b6, 0xffd24a, 0xe63946]) }));
        aw.position.set(0, -h / 2 + 3.2, d / 2 + 1.1);
        mesh.add(aw);
      }
    }
  }
}

function buildLandmark(scene, key, c, colliders, buildings, wallMats) {
  const lm = LANDMARKS[key];
  const roof = new THREE.MeshLambertMaterial({ color: 0x6b5f57 });
  if (key === 'lot') {
    const lines = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let k = -4; k <= 4; k++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 8), lines);
      l.rotation.x = -Math.PI / 2; l.position.set(c.x + k * 5, 0.27, c.z - 12);
      scene.add(l);
    }
    return;
  }
  const dims = { safehouse: [22, 16, 9], diner: [26, 18, 7], garage: [30, 22, 10] }[key];
  const mat = new THREE.MeshLambertMaterial({ color: { safehouse: 0xffb4a2, diner: 0xa8e6cf, garage: 0xd9e4ec }[key], map: wallMats[0].map });
  const mesh = addBuilding(scene, c.x, c.z, dims[0], dims[1], dims[2], mat, roof, colliders, buildings);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTexture(lm.label.toUpperCase(), '#1b0f2e', lm.color) }));
  // face the sign toward the marker road
  const dx = lm.x - c.x, dz = lm.z - c.z;
  if (Math.abs(dx) > Math.abs(dz)) {
    sign.position.set(Math.sign(dx) * (dims[0] / 2 + 0.1), dims[2] / 2 - 1.5, 0);
    sign.rotation.y = Math.sign(dx) * Math.PI / 2;
  } else {
    sign.position.set(0, dims[2] / 2 - 1.5, Math.sign(dz) * (dims[1] / 2 + 0.1));
    if (dz < 0) sign.rotation.y = Math.PI;
  }
  mesh.add(sign);
}

function addLaneMarkings(scene) {
  const dashes = [];
  const h = CITY.road / 2;
  const zMin = CITY.rowsMin * CITY.cell, zMax = CITY.rowsMax * CITY.cell;
  const xMin = CITY.colsMin * CITY.cell, xMax = CITY.colsMax * CITY.cell;
  for (let i = CITY.colsMin; i <= CITY.colsMax; i++) {
    for (let z = zMin; z < zMax; z += 6) if (((z - zMin) % CITY.cell) > h + 2 && ((z - zMin) % CITY.cell) < CITY.cell - h - 2) dashes.push([i * CITY.cell, z, 0]);
  }
  for (let j = CITY.rowsMin; j <= CITY.rowsMax; j++) {
    for (let x = xMin; x < xMax; x += 6) if (((x - xMin) % CITY.cell) > h + 2 && ((x - xMin) % CITY.cell) < CITY.cell - h - 2) dashes.push([x, j * CITY.cell, 1]);
  }
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 3), new THREE.MeshBasicMaterial({ color: 0xffd24a }), dashes.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  dashes.forEach(([x, z, rot], k) => {
    e.set(-Math.PI / 2, 0, rot ? Math.PI / 2 : 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(k, m);
  });
  scene.add(inst);
}

function addPalms(scene, palms, rng) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const leafGeo = new THREE.BoxGeometry(0.9, 0.12, 4.2);
  leafGeo.translate(0, 0, 2.1);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8b6b4a }), palms.length);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: 0x4cc25e }), palms.length * 7);
  trunks.castShadow = true; leaves.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  palms.forEach((p, k) => {
    const lean = rng.range(-0.12, 0.12);
    e.set(lean, 0, rng.range(-0.1, 0.1)); q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, 0.2, p.z), q, new THREE.Vector3(1, p.h, 1));
    trunks.setMatrixAt(k, m);
    const top = new THREE.Vector3(0, p.h, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, 0.2, p.z));
    for (let f = 0; f < 7; f++) {
      e.set(0.45 + rng.range(-0.1, 0.2), (f / 7) * Math.PI * 2 + rng.range(0, 0.4), 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(top, q, new THREE.Vector3(1, 1, 1));
      leaves.setMatrixAt(k * 7 + f, m);
    }
  });
  scene.add(trunks); scene.add(leaves);
}

function addBeachProps(scene, rng) {
  const colors = [0xff5f9e, 0xffd24a, 0x2ec4b6, 0xffffff, 0xe63946];
  for (let k = 0; k < 30; k++) {
    const x = rng.range(BOUNDS.minX, BOUNDS.maxX), z = rng.range(CITY.beachStart + 18, CITY.shoreZ - 6);
    if (Math.abs(x - CITY.pierX) < 10) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pole.position.set(x, 1.3, z);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 8), new THREE.MeshLambertMaterial({ color: rng.pick(colors) }));
    top.position.set(x, 2.7, z); top.castShadow = true;
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), new THREE.MeshLambertMaterial({ color: rng.pick(colors) }));
    towel.rotation.x = -Math.PI / 2; towel.position.set(x + 1.4, 0.05, z);
    scene.add(pole, top, towel);
  }
  // lifeguard towers
  for (const x of [-200, -60, 140, 230]) {
    const g = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 2.6), new THREE.MeshLambertMaterial({ color: 0xf6f1e9 }));
    legs.position.y = 1.5;
    const hut = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 3.2), new THREE.MeshLambertMaterial({ color: 0xff5f9e }));
    hut.position.y = 4.1;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), new THREE.MeshLambertMaterial({ color: 0xffd24a }));
    roof.position.y = 5.8; roof.rotation.y = Math.PI / 4;
    g.add(legs, hut, roof); g.position.set(x, 0, CITY.shoreZ - 18);
    g.traverse((o) => { o.castShadow = true; });
    scene.add(g);
  }
}

function addPier(scene) {
  const wood = new THREE.MeshLambertMaterial({ color: 0xa47148 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(CITY.pierWidth, 0.5, CITY.pierLength + 8), wood);
  deck.position.set(CITY.pierX, 0.65, CITY.shoreZ + CITY.pierLength / 2 - 4);
  deck.receiveShadow = true; deck.castShadow = true;
  scene.add(deck);
  const postGeo = new THREE.CylinderGeometry(0.3, 0.3, 3);
  for (let z = CITY.shoreZ; z < CITY.shoreZ + CITY.pierLength; z += 10) {
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(postGeo, wood);
      p.position.set(CITY.pierX + s * (CITY.pierWidth / 2 - 0.3), -0.5, z);
      scene.add(p);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 10), new THREE.MeshLambertMaterial({ color: 0xf6f1e9 }));
      rail.position.set(CITY.pierX + s * (CITY.pierWidth / 2 - 0.1), 1.4, z + 5);
      scene.add(rail);
    }
  }
  // Ferris wheel at the end of the pier
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(14, 0.5, 6, 40), new THREE.MeshLambertMaterial({ color: 0xff5f9e }));
  wheel.position.set(CITY.pierX, 16, CITY.shoreZ + CITY.pierLength - 4);
  wheel.rotation.y = Math.PI / 2;
  scene.add(wheel);
  for (let k = 0; k < 8; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 28, 0.3), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    spoke.position.copy(wheel.position); spoke.rotation.x = (k / 8) * Math.PI;
    scene.add(spoke);
  }
}

function addHills(scene, rng) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x7a8f5a });
  for (let k = 0; k < 14; k++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rng.range(60, 120), rng.range(40, 90), 7), mat);
    hill.position.set(rng.range(-600, 600), 10, BOUNDS.minZ - rng.range(90, 220));
    scene.add(hill);
  }
}
