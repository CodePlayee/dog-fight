// ---------------------------- CAMERA ---------------------------------
// Chase / cockpit camera rig with shake and speed-based FOV kick.
import { CFG, TMP, clamp, lerp, rand, damp } from './config.js';
import { camera } from './core.js';

export const cam={ mode:0, // 0 chase, 1 cockpit
  update(dt,player){
    const p=player.group;
    if(this.mode===0){
      p.visible=player.alive; // restore model when returning from cockpit view
      const back=TMP.v1.set(0,0,1).applyQuaternion(p.quaternion);
      const up=TMP.v2.set(0,1,0).applyQuaternion(p.quaternion);
      const desired=TMP.v3.copy(p.position).addScaledVector(back,20).addScaledVector(up,5.5);
      camera.position.lerp(desired, damp(7,dt));
      const look=TMP.v4.copy(p.position).addScaledVector(player.forward(),40);
      camera.lookAt(look);
    } else {
      p.visible=false; // hide own airframe: prop disc + cowl would fill the view
      const up=TMP.v2.set(0,1,0).applyQuaternion(p.quaternion);
      const fwd=player.forward();
      camera.position.copy(p.position).addScaledVector(up,1.1).addScaledVector(fwd,1.0);
      camera.lookAt(TMP.v4.copy(p.position).addScaledVector(fwd,60));
    }
    // shake
    if(player.shake>0.001){ const s=player.shake*2.2;
      camera.position.x+=rand(-s,s); camera.position.y+=rand(-s,s); camera.position.z+=rand(-s,s); }
    // fov kick / speed
    const targetFov=60+clamp(player.vel.length()/CFG.spdMax,0,1)*12+player.fovKick*4;
    camera.fov=lerp(camera.fov,targetFov,damp(5,dt)); camera.updateProjectionMatrix();
  }
};
