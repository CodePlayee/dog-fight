// ---------------------------- INPUT ----------------------------------
// Keyboard, mouse, and multi-touch state polled by the player.
import { game } from './game.js';

const keyboardKeys=new Set();
const touchKeyPointers=new Map();
const touchFireMG=new Set();
const touchFireCannon=new Set();
const activeTouchPointers=new Map();
const activeKeyboardControls=new Map();
const clickPulses=new Map();
let keyboardFireMG=false;
let keyboardFireCannon=false;
let mouseFireMG=false;
let mouseFireCannon=false;

export const input={
  has:key=>keyboardKeys.has(key)||(touchKeyPointers.get(key)?.size>0),
  fireMG:false,
  fireCannon:false
};

const keyMap={arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d'};
const touchControls=document.getElementById('touch-controls');
const cameraControl=touchControls?.querySelector('[data-control="camera"]');
const pauseControl=touchControls?.querySelector('[data-control="pause"]');

function normalizeKey(key){
  const normalized=key.toLowerCase();
  return keyMap[normalized]||normalized;
}

function isInteractiveTarget(target){
  return target instanceof Element&&Boolean(target.closest('button,a,input,textarea,select,[contenteditable="true"]'));
}

function syncFire(){
  input.fireMG=keyboardFireMG||mouseFireMG||touchFireMG.size>0;
  input.fireCannon=keyboardFireCannon||mouseFireCannon||touchFireCannon.size>0;
}

function setTouchKey(key,pointerId,pressed){
  let pointers=touchKeyPointers.get(key);
  if(pressed){
    if(!pointers){ pointers=new Set(); touchKeyPointers.set(key,pointers); }
    pointers.add(pointerId);
  } else if(pointers){
    pointers.delete(pointerId);
    if(!pointers.size) touchKeyPointers.delete(key);
  }
}

function markPressed(button,pressed){
  button.classList.toggle('is-pressed',pressed);
}

function setToggleState(button,pressed,activeLabel,inactiveLabel){
  if(!button) return;
  button.setAttribute('aria-pressed',String(pressed));
  button.setAttribute('aria-label',pressed?activeLabel:inactiveLabel);
}

function toggleCameraControl(){
  const cockpit=Boolean(game.toggleCam());
  setToggleState(cameraControl,cockpit,'Switch to chase camera','Switch to cockpit camera');
}

function togglePauseControl(){
  const paused=Boolean(game.togglePause());
  setToggleState(pauseControl,paused,'Resume','Pause');
}

function controlStillActive(button){
  for(const state of activeTouchPointers.values()) if(state.button===button) return true;
  for(const state of activeKeyboardControls.values()) if(state.button===button) return true;
  return clickPulses.has(button);
}

function activateControl(state,token){
  markPressed(state.button,true);
  if(state.key) setTouchKey(state.key,token,true);
  if(state.action==='fire-mg') touchFireMG.add(token);
  if(state.action==='fire-cannon') touchFireCannon.add(token);
  if(state.action==='camera') toggleCameraControl();
  if(state.action==='pause') togglePauseControl();
  syncFire();
}

function deactivateControl(state,token){
  if(state.key) setTouchKey(state.key,token,false);
  if(state.action==='fire-mg') touchFireMG.delete(token);
  if(state.action==='fire-cannon') touchFireCannon.delete(token);
  if(!controlStillActive(state.button)) markPressed(state.button,false);
  syncFire();
}

function releaseTouchPointer(pointerId){
  const state=activeTouchPointers.get(pointerId);
  if(!state) return;
  activeTouchPointers.delete(pointerId);
  deactivateControl(state,pointerId);
}

function releaseKeyboardControl(button){
  const state=activeKeyboardControls.get(button);
  if(!state) return;
  activeKeyboardControls.delete(button);
  deactivateControl(state,state.token);
}

function pulseControl(button){
  if(clickPulses.has(button)||!game.running) return;
  const state={button,key:button.dataset.touchKey,action:button.dataset.touchAction,token:Symbol(button.dataset.control)};
  activateControl(state,state.token);
  state.timer=setTimeout(()=>{
    clickPulses.delete(button);
    deactivateControl(state,state.token);
  },140);
  clickPulses.set(button,state);
}

function resetInput(){
  keyboardKeys.clear();
  touchKeyPointers.clear();
  touchFireMG.clear();
  touchFireCannon.clear();
  keyboardFireMG=keyboardFireCannon=false;
  mouseFireMG=mouseFireCannon=false;
  for(const state of activeTouchPointers.values()) markPressed(state.button,false);
  for(const state of activeKeyboardControls.values()) markPressed(state.button,false);
  for(const state of clickPulses.values()){ clearTimeout(state.timer); markPressed(state.button,false); }
  activeTouchPointers.clear();
  activeKeyboardControls.clear();
  clickPulses.clear();
  syncFire();
}

setToggleState(cameraControl,false,'Switch to chase camera','Switch to cockpit camera');
setToggleState(pauseControl,false,'Resume','Pause');

addEventListener('keydown',event=>{
  const key=normalizeKey(event.key);
  if(isInteractiveTarget(event.target)&&(key===' '||key==='enter')) return;

  if(key===' '){
    if(game.running){ keyboardFireMG=true; syncFire(); event.preventDefault(); }
  } else if(key==='f'){
    if(game.running){ keyboardFireCannon=true; syncFire(); }
  } else if(key==='p'||key==='escape'){
    if(!event.repeat) togglePauseControl();
  } else if(key==='v'){
    if(!event.repeat&&game.running) toggleCameraControl();
  } else if(game.running){
    keyboardKeys.add(key);
    if(keyMap[event.key.toLowerCase()]) event.preventDefault();
  }
});

addEventListener('keyup',event=>{
  const key=normalizeKey(event.key);
  if(key===' '){ keyboardFireMG=false; syncFire(); }
  else if(key==='f'){ keyboardFireCannon=false; syncFire(); }
  else keyboardKeys.delete(key);
});

addEventListener('mousedown',event=>{
  if(!game.running||isInteractiveTarget(event.target)) return;
  if(event.button===0) mouseFireMG=true;
  if(event.button===2) mouseFireCannon=true;
  syncFire();
});

addEventListener('mouseup',event=>{
  if(event.button===0) mouseFireMG=false;
  if(event.button===2) mouseFireCannon=false;
  syncFire();
});

addEventListener('contextmenu',event=>{
  if(game.running&&!isInteractiveTarget(event.target)) event.preventDefault();
});

if(touchControls){
  const coarsePointer=matchMedia('(any-pointer: coarse)');
  const updateTouchClass=()=>document.documentElement.classList.toggle('touch-input',coarsePointer.matches||navigator.maxTouchPoints>0);
  updateTouchClass();
  coarsePointer.addEventListener?.('change',updateTouchClass);

  touchControls.addEventListener('pointerdown',event=>{
    const button=event.target.closest('.touch-btn');
    if(!button||activeTouchPointers.has(event.pointerId)||!game.running) return;
    event.preventDefault();

    const state={button,key:button.dataset.touchKey,action:button.dataset.touchAction};
    activeTouchPointers.set(event.pointerId,state);
    button.setPointerCapture?.(event.pointerId);
    activateControl(state,event.pointerId);
  });

  for(const eventName of ['pointerup','pointercancel','lostpointercapture']){
    touchControls.addEventListener(eventName,event=>releaseTouchPointer(event.pointerId));
  }

  touchControls.addEventListener('keydown',event=>{
    if(event.key!==' '&&event.key!=='Enter') return;
    const button=event.target.closest('.touch-btn');
    if(!button||!game.running) return;
    event.preventDefault();
    if(event.repeat||activeKeyboardControls.has(button)) return;
    const state={button,key:button.dataset.touchKey,action:button.dataset.touchAction,token:`keyboard:${button.dataset.control}`};
    activeKeyboardControls.set(button,state);
    activateControl(state,state.token);
  });

  touchControls.addEventListener('keyup',event=>{
    if(event.key!==' '&&event.key!=='Enter') return;
    const button=event.target.closest('.touch-btn');
    if(!button) return;
    event.preventDefault();
    releaseKeyboardControl(button);
  });

  touchControls.addEventListener('focusout',event=>{
    const button=event.target.closest('.touch-btn');
    if(button) releaseKeyboardControl(button);
  });

  touchControls.addEventListener('click',event=>{
    const button=event.target.closest('.touch-btn');
    if(button&&event.detail===0) pulseControl(button);
  });
}

addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) resetInput(); });
