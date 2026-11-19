// Sunset Run — main game loop: sets up the scene, wires every system together and runs each frame.
import { PLAYER, WEAPONS } from './config.js';
import { rng } from './random.js';
import { initInput, isDown, wasPressed, moveAxes, consumeMouse, endFrame, releasePointer } from './input.js';
import { buildCity, LANDMARKS } from './city.js';
import { indexColliders, segmentBlocked } from './physics.js';
import { createPlayer, updatePlayerOnFoot, syncPlayerMesh, damagePlayer, enterCar, exitCar } from './player.js';
import { driveCar, nearestCar, randomCivilianCar, damageCar, syncCarMesh } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, createPed, hurtPed, scarePeds, recyclePeds } from './peds.js';
import { createWanted, reportCrime, updateWanted, clearWanted, searchZone } from './wanted.js';
import { createArsenal, attack, tickArsenal } from './weapons.js';
import { initEffects, updateEffects, carEffects, tracer, puff } from './effects.js';
import { STORY, createMissionState, updateMissions, objectiveTarget, objectiveText, failMission } from './missions.js';
import { buildMinimapBase, updateHud, toast, banner, showHud } from './hud.js';
import { initAudio, updateAudio, sfx } from './audio.js';
import { loadGame, saveGame } from './save.js';
import { createCameraRig, updateCameraRig } from './camera.js';
import { initScreens, showScreen, setContinueVisible } from './screens.js';
import { getShot } from './shots.js';

const THREE = window.THREE;

// ---------- renderer & scene ----------
const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffc9a0, 120, 620);
scene.add(new THREE.HemisphereLight(0xffd7b0, 0x6a5a7a, 1.1));
const sun = new THREE.DirectionalLight(0xffc27a, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 400 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
const SUN_OFFSET = new THREE.Vector3(-90, 110, 160);

initEffects(scene);
const city = buildCity(scene, rng);
indexColliders(city.colliders);
buildMinimapBase(city);

// ---------- game state ----------
const saved = loadGame();
const game = {
  scene, city, rng, mode: 'start', time: 0, clockMinutes: 18 * 60 + 42,
  player: createPlayer(scene, LANDMARKS.safehouse.x - 6, LANDMARKS.safehouse.z + 4),
  traffic: spawnTraffic(scene, rng),
  parked: [],
  peds: spawnPeds(scene, rng),
  wanted: createWanted(),
  missions: createMissionState(saved),
  arsenal: createArsenal(),
  rig: createCameraRig(window.innerWidth / window.innerHeight),
  pickups: [],
  deadTimer: 0,
  frozen: false,
};
const { player, wanted } = game;
player.hasPistol = false;

// parked cars at the curb of a few streets
for (let k = 0; k < 14; k++) {
  const x = rng.pick(city.roadXs) + rng.pick([-1, 1]) * 6.6;
  const z = rng.range(-260, 200);
  const car = randomCivilianCar(scene, rng, x, z, rng.pick([0, Math.PI]));
  game.parked.push(car);
}
game.allCars = () => [...game.traffic, ...game.parked, ...wanted.copCars];
game.allPeds = () => [...game.peds, ...wanted.cops];

// ---------- world API used by missions, weapons and hooks ----------
const world = {
  get player() { return player; }, get wanted() { return wanted; }, scene,
  toast, banner, sfx,
  save: () => saveGame(game),
  nearestFreeCar: () => nearestCar(game.allCars().filter((c) => !c.model.police), player.x, player.z, 400),
  forceWanted: (n) => { reportCrime(wanted, n - wanted.stars, player.x, player.z); sfx.wanted(); },
  removePed: (p) => { scene.remove(p.mesh); const k = game.peds.indexOf(p); if (k >= 0) game.peds.splice(k, 1); },
  spawnCrew(at, count) {
    const crew = [];
    for (let n = 0; n < count; n++) {
      const ped = createPed(scene, rng, at.x + rng.range(-14, 14), at.z + rng.range(-10, 14), {
        look: { shirt: 0xd62828, pants: 0x1b1b1b, skin: rng.pick([0xc68642, 0x8d5524, 0xe0ac69]), hair: 0x111111, hat: 0x111111 },
        kind: 'gang', hostile: true, armed: n % 2 === 1, health: 60,
      });
      crew.push(ped); game.peds.push(ped);
    }
    return crew;
  },
};

function crime(stars, x = player.x, z = player.z) {
  if (reportCrime(wanted, stars, x, z)) sfx.wanted();
}

const weaponWorld = {
  get peds() { return game.allPeds(); },
  get cars() { return game.allCars().filter((c) => c !== player.inCar); },
  onHitPed(ped, died, how) {
    if (how === 'melee') sfx.punch();
    if (ped.kind === 'cop') { crime(died ? 2 : 1); return; }
    if (died && ped.kind === 'civ') { crime(1); dropCash(ped.x, ped.z, rng.int(10, 60)); }
    if (died && ped.kind === 'gang') dropCash(ped.x, ped.z, rng.int(80, 160));
    if (!died && how === 'melee' && ped.kind === 'civ' && wanted.copCars.some((c) => Math.hypot(c.x - player.x, c.z - player.z) < 50)) crime(1);
  },
  onHitCar(car) { if (car.model.police) crime(1); },
  onShotFired() { sfx.gunshot(); if (wanted.stars === 0) crime(1); },
};

const wantedHooks = {
  damagePlayer: (amt) => damagePlayer(player, amt),
  tracer: (a, b) => { tracer(a, b, 0xffffff); sfx.gunshot(); },
  ramPlayer: (car, speed) => { if (speed > 6) { damageCar(player.inCar, speed * 0.3); sfx.crash(); } },
  onBusted: () => endLife('busted'),
  onEvaded: () => { toast('You lost the cops.'); },
};

const pedHooks = {
  attackPlayer(ped, kind) {
    if (!player.alive) return;
    const px = player.inCar ? player.inCar.x : player.x, pz = player.inCar ? player.inCar.z : player.z;
    if (kind === 'punch') { if (!player.inCar) { damagePlayer(player, 7); sfx.punch(); } return; }
    if (segmentBlocked(ped.x, ped.z, px, pz)) return;
    tracer({ x: ped.x, y: ped.y + 1.45, z: ped.z }, { x: px, y: 1.2, z: pz }, 0xffe0a0);
    sfx.gunshot();
    if (rng.chance(0.4)) damagePlayer(player, player.inCar ? 3 : 6);
  },
};

function dropCash(x, z, amount) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0x3cff6a }));
  m.position.set(x, 0.6, z);
  scene.add(m);
  game.pickups.push({ mesh: m, x, z, amount });
}

