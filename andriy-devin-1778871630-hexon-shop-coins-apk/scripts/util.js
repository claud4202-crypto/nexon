/* ---------- Util ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* 5-character chunk made of [A-Z0-9]. `Math.random().toString(36)` can
   return short strings when the random value happens to be small
   (e.g. `0.5` -> "0.5"), so we pad before slicing. */
function _idChunk(){
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for(let i=0;i<5;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function genId(){
  return "HX-" + _idChunk() + "-" + _idChunk();
}
function todayKey(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function fmtTime(ms){
  const s = Math.floor(ms/1000);
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if(h>0) return h+"h "+m+"m";
  if(m>0) return m+"m "+sec+"s";
  return sec+"s";
}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}

/* deterministic RNG */
function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s){
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------- Audio engine ----------
   A tiny synth on top of WebAudio. We keep a single shared
   AudioContext (created lazily on first user gesture), then
   build short envelope-shaped tones. `beep()` keeps its legacy
   shape so existing call sites keep working; `tone()` is the
   richer primitive used by `sfx.*` presets. */
let audioCtx = null;
let masterGain = null;
let masterBus = null;       // master -> compressor -> destination
function ensureAudio(){
  if(audioCtx) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    /* Tame any sharp transient — keeps things mellow on tiny
       phone speakers and big PC speakers alike. */
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 14;
    comp.ratio.value = 5;
    comp.attack.value = 0.005;
    comp.release.value = 0.18;
    /* Soft low-pass to round off the very high harmonics produced by
       triangle/square oscillators — that's the "pleasant" part. */
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 5200;
    lp.Q.value = 0.7;
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.6;
    masterBus = comp;
    masterGain.connect(lp);
    lp.connect(comp);
    comp.connect(audioCtx.destination);
  }catch{}
}
/* Resume context on first interaction — required by Chrome/Safari
   autoplay policies. Bound once via main.js. */
function resumeAudio(){
  ensureAudio();
  if(audioCtx && audioCtx.state === "suspended"){
    audioCtx.resume().catch(()=>{});
  }
}
/* Shape: { freq, dur, type, attack, release, gain, detune, slide } */
function tone(opts){
  if(!state.settings.sound) return;
  ensureAudio();
  if(!audioCtx) return;
  const {
    freq = 440,
    dur  = 120,
    type = "sine",
    attack  = 0.005,
    release = 0.08,
    gain    = 0.08,
    detune  = 0,
    slide   = null,           // [startFreq, endFreq] for a pitch glide
  } = opts || {};
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.detune.value = detune;
  if(slide){
    o.frequency.setValueAtTime(slide[0], audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, slide[1]), audioCtx.currentTime + dur/1000);
  } else {
    o.frequency.value = freq;
  }
  o.connect(g); g.connect(masterGain || audioCtx.destination);
  const now = audioCtx.currentTime;
  const peak = Math.max(0.0005, gain);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0002, now + dur/1000 + release);
  o.start(now);
  o.stop(now + dur/1000 + release + 0.05);
}
/* Backwards-compatible: simple sine tone. */
function beep(freq, dur, type){
  tone({ freq, dur, type: type || "sine", gain: 0.06 });
}
/* Curated effect presets (frequencies in Hz, dur in ms).
   Everything is tuned softer than before — lower gain, longer
   release, sine/triangle only, never square. The master chain
   adds a compressor + lowpass so even a stack of sounds in one
   frame still feels smooth. */
