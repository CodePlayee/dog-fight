// ---------------------------- MODELS ---------------------------------
// Procedural WW2 warbird mesh used for both player and enemies.
import * as THREE from 'three';

export function buildWarbird(opt){
  const { body=0x4c5b3e, accent=0xb6402f, glass=0x9fd6e6, roundel=0x2a4f9c, star=0xffffff, nose=0xd0c060 }=opt||{};
  const g=new THREE.Group();
  const mB=new THREE.MeshStandardMaterial({color:body,metalness:.45,roughness:.5});
  const mA=new THREE.MeshStandardMaterial({color:accent,metalness:.3,roughness:.55});
  const mN=new THREE.MeshStandardMaterial({color:nose,metalness:.5,roughness:.45});
  const mD=new THREE.MeshStandardMaterial({color:0x1a1a1a,metalness:.5,roughness:.6});
  const mG=new THREE.MeshStandardMaterial({color:glass,metalness:.1,roughness:.08,transparent:true,opacity:.55});

  // fuselage (nose toward -Z)
  const fuse=new THREE.Mesh(new THREE.CylinderGeometry(1.05,0.55,8.6,14),mB);
  fuse.rotation.x=Math.PI/2; g.add(fuse);
  const back=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.18,3.2,12),mB);
  back.rotation.x=Math.PI/2; back.position.z=5.7; g.add(back);
  // cowl + spinner + prop
  const cowl=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.05,1.3,16),mN);
  cowl.rotation.x=Math.PI/2; cowl.position.z=-4.2; g.add(cowl);
  const spin=new THREE.Mesh(new THREE.ConeGeometry(0.55,1.5,16),mN);
  spin.rotation.x=-Math.PI/2; spin.position.z=-5.4; g.add(spin);
  const prop=new THREE.Group(); prop.position.z=-5.7; g.add(prop);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.5,7.0,0.12),mD);
  prop.add(blade); const b2=blade.clone(); b2.rotation.z=Math.PI/2; prop.add(b2); const b3=blade.clone(); b3.rotation.z=Math.PI/3; prop.add(b3);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(3.5,28),
    new THREE.MeshBasicMaterial({color:0x222218,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false}));
  disc.position.z=-0.15; prop.add(disc);

  // wings (span X), slight dihedral via two halves
  const wgeo=new THREE.BoxGeometry(7.2,0.32,2.7);
  const wl=new THREE.Mesh(wgeo,mB); wl.position.set(-3.7,-0.05,-0.6); wl.rotation.z=0.06; g.add(wl);
  const wr=new THREE.Mesh(wgeo,mB); wr.position.set( 3.7,-0.05,-0.6); wr.rotation.z=-0.06; g.add(wr);
  // wingtips accent
  const tgeo=new THREE.BoxGeometry(1.2,0.34,2.7);
  const tl=new THREE.Mesh(tgeo,mA); tl.position.set(-7.0,0.0,-0.6); g.add(tl);
  const tr=new THREE.Mesh(tgeo,mA); tr.position.set( 7.0,0.0,-0.6); g.add(tr);
  // roundels
  const rgeo=new THREE.CircleGeometry(0.9,20); const rmat=new THREE.MeshStandardMaterial({color:roundel,roughness:.7});
  const smat=new THREE.MeshBasicMaterial({color:star});
  [[-4.3,0.18,-0.6],[4.3,0.18,-0.6]].forEach(p=>{
    const r=new THREE.Mesh(rgeo,rmat); r.rotation.x=-Math.PI/2; r.position.set(p[0],p[1],p[2]); g.add(r);
    const st=new THREE.Mesh(new THREE.CircleGeometry(0.42,16),smat); st.rotation.x=-Math.PI/2; st.position.set(p[0],p[1]+0.01,p[2]); g.add(st);
  });

  // tail
  const hs=new THREE.Mesh(new THREE.BoxGeometry(5.4,0.26,1.5),mB); hs.position.z=6.3; g.add(hs);
  const vs=new THREE.Mesh(new THREE.BoxGeometry(0.26,2.4,1.7),mA); vs.position.set(0,1.0,6.4); g.add(vs);

  // canopy
  const can=new THREE.Mesh(new THREE.SphereGeometry(0.85,14,10,0,Math.PI*2,0,Math.PI/2),mG);
  can.scale.set(1.05,0.95,2.3); can.position.set(0,0.78,-0.2); g.add(can);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.9,0.12),mD); frame.position.set(0,0.5,1.3); g.add(frame);

  // gun muzzles (local)
  const muzzles=[new THREE.Vector3(-3.6,-0.1,-3.4),new THREE.Vector3(3.6,-0.1,-3.4)];
  const cannonMuzzles=[new THREE.Vector3(-1.2,-0.2,-4.0),new THREE.Vector3(1.2,-0.2,-4.0)];

  g.traverse(o=>{ if(o.isMesh){o.castShadow=false;o.receiveShadow=false;} });
  return { group:g, prop, muzzles, cannonMuzzles };
}