// ---------- life cycle ----------
function startGame(fromSave) {
  if (!game.silent) initAudio();
  if (fromSave && saved) {
    player.cash = saved.cash; player.ammo = saved.ammo;
    player.hasPistol = saved.missionIndex >= 2;
    player.weapon = player.hasPistol ? saved.weapon : 'fists';
    player.x = saved.x; player.z = saved.z;
    game.missions.index = saved.missionIndex;
  } else {
    game.missions.index = 0;
    player.cash = 150; player.hasPistol = false; player.weapon = 'fists';
  }
  game.missions.step = -1;
  game.mode = 'play';
  showScreen('none'); showHud(true);
  banner('VISTA CORAL', 'Sunset Run');
}

function endLife(kind) {
  if (game.mode !== 'play') return;
  game.mode = kind;
  failMission(game.missions, world, kind === 'busted' ? 'You got busted' : 'You died');
  player.cash = Math.max(0, player.cash - (kind === 'busted' ? 300 : 200));
  if (kind === 'busted') player.ammo = Math.min(player.ammo, 12);
  kind === 'wasted' ? sfx.wasted() : sfx.wanted();
  releasePointer();
  setTimeout(() => showScreen(kind), 900);
}

function respawn() {
  if (player.inCar) exitCar(player);
  clearWanted(scene, wanted);
  player.alive = true; player.health = PLAYER.maxHealth;
  player.x = LANDMARKS.safehouse.x - 6; player.z = LANDMARKS.safehouse.z + 4;
  game.mode = 'play';
  showScreen('none');
  syncPlayerMesh(player);
  saveGame(game);
}

initScreens({
  hasSave: !!saved,
  onNew: () => startGame(false),
  onContinue: () => startGame(true),
  onResume: () => { game.mode = 'play'; showScreen('none'); },
  onSave: () => { saveGame(game); setContinueVisible(true); toast('Game saved'); },
  onQuit: () => { game.mode = 'start'; showHud(false); showScreen('start'); },
  onRespawn: respawn,
});

// ---------- per-frame systems ----------
function handleInput(dt, mouse, override) {
  if (wasPressed('Escape') || wasPressed('KeyP')) { game.mode = 'pause'; showScreen('pause'); releasePointer(); return; }
  if (wasPressed('Digit1')) player.weapon = 'fists';
  if (wasPressed('Digit2') && player.hasPistol) player.weapon = 'pistol';
  if (wasPressed('KeyE')) tryToggleCar();
  if ((mouse.left || isDown('KeyF')) && !player.inCar) attack(game.arsenal, player, weaponWorld);
  if (mouse.left && player.weapon === 'pistol') player.aimT = Math.max(player.aimT, 0.3);

  const mv = override?.mv || moveAxes();
  if (player.inCar) {
    const car = player.inCar;
    const impact = driveCar(car, mv.y, -mv.x, override?.handbrake ?? isDown('Space'), dt);
    if (impact > 9) { sfx.crash(); game.rig.fovKick = 6; }
    player.x = car.x; player.z = car.z;
    if (car.wrecked && car.health < -40) { exitCar(player); damagePlayer(player, 25); toast('Your ride is toast!'); }
  } else if (player.alive) {
    updatePlayerOnFoot(player, mv, override?.camYaw ?? game.rig.yaw, isDown('ShiftLeft') || isDown('ShiftRight'), wasPressed('Space'), dt);
  }
}

