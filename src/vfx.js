// ---------------------------- POOLS: VFX -----------------------------
// Particle + debris pools and the muzzle/impact/smoke/explosion helpers.
// Exports `additive` and `glowTex` which bullets.js also reuses.
import * as THREE from 'three';
import { CFG, TMP, rand } from './config.js';
import { scene } from './core.js';
import { SFX } from './audio.js';

export const additive = (color,size,tex)=> new THREE.Sprite(new THREE.SpriteMaterial({
  map:tex, color, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false, opacity:1 }));

function makeGlowTex(){
  const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.35,'rgba(255,240,200,.7)'); g.addColorStop(1,'rgba(255,180,80,0)');
  x.fillStyle=g; x.fillRect(0,0,128,128); return new THREE.CanvasTexture(c);
}
export const glowTex=makeGlowTex();

// generic particle pool
class Particles{
  constructor(max=600){ this.max=max; this.items=[]; this.free=[];
    for(let i=0;i<max;i++){ const s=additive(0xffffff,1,glowTex); s.visible=false; scene.add(s);
      const p={spr:s,life:0,maxLife:0,vel:new THREE.Vector3(),grav:0,fade:1,baseScale:1,spin:0,col0:new THREE.Color(),col1:new THREE.Color()};
      this.items.push(p); this.free.push(p);} }
  spawn(pos,opt){ const p=this.free.pop(); if(!p) return null;
    p.spr.visible=true; p.spr.position.copy(pos);
    p.maxLife=p.life=opt.life; p.vel.copy(opt.vel||TMP.v1.set(0,0,0)); p.grav=opt.grav||0;
    p.baseScale=opt.scale||4; p.spr.scale.set(p.baseScale,p.baseScale,1);
    p.col0.set(opt.c0??0xffffff); p.col1.set(opt.c1??opt.c0??0xffffff);
    p.spr.material.color.copy(p.col0); p.spr.material.opacity=opt.opacity??1; p.growth=opt.growth||0;
    return p; }
  reset(){ this.free.length=0; for(const p of this.items){
    p.spr.visible=false; p.life=0; p.maxLife=0; p.vel.set(0,0,0);
    p.spr.position.set(0,0,0); p.spr.scale.set(1,1,1); this.free.push(p);
  } }
  update(dt){ for(const p of this.items){ if(!p.spr.visible) continue; p.life-=dt;
    if(p.life<=0){ p.spr.visible=false; this.free.push(p); continue; }
    p.vel.y-=p.grav*dt; p.spr.position.addScaledVector(p.vel,dt);
    const k=1-p.life/p.maxLife; const s=p.baseScale*(1+p.growth*k);
    p.spr.scale.set(s,s,1); p.spr.material.opacity=(1-k); p.spr.material.color.copy(p.col0).lerp(p.col1,k);
  } }
}
export const parts=new Particles(700);

// debris pool (small meshes)
class Debris{
  constructor(max=80){ this.items=[]; this.free=[];
    const geo=new THREE.BoxGeometry(1,1,1), mat=new THREE.MeshStandardMaterial({color:0x333033,metalness:.6,roughness:.5});
    for(let i=0;i<max;i++){ const m=new THREE.Mesh(geo,mat.clone()); m.visible=false; scene.add(m);
      this.items.push({m,life:0,vel:new THREE.Vector3(),spin:new THREE.Vector3()}); this.free.push(this.items[i]); } }
  burst(pos,n,col){ for(let i=0;i<n;i++){ const d=this.free.pop(); if(!d) return; d.m.visible=true;
    d.m.position.copy(pos); const s=rand(0.8,2.6); d.m.scale.set(s,s,s);
    d.m.material.color.set(col); d.life=rand(1.2,2.4);
    d.vel.set(rand(-1,1),rand(.2,1),rand(-1,1)).normalize().multiplyScalar(rand(20,70));
    d.spin.set(rand(-6,6),rand(-6,6),rand(-6,6)); } }
  reset(){ this.free.length=0; for(const d of this.items){
    d.m.visible=false; d.life=0; d.vel.set(0,0,0); d.spin.set(0,0,0);
    d.m.position.set(0,0,0); d.m.rotation.set(0,0,0); d.m.scale.set(1,1,1); this.free.push(d);
  } }
  update(dt){ for(const d of this.items){ if(!d.m.visible) continue; d.life-=dt;
    if(d.life<=0){ d.m.visible=false; this.free.push(d); continue; }
    d.vel.y-=CFG.grav*2*dt; d.m.position.addScaledVector(d.vel,dt);
    d.m.rotation.x+=d.spin.x*dt; d.m.rotation.y+=d.spin.y*dt; d.m.rotation.z+=d.spin.z*dt; } }
}
export const debris=new Debris(90);
const flashes=[];

