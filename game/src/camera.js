// Third-person camera: mouse-orbit on foot, smoothed chase cam behind cars, collision with buildings.
import { segmentBlocked, angleWrap } from './physics.js';

const THREE = window.THREE;

export function createCameraRig(aspect) {
  const cam = new THREE.PerspectiveCamera(62, aspect, 0.3, 1600);
  return { cam, yaw: 0, pitch: 0.28, dist: 6, fovKick: 0, idle: 0 };
}

export function updateCameraRig(rig, player, mouse, dt, lookBack) {
  const car = player.inCar;
  if (mouse.dx || mouse.dy) rig.idle = 0; else rig.idle += dt;
  rig.yaw -= mouse.dx * 0.0032;
  rig.pitch = Math.max(-0.1, Math.min(1.1, rig.pitch + mouse.dy * 0.0025));
  let tx, ty, tz, dist, height;
  if (car) {
    // drift the yaw back behind the car when the mouse is idle
    const behind = car.heading + (lookBack ? Math.PI : 0);
    if (rig.idle > 0.8 || lookBack) rig.yaw += angleWrap(behind - rig.yaw) * Math.min(1, dt * 3.5);
    tx = car.x; ty = car.y + 2.2; tz = car.z;
    const sp = Math.abs(car.speed);
    dist = 10.5 + sp * 0.09; height = 0.12;
    rig.fovKick += ((sp > 25 ? (sp - 25) * 0.5 : 0) - rig.fovKick) * Math.min(1, dt * 2);
  } else {
    tx = player.x; ty = player.y + 1.6; tz = player.z;
    dist = player.aimT > 0 ? 5 : 5.8; height = 0.05;
    rig.fovKick += (0 - rig.fovKick) * Math.min(1, dt * 3);
  }
  rig.dist += (dist - rig.dist) * Math.min(1, dt * 4);
  const p = rig.pitch + height;
  let cx = tx - Math.sin(rig.yaw) * Math.cos(p) * rig.dist;
  let cz = tz - Math.cos(rig.yaw) * Math.cos(p) * rig.dist;
  const cy = ty + Math.sin(p) * rig.dist + 0.6;
  if (segmentBlocked(tx, tz, cx, cz)) {
    // pull in so the camera does not end up inside a building
    cx = tx + (cx - tx) * 0.45; cz = tz + (cz - tz) * 0.45;
  }
  const shoulder = !car && player.aimT > 0 ? 1.15 : 0;
  rig.cam.position.set(cx - Math.cos(rig.yaw) * shoulder, cy, cz + Math.sin(rig.yaw) * shoulder);
  rig.cam.lookAt(tx - Math.cos(rig.yaw) * shoulder, ty + 0.3, tz + Math.sin(rig.yaw) * shoulder);
  rig.cam.fov = 62 + rig.fovKick;
  rig.cam.updateProjectionMatrix();
}
