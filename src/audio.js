// ---------------------------- AUDIO (procedural synth) ---------------
// WebAudio-based engine drone + weapon/impact one-shots. No asset files.
export const SFX = {
  ctx:null, master:null, engGain:null, engOsc:null, engOsc2:null, noiseBuf:null, on:false,
  init(){
    try{
      const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
      this.ctx=new AC(); this.master=this.ctx.createGain(); this.master.gain.value=0.5; this.master.connect(this.ctx.destination);
      // noise buffer
      const len=this.ctx.sampleRate*1.0; const b=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
      const d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; this.noiseBuf=b;
      // engine drone
      this.engGain=this.ctx.createGain(); this.engGain.gain.value=0.0; this.engGain.connect(this.master);
      const lp=this.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420; lp.connect(this.engGain);
      this.engOsc=this.ctx.createOscillator(); this.engOsc.type='sawtooth'; this.engOsc.frequency.value=70; this.engOsc.connect(lp);
      this.engOsc2=this.ctx.createOscillator(); this.engOsc2.type='square'; this.engOsc2.frequency.value=104; const g2=this.ctx.createGain(); g2.gain.value=0.4; this.engOsc2.connect(g2); g2.connect(lp);
      this.engOsc.start(); this.engOsc2.start();
      this.on=true;
    }catch(e){ console.warn('audio init failed',e); }
  },
  resume(){ if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); },
  engine(throttle,speed){ if(!this.on) return; const t=this.ctx.currentTime;
    const f=58+throttle*60+speed*0.25; this.engOsc.frequency.setTargetAtTime(f,t,0.1);
    this.engOsc2.frequency.setTargetAtTime(f*1.5,t,0.1);
    this.engGain.gain.setTargetAtTime(0.12+throttle*0.12,t,0.2);
  },
  silenceEngine(immediate=false){ if(!this.on||!this.engGain) return; const t=this.ctx.currentTime;
    this.engGain.gain.cancelScheduledValues(t);
    if(immediate) this.engGain.gain.setValueAtTime(0,t);
    else this.engGain.gain.setTargetAtTime(0,t,0.06);
  },
  noise(dur,freq,type,gain,sweep){ if(!this.on) return; const t=this.ctx.currentTime;
    const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuf; src.loop=true;
    const f=this.ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq; f.Q.value=1.1;
    if(sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80,freq*sweep),t+dur);
    const g=this.ctx.createGain(); g.gain.value=gain; g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); src.stop(t+dur);
  },
  tone(freq,dur,type,gain,sweep){ if(!this.on) return; const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(); o.type=type||'sine'; o.frequency.value=freq;
    if(sweep) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*sweep),t+dur);
    const g=this.ctx.createGain(); g.gain.value=gain; g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(t+dur);
  },
  mg(){ this.noise(0.06,2400,'bandpass',0.18,0.5); },
  cannon(){ this.tone(120,0.18,'square',0.28,0.4); this.noise(0.16,700,'lowpass',0.22,0.4); },
  explosion(){ this.noise(0.7,500,'lowpass',0.5,0.18); this.tone(70,0.6,'sine',0.3,0.3); },
  hit(){ this.tone(1300,0.05,'square',0.12,0.6); },
  hurt(){ this.noise(0.18,900,'bandpass',0.3,0.4); },
};
