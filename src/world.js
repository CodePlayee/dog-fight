// ---------------------------- WORLD ----------------------------------
// Lights, gradient sky dome, displaced terrain, scatter features, clouds.
// Also exports terrainH() — the analytic ground height used for collisions.
import * as THREE from 'three';
import { rand } from './config.js';
import { scene, skyTop, skyHorizon } from './core.js';

// lights
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x4a6048, 0.9); scene.add(hemi);
const sunDir = new THREE.Vector3(-0.5,0.62,0.6).normalize();
const sun = new THREE.DirectionalLight(0xfff0d2, 2.5);
sun.position.copy(sunDir).multiplyScalar(1000); scene.add(sun);
scene.add(new THREE.AmbientLight(0x3a4a5a, 0.45));

// sky dome (gradient via shader)
const skyGeo = new THREE.SphereGeometry(9000,32,16);
const skyMat = new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ top:{value:skyTop}, bot:{value:skyHorizon}, off:{value:420.0}, exp:{value:0.7},
             sunPos:{value:sunDir.clone()} },
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec3 vP; uniform vec3 top; uniform vec3 bot; uniform float off; uniform float exp; uniform vec3 sunPos;
    void main(){ float h=normalize(vP+vec3(0.0,off,0.0)).y; float t=pow(clamp(h,0.0,1.0),exp);
      vec3 col=mix(bot,top,t);
      float s=clamp(dot(normalize(vP),normalize(sunPos)),0.0,1.0);
      col+=vec3(1.0,0.85,0.6)*pow(s,140.0)*1.4;          // sun disc
      col+=vec3(1.0,0.8,0.55)*pow(s,9.0)*0.25;           // glow
      gl_FragColor=vec4(col,1.0); }`
});
scene.add(new THREE.Mesh(skyGeo,skyMat));

// ground: displaced patchwork terrain
function makeFieldTexture(){
  const c=document.createElement('canvas'); c.width=c.height=1024; const x=c.getContext('2d');
  const greens=['#5a7d3c','#6c8a44','#4f7038','#7d9450','#587a40','#496b34','#8a9a55'];
  x.fillStyle='#5e7d40'; x.fillRect(0,0,1024,1024);
  for(let i=0;i<420;i++){ const w=rand(40,160),h=rand(40,160);
    x.fillStyle=greens[(Math.random()*greens.length)|0];
    x.globalAlpha=rand(.5,.95);
    x.fillRect(rand(0,1024-w),rand(0,1024-h),w,h);
  }
  x.globalAlpha=.5; x.strokeStyle='#caa05a'; x.lineWidth=3;
  for(let i=0;i<26;i++){ x.beginPath(); x.moveTo(rand(0,1024),0); x.lineTo(rand(0,1024),1024); x.stroke(); }
  for(let i=0;i<26;i++){ x.beginPath(); x.moveTo(0,rand(0,1024)); x.lineTo(1024,rand(0,1024)); x.stroke(); }
  // river
  x.globalAlpha=.8; x.strokeStyle='#3f6b86'; x.lineWidth=22; x.beginPath();
  x.moveTo(0,300); x.bezierCurveTo(300,360,600,180,1024,420); x.stroke();
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(60,60);
  t.anisotropy=4; return t;
}
const groundGeo = new THREE.PlaneGeometry(28000,28000,120,120);
groundGeo.rotateX(-Math.PI/2);
// gentle hills
const gp=groundGeo.attributes.position;
for(let i=0;i<gp.count;i++){ const px=gp.getX(i), pz=gp.getZ(i);
  const h=Math.sin(px*0.0009)*Math.cos(pz*0.0011)*60 + Math.sin(px*0.0003+pz*0.0004)*120;
  gp.setY(i, Math.max(0,h)); }
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map:makeFieldTexture(), roughness:1, metalness:0 }));
ground.position.y=-2; scene.add(ground);

// scattered scale-cue features (instanced boxes = buildings/hangars)
function scatterFeatures(){
  const g=new THREE.BoxGeometry(1,1,1);
  const m=new THREE.MeshStandardMaterial({color:0x9a8d72, roughness:.9});
  const N=140; const inst=new THREE.InstancedMesh(g,m,N); const d=new THREE.Object3D();
  for(let i=0;i<N;i++){ const a=Math.random()*Math.PI*2, r=rand(600,9000);
    const px=Math.cos(a)*r, pz=Math.sin(a)*r;
    const w=rand(20,70), h=rand(14,90), de=rand(20,70);
    d.position.set(px,h/2,pz); d.scale.set(w,h,de); d.rotation.y=rand(0,Math.PI); d.updateMatrix();
    inst.setMatrixAt(i,d.matrix);
  }
  scene.add(inst);
  // dark tree clusters
  const tg=new THREE.ConeGeometry(1,1,6); const tm=new THREE.MeshStandardMaterial({color:0x35552c,roughness:1});
  const TN=260; const ti=new THREE.InstancedMesh(tg,tm,TN);
  for(let i=0;i<TN;i++){ const a=Math.random()*Math.PI*2, r=rand(400,9500);
    const s=rand(16,40);
    d.position.set(Math.cos(a)*r, s, Math.sin(a)*r); d.scale.set(s*0.7,s*1.6,s*0.7); d.rotation.set(0,rand(0,6),0); d.updateMatrix();
    ti.setMatrixAt(i,d.matrix);
  }
  scene.add(ti);
}
scatterFeatures();

// clouds (soft additive sprites)
function makeCloudTex(){
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  const g=x.createRadialGradient(128,128,10,128,128,128);
  g.addColorStop(0,'rgba(255,255,255,.95)'); g.addColorStop(.5,'rgba(255,255,255,.5)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,256,256); return new THREE.CanvasTexture(c);
}
const cloudTex=makeCloudTex(); const clouds=new THREE.Group(); scene.add(clouds);
for(let i=0;i<46;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:rand(.45,.8),depthWrite:false,fog:true}));
  const a=Math.random()*Math.PI*2, r=rand(500,6500);
  s.position.set(Math.cos(a)*r, rand(260,1100), Math.sin(a)*r);
  const sc=rand(280,720); s.scale.set(sc,sc*0.6,1); clouds.add(s);
}

// analytic ground height (matches the vertex displacement above, minus the -2 offset)
export function terrainH(x,z){ const h=Math.sin(x*0.0009)*Math.cos(z*0.0011)*60 + Math.sin(x*0.0003+z*0.0004)*120; return Math.max(0,h)-2; }
