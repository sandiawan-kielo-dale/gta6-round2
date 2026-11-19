// Collision helpers: a bucketed list of building boxes and circle push-out against them.
import { isBlockedArea } from './city.js';

const BUCKET = 36;
let buckets = new Map();

export function indexColliders(colliders) {
  buckets = new Map();
  for (const c of colliders) {
    for (let bx = Math.floor(c.minX / BUCKET); bx <= Math.floor(c.maxX / BUCKET); bx++) {
      for (let bz = Math.floor(c.minZ / BUCKET); bz <= Math.floor(c.maxZ / BUCKET); bz++) {
        const key = bx * 1000 + bz;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(c);
      }
    }
  }
}

function nearby(x, z) {
  const out = [];
  const bx = Math.floor(x / BUCKET), bz = Math.floor(z / BUCKET);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const list = buckets.get((bx + a) * 1000 + bz + b);
    if (list) for (const c of list) if (!out.includes(c)) out.push(c);
  }
  return out;
}

// Push a circle (pos.x, pos.z, r) out of every box; returns true when it touched something.
export function resolveCircle(pos, r) {
  let hit = false;
  for (const c of nearby(pos.x, pos.z)) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (r - d); pos.z += (dz / d) * (r - d);
    } else {
      // centre inside the box: push out along the shortest axis
      const pushes = [[c.minX - r - pos.x, 0], [c.maxX + r - pos.x, 0], [0, c.minZ - r - pos.z], [0, c.maxZ + r - pos.z]];
      pushes.sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
      pos.x += pushes[0][0]; pos.z += pushes[0][1];
    }
  }
  return hit;
}

// Move from prev to pos but refuse to step into the sea / off the map.
export function keepInWorld(pos, prevX, prevZ) {
  if (!isBlockedArea(pos.x, pos.z)) return false;
  if (!isBlockedArea(pos.x, prevZ)) { pos.z = prevZ; return true; }
  if (!isBlockedArea(prevX, pos.z)) { pos.x = prevX; return true; }
  pos.x = prevX; pos.z = prevZ;
  return true;
}

// Does the segment from a to b pass through a building? Used for line of sight and bullets.
export function segmentBlocked(ax, az, bx, bz) {
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 3);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    for (const c of nearby(x, z)) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
  }
  return false;
}

export function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
