// Wanted level (0-5 stars), police dispatch, pursuit driving, foot officers, evasion and arrests.
import { WANTED, CAR } from './config.js';
import { createCar, POLICE_MODEL, driveCar, flashLightbar } from './vehicles.js';
import { createPed } from './peds.js';
import { nearestNode, nodePos, stepToward } from './traffic.js';
import { segmentBlocked, angleWrap } from './physics.js';

const COP_LOOK = { shirt: 0x1d3a6e, pants: 0x14213d, skin: 0xc68e6a, hair: 0x111111, hat: 0x0d1b2a };

export function createWanted() {
  return { stars: 0, unseenT: 0, lastSeen: null, copCars: [], cops: [], bustT: 0, sirenT: 0, flash: 0, spawnT: 0, crimeCooldown: 0 };
}

export function reportCrime(w, amount, x, z) {
  const before = w.stars;
  w.stars = Math.min(WANTED.maxStars, Math.max(w.stars, 0) + amount);
  w.unseenT = 0;
  w.lastSeen = { x, z };
  if (w.stars > before) w.flash = 2;
  return w.stars > before;
}

export function clearWanted(scene, w) {
  w.stars = 0; w.unseenT = 0; w.bustT = 0;
  for (const c of w.copCars) scene.remove(c.mesh);
  for (const p of w.cops) scene.remove(p.mesh);
  w.copCars.length = 0; w.cops.length = 0;
}

function spawnCopCar(scene, w, rng, player) {
  const here = nearestNode(player.x, player.z);
  for (let tries = 0; tries < 12; tries++) {
    const i = Math.max(0, Math.min(8, here.i + rng.int(-3, 3)));
    const j = Math.max(0, Math.min(7, here.j + rng.int(-3, 3)));
    const p = nodePos(i, j);
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < 70 || d > 260) continue;
    const car = createCar(scene, POLICE_MODEL, 0xf5f5f5, p.x, p.z, Math.atan2(player.x - p.x, player.z - p.z));
    car.driver = 'police';
    car.cop = { node: { i, j }, shootT: rng.range(1, 3), dismounted: false };
    w.copCars.push(car);
    return car;
  }
  return null;
}

function steerPoliceCar(car, target, dt) {
  const want = Math.atan2(target.x - car.x, target.z - car.z);
  const diff = angleWrap(want - car.heading);
  const dist = Math.hypot(target.x - car.x, target.z - car.z);
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const throttle = Math.abs(diff) > 1.8 ? -0.6 : (dist < 8 ? 0.2 : 1);
  return driveCar(car, throttle, steer, Math.abs(diff) > 0.9 && car.speed > 15, dt);
}

