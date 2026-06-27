// ---------------------------- MAIN -----------------------------------
// Entry point: imports the CSS, builds the world (side effects), runs the
// game loop, and wires the boot / start / restart buttons.
import './styles.css';

import { renderer, scene, camera, composer } from './core.js';
import './world.js';            // side-effect: lights, sky, terrain, clouds
import { SFX } from './audio.js';
import { parts, debris } from './vfx.js';
import { bullets } from './bullets.js';
import { HUD } from './hud.js';
import { input } from './input.js';
import { cam } from './camera.js';
import { game } from './game.js';

// ---------------------------- MAIN LOOP -------------------------------
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  let dt=(now-last)/1000; last=now; if(dt>0.05) dt=0.05;
  if(game.running && !game.paused && !game.over){
    game.player.update(dt,input);
    for(const e of game.enemies) e.update(dt,game.player);
    bullets.update(dt,game.player,game.enemies);
    parts.update(dt); debris.update(dt);
    game.lock=game.pickLock();
    cam.update(dt,game.player);
    SFX.engine(game.player.throttle, game.player.vel.length());
    HUD.update(game.player,game.enemies,game.score,game.lock);
  } else {
    parts.update(dt); debris.update(dt);
    if(game.player) cam.update(dt,game.player);
  }
  // prop & clouds idle motion handled in updates
  if(composer) composer.render(); else renderer.render(scene,camera);
}

// boot
document.getElementById('boot-note').style.display='none';
document.getElementById('start').classList.remove('hidden');
HUD.init();
addEventListener('resize',()=>HUD.onResize());
requestAnimationFrame(frame);

document.getElementById('start-btn').addEventListener('click',()=>{ SFX.init(); SFX.resume(); game.start(); });
document.getElementById('restart-btn').addEventListener('click',()=>{ SFX.resume(); game.restart(); });

// expose for debugging / QA
import * as THREE from 'three';
window.__game=game; window.__THREE=THREE;
