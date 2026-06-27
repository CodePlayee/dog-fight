// ---------------------------- CORE -----------------------------------
// Renderer, scene, camera, post-processing composer, resize handling.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const app = document.getElementById('app');

export const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
export const skyTop = new THREE.Color(0x1a5ba8), skyHorizon = new THREE.Color(0x9ec3e0);
scene.fog = new THREE.Fog(0x9ebfd8, 3200, 12500);

export const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.5, 14000);
camera.position.set(0,320,40);

// post
export let composer=null, bloom=null;
try{
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), 0.75, 0.6, 0.82);
  composer.addPass(bloom);
}catch(e){ console.warn('bloom unavailable, plain render',e); composer=null; }

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  if(composer) composer.setSize(innerWidth,innerHeight);
});
