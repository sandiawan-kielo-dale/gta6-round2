// Screenshot staging: ?shot=chase|drive|combat|start sets up a scene deterministically for the cover shots.
import { createCar, POLICE_MODEL, MODELS, syncCarMesh } from './vehicles.js';
import { reportCrime } from './wanted.js';

function placePlayerCar(game, ctx, model, color, x, z, heading, speed) {
  const car = createCar(game.scene, model, color, x, z, heading);
  car.vx = Math.sin(heading) * speed; car.vz = Math.cos(heading) * speed; car.speed = speed;
  game.parked.push(car);
  ctx.enterCar(game.player, car);
  game.rig.yaw = heading; game.rig.idle = 5;
  return car;
}

function addCop(game, x, z, heading, speed) {
  const cop = createCar(game.scene, POLICE_MODEL, 0xf5f5f5, x, z, heading);
  cop.driver = 'police';
  cop.vx = Math.sin(heading) * speed; cop.vz = Math.cos(heading) * speed; cop.speed = speed;
  cop.cop = { node: { i: 4, j: 3 }, shootT: 99, dismounted: false };
  game.wanted.copCars.push(cop);
  return cop;
}

const SHOTS = {
  chase: {
    steps: 40,
    setup(game, ctx) {
      ctx.startGame(false);
      game.missions.index = 5; game.missions.step = 1; game.missions.timer = 124;
      game.player.cash = 4870; game.player.hasPistol = true; game.player.weapon = 'pistol';
      game.player.health = 72;
      placePlayerCar(game, ctx, MODELS[2], 0xff2d55, 3.6, -20, Math.PI, 26);
      reportCrime(game.wanted, 3, 3.6, -20);
      addCop(game, 3.0, -12, Math.PI, 26);
      addCop(game, -3.4, -9, Math.PI, 26);
      addCop(game, 4.2, -3, Math.PI, 26);
    },
    input: () => ({ mv: { x: 0, y: 1 }, handbrake: false }),
    finish(game, fx) {
      const car = game.player.inCar;
      game.cameraLocked = true;
      const cam = game.rig.cam;
      // low camera ahead of the getaway car, looking back down the boulevard at the pursuit
      cam.position.set(car.x + 6, 3.4, car.z - 13);
      cam.lookAt(car.x - 1, 1.2, car.z + 10);
      const c0 = game.wanted.copCars[0];
      fx.tracer({ x: c0.x, y: 1.7, z: c0.z }, { x: car.x, y: 1.2, z: car.z }, 0xffffff);
    },
  },
  drive: {
    steps: 45,
    setup(game, ctx) {
      ctx.startGame(false);
      game.missions.index = 1; game.missions.step = 1;
      game.player.cash = 620;
      placePlayerCar(game, ctx, MODELS[0], 0x2ec4b6, -150, 216 + 3.6, Math.PI / 2, 20);
      game.rig.pitch = 0.24;
      // a little traffic sharing the beach road
      const t1 = game.traffic[0], t2 = game.traffic[1], t3 = game.traffic[2];
      Object.assign(t1, { x: -95, z: 216 - 3.6, heading: -Math.PI / 2 });
      t1.ai = { i: 0, j: 7, d: 3, cruise: 12, wait: 0 };
      Object.assign(t2, { x: -70, z: 216 + 3.6, heading: Math.PI / 2 });
      t2.ai = { i: 8, j: 7, d: 1, cruise: 14, wait: 0 };
      Object.assign(t3, { x: -50, z: 216 - 3.6, heading: -Math.PI / 2 });
      t3.ai = { i: 0, j: 7, d: 3, cruise: 12, wait: 0 };
      [t1, t2, t3].forEach(syncCarMesh);
    },
    input: () => ({ mv: { x: 0, y: 1 }, handbrake: false }),
  },
  combat: {
    steps: 12,
    setup(game, ctx) {
      ctx.startGame(false);
      const p = game.player;
      p.hasPistol = true; p.weapon = 'pistol'; p.ammo = 41; p.cash = 2310; p.health = 64; p.armor = 30;
      game.missions.index = 4; game.missions.step = 1;
      p.x = -108; p.z = -158;
      game.missions.targets = ctx.world.spawnCrew({ x: -108, z: -186 }, 4);
      game.missions.targets[0].state = 'dead';
      game.missions.targets[0].x = -104; game.missions.targets[0].z = -170;
      reportCrime(game.wanted, 1, p.x, p.z);
      game.rig.yaw = Math.PI; game.rig.pitch = 0.32; game.rig.idle = 0;
      // a crew car parked in the lot for cover
      const crewCar = createCar(game.scene, MODELS[3], 0x8b1e2d, -96, -178, 0.4);
      game.parked.push(crewCar);
    },
    input: () => ({ mv: { x: 0, y: 0 }, camYaw: Math.PI }),
    each(game) { game.player.aimT = 1; },
    finish(game, fx) {
      const p = game.player;
      const foe = game.missions.targets.find((t) => t.state !== 'dead');
      if (foe) {
        p.yaw = Math.atan2(foe.x - p.x, foe.z - p.z);
        game.rig.yaw = p.yaw;
        fx.tracer({ x: p.x + Math.sin(p.yaw) * 0.7, y: 1.45, z: p.z + Math.cos(p.yaw) * 0.7 }, { x: foe.x, y: 1.3, z: foe.z });
      }
    },
  },
  start: {
    steps: 0,
    setup(game, ctx) { game.time = 6; ctx.showScreen('start'); },
  },
};

export function getShot(name) { return name ? SHOTS[name] || null : null; }
