// audio.js — paper sounds synthesised in the browser; no audio files, no narration.
export class PaperAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.buffer = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }
    this.ctx = new Ctx();
    const len = Math.floor(this.ctx.sampleRate * 0.9);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.buffer = buf;
  }

  _noise({ dur = 0.3, from = 1500, to = 420, gain = 0.16, q = 0.9, delay = 0 }) {
    if (!this.enabled || !this.ctx || !this.buffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(Math.max(to, 60), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  _thump({ freq = 96, dur = 0.22, gain = 0.1, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  turn() { this._noise({ dur: 0.42, from: 1900, to: 380, gain: 0.15 }); this._thump({ delay: 0.34, gain: 0.07 }); }
  fold() { this._noise({ dur: 0.2, from: 2600, to: 900, gain: 0.07, q: 1.4 }); }
  rise() { this._noise({ dur: 0.26, from: 900, to: 2200, gain: 0.055, q: 1.1, delay: 0.05 }); }
  open() {
    this._noise({ dur: 0.5, from: 1700, to: 300, gain: 0.13 });
    this._thump({ freq: 84, delay: 0.9, gain: 0.09 });
    this._noise({ dur: 0.5, from: 1200, to: 620, gain: 0.07, delay: 0.62 });
  }
  blip() { this._thump({ freq: 420, dur: 0.1, gain: 0.05 }); }
}
