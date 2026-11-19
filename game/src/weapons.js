// Weapons: fists (melee) and pistol (hitscan), target picking, ammo and crime reporting.
import { WEAPONS } from './config.js';
import { segmentBlocked } from './physics.js';
import { hurtPed, scarePeds } from './peds.js';
import { damageCar } from './vehicles.js';
import { tracer, hitSpark, puff } from './effects.js';

export function createArsenal() {
  return { cooldown: 0 };
}

// Find the first ped or car along the ray from (x,z) in direction yaw within range.
function castRay(x, z, yaw, range, peds, cars) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let best = null, bestAlong = range;
  const consider = (obj, radius, kind) => {
    const dx = obj.x - x, dz = obj.z - z;
    const along = dx * fx + dz * fz;
    if (along <= 0.3 || along >= bestAlong) return;
    const side = Math.abs(dx * fz - dz * fx);
    if (side > radius + along * 0.025) return; // slight auto-aim cone
    best = { obj, kind, along }; bestAlong = along;
  };
  for (const p of peds) if (p.state !== 'dead') consider(p, 0.6, 'ped');
  for (const c of cars) consider(c, 1.4, 'car');
  if (best && segmentBlocked(x, z, best.obj.x, best.obj.z)) best = null;
  return best;
}

// world: { peds, cars, onKill(ped), onHitCar(car), onShotFired() }
export function attack(arsenal, player, world) {
  if (arsenal.cooldown > 0 || !player.alive || player.inCar) return false;
  const w = WEAPONS[player.weapon];
  if (player.weapon === 'pistol' && player.ammo <= 0) { player.weapon = 'fists'; return false; }
  arsenal.cooldown = w.cooldown;
  const yaw = player.yaw;
  if (player.weapon === 'fists') {
    player.punchT = 0;
    const hit = castRay(player.x, player.z, yaw, w.range, world.peds, []);
    if (hit) {
      hitSpark({ x: hit.obj.x, y: 1.5, z: hit.obj.z });
      const died = hurtPed(hit.obj, w.damage, player.x, player.z);
      world.onHitPed(hit.obj, died, 'melee');
    }
    return true;
  }
  player.ammo -= 1;
  player.aimT = 1.2;
  const from = { x: player.x + Math.sin(yaw) * 0.7, y: player.y + 1.45, z: player.z + Math.cos(yaw) * 0.7 };
  const hit = castRay(player.x, player.z, yaw, w.range, world.peds, world.cars);
  let to = { x: player.x + Math.sin(yaw) * w.range, y: 1.4, z: player.z + Math.cos(yaw) * w.range };
  if (hit) {
    to = { x: hit.obj.x, y: hit.kind === 'car' ? 1 : 1.3, z: hit.obj.z };
    if (hit.kind === 'ped') {
      hitSpark(to);
      const died = hurtPed(hit.obj, w.damage, player.x, player.z);
      world.onHitPed(hit.obj, died, 'gun');
    } else {
      puff(to, 0xffcc66, 0.3, 0.25, 0);
      damageCar(hit.obj, 12);
      world.onHitCar(hit.obj);
    }
  }
  tracer(from, to);
  scarePeds(world.peds, player.x, player.z, 35);
  world.onShotFired();
  return true;
}

export function tickArsenal(arsenal, dt) { arsenal.cooldown = Math.max(0, arsenal.cooldown - dt); }
