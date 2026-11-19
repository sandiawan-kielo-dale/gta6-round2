// Story missions for "Sunset Run": a chain of six jobs with objectives, timers, markers and rewards.
import { LANDMARKS } from './city.js';

const THREE = window.THREE;

export const STORY = [
  {
    id: 'homecoming', title: 'Homecoming', giver: 'Marisol Vega', start: LANDMARKS.safehouse, reward: 200,
    intro: 'Marisol says the coast changed while you were gone. Meet her at the diner.',
    steps: [{ type: 'goto', text: "Go to Marisol's Diner", at: LANDMARKS.diner, radius: 7 }],
  },
  {
    id: 'wheels', title: 'Borrowed Wheels', giver: 'Tito Arroyo', start: LANDMARKS.diner, reward: 400, givesPistol: true,
    intro: 'Tito needs a car for parts. Any car. Nobody will miss it... probably.',
    steps: [
      { type: 'enterCar', text: 'Steal a car (press E next to one)' },
      { type: 'goto', text: 'Deliver the car to Bayside Auto Body', at: LANDMARKS.garage, radius: 8, inCar: true },
    ],
  },
  {
    id: 'pier', title: 'Pier Pressure', giver: 'Tito Arroyo', start: LANDMARKS.garage, reward: 600,
    intro: 'A package is waiting at the end of Gull Pier. Get it home before the Red Tide crew does.',
    steps: [
      { type: 'goto', text: 'Pick up the package at the end of Gull Pier', at: LANDMARKS.pier, radius: 7 },
      { type: 'goto', text: "Bring the package to Rae's Safehouse", at: LANDMARKS.safehouse, radius: 7, timer: 150 },
    ],
  },
  {
    id: 'heat', title: 'Heat Wave', giver: 'Marisol Vega', start: LANDMARKS.safehouse, reward: 800,
    intro: 'Marisol needs the cops busy downtown. Make some noise, then vanish.',
    steps: [
      { type: 'wanted', text: 'Raise your wanted level to 2 stars', stars: 2 },
      { type: 'lose', text: 'Lose the cops' },
    ],
  },
  {
    id: 'collector', title: 'Debt Collector', giver: 'Marisol Vega', start: LANDMARKS.diner, reward: 1200,
    intro: 'The Red Tide crew took the diner\'s money. They hang out at Sunrise Parking.',
    steps: [
      { type: 'goto', text: 'Go to Sunrise Parking', at: LANDMARKS.lot, radius: 14 },
      { type: 'kill', text: 'Take out the Red Tide crew', spawn: 'redtide', count: 4 },
    ],
  },
  {
    id: 'lastlight', title: 'Last Light', giver: 'Rae Solano', start: LANDMARKS.safehouse, reward: 3000,
    intro: 'Every cop on the coast is looking for the money. Get it to the boat at Coral Marina.',
    steps: [
      { type: 'enterCar', text: 'Get a car' },
      { type: 'goto', text: 'Drive the money to Coral Marina', at: LANDMARKS.marina, radius: 9, forceStars: 3, timer: 180 },
    ],
  },
];

export function createMissionState(saved) {
  return { index: saved?.missionIndex ?? 0, step: -1, timer: 0, targets: [], marker: null, finished: false };
}

export function makeMarker(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcf3a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 30;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffcf3a }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
  const chevron = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 4), new THREE.MeshBasicMaterial({ color: 0xff5f9e }));
  chevron.rotation.x = Math.PI; chevron.position.y = 6;
  g.add(beam, ring, chevron);
  g.userData = { beam, ring, chevron };
  scene.add(g);
  return g;
}

export function currentMission(ms) { return STORY[ms.index] || null; }

// Where the objective arrow should point right now (or null).
export function objectiveTarget(ms, world) {
  const m = currentMission(ms);
  if (!m) return null;
  if (ms.step < 0) return m.start;
  const s = m.steps[ms.step];
  if (s.at) return s.at;
  if (s.type === 'kill') {
    const alive = ms.targets.find((t) => t.state !== 'dead');
    return alive ? { x: alive.x, z: alive.z } : null;
  }
  if (s.type === 'enterCar') {
    const c = world.nearestFreeCar();
    return c ? { x: c.x, z: c.z } : null;
  }
  return null;
}

