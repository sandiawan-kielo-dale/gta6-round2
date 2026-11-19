// Save and load progress (mission, cash, weapon, position) in localStorage.
const KEY = 'vista-coral-sunset-run-save-v1';

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveGame(state) {
  const data = {
    missionIndex: state.missions.index,
    cash: state.player.cash,
    weapon: state.player.weapon,
    ammo: state.player.ammo,
    x: state.player.inCar ? state.player.inCar.x : state.player.x,
    z: state.player.inCar ? state.player.inCar.z : state.player.z,
    savedAt: Date.now(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
