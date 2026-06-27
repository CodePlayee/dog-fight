// ---------------------------- HUD ------------------------------------
// SVG gunsight, target brackets, lead pip, gauges, killfeed, messages.
import { CFG, TMP, clamp } from './config.js';
import { camera } from './core.js';

export const HUD={
  el:{ hp:document.getElementById('hp-bar'), spd:document.getElementById('spd'), alt:document.getElementById('alt'),
    thr:document.getElementById('throttle-bar'), ammoMg:document.getElementById('ammo-mg'), ammoCannon:document.getElementById('ammo-cannon'),
    wpnMg:document.getElementById('wpn-mg'), wpnCannon:document.getElementById('wpn-cannon'),
    enemies:document.getElementById('enemies-left'), score:document.getElementById('score-top'),
    svg:document.getElementById('hud-svg'), msg:document.getElementById('msg'), killfeed:document.getElementById('killfeed') },
  init(){ this.svgns='http://www.w3.org/2000/svg'; this.brackets=[]; this.maxBrackets=CFG.enemies;
    for(let i=0;i<this.maxBrackets;i++){ const g=document.createElementNS(this.svgns,'g'); g.style.display='none';
      const r=document.createElementNS(this.svgns,'path'); r.setAttribute('fill','none'); r.setAttribute('stroke','#7dffea'); r.setAttribute('stroke-width','2');
      const a=document.createElementNS(this.svgns,'path'); a.setAttribute('fill','#ff7a3c'); // offscreen arrow
      const tx=document.createElementNS(this.svgns,'text'); tx.setAttribute('fill','#7dffea'); tx.setAttribute('font-size','11'); tx.setAttribute('font-family','monospace');
      g.appendChild(r); g.appendChild(a); g.appendChild(tx); this.el.svg.appendChild(g);
      this.brackets.push({g,r,a,tx}); }
    // lead pip
    this.lead=document.createElementNS(this.svgns,'path'); this.lead.setAttribute('fill','none'); this.lead.setAttribute('stroke','#ffd45e'); this.lead.setAttribute('stroke-width','2'); this.lead.style.display='none';
    this.el.svg.appendChild(this.lead);
    // gunsight
    this.sight=document.createElementNS(this.svgns,'g'); this.el.svg.appendChild(this.sight);
    this.drawSight();
  },
  drawSight(){ const cx=()=>innerWidth/2, cy=()=>innerHeight/2; // redrawn in update for resize
    this.sight.innerHTML='';
    const mk=(tag,attrs)=>{ const e=document.createElementNS(this.svgns,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); this.sight.appendChild(e); return e; };
    const x=innerWidth/2,y=innerHeight/2;
    mk('circle',{cx:x,cy:y,r:54,fill:'none',stroke:'#7dffea',['stroke-width']:1.5,opacity:.55});
    mk('circle',{cx:x,cy:y,r:3,fill:'#ffd45e'});
    mk('line',{x1:x-78,y1:y,x2:x-58,y2:y,stroke:'#7dffea',['stroke-width']:2,opacity:.7});
    mk('line',{x1:x+58,y1:y,x2:x+78,y2:y,stroke:'#7dffea',['stroke-width']:2,opacity:.7});
    mk('line',{x1:x,y1:y-78,x2:x,y2:y-58,stroke:'#7dffea',['stroke-width']:2,opacity:.7});
    mk('path',{d:`M ${x-54} ${y+18} A 54 54 0 0 0 ${x+54} ${y+18}`,fill:'none',stroke:'#7dffea',['stroke-width']:1,opacity:.4});
  },
  project(p){ TMP.v1.copy(p).project(camera); return { x:(TMP.v1.x*0.5+0.5)*innerWidth, y:(-TMP.v1.y*0.5+0.5)*innerHeight, z:TMP.v1.z, front:TMP.v1.z<1 }; },
  update(player,enemies,score,lockTarget){
    this.el.hp.style.width=(player.hp/player.maxhp*100)+'%';
    const spd=player.vel.length();
    this.el.spd.textContent=(spd*3.6).toFixed(0);
    this.el.alt.textContent=Math.max(0,player.group.position.y).toFixed(0);
    this.el.thr.style.width=(player.throttle*100)+'%';
    this.el.ammoMg.textContent=player.mgAmmo;
    this.el.ammoCannon.textContent=player.cannonAmmo;
    this.el.ammoMg.parentElement.classList.toggle('ammo-low',player.mgAmmo<200);
    this.el.ammoCannon.parentElement.classList.toggle('ammo-low',player.cannonAmmo<20);
    const left=enemies.filter(e=>e.alive).length;
    this.el.enemies.innerHTML='BANDITS <b>'+left+'</b>';
    this.el.score.textContent='SCORE '+score;
    // brackets
    let bi=0;
    for(const e of enemies){ const b=this.brackets[bi++]; if(!b) break;
      if(!e.alive){ b.g.style.display='none'; continue; }
      const s=this.project(e.group.position);
      const dist=player.group.position.distanceTo(e.group.position);
      if(s.front && s.x>-40 && s.x<innerWidth+40 && s.y>-40 && s.y<innerHeight+40){
        b.g.style.display=''; const sz=clamp(2600/dist,12,60);
        b.r.setAttribute('d',`M ${s.x-sz} ${s.y-sz} h ${sz*0.5} M ${s.x+sz} ${s.y-sz} h ${-sz*0.5}
          M ${s.x-sz} ${s.y+sz} h ${sz*0.5} M ${s.x+sz} ${s.y+sz} h ${-sz*0.5}
          M ${s.x-sz} ${s.y-sz} v ${sz*0.5} M ${s.x+sz} ${s.y-sz} v ${sz*0.5}
          M ${s.x-sz} ${s.y+sz} v ${-sz*0.5} M ${s.x+sz} ${s.y+sz} v ${-sz*0.5}`);
        const locked=(e===lockTarget);
        b.r.setAttribute('stroke',locked?'#ff7a3c':'#7dffea');
        b.a.setAttribute('d','');
        b.tx.setAttribute('x',s.x+sz+4); b.tx.setAttribute('y',s.y-sz); b.tx.setAttribute('fill',locked?'#ff7a3c':'#7dffea');
        b.tx.textContent=(dist).toFixed(0)+'m';
      } else {
        // offscreen arrow toward target
        b.g.style.display=''; b.r.setAttribute('d',''); b.tx.textContent='';
        let ax=clamp(s.x,30,innerWidth-30), ay=clamp(s.y,30,innerHeight-30);
        if(!s.front){ ax=innerWidth-ax; ay=innerHeight-ay; ax=clamp(ax,30,innerWidth-30); ay=clamp(ay,30,innerHeight-30); }
        const ang=Math.atan2(ay-innerHeight/2,ax-innerWidth/2);
        const c=Math.cos(ang),si=Math.sin(ang);
        b.a.setAttribute('d',`M ${ax+c*12} ${ay+si*12} L ${ax-si*7-c*0} ${ay+c*7} L ${ax+si*7} ${ay-c*7} Z`);
      }
    }
    for(;bi<this.brackets.length;bi++) this.brackets[bi].g.style.display='none';
    // lead pip
    if(lockTarget && lockTarget.alive){
      const t=player.group.position.distanceTo(lockTarget.group.position)/CFG.mg.spd;
      TMP.v2.copy(lockTarget.group.position).addScaledVector(lockTarget.vel,t);
      const s=this.project(TMP.v2);
      if(s.front){ this.lead.style.display=''; const r=7;
        this.lead.setAttribute('d',`M ${s.x} ${s.y-r} L ${s.x+r} ${s.y} L ${s.x} ${s.y+r} L ${s.x-r} ${s.y} Z`);
      } else this.lead.style.display='none';
    } else this.lead.style.display='none';
  },
  onResize(){ this.drawSight(); },
  message(t,col){ this.el.msg.textContent=t; this.el.msg.style.color=col||'#ffd45e'; this.el.msg.style.opacity='1';
    clearTimeout(this._mt); this._mt=setTimeout(()=>this.el.msg.style.opacity='0',1400); },
  kill(t){ const d=document.createElement('div'); d.className='kf'; d.textContent=t; this.el.killfeed.appendChild(d);
    setTimeout(()=>d.remove(),2600); },
};
