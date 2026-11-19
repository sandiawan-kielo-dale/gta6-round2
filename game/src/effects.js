// Short-lived visual effects: bullet tracers, muzzle flashes, hit puffs, tyre smoke and wreck fires.
const THREE = window.THREE;

const items = [];
let scene = null;
const puffGeo = new THREE.SphereGeometry(0.5, 6, 4);

export function initEffects(s) { scene = s; }

export function tracer(from, to, color = 0xfff2a0) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
  scene.add(line);
  items.push({ obj: line, life: 0.12, max: 0.12, kind: 'fade' });
  flash(from);
}

export function flash(at) {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true }));
  m.position.set(at.x, at.y, at.z); m.scale.setScalar(0.5);
  scene.add(m);
  items.push({ obj: m, life: 0.08, max: 0.08, kind: 'fade' });
}

export function puff(at, color = 0xd0d0d0, size = 1, life = 0.6, rise = 1) {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  m.position.set(at.x, at.y, at.z); m.scale.setScalar(size);
  scene.add(m);
  items.push({ obj: m, life, max: life, kind: 'puff', rise, size });
}

export function hitSpark(at) { puff(at, 0xff3b3b, 0.35, 0.35, 0.2); }

export function updateEffects(dt) {
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k];
    it.life -= dt;
    const f = Math.max(0, it.life / it.max);
    it.obj.material.opacity = f * (it.kind === 'puff' ? 0.8 : 1);
    if (it.kind === 'puff') {
      it.obj.position.y += it.rise * dt;
      it.obj.scale.setScalar(it.size * (1 + (1 - f) * 1.5));
    }
    if (it.life <= 0) {
      scene.remove(it.obj);
      it.obj.geometry !== puffGeo && it.obj.geometry.dispose();
      it.obj.material.dispose();
      items.splice(k, 1);
    }
  }
}

// Wrecked cars smoke; drifting cars leave tyre smoke.
export function carEffects(car, dt) {
  car.smoke = (car.smoke || 0) - dt;
  if (car.smoke > 0) return;
  if (car.wrecked) { car.smoke = 0.15; puff({ x: car.x, y: 1.8, z: car.z }, 0x333333, 1.2, 1.6, 2.5); }
  else if (car.health < 40) { car.smoke = 0.3; puff({ x: car.x + Math.sin(car.heading) * 1.8, y: 1.3, z: car.z + Math.cos(car.heading) * 1.8 }, 0x888888, 0.7, 1, 1.5); }
  else if ((car.drift || 0) > 4) { car.smoke = 0.07; puff({ x: car.x - Math.sin(car.heading) * 1.8, y: 0.4, z: car.z - Math.cos(car.heading) * 1.8 }, 0xeeeeee, 0.8, 0.8, 0.6); }
}