// hooks: { damagePlayer(amount, source), onBusted(), tracer(from, to), ramPlayer(car, impact) }
export function updateWanted(scene, w, rng, player, dt, t, hooks) {
  w.flash = Math.max(0, w.flash - dt);
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  if (w.stars <= 0) {
    // cops left over drive off and despawn once out of view
    for (let k = w.copCars.length - 1; k >= 0; k--) if (Math.hypot(w.copCars[k].x - px, w.copCars[k].z - pz) > 90) { scene.remove(w.copCars[k].mesh); w.copCars.splice(k, 1); }
    for (let k = w.cops.length - 1; k >= 0; k--) { w.cops[k].hostile = false; if (Math.hypot(w.cops[k].x - px, w.cops[k].z - pz) > 60) { scene.remove(w.cops[k].mesh); w.cops.splice(k, 1); } }
    return;
  }

  // Dispatch
  w.spawnT -= dt;
  if (w.copCars.length < WANTED.copsPerStar[w.stars] && w.spawnT <= 0) { spawnCopCar(scene, w, rng, player); w.spawnT = 2.5; }

  let seen = false;
  for (let k = w.copCars.length - 1; k >= 0; k--) {
    const car = w.copCars[k];
    flashLightbar(car, t + k * 0.3);
    const dist = Math.hypot(px - car.x, pz - car.z);
    if (dist > 300) { scene.remove(car.mesh); w.copCars.splice(k, 1); continue; }
    const los = !segmentBlocked(car.x, car.z, px, pz);
    if (los && dist < WANTED.sightRange) seen = true;
    if (car.wrecked) continue;
    if (!player.inCar && dist < 14 && !car.cop.dismounted) {
      // officers jump out and chase on foot
      car.cop.dismounted = true;
      for (const s of [-1, 1]) {
        const cop = createPed(scene, rng, car.x + Math.cos(car.heading) * 2 * s, car.z - Math.sin(car.heading) * 2 * s, { look: COP_LOOK, kind: 'cop', hostile: true, armed: w.stars >= 2, health: 60 });
        w.cops.push(cop);
      }
    }
    if (car.cop.dismounted && !player.inCar) { driveCar(car, 0, 0, true, dt); continue; }
    if (player.inCar && car.cop.dismounted) car.cop.dismounted = dist > 25 ? false : car.cop.dismounted;
    let target;
    if (los && dist < 60) target = { x: px, z: pz };
    else {
      const here = nearestNode(car.x, car.z);
      const np = nodePos(here.i, here.j);
      const goal = nearestNode(px, pz);
      const next = Math.hypot(np.x - car.x, np.z - car.z) > 9 ? here : stepToward(here, goal);
      target = nodePos(next.i, next.j);
      if (next.i === goal.i && next.j === goal.j && Math.hypot(target.x - car.x, target.z - car.z) < 9) target = { x: px, z: pz };
    }
    const impact = steerPoliceCar(car, target, dt);
    if (player.inCar && dist < CAR.radius * 2.3 && impact === 0) hooks.ramPlayer(car, Math.abs(car.speed));
    // shooting from the car at 3+ stars
    car.cop.shootT -= dt;
    if (w.stars >= 3 && los && dist < 32 && car.cop.shootT <= 0) {
      car.cop.shootT = rng.range(0.8, 1.6);
      hooks.tracer({ x: car.x, y: 1.6, z: car.z }, { x: px, y: 1.2, z: pz });
      if (rng.chance(0.45)) hooks.damagePlayer(player.inCar ? 4 : 7, 'police');
    }
  }
  for (const cop of w.cops) {
    if (cop.state === 'dead') continue;
    cop.hostile = true;
    cop.armed = w.stars >= 2 && cop.armed;
    const d = Math.hypot(px - cop.x, pz - cop.z);
    if (d < 40 && !segmentBlocked(cop.x, cop.z, px, pz)) seen = true;
  }

  // Arrest: a cop next to a slow or stopped player
  const slow = player.inCar ? Math.abs(player.inCar.speed) < 2.5 : true;
  const close = player.inCar
    ? w.copCars.some((c) => !c.wrecked && Math.hypot(c.x - px, c.z - pz) < 6.5)
    : w.cops.some((c) => c.state !== 'dead' && Math.hypot(c.x - px, c.z - pz) < 1.8);
  if (slow && close && player.alive) {
    w.bustT += dt;
    if (w.bustT > WANTED.bustTime) { w.bustT = 0; hooks.onBusted(); }
  } else w.bustT = Math.max(0, w.bustT - dt);

  // Evasion
  if (seen) { w.unseenT = 0; w.lastSeen = { x: px, z: pz }; }
  else {
    w.unseenT += dt;
    const lastDist = w.lastSeen ? Math.hypot(px - w.lastSeen.x, pz - w.lastSeen.z) : 999;
    if (w.unseenT > WANTED.evadeTime[w.stars] && lastDist > 40) {
      w.stars -= 1; w.unseenT = 0;
      if (w.stars === 0) hooks.onEvaded();
    }
  }
}

export function searchZone(w) {
  if (w.stars <= 0 || !w.lastSeen) return null;
  return { x: w.lastSeen.x, z: w.lastSeen.z, r: 30 + w.stars * 12 };
}