export function objectiveText(ms, world) {
  const m = currentMission(ms);
  if (!m) return { title: 'Free Roam', text: 'The coast is yours. Cause trouble or cruise at sunset.' };
  if (ms.step < 0) return { title: `Mission ${ms.index + 1}: ${m.title}`, text: `Go to the marker to meet ${m.giver}` };
  const s = m.steps[ms.step];
  let text = s.text;
  if (s.type === 'kill') text += ` (${ms.targets.filter((t) => t.state === 'dead').length}/${s.count})`;
  if (s.type === 'wanted') text += ` (${world.wanted.stars}/${s.stars})`;
  return { title: `Mission ${ms.index + 1}: ${m.title}`, text };
}

function beginStep(ms, world) {
  const m = currentMission(ms);
  const s = m.steps[ms.step];
  ms.timer = s.timer || 0;
  if (s.spawn === 'redtide') ms.targets = world.spawnCrew(LANDMARKS.lot, s.count);
  if (s.forceStars) world.forceWanted(s.forceStars);
  if (s.text) world.toast(s.text);
}

function completeMission(ms, world) {
  const m = currentMission(ms);
  world.player.cash += m.reward;
  if (m.givesPistol) { world.player.weapon = 'pistol'; world.player.ammo += 60; world.toast('Tito slipped you a pistol. Press 2 to draw it.'); }
  world.banner('MISSION PASSED', `+$${m.reward}`);
  world.sfx.missionPassed();
  ms.index += 1; ms.step = -1; ms.targets = [];
  if (ms.index >= STORY.length) { ms.finished = true; world.toast('Story complete — thanks for playing Sunset Run!'); }
  world.save();
}

export function failMission(ms, world, reason) {
  if (ms.step < 0) return;
  world.banner('MISSION FAILED', reason);
  for (const t of ms.targets) world.removePed(t);
  ms.step = -1; ms.targets = [];
}

// Advance objectives; called every frame while playing.
export function updateMissions(ms, world, dt, t) {
  const m = currentMission(ms);
  const p = world.player;
  const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
  const target = objectiveTarget(ms, world);
  if (!ms.marker) ms.marker = makeMarker(world.scene);
  const showMarker = target && (ms.step < 0 || m.steps[ms.step].at);
  ms.marker.visible = !!showMarker;
  if (showMarker) {
    ms.marker.position.set(target.x, 0, target.z);
    ms.marker.userData.chevron.position.y = 6 + Math.sin(t * 3) * 0.8;
    ms.marker.userData.chevron.rotation.y = t * 2;
  }
  if (!m) return;
  if (ms.step < 0) {
    if (Math.hypot(px - m.start.x, pz - m.start.z) < 6) {
      ms.step = 0;
      world.banner(m.title.toUpperCase(), m.giver);
      beginStep(ms, world);
      world.toast(m.intro, 5);
    }
    return;
  }
  const s = m.steps[ms.step];
  if (ms.timer > 0) {
    ms.timer -= dt;
    if (ms.timer <= 0) { failMission(ms, world, 'Out of time'); return; }
  }
  let done = false;
  if (s.type === 'goto') done = Math.hypot(px - s.at.x, pz - s.at.z) < s.radius && (!s.inCar || p.inCar);
  if (s.type === 'enterCar') done = !!p.inCar;
  if (s.type === 'wanted') done = world.wanted.stars >= s.stars;
  if (s.type === 'lose') done = world.wanted.stars === 0;
  if (s.type === 'kill') done = ms.targets.length > 0 && ms.targets.every((e) => e.state === 'dead');
  if (!done) return;
  ms.step += 1;
  if (ms.step >= m.steps.length) completeMission(ms, world);
  else { world.sfx.pickup(); beginStep(ms, world); }
}
