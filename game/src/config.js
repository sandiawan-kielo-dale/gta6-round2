// Tunable constants for Vista Coral: city layout, physics, wanted system and palette.
export const CITY = {
  cell: 72,            // distance between road centre lines
  road: 16,            // road width (asphalt)
  sidewalk: 3,         // sidewalk ring inside each lot
  colsMin: -4, colsMax: 4,   // road lines along x (east-west index)
  rowsMin: -4, rowsMax: 3,   // road lines along z (north-south index)
  beachStart: 3 * 72 + 8,    // z where the sand begins (south of last road)
  shoreZ: 3 * 72 + 62,       // z where the ocean starts
  pierX: 36, pierLength: 120, pierWidth: 10,
};

export const PLAYER = {
  walkSpeed: 4.2, sprintSpeed: 8.5, jumpSpeed: 6.5, gravity: 18,
  radius: 0.45, maxHealth: 100, maxArmor: 50,
};

export const CAR = {
  maxSpeed: 42, reverseSpeed: 10, accel: 17, brake: 34, drag: 0.35,
  steer: 2.3, grip: 7.5, driftGrip: 1.4, radius: 1.9,
};

export const TRAFFIC = { count: 22, cruise: 13, laneOffset: 3.6 };
export const PEDS = { count: 34, speed: 1.6 };

export const WANTED = {
  maxStars: 5,
  evadeTime: [0, 10, 14, 18, 24, 30],    // seconds out of sight to lose a star
  copsPerStar: [0, 1, 2, 3, 4, 6],
  sightRange: 90,
  bustTime: 2.2,
};

export const WEAPONS = {
  fists: { name: 'FISTS', damage: 18, range: 1.9, cooldown: 0.45 },
  pistol: { name: 'PISTOL', damage: 34, range: 70, cooldown: 0.28, clip: 12 },
};

export const PALETTE = {
  walls: [0xf4d6b8, 0xffb4a2, 0xa8e6cf, 0xffe28a, 0xf6f1e9, 0xc7b8ea, 0x9ad0ec, 0xffc988],
  towers: [0xd9e4ec, 0xbcd0de, 0xf0e2d0, 0x9fb7c9],
  cars: [0xe63946, 0x2a9df4, 0xffd166, 0x06d6a0, 0xf8f8f8, 0x222222, 0xff7bac, 0x8338ec, 0xff8c42],
  asphalt: 0x3b3a44, sidewalk: 0xcfc6b8, sand: 0xf2d6a2, sea: 0x1aa6c4, grass: 0x6dbb5c,
};

export const DISTRICTS = [
  { name: 'Coral Downtown', test: (x, z) => Math.abs(x) < 150 && z < 80 && z > -160 },
  { name: 'Palmetto Beach', test: (x, z) => z >= 150 },
  { name: 'Harbor Row', test: (x, z) => x >= 150 },
  { name: 'Las Brisas', test: (x, z) => x <= -150 },
  { name: 'North Hills', test: (x, z) => z <= -160 },
  { name: 'Mid Coral', test: () => true },
];

export function districtAt(x, z) {
  return DISTRICTS.find((d) => d.test(x, z)).name;
}
