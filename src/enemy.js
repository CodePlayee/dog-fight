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
import { solveBallisticLead } from './ballistics.js';

const ENEMY_SKINS=[
  {body:0x6a6f74,accent:0xb03028,nose:0x222222,roundel:0x9a1414,star:0xf0f0f0},
  {body:0x5d5a50,accent:0xc9a23a,nose:0x303030,roundel:0x8a1010,star:0xeae0c0},
  {body:0x4f5b63,accent:0xa83a26,nose:0x1c1c1c,roundel:0x7a1010,star:0xffffff},
];

const ORIGIN=new THREE.Vector3();
const LOOK_MATRIX=new THREE.Matrix4();
const TARGET_QUATERNION=new THREE.Quaternion();
const TO_PLAYER=new THREE.Vector3();
const TO_PLAYER_DIR=new THREE.Vector3();
const FORWARD=new THREE.Vector3();
const PLAYER_FORWARD=new THREE.Vector3();
const DESIRED=new THREE.Vector3();
const WORK=new THREE.Vector3();
const AIM=new THREE.Vector3();
const MUZZLE_POSITION=new THREE.Vector3();
const SHOT_VELOCITY=new THREE.Vector3();
const SMOKE_POSITION=new THREE.Vector3();
const SMOKE_VELOCITY=new THREE.Vector3();
const GROUND_LOOK_AHEAD=2.2;
const GROUND_PULL_CLEARANCE=320;
const GROUND_CRASH_CLEARANCE=3;
const ENEMY_BULLET_OPTIONS={
  life:CFG.enMg.life,dmg:CFG.enMg.dmg,from:1,color:CFG.enMg.color,size:CFG.enMg.size,
};

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
  forward(out=TMP.v1){ return out.set(0,0,-1).applyQuaternion(this.group.quaternion); }
  update(dt,player){
    if(!this.alive) return;
    this.prop.rotation.z+=42*dt;
    const toP=TO_PLAYER.copy(player.group.position).sub(this.group.position);
    const dist=toP.length();
    const fwd=this.forward(FORWARD);
    this.stateT-=dt;

    // --- decide desired direction ---
    const desired=DESIRED;
    TO_PLAYER_DIR.copy(toP).multiplyScalar(dist>0?1/dist:0);
    const playerOnTail = player.alive && dist<600
                         && fwd.dot(TO_PLAYER_DIR)<-0.2
                         && player.forward(PLAYER_FORWARD).dot(TO_PLAYER_DIR)<-0.7;
    if(this.stateT<=0){
      if(playerOnTail && Math.random()<0.8){ this.state='evade'; this.stateT=rand(1.2,2.2); this.evadeDir=Math.random()<0.5?1:-1; }
      else { this.state='engage'; this.stateT=rand(1.5,3.0); }
    }

    if(this.state==='evade'){
      // hard break: turn away + roll
      desired.copy(fwd).addScaledVector(WORK.set(this.evadeDir,0.2,0).applyQuaternion(this.group.quaternion),1.4).normalize();
    } else {
      // lead pursuit toward intercept
      const t=clamp(dist/CFG.enMg.spd,0,1.5);
      desired.copy(player.group.position).addScaledVector(player.vel,t).sub(this.group.position).normalize();
      // separation from other enemies + avoid head-on with player
      for(const o of game.enemies){ if(o===this||!o.alive) continue;
        const dd=WORK.copy(this.group.position).sub(o.group.position); const l=dd.length();
        if(l<120) desired.addScaledVector(dd.normalize(), (120-l)/120*0.8); }
      desired.normalize();
    }

    // Start a smooth inward turn well before the world edge. A hard guard after
    // movement below only catches unusually large frame steps.
    const px=this.group.position.x, pz=this.group.position.z;
    const radial=Math.hypot(px,pz);
    const returnRadius=CFG.worldR*CFG.worldReturnStart;
    if(radial>returnRadius){
      const edgeT=clamp((radial-returnRadius)/(CFG.worldR-returnRadius),0,1);
      const smoothT=edgeT*edgeT*(3-2*edgeT);
      desired.x-=px/radial*3.2*smoothT;
      desired.z-=pz/radial*3.2*smoothT;
      desired.normalize();
    }

    // Look over the terrain along the current flight path and account for any
    // sink rate. This gives the limited-rate steering enough time to pull up.
    const lookDistance=CFG.enSpd*GROUND_LOOK_AHEAD;
    const groundHere=terrainH(px,pz);
    const groundMid=terrainH(px+fwd.x*lookDistance*0.5,pz+fwd.z*lookDistance*0.5);
    const groundFar=terrainH(px+fwd.x*lookDistance,pz+fwd.z*lookDistance);
    const highestGround=Math.max(groundHere,groundMid,groundFar);
    const predictedY=this.group.position.y+Math.min(0,this.vel.y)*GROUND_LOOK_AHEAD;
    const clearance=Math.min(this.group.position.y-groundHere,predictedY-highestGround);
    if(clearance<GROUND_PULL_CLEARANCE){
      const urgency=clamp((GROUND_PULL_CLEARANCE-clearance)/GROUND_PULL_CLEARANCE,0,1);
      desired.y=Math.max(desired.y,0.3+2.2*urgency);
      desired.normalize();
    }
    if(this.group.position.y>CFG.ceiling){ desired.y=Math.min(desired.y,-0.35); desired.normalize(); }

    // --- steer: rotate toward desired with limited rate ---
    LOOK_MATRIX.lookAt(ORIGIN,desired,UP);
    TARGET_QUATERNION.setFromRotationMatrix(LOOK_MATRIX);
    this.group.quaternion.rotateTowards(TARGET_QUATERNION, CFG.enTurn*dt);

    // --- move ---
    const targetSpd=CFG.enSpd*(this.state==='evade'?1.12:1.0);
    this.vel.lerp(this.forward(FORWARD).multiplyScalar(targetSpd), damp(2.2,dt));
    this.group.position.addScaledVector(this.vel,dt);

    const movedGround=terrainH(this.group.position.x,this.group.position.z)+GROUND_CRASH_CLEARANCE;
    if(this.group.position.y<=movedGround){
      this.group.position.y=movedGround;
      this.die();
      return;
    }

    const movedRadius=Math.hypot(this.group.position.x,this.group.position.z);
    if(movedRadius>CFG.worldR){
      const nx=this.group.position.x/movedRadius;
      const nz=this.group.position.z/movedRadius;
      this.group.position.x=nx*CFG.worldR;
      this.group.position.z=nz*CFG.worldR;
      const outwardSpeed=this.vel.x*nx+this.vel.z*nz;
      if(outwardSpeed>0){ this.vel.x-=nx*outwardSpeed; this.vel.z-=nz*outwardSpeed; }
    }

    // --- fire ---
    this.fireCd-=dt;
    if(this.state==='engage' && player.alive){
      const fireDist=this.group.position.distanceTo(player.group.position);
      const interceptT=fireDist<CFG.enFireRange?solveBallisticLead(
        AIM,
        this.group.position,
        this.vel,
        player.group.position,
        player.vel,
        CFG.enMg.spd,
        CFG.bulletGrav,
        CFG.enMg.life,
      ):-1;
      if(interceptT>=0 && this.forward(FORWARD).dot(AIM)>CFG.enFireCone && this.fireCd<=0){
        this.fireCd=1/CFG.enMg.rof;
        const mz=this.muzzles[(Math.random()*2)|0];
        this.group.updateMatrixWorld();
        const pos=MUZZLE_POSITION.copy(mz).applyMatrix4(this.group.matrixWorld);
        AIM.x+=rand(-CFG.enMg.spread,CFG.enMg.spread); AIM.y+=rand(-CFG.enMg.spread,CFG.enMg.spread); AIM.normalize();
        SHOT_VELOCITY.copy(AIM).multiplyScalar(CFG.enMg.spd).add(this.vel);
        bullets.fire(pos,SHOT_VELOCITY,ENEMY_BULLET_OPTIONS);
        muzzleFlash(pos,0xff7040,4);
      }
    }
    // damaged smoke
    if(this.hp<CFG.enHP*0.45){ this.smokeT-=dt; if(this.smokeT<=0){ this.smokeT=0.06;
      SMOKE_POSITION.copy(this.group.position).addScaledVector(this.forward(FORWARD),3);
      SMOKE_VELOCITY.copy(this.vel).multiplyScalar(0.4);
      smokePuff(SMOKE_POSITION,SMOKE_VELOCITY); } }
  }
  damage(d,vel,knock){ if(!this.alive) return; this.hp-=d;
    // flinch flash
    this.group.traverse(o=>{ if(o.isMesh&&o.material&&o.material.emissive){ o.material.emissive.setRGB(0.6,0.2,0.05);
      setTimeout(()=>o.material.emissive&&o.material.emissive.setRGB(0,0,0),60);} });
    if(knock) this.vel.addScaledVector(WORK.copy(vel).normalize(),knock*6);
    game.hitMarker();
    if(this.hp<=0) this.die();
  }
  die(){ if(!this.alive) return; this.alive=false; explosion(this.group.position);
    // falling smoke trail handled by removal; spawn lingering smoke
    this.group.visible=false; game.onEnemyDead(this); }
}