const sfx = {
  click()   { tone({ freq: 760, dur: 45,  type: "sine",     gain: 0.035, release: 0.06 }); },
  hover()   { tone({ freq: 980, dur: 28,  type: "sine",     gain: 0.018, release: 0.05 }); },
  place()   {
    tone({ freq: 520, dur: 70, type: "sine",     gain: 0.045, release: 0.10 });
    tone({ freq: 780, dur: 70, type: "sine",     gain: 0.030, detune: 4, release: 0.10 });
  },
  invalid() {
    /* Soft warning — falling minor third, no square wave. */
    tone({ freq: 320, dur: 110, type: "triangle", gain: 0.035, slide: [320, 240], release: 0.10 });
  },
  clear()   {
    tone({ freq: 660, dur: 130, type: "sine",     gain: 0.05, release: 0.18 });
    tone({ freq: 990, dur: 150, type: "triangle", gain: 0.035, detune: 6, release: 0.18 });
  },
  combo(n)  {
    const base = 520 + Math.min(8, n) * 60;
    tone({ freq: base,           dur: 110, type: "triangle", gain: 0.05, release: 0.12 });
    tone({ freq: base * 1.25,    dur: 130, type: "sine",     gain: 0.035, release: 0.16 });
    tone({ freq: base * 1.5,     dur: 150, type: "sine",     gain: 0.025, release: 0.18 });
  },
  lvlup()   {
    // Major triad arpeggio sweeping upward (soft).
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(()=> tone({ freq: f, dur: 180, type: "sine", gain: 0.05, release: 0.18 }), i * 70);
    });
  },
  gameover(){
    [440, 392, 349.23, 293.66].forEach((f, i) => {
      setTimeout(()=> tone({ freq: f, dur: 260, type: "sine", gain: 0.05, release: 0.22 }), i * 130);
    });
  },
  toast()       { tone({ freq: 880, dur: 50, type: "sine", gain: 0.03, release: 0.08 }); },
  modalOpen()   { tone({ freq: 540, dur: 110, type: "sine", gain: 0.035, slide: [380, 560], release: 0.14 }); },
  modalClose()  { tone({ freq: 380, dur: 90,  type: "sine", gain: 0.030, slide: [560, 360], release: 0.12 }); },

  /* ---- shop / wallet / daily reward ---- */
  coin()        {
    /* Sparkly chime — two stacked sines an octave apart. */
    tone({ freq: 1175, dur: 110, type: "sine",     gain: 0.04, release: 0.18 });
    setTimeout(()=> tone({ freq: 1568, dur: 130, type: "triangle", gain: 0.028, release: 0.20 }), 36);
  },
  purchase()    {
    /* Confirmed-purchase fanfare. Gentle 3-note rise. */
    [659.25, 880, 1318.5].forEach((f, i) => {
      setTimeout(()=> tone({ freq: f, dur: 140, type: "sine", gain: 0.045, release: 0.18 }), i * 70);
    });
  },
  dailyClaim()  {
    /* Pentatonic sparkle — five notes in 280ms. */
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
      setTimeout(()=> tone({ freq: f, dur: 150, type: "sine", gain: 0.05, release: 0.20 }), i * 56);
    });
  },
  skinEquip()   {
    tone({ freq: 587.33, dur: 90,  type: "sine", gain: 0.04, release: 0.14 });
    setTimeout(()=> tone({ freq: 880, dur: 130, type: "triangle", gain: 0.035, release: 0.18 }), 40);
  },
  shopOpen()    { tone({ freq: 460, dur: 130, type: "sine", gain: 0.04, slide: [380, 540], release: 0.20 }); },
  shopTab()     { tone({ freq: 720, dur: 40,  type: "sine", gain: 0.030, release: 0.10 }); },
};
function vibrate(p){ if(state.settings.vibration && navigator.vibrate) navigator.vibrate(p); }

/* ---------- Toast ---------- */
function toast(msg, kind){
  const stack = $("#toast-stack");
  const el = document.createElement("div");
  el.className = "toast " + (kind || "info");
  el.innerHTML = '<svg class="ic-svg"><use href="#i-'+(kind==="success"?"check":"bolt")+'"/></svg><span></span>';
  el.querySelector("span").textContent = msg;
  stack.appendChild(el);
  setTimeout(()=>{ el.style.transition="opacity .25s, transform .25s"; el.style.opacity="0"; el.style.transform="translateY(8px)"; }, 1800);
  setTimeout(()=> el.remove(), 2200);
}

