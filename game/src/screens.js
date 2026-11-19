// Menu screens: title/start, pause, and the WASTED / BUSTED screens, wired to game callbacks.
const $ = (id) => document.getElementById(id);

export function initScreens({ onNew, onContinue, onResume, onSave, onQuit, onRespawn, hasSave }) {
  $('btn-new').onclick = onNew;
  $('btn-continue').onclick = onContinue;
  $('btn-continue').style.display = hasSave ? '' : 'none';
  $('btn-controls').onclick = () => $('controls-panel').classList.toggle('hidden');
  $('btn-resume').onclick = onResume;
  $('btn-save').onclick = onSave;
  $('btn-quit').onclick = onQuit;
  $('btn-respawn').onclick = onRespawn;
}

export function showScreen(name) {
  $('screen-start').classList.toggle('hidden', name !== 'start');
  $('screen-pause').classList.toggle('hidden', name !== 'pause');
  $('screen-dead').classList.toggle('hidden', name !== 'wasted' && name !== 'busted');
  if (name === 'wasted') { $('dead-title').textContent = 'WASTED'; $('dead-sub').textContent = 'Palmetto General patched you up. Bill: $200'; }
  if (name === 'busted') { $('dead-title').textContent = 'BUSTED'; $('dead-sub').textContent = 'Coral PD kept your pistol and $300 bail'; }
}

export function setContinueVisible(on) { $('btn-continue').style.display = on ? '' : 'none'; }
