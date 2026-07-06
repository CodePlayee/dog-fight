// ---------------------------- CONFIG ---------------------------------
// Tunables, shared scratch vectors, constant directions, math helpers.
import * as THREE from 'three';

export const CFG = {
  enemies: 8,
  grav: 9.2,
  // player flight
  thrustMax: 64, dragK: 0.0016, liftK: 0.00046, liftMax: 26,
  stallSpd: 42, refSpd: 150, grip: 2.6,
  pitchRate: 1.55, rollRate: 2.9, yawRate: 0.8, angDamp: 2.6,
  spdMin: 0, spdMax: 240,
  // weapons
  mg:     { spd: 980, dmg: 8,  rof: 12,  spread: 0.006, life: 2.1, ammo: 1600, color: 0xfff2a0, size: 0.9, knock: 0 },
  cannon: { spd: 840, dmg: 30, rof: 3.4, spread: 0.004, life: 2.4, ammo: 120,  color: 0xff7a2c, size: 1.7, knock: 1.4 },
  bulletGrav: 9.2,
  hitR: 6.8,            // plane hit sphere radius
  // enemy
  enSpd: 132, enTurn: 0.95, enHP: 80, enFireRange: 760, enFireCone: 0.991,
  enMg: { spd: 900, dmg: 6, rof: 8, spread: 0.02, life: 2.0, color: 0xff5436, size: 1.0 },
  // world
  groundY: 0, ceiling: 1500, worldR: 7000,
};

// shared scratch — reused across modules to avoid per-frame allocations
export const TMP = { v1:new THREE.Vector3(), v2:new THREE.Vector3(), v3:new THREE.Vector3(),
              v4:new THREE.Vector3(), v5:new THREE.Vector3(), v6:new THREE.Vector3(),
              q1:new THREE.Quaternion(), q2:new THREE.Quaternion() };

export const FWD=new THREE.Vector3(0,0,-1), UP=new THREE.Vector3(0,1,0), RIGHT=new THREE.Vector3(1,0,0);

export const clamp=(x,a,b)=>x<a?a:x>b?b:x;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const rand=(a,b)=>a+Math.random()*(b-a);
export const damp=(rate,dt)=>1-Math.exp(-rate*dt);