function tryToggleCar() {
  if (player.inCar) { exitCar(player); sfx.door(); return; }
  const car = nearestCar(game.allCars(), player.x, player.z, 4.5);
  if (!car) return;
  if (car.driver === 'ai') {
    const ped = createPed(scene, rng, car.x + Math.cos(car.heading) * 2, car.z - Math.sin(car.heading) * 2);
    ped.state = 'flee'; ped.fear = 12; ped.threat = { x: player.x, z: player.z };
    game.peds.push(ped);
    crime(1);
    toast(`Jacked a ${car.model.name}`);
  } else if (car.driver === 'police') {
    crime(2);
    const k = wanted.copCars.indexOf(car);
    if (k >= 0) { wanted.copCars.splice(k, 1); game.parked.push(car); }
  }
  car.ai = null;
  car.vx = 0; car.vz = 0; car.speed = 0;
  if (game.traffic.includes(car)) { game.traffic.splice(game.traffic.indexOf(car), 1); game.parked.push(car); }
  enterCar(player, car);
  sfx.door();
}

function collideVehicles(dt) {
  const cars = game.allCars();
  for (let a = 0; a < cars.length; a++) {
    for (let b = a + 1; b < cars.length; b++) {
      const A = cars[a], B = cars[b];
      const dx = B.x - A.x, dz = B.z - A.z;
      const d = Math.hypot(dx, dz);
      if (d > 3.6 || d < 0.01) continue;
      const push = (3.6 - d) / 2, nx = dx / d, nz = dz / d;
      A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push;
      const rel = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz;
      if (rel > 0) {
        A.vx -= nx * rel * 0.6; A.vz -= nz * rel * 0.6; B.vx += nx * rel * 0.6; B.vz += nz * rel * 0.6;
        if (rel > 8) {
          damageCar(A, rel); damageCar(B, rel);
          if (A === player.inCar || B === player.inCar) {
            sfx.crash();
            const other = A === player.inCar ? B : A;
            if (other.model.police && !wanted.crimeCooldown) { crime(1); wanted.crimeCooldown = 3; }
          }
        }
      }
      syncCarMesh(A); syncCarMesh(B);
    }
  }
  wanted.crimeCooldown = Math.max(0, (wanted.crimeCooldown || 0) - dt);
  // cars hitting people
  for (const car of cars) {
    const sp = Math.hypot(car.vx, car.vz);
    if (sp < 6) continue;
    for (const ped of game.allPeds()) {
      if (ped.state === 'dead') continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.1) {
        const died = hurtPed(ped, sp * 4, car.x, car.z);
        puff({ x: ped.x, y: 1, z: ped.z }, 0xff4040, 0.5, 0.4, 0.4);
        if (car === player.inCar) weaponWorld.onHitPed(ped, died, 'car');
      }
    }
    if (!player.inCar && player.alive && car.driver !== 'player' && Math.hypot(player.x - car.x, player.z - car.z) < 2.1) {
      damagePlayer(player, sp * 1.5);
      player.x += (player.x - car.x) * 0.5; player.z += (player.z - car.z) * 0.5;
    }
  }
}

function updatePickups(t) {
  for (let k = game.pickups.length - 1; k >= 0; k--) {
    const p = game.pickups[k];
    p.mesh.rotation.y = t * 3; p.mesh.position.y = 0.6 + Math.sin(t * 4 + k) * 0.15;
    if (Math.hypot(player.x - p.x, player.z - p.z) < 1.6) {
      player.cash += p.amount; sfx.pickup(); toast(`+$${p.amount}`, 1.2);
      scene.remove(p.mesh); game.pickups.splice(k, 1);
    }
  }
}

function hintText() {
  if (player.inCar) return '';
  const car = nearestCar(game.allCars(), player.x, player.z, 4.5);
  return car ? `Press E to ${car.driver ? 'steal' : 'enter'} the ${car.model.name}` : '';
}

