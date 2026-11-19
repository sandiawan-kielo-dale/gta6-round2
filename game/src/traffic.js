// Road-graph helpers and civilian traffic AI that follows lanes and turns at intersections.
import { CITY, TRAFFIC } from './config.js';
import { randomCivilianCar, syncCarMesh, moveCar } from './vehicles.js';
import { angleWrap } from './physics.js';

const NI = CITY.colsMax - CITY.colsMin; // max node index along x
const NJ = CITY.rowsMax - CITY.rowsMin;
const DIRS = [{ di: 0, dj: 1 }, { di: 1, dj: 0 }, { di: 0, dj: -1 }, { di: -1, dj: 0 }];
const DIR_HEADING = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function nodePos(i, j) {
  return { x: (i + CITY.colsMin) * CITY.cell, z: (j + CITY.rowsMin) * CITY.cell };
}

export function nearestNode(x, z) {
  const i = Math.max(0, Math.min(NI, Math.round(x / CITY.cell) - CITY.colsMin));
  const j = Math.max(0, Math.min(NJ, Math.round(z / CITY.cell) - CITY.rowsMin));
  return { i, j };
}

function validDir(i, j, d) {
  const ni = i + DIRS[d].di, nj = j + DIRS[d].dj;
  return ni >= 0 && ni <= NI && nj >= 0 && nj <= NJ;
}

// Manhattan step from node a toward node b along the grid.
export function stepToward(a, b) {
  if (a.i !== b.i && (a.j === b.j || Math.abs(a.i - b.i) >= Math.abs(a.j - b.j))) return { i: a.i + Math.sign(b.i - a.i), j: a.j };
  if (a.j !== b.j) return { i: a.i, j: a.j + Math.sign(b.j - a.j) };
  return a;
}

function lanePoint(i, j, d) {
  const p = nodePos(i, j);
  const h = DIR_HEADING[d];
  return { x: p.x - Math.cos(h) * TRAFFIC.laneOffset, z: p.z + Math.sin(h) * TRAFFIC.laneOffset };
}

function pickNextDir(i, j, d, rng) {
  const options = [];
  for (let k = 0; k < 4; k++) if (k !== (d + 2) % 4 && validDir(i, j, k)) options.push(k);
  if (!options.length) return (d + 2) % 4;
  if (options.includes(d) && rng.chance(0.55)) return d;
  return rng.pick(options);
}

export function spawnTraffic(scene, rng, count = TRAFFIC.count) {
  const cars = [];
  for (let n = 0; n < count; n++) {
    let i, j, d;
    do { i = rng.int(0, NI); j = rng.int(0, NJ); d = rng.int(0, 3); } while (!validDir(i, j, d));
    const a = lanePoint(i, j, d);
    const b = lanePoint(i + DIRS[d].di, j + DIRS[d].dj, d);
    const t = rng.range(0.2, 0.8);
    const car = randomCivilianCar(scene, rng, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, DIR_HEADING[d]);
    car.driver = 'ai';
    car.ai = { i: i + DIRS[d].di, j: j + DIRS[d].dj, d, cruise: TRAFFIC.cruise * rng.range(0.8, 1.2), wait: 0 };
    cars.push(car);
  }
  return cars;
}

function obstacleAhead(car, others, extra) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const check = (ox, oz, range) => {
    const dx = ox - car.x, dz = oz - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    return along > 0 && along < range && side < 2.6;
  };
  for (const o of others) if (o !== car && check(o.x, o.z, 10)) return true;
  for (const e of extra) if (check(e.x, e.z, 8)) return true;
  return false;
}

export function updateTraffic(cars, rng, dt, obstacles) {
  for (const car of cars) {
    if (car.driver !== 'ai' || car.wrecked) {
      if (car.driver === null || car.wrecked) {
        // coast to a stop
        car.vx *= Math.exp(-2 * dt); car.vz *= Math.exp(-2 * dt); car.speed *= Math.exp(-2 * dt);
        moveCar(car, dt);
      }
      continue;
    }
    const ai = car.ai;
    const target = lanePoint(ai.i, ai.j, ai.d);
    const dist = Math.hypot(target.x - car.x, target.z - car.z);
    if (dist < 7) {
      const nd = pickNextDir(ai.i, ai.j, ai.d, rng);
      ai.i += DIRS[nd].di; ai.j += DIRS[nd].dj; ai.d = nd;
    }
    const want = Math.atan2(target.x - car.x, target.z - car.z);
    const diff = angleWrap(want - car.heading);
    const turnRate = 1.6;
    car.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const blocked = obstacleAhead(car, cars, obstacles);
    const desired = blocked ? 0 : ai.cruise * (Math.abs(diff) > 0.4 ? 0.55 : 1);
    car.speed += (desired - car.speed) * Math.min(1, dt * (blocked ? 4 : 1.2));
    car.honk = blocked ? (car.honk || 0) + dt : 0;
    car.vx = Math.sin(car.heading) * car.speed;
    car.vz = Math.cos(car.heading) * car.speed;
    car.x += car.vx * dt; car.z += car.vz * dt;
    car.wheelSpin += car.speed * dt / 0.42;
    syncCarMesh(car);
  }
}
