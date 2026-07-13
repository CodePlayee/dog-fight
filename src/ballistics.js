// Allocation-free ballistic lead shared by weapons and HUD aim helpers.

const ROOT_STEPS = 24;
const BISECTION_STEPS = 14;
const EPSILON = 1e-6;

function polynomialAt(t, a4, a3, a2, a1, a0){
  return ((((a4*t+a3)*t+a2)*t+a1)*t+a0);
}

/**
 * Solve a constant-velocity intercept for a projectile that inherits the
 * shooter's velocity and accelerates downward by `gravity`.
 *
 * Returns the intercept time, or -1 when no solution exists within maxTime.
 * `outDirection` is always written. `outAimPoint`, when supplied, is a world
 * point on the compensated line of aim and can be projected directly by a HUD.
 */
export function solveBallisticLead(
  outDirection,
  shooterPosition,
  shooterVelocity,
  targetPosition,
  targetVelocity,
  projectileSpeed,
  gravity,
  maxTime,
  outAimPoint,
){
  const rx=targetPosition.x-shooterPosition.x;
  const ry=targetPosition.y-shooterPosition.y;
  const rz=targetPosition.z-shooterPosition.z;

  // Bullets inherit the carrier velocity, so interception is solved in the
  // shooter's moving frame rather than against target velocity alone.
  const vx=targetVelocity.x-shooterVelocity.x;
  const vy=targetVelocity.y-shooterVelocity.y;
  const vz=targetVelocity.z-shooterVelocity.z;
  const fallbackLength=Math.hypot(rx,ry,rz);

  if(projectileSpeed<=EPSILON || maxTime<=EPSILON || fallbackLength<=EPSILON){
    if(fallbackLength>EPSILON) outDirection.set(rx/fallbackLength,ry/fallbackLength,rz/fallbackLength);
    else outDirection.set(0,0,-1);
    if(outAimPoint) outAimPoint.copy(targetPosition);
    return fallbackLength<=EPSILON?0:-1;
  }

  const g=Math.max(0,gravity||0);
  const halfG=g*0.5;
  const speedSq=projectileSpeed*projectileSpeed;
  // |r + relativeVelocity*t + 0.5*g*t^2*up|^2 = (speed*t)^2
  const a4=halfG*halfG;
  const a3=2*halfG*vy;
  const a2=vx*vx+vy*vy+vz*vz+2*halfG*ry-speedSq;
  const a1=2*(rx*vx+ry*vy+rz*vz);
  const a0=rx*rx+ry*ry+rz*rz;

  let lo=0;
  let hi=0;
  let found=false;
  let previousValue=a0;
  for(let i=1;i<=ROOT_STEPS;i++){
    const t=maxTime*i/ROOT_STEPS;
    const value=polynomialAt(t,a4,a3,a2,a1,a0);
    if(value<=0 && previousValue>0){ hi=t; found=true; break; }
    lo=t;
    previousValue=value;
  }

  if(!found){
    outDirection.set(rx/fallbackLength,ry/fallbackLength,rz/fallbackLength);
    if(outAimPoint) outAimPoint.copy(targetPosition);
    return -1;
  }

  for(let i=0;i<BISECTION_STEPS;i++){
    const mid=(lo+hi)*0.5;
    if(polynomialAt(mid,a4,a3,a2,a1,a0)>0) lo=mid;
    else hi=mid;
  }
  const t=(lo+hi)*0.5;
  const dx=rx+vx*t;
  const dy=ry+vy*t+halfG*t*t;
  const dz=rz+vz*t;
  const aimLength=Math.hypot(dx,dy,dz);
  outDirection.set(dx/aimLength,dy/aimLength,dz/aimLength);
  if(outAimPoint){
    outAimPoint.copy(shooterPosition).addScaledVector(outDirection,projectileSpeed*t);
  }
  return t;
}