function simulate(dt, mouse, override) {
  game.time += dt;
  const t = game.time;
  game.clockMinutes += dt * 0.5;
  handleInput(dt, mouse, override);
  if (game.mode !== 'play') return;
  tickArsenal(game.arsenal, dt);
  const obstacles = player.inCar ? [] : [{ x: player.x, z: player.z }];
  updateTraffic(game.traffic, rng, dt, obstacles);
  for (const c of game.parked) if (c !== player.inCar) updateTraffic([c], rng, dt, []);
  updatePeds(game.allPeds(), rng, dt, player, pedHooks);
  updateWanted(scene, wanted, rng, player, dt, t, wantedHooks);
  collideVehicles(dt);
  updateMissions(game.missions, world, dt, t);
  updatePickups(t);
  recyclePeds(scene, game.peds, rng, player);
  for (const c of game.allCars()) carEffects(c, dt);
  if (!player.alive) endLife('wasted');
  if (game.missions.index >= 2) player.hasPistol = true;
  // slow regeneration when out of danger, up to half health
  if (player.alive && wanted.stars === 0 && player.health < 50) player.health = Math.min(50, player.health + dt * 2);
  // armor vest kept at the safehouse
  if (!player.inCar && player.armor < PLAYER.maxArmor && Math.hypot(player.x - LANDMARKS.safehouse.x, player.z - LANDMARKS.safehouse.z) < 3) {
    player.armor = PLAYER.maxArmor; toast('Picked up body armor', 1.5); sfx.pickup();
  }
}

function present(dt, mouse) {
  const t = game.time;
  city.update(t);
  updateEffects(dt);
  const lookBack = isDown('KeyC');
  if (game.mode === 'start') {
    // attract-mode camera gliding over the coast
    const a = t * 0.05 + 0.6;
    game.rig.cam.position.set(Math.sin(a) * 150 + 20, 55, Math.cos(a) * 60 + 150);
    game.rig.cam.lookAt(0, 10, 0);
  } else if (!game.cameraLocked) updateCameraRig(game.rig, player, mouse, dt, lookBack);
  const focus = player.inCar || player;
  sun.position.set(focus.x + SUN_OFFSET.x, SUN_OFFSET.y, focus.z + SUN_OFFSET.z);
  sun.target.position.set(focus.x, 0, focus.z);
  if (game.mode !== 'start') {
    const target = objectiveTarget(game.missions, world);
    const zone = searchZone(wanted);
    const copDist = wanted.copCars.reduce((m, c) => Math.min(m, Math.hypot(c.x - player.x, c.z - player.z)), 999);
    const mins = Math.floor(game.clockMinutes) % (24 * 60);
    updateHud({
      health: player.health, armor: player.armor, cash: player.cash, weapon: player.weapon, ammo: player.ammo,
      stars: wanted.stars, flash: wanted.flash > 0 || (wanted.stars > 0 && Math.floor(t * 4) % 2 === 0),
      inCar: !!player.inCar, speed: player.inCar ? player.inCar.speed : 0, vehicleName: player.inCar ? player.inCar.model.name : '',
      objective: objectiveText(game.missions, world), timer: game.missions.timer,
      x: focus.x, z: focus.z, camYaw: game.rig.yaw, facing: player.inCar ? player.inCar.heading : player.yaw,
      target, search: zone, cops: wanted.copCars,
      enemies: game.missions.targets.filter((e) => e.state !== 'dead'),
      clock: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`,
      hint: hintText(),
    });
    updateAudio({ inCar: !!player.inCar, carSpeed: player.inCar?.speed, throttle: isDown('KeyW'), stars: wanted.stars, copDist, paused: game.mode !== 'play' });
  }
  renderer.render(scene, game.rig.cam);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  game.rig.cam.aspect = w / h;
  game.rig.cam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
initInput(canvas);

// ---------- screenshot staging (?shot=name) ----------
const shot = getShot(new URLSearchParams(location.search).get('shot'));
if (shot) {
  game.silent = true;
  shot.setup(game, { startGame, world, crime, enterCar, showScreen, showHud, createPed, tracer, STORY });
  for (let s = 0; s < shot.steps; s++) {
    if (game.mode === 'play') simulate(1 / 30, { dx: 0, dy: 0, left: false }, shot.input?.(game, s));
    else game.time += 1 / 30;
    shot.each?.(game, s);
  }
  shot.finish?.(game, { tracer });
  present(1 / 30, { dx: 0, dy: 0 });
  setTimeout(() => { present(0.001, { dx: 0, dy: 0 }); window.__shotReady = true; }, 300);
} else {
  showScreen('start');
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const mouse = consumeMouse();
    if (game.mode === 'play') simulate(dt, mouse);
    else if (game.mode === 'pause' && (wasPressed('Escape') || wasPressed('KeyP'))) { game.mode = 'play'; showScreen('none'); }
    else game.time += dt;
    present(dt, mouse);
    endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

window.__game = game;
void WEAPONS; void scarePeds;
