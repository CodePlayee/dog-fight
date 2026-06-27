// ---------------------------- ENEMY ----------------------------------
// Enemy fighters: engage/evade state machine, lead-pursuit, firing.
import * as THREE from 'three';
import { CFG, TMP, UP, clamp, rand, damp } from './config.js';
import { scene } from './core.js';
import { terrainH } from './world.js';
import { buildWarbird } from './models.js';
import { muzzleFlash, smokePuff, explosion } from './vfx.js';
import { bullets } from './bullets.js';
import { game } from './game.js';

const ENEMY_SKINS=[
  {body:0x6a6f74,accent:0xb03028,nose:0x222222,roundel:0x9a1414,star:0xf0f0f0},
  {body:0x5d5a50,accent:0xc9a23a,nose:0x303030,roundel:0x8a1010,star:0xeae0c0},
  {body:0x4f5b63,accent:0xa83a26,nose:0x1c1c1c,roundel:0x7a1010,star:0xffffff},
];

export class Enemy{
  constructor(i){
    const m=buildWarbird(ENEMY_SKINS[i%ENEMY_SKINS.length]);
    this.group=m.group; this.prop=m.prop; this.muzzles=m.muzzles; scene.add(this.group);
    this.vel=new THREE.Vector3(); this.alive=true; this.hp=CFG.enHP; this.fireCd=rand(0,1);
    this.state='engage'; this.stateT=0; this.evadeDir=1; this.smokeT=0; this.id=i;
    const a=(i/CFG.enemies)*Math.PI*2;
    this.group.position.set(Math.cos(a)*900, rand(380,560), -400+Math.sin(a)*900);
    this.vel.set(0,0,0); this.smokeT=0;
  }
  forward(){ return TMP.v1.set(0,0,-1).applyQuaternion(this.group.quaternion); }
  update(dt,player){
    if(!this.alive) return;
    this.prop.rotation.z+=42*dt;
    const toP=TMP.v2.copy(player.group.position).sub(this.group.position);
    const dist=toP.length();
    const fwd=this.forward();
    this.stateT-=dt;

    // --- decide desired direction ---
    let desired=TMP.v3;
    const playerOnTail = fwd.dot(TMP.v4.copy(this.group.position).sub(player.group.position).normalize())<-0.2
                         && player.alive
                         && player.forward().dot(toP.clone().normalize())>0.7 && dist<600;
    if(this.stateT<=0){
      if(playerOnTail && Math.random()<0.8){ this.state='evade'; this.stateT=rand(1.2,2.2); this.evadeDir=Math.random()<0.5?1:-1; }
      else { this.state='engage'; this.stateT=rand(1.5,3.0); }
    }

    if(this.state==='evade'){
      // hard break: turn away + roll
      desired.copy(fwd).addScaledVector(TMP.v4.set(this.evadeDir,0.2,0).applyQuaternion(this.group.quaternion),1.4).normalize();
    } else {
      // lead pursuit toward intercept
      const t=clamp(dist/CFG.enMg.spd,0,1.5);
      desired.copy(player.group.position).addScaledVector(player.vel,t).sub(this.group.position).normalize();
      // separation from other enemies + avoid head-on with player
      for(const o of game.enemies){ if(o===this||!o.alive) continue;
        const dd=TMP.v4.copy(this.group.position).sub(o.group.position); const l=dd.length();
        if(l<120) desired.addScaledVector(dd.normalize(), (120-l)/120*0.8); }
      desired.normalize();
    }
    // avoid ground
    const gh=terrainH(this.group.position.x,this.group.position.z);
    if(this.group.position.y-gh<160){ desired.y+=0.7; desired.normalize(); }
    if(this.group.position.y>CFG.ceiling){ desired.y-=0.5; desired.normalize(); }

    // --- steer: rotate toward desired with limited rate ---
    TMP.q1.copy(this.group.quaternion);
    const look=new THREE.Matrix4().lookAt(new THREE.Vector3(0,0,0), desired.clone().multiplyScalar(-1), UP);
    TMP.q2.setFromRotationMatrix(look);
    this.group.quaternion.rotateTowards(TMP.q2, CFG.enTurn*dt);

    // --- move ---
    const targetSpd=CFG.enSpd*(this.state==='evade'?1.12:1.0);
    this.vel.lerp(this.forward().multiplyScalar(targetSpd), damp(2.2,dt));
    this.group.position.addScaledVector(this.vel,dt);

    // --- fire ---
    this.fireCd-=dt;
    if(this.state==='engage' && player.alive && dist<CFG.enFireRange){
      const aim=TMP.v4.copy(player.group.position).addScaledVector(player.vel, dist/CFG.enMg.spd).sub(this.group.position).normalize();
      if(this.forward().dot(aim)>CFG.enFireCone && this.fireCd<=0){
        this.fireCd=1/CFG.enMg.rof;
        const mz=this.muzzles[(Math.random()*2)|0];
        this.group.updateMatrixWorld();
        const pos=new THREE.Vector3().copy(mz).applyMatrix4(this.group.matrixWorld);
        const dir=aim.clone(); dir.x+=rand(-CFG.enMg.spread,CFG.enMg.spread); dir.y+=rand(-CFG.enMg.spread,CFG.enMg.spread); dir.normalize();
        bullets.fire(pos,dir.multiplyScalar(CFG.enMg.spd).add(this.vel),
          {life:CFG.enMg.life,dmg:CFG.enMg.dmg,from:1,color:CFG.enMg.color,size:CFG.enMg.size});
        muzzleFlash(pos,0xff7040,4);
      }
    }
    // damaged smoke
    if(this.hp<CFG.enHP*0.45){ this.smokeT-=dt; if(this.smokeT<=0){ this.smokeT=0.06;
      smokePuff(this.group.position.clone().addScaledVector(this.forward(),3), this.vel.clone().multiplyScalar(0.4)); } }
  }
  damage(d,vel,knock){ if(!this.alive) return; this.hp-=d;
    // flinch flash
    this.group.traverse(o=>{ if(o.isMesh&&o.material&&o.material.emissive){ o.material.emissive.setRGB(0.6,0.2,0.05);
      setTimeout(()=>o.material.emissive&&o.material.emissive.setRGB(0,0,0),60);} });
    if(knock) this.vel.addScaledVector(vel.clone().normalize(),knock*6);
    game.hitMarker();
    if(this.hp<=0) this.die();
  }
  die(){ if(!this.alive) return; this.alive=false; explosion(this.group.position);
    // falling smoke trail handled by removal; spawn lingering smoke
    this.group.visible=false; game.onEnemyDead(this); }
}
