// ---------------------------- INPUT ----------------------------------
// Keyboard + mouse state. Fire flags and a key set the player polls.
import { game } from './game.js';

const keys=new Set();
export const input={ has:k=>keys.has(k), fireMG:false, fireCannon:false };
const keyMap={'arrowup':'w','arrowdown':'s','arrowleft':'a','arrowright':'d'};

addEventListener('keydown',e=>{ let k=e.key.toLowerCase(); if(keyMap[k])k=keyMap[k];
  if(['w','a','s','d','q','e','shift','control',' ','f','p','escape','v'].includes(k)||k.length===1){ }
  if(k===' '){ input.fireMG=true; e.preventDefault(); }
  else if(k==='f'){ input.fireCannon=true; }
  else if(k==='p'||k==='escape'){ game.togglePause(); }
  else if(k==='v'){ game.toggleCam(); }
  else keys.add(k);
  if(k==='shift') keys.add('shift'); if(k==='control') keys.add('control');
});
addEventListener('keyup',e=>{ let k=e.key.toLowerCase(); if(keyMap[k])k=keyMap[k];
  if(k===' ') input.fireMG=false; else if(k==='f') input.fireCannon=false; else keys.delete(k);
  if(k==='shift') keys.delete('shift'); if(k==='control') keys.delete('control');
});
addEventListener('mousedown',e=>{ if(!game.running) return; if(e.button===0) input.fireMG=true; if(e.button===2) input.fireCannon=true; });
addEventListener('mouseup',e=>{ if(e.button===0) input.fireMG=false; if(e.button===2) input.fireCannon=false; });
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('blur',()=>{ keys.clear(); input.fireMG=input.fireCannon=false; });
