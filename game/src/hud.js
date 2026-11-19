// HUD: health/armor, cash, wanted stars, speedometer, objective text and arrow, toasts and the minimap.
import { CITY } from './config.js';
import { BOUNDS, LANDMARKS } from './city.js';
import { districtAt } from './config.js';

const $ = (id) => document.getElementById(id);
let mapCanvas = null;
const MAP_PAD = 60;
let toastTimer = 0, bannerTimer = 0;

export function buildMinimapBase(city) {
  const w = BOUNDS.maxX - BOUNDS.minX + MAP_PAD * 2;
  const h = BOUNDS.maxZ - BOUNDS.minZ + MAP_PAD * 2;
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = w; mapCanvas.height = h;
  const g = mapCanvas.getContext('2d');
  const X = (x) => x - BOUNDS.minX + MAP_PAD, Z = (z) => z - BOUNDS.minZ + MAP_PAD;
  g.fillStyle = '#2a8fb0'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8cf98'; g.fillRect(0, 0, w, Z(CITY.shoreZ));
  g.fillStyle = '#5b5a66'; g.fillRect(X(BOUNDS.minX), 0, BOUNDS.maxX - BOUNDS.minX, Z(CITY.beachStart));
  g.fillStyle = '#9a9488';
  for (let i = CITY.colsMin; i < CITY.colsMax; i++) for (let j = CITY.rowsMin; j < CITY.rowsMax; j++) {
    const s = CITY.cell - CITY.road;
    g.fillRect(X((i + 0.5) * CITY.cell - s / 2), Z((j + 0.5) * CITY.cell - s / 2), s, s);
  }
  g.fillStyle = '#d9d2c4';
  for (const b of city.buildings) g.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w, b.d);
  g.fillStyle = '#a47148';
  g.fillRect(X(CITY.pierX - CITY.pierWidth / 2), Z(CITY.shoreZ - 4), CITY.pierWidth, CITY.pierLength);
  g.font = 'bold 16px sans-serif'; g.fillStyle = '#ffffff';
  for (const lm of Object.values(LANDMARKS)) { g.beginPath(); g.arc(X(lm.x), Z(lm.z), 4, 0, Math.PI * 2); g.fill(); }
}

export function drawMinimap(view) {
  const c = $('minimap');
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.save();
  g.fillStyle = '#2a8fb0'; g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2);
  g.rotate(Math.PI + view.camYaw);
  const scale = view.inCar ? 0.75 : 1.1;
  g.scale(scale, scale);
  g.translate(-(view.x - BOUNDS.minX + MAP_PAD), -(view.z - BOUNDS.minZ + MAP_PAD));
  g.drawImage(mapCanvas, 0, 0);
  const X = (x) => x - BOUNDS.minX + MAP_PAD, Z = (z) => z - BOUNDS.minZ + MAP_PAD;
  if (view.search) {
    g.fillStyle = view.flash ? 'rgba(255,40,60,0.35)' : 'rgba(60,90,255,0.3)';
    g.beginPath(); g.arc(X(view.search.x), Z(view.search.z), view.search.r, 0, Math.PI * 2); g.fill();
  }
  for (const car of view.cops) {
    g.fillStyle = view.flash ? '#ff3040' : '#3060ff';
    g.beginPath(); g.arc(X(car.x), Z(car.z), 5 / scale, 0, Math.PI * 2); g.fill();
  }
  for (const e of view.enemies) { g.fillStyle = '#ff3b3b'; g.fillRect(X(e.x) - 3, Z(e.z) - 3, 6, 6); }
  g.restore();

  // objective blip, clamped to the rim
  if (view.target) {
    const dx = view.target.x - view.x, dz = view.target.z - view.z;
    const a = Math.PI + view.camYaw;
    let sx = (dx * Math.cos(a) - dz * Math.sin(a)) * scale;
    let sy = (dx * Math.sin(a) + dz * Math.cos(a)) * scale;
    const len = Math.hypot(sx, sy), rim = W / 2 - 12;
    if (len > rim) { sx *= rim / len; sy *= rim / len; }
    g.fillStyle = '#ffcf3a'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.arc(W / 2 + sx, H / 2 + sy, 7, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // player arrow (always points up = camera forward, rotated by facing offset)
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(view.camYaw - view.facing);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ff4f8b'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.fill(); g.stroke();
  g.restore();
  g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
  // north is world -z; rotate (0,-1) by the map angle to find it on the rim
  const na = Math.PI + view.camYaw;
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.beginPath(); g.arc(W / 2 + Math.sin(na) * (W / 2 - 14), H / 2 - Math.cos(na) * (H / 2 - 14), 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.fillText('N', W / 2 + Math.sin(na) * (W / 2 - 14), H / 2 - Math.cos(na) * (H / 2 - 14) + 5);
}

export function updateHud(view) {
  $('hud-health').style.width = `${Math.max(0, view.health)}%`;
  $('hud-armor').style.width = `${(view.armor / 50) * 100}%`;
  $('hud-cash').textContent = `$${view.cash.toLocaleString('en-US')}`;
  $('hud-weapon').textContent = view.weapon === 'pistol' ? `PISTOL  ${view.ammo}` : 'FISTS';
  const stars = $('hud-stars');
  let html = '';
  for (let s = 1; s <= 5; s++) html += `<span class="star${s <= view.stars ? ' on' : ''}">&#9733;</span>`;
  if (stars.innerHTML !== html) stars.innerHTML = html;
  stars.classList.toggle('flash', view.flash);
  $('hud-speedo').classList.toggle('hidden', !view.inCar);
  if (view.inCar) {
    $('hud-speed').textContent = Math.round(Math.abs(view.speed) * 3.6);
    $('hud-vehicle-name').textContent = view.vehicleName;
  }
  $('hud-mission-title').textContent = view.objective.title;
  $('hud-objective-text').textContent = view.objective.text;
  $('hud-mission-timer').textContent = view.timer > 0 ? `${Math.floor(view.timer / 60)}:${String(Math.floor(view.timer % 60)).padStart(2, '0')}` : '';
  $('hud-district').textContent = districtAt(view.x, view.z);
  $('hud-clock').textContent = view.clock;
  $('hud-crosshair').style.display = !view.inCar && view.weapon === 'pistol' ? 'block' : 'none';
  $('hud-hint').textContent = view.hint || '';
  const arrow = $('hud-arrow');
  if (view.target) {
    arrow.style.display = 'block';
    const rel = Math.atan2(view.target.x - view.x, view.target.z - view.z) - view.camYaw;
    arrow.firstElementChild.style.transform = `rotate(${-rel}rad)`;
    $('hud-arrow-dist').textContent = `${Math.round(Math.hypot(view.target.x - view.x, view.target.z - view.z))} m`;
  } else arrow.style.display = 'none';
  drawMinimap(view);
}

export function toast(text, seconds = 3) {
  const el = $('hud-toast');
  el.textContent = text; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), seconds * 1000);
}

export function banner(title, sub = '', seconds = 2.6) {
  const el = $('hud-banner');
  el.innerHTML = `${title}<div style="font-size:22px;letter-spacing:2px;color:#fff">${sub}</div>`;
  el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), seconds * 1000);
}

export function showHud(on) { $('hud').classList.toggle('hidden', !on); }
