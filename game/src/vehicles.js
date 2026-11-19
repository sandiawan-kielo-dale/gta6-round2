// Vehicles: car models, mesh building, arcade driving physics and damage.
import { CAR, PALETTE } from './config.js';
import { resolveCircle, keepInWorld } from './physics.js';
import { groundAt } from './city.js';

const THREE = window.THREE;

export const MODELS = [
  { name: 'Solara Coupe', len: 4.3, wid: 1.9, hgt: 0.62, cabin: 0.5, top: 1.0 },
  { name: 'Tidewater Sedan', len: 4.7, wid: 2.0, hgt: 0.72, cabin: 0.65, top: 0.9 },
  { name: 'Marlin GT', len: 4.5, wid: 2.0, hgt: 0.55, cabin: 0.45, top: 1.1 },
  { name: 'Pelican Van', len: 5.0, wid: 2.1, hgt: 1.5, cabin: 0.4, top: 0.75 },
];
export const POLICE_MODEL = { name: 'Coral PD Interceptor', len: 4.8, wid: 2.0, hgt: 0.72, cabin: 0.62, top: 1.05, police: true };

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x18181c });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x23324a });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });

export function makeCarMesh(model, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.wid, model.hgt, model.len), bodyMat);
  body.position.y = 0.45 + model.hgt / 2;
  const cabinLen = model.len * model.cabin;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.86, 0.58, cabinLen), glassMat);
  cabin.position.set(0, 0.45 + model.hgt + 0.29, -model.len * 0.06);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.88, 0.08, cabinLen * 0.9), bodyMat);
  roof.position.set(0, 0.45 + model.hgt + 0.6, -model.len * 0.06);
  g.add(body, cabin, roof);
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(sx * (model.wid / 2 - 0.1), 0.42, sz * (model.len / 2 - 0.85));
    g.add(w); wheels.push(w);
  }
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.05), headMat);
    hl.position.set(sx * (model.wid / 2 - 0.35), 0.45 + model.hgt * 0.7, model.len / 2 + 0.02);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.05), tailMat);
    tl.position.set(sx * (model.wid / 2 - 0.35), 0.45 + model.hgt * 0.7, -model.len / 2 - 0.02);
    g.add(hl, tl);
  }
  let lightbar = null;
  if (model.police) {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(model.wid + 0.02, model.hgt * 0.6, model.len * 0.3), new THREE.MeshLambertMaterial({ color: 0x14213d }));
    hood.position.set(0, 0.45 + model.hgt * 0.5, 0);
    g.add(hood);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    red.position.set(-0.35, 0.45 + model.hgt + 0.73, -model.len * 0.06);
    blue.position.set(0.35, 0.45 + model.hgt + 0.73, -model.len * 0.06);
    g.add(red, blue);
    lightbar = { red, blue };
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, wheels, lightbar, bodyMat };
}

export function createCar(scene, model, color, x, z, heading) {
  const parts = makeCarMesh(model, color);
  scene.add(parts.group);
  const car = {
    model, color, mesh: parts.group, wheels: parts.wheels, lightbar: parts.lightbar, bodyMat: parts.bodyMat,
    x, z, y: 0, heading, vx: 0, vz: 0, speed: 0, steerVis: 0, wheelSpin: 0,
    health: 100, driver: null, wrecked: false, smoke: 0,
  };
  syncCarMesh(car);
  return car;
}

export function randomCivilianCar(scene, rng, x, z, heading) {
  return createCar(scene, rng.pick(MODELS), rng.pick(PALETTE.cars), x, z, heading);
}

export function forwardOf(h) { return { x: Math.sin(h), z: Math.cos(h) }; }

// Arcade handling: throttle -1..1, steer -1..1 (positive = left), handbrake bool.
export function driveCar(car, throttle, steer, handbrake, dt) {
  if (car.wrecked) { throttle = 0; steer = 0; }
  const f = forwardOf(car.heading);
  const r = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  let vF = car.vx * f.x + car.vz * f.z;
  let vR = car.vx * r.x + car.vz * r.z;
  if (throttle > 0) vF += CAR.accel * throttle * dt * (vF < 0 ? 2 : 1);
  else if (throttle < 0) vF += (vF > 0.5 ? CAR.brake : CAR.accel * 0.7) * throttle * dt;
  vF = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, vF));
  vF -= vF * CAR.drag * dt * (throttle === 0 ? 1.6 : 1);
  if (handbrake) vF -= vF * 1.3 * dt;
  const speedFactor = Math.max(-1, Math.min(1, vF / 7)) * (1 - Math.min(0.55, Math.abs(vF) / 90));
  car.heading += steer * CAR.steer * speedFactor * dt * (handbrake ? 1.5 : 1);
  const grip = handbrake ? CAR.driftGrip : CAR.grip;
  vR *= Math.exp(-grip * dt);
  const nf = forwardOf(car.heading);
  const nr = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  car.vx = nf.x * vF + nr.x * vR;
  car.vz = nf.z * vF + nr.z * vR;
  car.speed = vF;
  car.drift = Math.abs(vR);
  car.steerVis += (steer * 0.5 - car.steerVis) * Math.min(1, dt * 10);
  return moveCar(car, dt);
}

// Integrate and collide; returns impact speed (0 when nothing was hit).
export function moveCar(car, dt) {
  const px = car.x, pz = car.z;
  car.x += car.vx * dt; car.z += car.vz * dt;
  const pos = { x: car.x, z: car.z };
  let impact = 0;
  if (resolveCircle(pos, CAR.radius) || keepInWorld(pos, px, pz)) {
    impact = Math.hypot(car.vx, car.vz);
    car.vx *= -0.25; car.vz *= -0.25; car.speed *= -0.25;
    if (impact > 9) damageCar(car, impact * 0.9);
  }
  car.x = pos.x; car.z = pos.z;
  car.y += (groundAt(car.x, car.z) - car.y) * Math.min(1, dt * 8);
  car.wheelSpin += car.speed * dt / 0.42;
  syncCarMesh(car);
  return impact;
}

export function damageCar(car, amount) {
  car.health -= amount;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.bodyMat.color.setHex(0x2a2522);
  }
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, car.y, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheels.forEach((w, i) => {
    w.rotation.x = car.wheelSpin;
    w.rotation.y = i < 2 ? car.steerVis : 0;
  });
}

export function flashLightbar(car, t) {
  if (!car.lightbar) return;
  const on = Math.floor(t * 6) % 2 === 0;
  car.lightbar.red.material.color.setHex(on ? 0xff2030 : 0x401015);
  car.lightbar.blue.material.color.setHex(on ? 0x101840 : 0x3070ff);
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd && !c.wrecked) { bd = d; best = c; }
  }
  return best;
}