export function updateVfx(dt){
  parts.update(dt); debris.update(dt);
  for(let i=flashes.length-1;i>=0;i--){
    const f=flashes[i]; f.life-=dt;
    if(f.life<=0){ f.light.removeFromParent(); f.light.dispose?.(); flashes.splice(i,1); continue; }
    f.light.intensity=f.intensity*(f.life/f.maxLife);
  }
}

export function resetVfx(){
  parts.reset(); debris.reset();
  for(const f of flashes){ f.light.removeFromParent(); f.light.dispose?.(); }
  flashes.length=0;
}

export function muzzleFlash(pos,color,scale){
  parts.spawn(pos,{life:0.09,scale:scale||9,c0:0xffffff,c1:color,growth:0.5});
  parts.spawn(pos,{life:0.05,scale:(scale||9)*0.55,c0:color,c1:0xffd070,growth:0.8});
}
export function impactSparks(pos,color){
  for(let i=0;i<7;i++){ parts.spawn(pos,{life:rand(.18,.4),scale:rand(1.5,3.2),
    vel:TMP.v1.set(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(rand(14,40)),
    grav:8,c0:0xfff0b0,c1:color}); }
  SFX.hit();
}
export function smokePuff(pos,vel,big){ parts.spawn(pos,{life:rand(.7,1.4),scale:big?rand(7,12):rand(3,6),
    vel:vel||TMP.v1.set(0,rand(2,8),0),grav:-1,c0:0x6a6a66,c1:0x202020,opacity:.7,growth:2.2}); }
export function explosion(pos){
  // flash light
  const fl=new THREE.PointLight(0xffd0a0,9,520); fl.position.copy(pos); scene.add(fl);
  flashes.push({light:fl,life:0.4,maxLife:0.4,intensity:9});
  // bright core flash + expanding shock pulse
  parts.spawn(pos,{life:0.13,scale:24,c0:0xffffff,c1:0xffd070,growth:1.1});
  parts.spawn(pos,{life:0.28,scale:10,c0:0xfff0c0,c1:0xff8030,growth:7.0,opacity:0.55});
  // fireball
  for(let i=0;i<5;i++) parts.spawn(pos,{life:rand(.4,.7),scale:rand(14,30),c0:0xffd070,c1:0xff3010,growth:1.4,
    vel:TMP.v1.set(rand(-1,1),rand(-1,1),rand(-1,1)).multiplyScalar(rand(6,24))});
  for(let i=0;i<14;i++) parts.spawn(pos,{life:rand(.8,1.8),scale:rand(8,18),c0:0x555555,c1:0x111111,growth:2.4,
    vel:TMP.v1.set(rand(-1,1),rand(-.2,1),rand(-1,1)).normalize().multiplyScalar(rand(18,52)),grav:-2,opacity:.9});
  for(let i=0;i<22;i++) parts.spawn(pos,{life:rand(.3,.7),scale:rand(2,5),c0:0xfff0b0,c1:0xff5020,grav:10,
    vel:TMP.v1.set(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(rand(40,120))});
  debris.burst(pos,8,0x2a2a2a);
  SFX.explosion();
}
