// ---------------------------- GAME -----------------------------------
// Match state, win/lose flow, overlays, target lock, HUD effect hooks.
import { CFG, TMP } from './config.js';
import { SFX } from './audio.js';
import { smokePuff } from './vfx.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { cam } from './camera.js';
import { HUD } from './hud.js';

export const game={
  running:false, paused:false, over:false, score:0, kills:0, t0:0,
  player:null, enemies:[], lock:null,
  elStart:document.getElementById('start'), elEnd:document.getElementById('end'),
  elHud:document.getElementById('hud'), elVig:document.getElementById('vignette'), elHit:document.getElementById('hitmark'),
  start(){
    this.player=new Player();
    this.enemies=[]; for(let i=0;i<CFG.enemies;i++) this.enemies.push(new Enemy(i));
    this.score=0; this.kills=0; this.over=false; this.paused=false; this.running=true; this.t0=performance.now();
    this.elStart.classList.add('hidden'); this.elEnd.classList.add('hidden'); this.elHud.classList.remove('hidden');
    HUD.message('ENGAGE','#ffd45e');
  },
  restart(){ // clean previous
    this.player.group.removeFromParent();
    this.enemies.forEach(e=>e.group.removeFromParent());
    this.start();
  },
  onEnemyDead(e){ this.kills++; this.score+=1000;
    HUD.kill('▼ BANDIT DOWN  +1000'); HUD.message('ENEMY DOWN','#ff7a3c');
    smokePuff(e.group.position,null,true);
    if(this.enemies.every(x=>!x.alive)){ this.win(); } },
  onPlayerDead(crash){ this.lose(crash?'WENT DOWN':'SHOT DOWN'); },
  win(){ if(this.over) return; this.over=true; this.running=false;
    this.end('VICTORY','SKIES SECURED',true); },
  lose(reason){ if(this.over) return; this.over=true; this.running=false;
    this.end('K.I.A.', reason, false); },
  end(title,sub,won){
    const t=((performance.now()-this.t0)/1000).toFixed(0);
    document.getElementById('end-title').textContent=title;
    document.getElementById('end-title').style.color=won?'#7dffd0':'#ff5a4d';
    document.getElementById('end-sub').textContent=sub;
    document.getElementById('end-stats').innerHTML=
      `BANDITS DOWNED &nbsp; <b style="color:#ffd45e">${this.kills} / ${CFG.enemies}</b><br>`+
      `SCORE &nbsp; <b style="color:#ffd45e">${this.score}</b><br>`+
      `FLIGHT TIME &nbsp; <b style="color:#ffd45e">${t}s</b>`;
    setTimeout(()=>this.elEnd.classList.remove('hidden'),900);
  },
  togglePause(){ if(!this.running) return; this.paused=!this.paused; HUD.message(this.paused?'PAUSED':'','#7dffea'); },
  toggleCam(){ cam.mode=cam.mode?0:1; },
  hitMarker(){ this.elHit.style.opacity='1'; SFX.hit(); clearTimeout(this._ht); this._ht=setTimeout(()=>this.elHit.style.opacity='0',90); },
  vignette(a){ this.elVig.style.boxShadow=`inset 0 0 220px 30px rgba(255,40,30,${a})`;
    clearTimeout(this._vt); this._vt=setTimeout(()=>this.elVig.style.boxShadow='inset 0 0 220px 30px rgba(255,40,30,0)',120); },
  dmgDir(vel){ /* could add directional indicator; vignette suffices */ },
  pickLock(){ // nearest enemy in front cone
    if(!this.player) return null; let best=null,bd=2;
    const fwd=this.player.forward(TMP.v5); // v5: not clobbered by the v1 scratch below
    for(const e of this.enemies){ if(!e.alive) continue;
      const to=TMP.v1.copy(e.group.position).sub(this.player.group.position); const dist=to.length(); to.normalize();
      const d=fwd.dot(to); if(d>0.9){ const score=(1-d)+dist/8000; if(score<bd){ bd=score; best=e; } } }
    return best;
  }
};
