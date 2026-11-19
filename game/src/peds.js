// Pedestrians: sidewalk wandering, panic and fleeing, hostile gang members, deaths and cash drops.
import { CITY, PEDS } from './config.js';
import { makeHumanoid, animateHumanoid, makePistolMesh } from './characters.js';
import { resolveCircle, keepInWorld, angleWrap } from './physics.js';
import { groundAt } from './city.js';

const SHIRTS = [0xffd166, 0x06d6a0, 0x118ab2, 0xef476f, 0xffffff, 0xf4a261, 0x9b5de5, 0x00bbf9];
const PANTS = [0x2b2d42, 0x6c584c, 0x264653, 0xe9c46a, 0x3a86ff, 0x1b1b1b];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

function sidewalkPoint(rng, i, j) {
  const cx = (i + 0.5) * CITY.cell, cz = (j + 0.5) * CITY.cell;
  const half = (CITY.cell - CITY.road) / 2 - 1.4;
  const side = rng.int(0, 3);
  const t = rng.range(-half, half);
  if (side === 0) return { x: cx + t, z: cz - half };
  if (side === 1) return { x: cx + t, z: cz + half };
  if (side === 2) return { x: cx - half, z: cz + t };
  return { x: cx + half, z: cz + t };
}

function randomLot(rng) {
  return { i: rng.int(CITY.colsMin, CITY.colsMax - 1), j: rng.int(CITY.rowsMin, CITY.rowsMax - 1) };
}

export function createPed(scene, rng, x, z, opts = {}) {
  const look = opts.look || { shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), skin: rng.pick(SKINS), hair: rng.pick([0x1a0f08, 0x6b3e1e, 0xe8c07d, 0x111111]) };
  const mesh = makeHumanoid(look);
  if (opts.armed) { const gun = makePistolMesh(); mesh.userData.parts.armR.add(gun); }
  scene.add(mesh);
  const ped = {
    mesh, x, z, y: 0.25, yaw: rng.range(-Math.PI, Math.PI), state: 'walk', health: opts.health || 40,
    phase: rng.range(0, 6), speed: PEDS.speed * rng.range(0.8, 1.2), target: null, lot: opts.lot || null,
    kind: opts.kind || 'civ', hostile: !!opts.hostile, armed: !!opts.armed, cooldown: 1, fear: 0, deadT: 0, punchT: 1,
  };
  return ped;
}

export function spawnPeds(scene, rng, count = PEDS.count) {
  const peds = [];
  for (let n = 0; n < count; n++) {
    const lot = randomLot(rng);
    const p = sidewalkPoint(rng, lot.i, lot.j);
    const ped = createPed(scene, rng, p.x, p.z, { lot });
    peds.push(ped);
  }
  // beach strollers
  for (let n = 0; n < 10; n++) {
    const ped = createPed(scene, rng, rng.range(-260, 260), rng.range(CITY.beachStart + 10, CITY.shoreZ - 8), { look: { shirt: rng.pick(SHIRTS), pants: rng.pick([0xff5f9e, 0x2ec4b6, 0xffd24a]), skin: rng.pick(SKINS), hair: 0x3b2314 } });
    ped.beach = true;
    peds.push(ped);
  }
  return peds;
}

export function scarePeds(peds, x, z, radius) {
  for (const p of peds) {
    if (p.state === 'dead' || p.hostile) continue;
    if (Math.hypot(p.x - x, p.z - z) < radius) { p.state = 'flee'; p.fear = 8; p.threat = { x, z }; }
  }
}

// Returns true if the ped died from this hit.
export function hurtPed(ped, dmg, fromX, fromZ) {
  if (ped.state === 'dead') return false;
  ped.health -= dmg;
  ped.knock = { x: ped.x - fromX, z: ped.z - fromZ };
  if (ped.health <= 0) {
    ped.state = 'dead'; ped.deadT = 0;
    return true;
  }
  if (!ped.hostile) { ped.state = 'flee'; ped.fear = 10; ped.threat = { x: fromX, z: fromZ }; }
  return false;
}

