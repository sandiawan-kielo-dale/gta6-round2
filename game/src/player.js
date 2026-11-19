// The player character: on-foot movement, jumping, health and getting in and out of cars.
import { PLAYER } from './config.js';
import { makeHumanoid, animateHumanoid, makePistolMesh } from './characters.js';
import { resolveCircle, keepInWorld } from './physics.js';
import { groundAt } from './city.js';

export function createPlayer(scene, x, z) {
  const mesh = makeHumanoid({ shirt: 0xff4f8b, pants: 0x1d3557, skin: 0xb9805a, hair: 0x1a0f08 });
  const gun = makePistolMesh();
  mesh.userData.parts.armR.add(gun);
  scene.add(mesh);
  return {
    mesh, gun, x, z, y: 0, vy: 0, yaw: 0, health: PLAYER.maxHealth, armor: 0,
    cash: 150, weapon: 'fists', ammo: 48, inCar: null, alive: true,
    phase: 0, moveAmount: 0, punchT: 1, aimT: 0, hurtFlash: 0, onGround: true,
  };
}

export function rightOf(h) { return { x: -Math.cos(h), z: Math.sin(h) }; }

// mv: {x,y} input axes, camYaw: camera heading, sprint/jump: bools.
export function updatePlayerOnFoot(p, mv, camYaw, sprint, jump, dt) {
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const r = rightOf(camYaw);
  let dx = fx * mv.y + r.x * mv.x;
  let dz = fz * mv.y + r.z * mv.x;
  const len = Math.hypot(dx, dz);
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (len > 0.01) {
    dx /= len; dz /= len;
    const targetYaw = Math.atan2(dx, dz);
    let diff = targetYaw - p.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (p.aimT <= 0) p.yaw += diff * Math.min(1, dt * 12);
  }
  if (p.aimT > 0) p.yaw = camYaw;
  const px = p.x, pz = p.z;
  p.x += dx * speed * dt * Math.min(1, len);
  p.z += dz * speed * dt * Math.min(1, len);
  const pos = { x: p.x, z: p.z };
  resolveCircle(pos, PLAYER.radius);
  keepInWorld(pos, px, pz);
  p.x = pos.x; p.z = pos.z;

  const g = groundAt(p.x, p.z);
  if (jump && p.onGround) { p.vy = PLAYER.jumpSpeed; p.onGround = false; }
  p.vy -= PLAYER.gravity * dt;
  p.y += p.vy * dt;
  if (p.y <= g) { p.y = g; p.vy = 0; p.onGround = true; }

  p.moveAmount += ((len > 0.01 ? (sprint ? 1 : 0.6) : 0) - p.moveAmount) * Math.min(1, dt * 8);
  p.phase += dt * (sprint ? 13 : 8) * (len > 0.01 ? 1 : 0);
  p.punchT += dt * 3;
  p.aimT -= dt;
  syncPlayerMesh(p);
}

export function syncPlayerMesh(p) {
  p.mesh.visible = !p.inCar;
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.yaw;
  p.gun.visible = p.weapon === 'pistol';
  let pose = 'walk';
  if (!p.alive) pose = 'dead';
  else if (p.punchT < 1) pose = 'punch';
  else if (p.aimT > 0 && p.weapon === 'pistol') pose = 'aim';
  animateHumanoid(p.mesh, p.phase, p.onGround ? p.moveAmount : 0.3, pose, p.punchT);
}

export function damagePlayer(p, amount) {
  if (!p.alive) return;
  const absorbed = Math.min(p.armor, amount * 0.7);
  p.armor -= absorbed;
  p.health -= amount - absorbed;
  p.hurtFlash = 0.35;
  if (p.health <= 0) { p.health = 0; p.alive = false; syncPlayerMesh(p); }
}

export function enterCar(p, car) {
  car.driver = 'player';
  car.wasStolen = true;
  p.inCar = car;
  p.mesh.visible = false;
}

export function exitCar(p) {
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  car.vx *= 0.3; car.vz *= 0.3;
  const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  p.x = car.x + side.x * 2.2; p.z = car.z + side.z * 2.2;
  const pos = { x: p.x, z: p.z };
  resolveCircle(pos, PLAYER.radius + 0.2);
  p.x = pos.x; p.z = pos.z;
  p.yaw = car.heading;
  p.inCar = null;
  syncPlayerMesh(p);
}
