// ---------------------------- POOLS: BULLETS -------------------------
// Pooled tracer rounds with gravity, segment-vs-sphere hit tests against
// the player and enemies, plus ground impact.
import * as THREE from 'three';
import { CFG, TMP, FWD, clamp } from './config.js';
import { scene } from './core.js';
import { terrainH } from './world.js';
import { additive, glowTex, impactSparks } from './vfx.js';

const bulletGeo = new THREE.CylinderGeometry(0.18,0.18,4.4,6); bulletGeo.rotateX(Math.PI/2); // along Z

class Bullets{
  constructor(max=520){ this.items=[]; this.free=[];
    for(let i=0;i<max;i++){
      const core=new THREE.Mesh(bulletGeo,new THREE.MeshBasicMaterial({color:0xffffff,fog:false}));
      const glow=additive(0xffffff,3,glowTex); glow.material.fog=false;
      const grp=new THREE.Group(); grp.add(core); grp.add(glow); grp.visible=false; scene.add(grp);
      const b={grp,core,glow,vel:new THREE.Vector3(),prev:new THREE.Vector3(),life:0,dmg:0,from:0,knock:0,size:1};
      this.items.push(b); this.free.push(b); } }
  fire(pos,vel,opt){ const b=this.free.pop(); if(!b) return; b.grp.visible=true;
    b.grp.position.copy(pos); b.prev.copy(pos); b.vel.copy(vel);
    b.life=opt.life; b.dmg=opt.dmg; b.from=opt.from; b.knock=opt.knock||0; b.size=opt.size||1;
    b.core.material.color.set(opt.color); b.glow.material.color.set(opt.color);
    b.glow.scale.set(opt.size*3.0,opt.size*3.0,1); b.core.scale.set(opt.size,opt.size,(opt.streak||2.8));
    // orient along velocity
    TMP.q1.setFromUnitVectors(FWD,TMP.v1.copy(vel).normalize()); b.grp.quaternion.copy(TMP.q1);
    return b; }
  update(dt, player, enemies){
    for(const b of this.items){ if(!b.grp.visible) continue;
      b.life-=dt; if(b.life<=0){ b.grp.visible=false; this.free.push(b); continue; }
      b.prev.copy(b.grp.position);
      b.vel.y-=CFG.bulletGrav*dt;
      b.grp.position.addScaledVector(b.vel,dt);
      TMP.q1.setFromUnitVectors(FWD,TMP.v1.copy(b.vel).normalize()); b.grp.quaternion.copy(TMP.q1);
      // collision (segment vs sphere)
      if(b.from===0){ // player bullet -> enemies
        for(const e of enemies){ if(!e.alive) continue;
          if(segSphere(b.prev,b.grp.position,e.group.position,CFG.hitR)){
            e.damage(b.dmg, b.vel, b.knock); impactSparks(b.grp.position, 0xffa030);
            b.grp.visible=false; this.free.push(b); break; }
        }
      } else { // enemy bullet -> player
        if(player.alive && segSphere(b.prev,b.grp.position,player.group.position,CFG.hitR)){
          player.damage(b.dmg, b.vel); impactSparks(b.grp.position,0xff5030);
          b.grp.visible=false; this.free.push(b); }
      }
      // ground
      if(b.grp.position.y<=terrainH(b.grp.position.x,b.grp.position.z)+0.5){
        impactSparks(b.grp.position,0xcfae6a); b.grp.visible=false; this.free.push(b);
      }
    }
  }
}
export const bullets=new Bullets(520);

export function segSphere(a,b,c,r){ // does segment a->b intersect sphere(c,r)
  TMP.v1.copy(b).sub(a); const ab2=TMP.v1.lengthSq(); if(ab2<1e-6) return a.distanceToSquared(c)<=r*r;
  let t=TMP.v2.copy(c).sub(a).dot(TMP.v1)/ab2; t=clamp(t,0,1);
  TMP.v3.copy(a).addScaledVector(TMP.v1,t); return TMP.v3.distanceToSquared(c)<=r*r;
}