// hooks: { attackPlayer(ped, kind) } is called when a hostile ped strikes or shoots.
export function updatePeds(peds, rng, dt, player, hooks) {
  for (const p of peds) {
    if (p.state === 'dead') {
      p.deadT += dt;
      animateHumanoid(p.mesh, 0, 0, 'dead');
      p.mesh.position.set(p.x, p.y, p.z);
      continue;
    }
    let moveX = 0, moveZ = 0, speed = p.speed;
    const tx = player.inCar ? player.inCar.x : player.x;
    const tz = player.inCar ? player.inCar.z : player.z;
    const dPlayer = Math.hypot(tx - p.x, tz - p.z);
    let pose = 'walk';
    if (p.hostile && player.alive) {
      p.yaw = Math.atan2(tx - p.x, tz - p.z);
      p.cooldown -= dt;
      if (p.armed && dPlayer < 30) {
        pose = 'aim';
        if (dPlayer > 9) { moveX = Math.sin(p.yaw); moveZ = Math.cos(p.yaw); speed = 2.2; }
        if (p.cooldown <= 0) { p.cooldown = rng.range(0.9, 1.6); hooks.attackPlayer(p, 'shot'); }
      } else if (dPlayer > 1.4) {
        moveX = Math.sin(p.yaw); moveZ = Math.cos(p.yaw); speed = dPlayer < 40 ? 5.5 : 0;
      } else if (p.cooldown <= 0) {
        p.cooldown = 0.9; p.punchT = 0; hooks.attackPlayer(p, 'punch');
      }
    } else if (p.state === 'flee') {
      p.fear -= dt;
      const ax = p.x - p.threat.x, az = p.z - p.threat.z;
      const l = Math.hypot(ax, az) || 1;
      moveX = ax / l; moveZ = az / l; speed = 6;
      p.yaw = Math.atan2(moveX, moveZ);
      if (p.fear <= 0) { p.state = 'walk'; p.target = null; }
    } else {
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.z - p.z) < 1) {
        if (p.beach) p.target = { x: p.x + rng.range(-20, 20), z: Math.max(CITY.beachStart + 8, Math.min(CITY.shoreZ - 6, p.z + rng.range(-12, 12))) };
        else if (p.lot) p.target = sidewalkPoint(rng, p.lot.i, p.lot.j);
        else p.target = { x: p.x + rng.range(-10, 10), z: p.z + rng.range(-10, 10) };
      }
      const ax = p.target.x - p.x, az = p.target.z - p.z;
      const l = Math.hypot(ax, az) || 1;
      moveX = ax / l; moveZ = az / l;
      const want = Math.atan2(moveX, moveZ);
      p.yaw += angleWrap(want - p.yaw) * Math.min(1, dt * 6);
    }
    const px = p.x, pz = p.z;
    p.x += moveX * speed * dt; p.z += moveZ * speed * dt;
    const pos = { x: p.x, z: p.z };
    resolveCircle(pos, 0.4);
    if (keepInWorld(pos, px, pz)) p.target = null;
    p.x = pos.x; p.z = pos.z;
    p.y = groundAt(p.x, p.z);
    const moving = Math.hypot(moveX, moveZ) * speed > 0.1;
    p.phase += dt * speed * 2.2 * (moving ? 1 : 0);
    p.punchT += dt * 3;
    if (p.punchT < 1) pose = 'punch';
    animateHumanoid(p.mesh, p.phase, moving ? Math.min(1, speed / 5 + 0.3) : 0, pose, p.punchT);
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.y = p.yaw;
  }
}

// Remove peds that died long ago and respawn civilians far from the player.
export function recyclePeds(scene, peds, rng, player) {
  for (let k = peds.length - 1; k >= 0; k--) {
    const p = peds[k];
    if (p.state === 'dead' && p.deadT > 25 && p.kind === 'civ') {
      scene.remove(p.mesh);
      const lot = randomLot(rng);
      const s = sidewalkPoint(rng, lot.i, lot.j);
      if (Math.hypot(s.x - player.x, s.z - player.z) > 60) peds[k] = createPed(scene, rng, s.x, s.z, { lot });
      else peds.splice(k, 1);
    }
  }
}
