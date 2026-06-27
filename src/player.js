// ---------------------------- PLAYER ---------------------------------
// Player aircraft: arcade flight model, weapons, damage/death.
import * as THREE from 'three';
import { CFG, TMP, clamp, lerp, rand, damp } from './config.js';
import { scene } from './core.js';
import { terrainH } from './world.js';
import { buildWarbird } from './models.js';
import { SFX } from './audio.js';
import { muzzleFlash, explosion } from './vfx.js';
import { bullets } from './bullets.js';
import { game } from './game.js';

export class Player{
  constructor(){
    const m=buildWarbird({body:0x6c7a55,accent:0xb6402f,nose:0xe2c84a,roundel:0x223a86,star:0xffffff});
    this.group=m.group; this.prop=m.prop; this.muzzles=m.muzzles; this.cannonMuzzles=m.cannonMuzzles;
    scene.add(this.group);
    this.vel=new THREE.Vector3(0,0,-150); this.angVel=new THREE.Vector3();
    this.throttle=0.62; this.alive=true; this.hp=100; this.maxhp=100;
    this.mgAmmo=CFG.mg.ammo; this.cannonAmmo=CFG.cannon.ammo;
    this.mgCd=0; this.cannonCd=0; this.muzIdx=0; this.shake=0; this.fovKick=0;
    this.reset();
  }
  reset(){
    this.group.position.set(0,420,600); this.group.quaternion.identity();
    this.group.rotateY(Math.PI); // face -Z world (toward bandits)
    this.vel.set(0,0,0).addScaledVector(this.forward(),150);
    this.throttle=0.62; this.hp=100; this.alive=true;
    this.mgAmmo=CFG.mg.ammo; this.cannonAmmo=CFG.cannon.ammo;
  }
  forward(){ return TMP.v1.set(0,0,-1).applyQuaternion(this.group.quaternion); }
  update(dt,input){
    if(!this.alive) return;
    // throttle
    if(input.has('shift')) this.throttle=clamp(this.throttle+0.5*dt,0,1);
    if(input.has('control')) this.throttle=clamp(this.throttle-0.5*dt,0,1);
    // control inputs -> target angular velocity (in local axes)
    const spd=this.vel.length();
    const auth=clamp(spd/CFG.refSpd,0.18,1.25);
    let tp=0,ty=0,tr=0;
    if(input.has('s')) tp+=1; if(input.has('w')) tp-=1;      // pull=up
    if(input.has('a')) tr+=1; if(input.has('d')) tr-=1;      // roll
    if(input.has('e')) ty-=1; if(input.has('q')) ty+=1;      // yaw
    const tpa=tp*CFG.pitchRate*auth, tya=ty*CFG.yawRate*auth, tra=tr*CFG.rollRate*auth;
    this.angVel.x=lerp(this.angVel.x,tpa, damp(6,dt));
    this.angVel.y=lerp(this.angVel.y,tya, damp(5,dt));
    this.angVel.z=lerp(this.angVel.z,tra, damp(7,dt));
    // damping when idle
    if(!tp) this.angVel.x*=1-damp(CFG.angDamp,dt);
    if(!ty) this.angVel.y*=1-damp(CFG.angDamp,dt);
    if(!tr) this.angVel.z*=1-damp(CFG.angDamp*1.4,dt);
    // apply rotation about local axes
    this.group.rotateX(this.angVel.x*dt);
    this.group.rotateY(this.angVel.y*dt);
    this.group.rotateZ(this.angVel.z*dt);

    this.physics(dt,spd);
    // weapons
    this.mgCd-=dt; this.cannonCd-=dt;
    if(input.fireMG && this.mgCd<=0 && this.mgAmmo>0){ this.shootMG(); }
    if(input.fireCannon && this.cannonCd<=0 && this.cannonAmmo>0){ this.shootCannon(); }
    // prop spin
    this.prop.rotation.z+=(18+this.throttle*40)*dt;
    // camera fx decay
    this.shake*=1-damp(6,dt); this.fovKick*=1-damp(4,dt);
    // ground crash
    if(this.group.position.y<=terrainH(this.group.position.x,this.group.position.z)+3){ this.die(true); }
    if(this.group.position.y>CFG.ceiling+200) this.group.position.y=CFG.ceiling+200;
  }
  physics(dt,spd){
    const fwd=this.forward();
    const up=TMP.v2.set(0,1,0).applyQuaternion(this.group.quaternion);
    const a=TMP.v3.set(0,0,0);
    // thrust
    a.addScaledVector(fwd, CFG.thrustMax*this.throttle);
    // gravity
    a.y-=CFG.grav;
    // lift (along up, scales with speed^2, dies in stall)
    let liftMag=clamp(CFG.liftK*spd*spd,0,CFG.liftMax);
    if(spd<CFG.stallSpd) liftMag*=clamp(spd/CFG.stallSpd,0,1)*0.6;
    a.addScaledVector(up,liftMag);
    // drag (opposite velocity, ~v^2)
    a.addScaledVector(this.vel, -CFG.dragK*spd);
    this.vel.addScaledVector(a,dt);
    // grip: blend velocity toward forward*speed (fuselage tracks) — stronger with speed
    const gf=clamp(CFG.grip*(spd/CFG.refSpd),0.2,CFG.grip)*dt;
    TMP.v4.copy(fwd).multiplyScalar(this.vel.length());
    this.vel.lerp(TMP.v4, clamp(gf,0,0.9));
    // clamp speed
    const s2=this.vel.length(); if(s2>CFG.spdMax) this.vel.multiplyScalar(CFG.spdMax/s2);
    this.group.position.addScaledVector(this.vel,dt);
  }
  shootMG(){ this.mgCd=1/CFG.mg.rof; this.mgAmmo--;
    const m=this.muzzles[this.muzIdx%2]; this.muzIdx++;
    this._spawnBullet(m,CFG.mg);
    muzzleFlash(this._worldMuz(m),0xfff0a0,5); this.fovKick=0.5; this.shake=Math.max(this.shake,0.12); SFX.mg();
  }
  shootCannon(){ this.cannonCd=1/CFG.cannon.rof; this.cannonAmmo--;
    this.cannonMuzzles.forEach(m=>{ this._spawnBullet(m,CFG.cannon); muzzleFlash(this._worldMuz(m),0xff9030,10); });
    this.fovKick=1.4; this.shake=Math.max(this.shake,0.5); SFX.cannon();
  }
  _worldMuz(m){ return TMP.v4.copy(m).applyMatrix4(this.group.matrixWorld); }
  _spawnBullet(m,w){
    this.group.updateMatrixWorld();
    const pos=new THREE.Vector3().copy(m).applyMatrix4(this.group.matrixWorld);
    const fwd=this.forward();
    const dir=fwd.clone();
    dir.x+=rand(-w.spread,w.spread); dir.y+=rand(-w.spread,w.spread); dir.z+=rand(-w.spread,w.spread); dir.normalize();
    const vel=dir.multiplyScalar(w.spd).add(this.vel); // inherit plane velocity
    bullets.fire(pos,vel,{life:w.life,dmg:w.dmg,from:0,color:w.color,size:w.size,knock:w.knock});
  }
  damage(d,vel){ if(!this.alive) return; this.hp-=d; SFX.hurt();
    game.vignette(0.9); game.dmgDir(vel);
    this.shake=Math.max(this.shake,0.6);
    if(this.hp<=0){ this.hp=0; this.die(false); } }
  die(crash){ if(!this.alive) return; this.alive=false;
    explosion(this.group.position); this.group.visible=false; game.onPlayerDead(crash); }
}
