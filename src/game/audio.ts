/**
 * Small original Web Audio effects set (PRD §7). Synthesised at runtime, no
 * samples. Starts only after a user gesture, respects the saved mute setting,
 * and suspends while the page is hidden. No error buzzers, no continuous sound
 * while drawing, no music.
 */
export type Sfx = 'tap' | 'pickup' | 'success' | 'wave' | 'flutter' | 'pop' | 'whoosh';

export class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private unlocked = false;
  private hidden = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.unlocked && this.ctx?.state === 'running') return;
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 3;
        this.master.connect(comp).connect(this.ctx.destination);
      }
      if (!this.hidden) void this.ctx.resume();
      this.unlocked = true;
    } catch {
      // Audio unavailable: continue silently (the game never depends on sound).
      this.ctx = null;
    }
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else if (this.unlocked) void this.ctx.resume();
  }

  play(name: Sfx): void {
    if (this.muted || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'tap':
        this.tone(660, t, 0.09, 'sine', 0.22, 0.004);
        this.tone(1320, t, 0.05, 'sine', 0.05, 0.002);
        break;
      case 'pop':
        this.sweep(380, 760, t, 0.08, 'sine', 0.18);
        break;
      case 'whoosh':
        this.noise(t, 0.28, 900, 0.07);
        break;
      case 'pickup':
        this.tone(1046.5, t, 0.22, 'triangle', 0.16, 0.003);
        this.tone(1568, t + 0.08, 0.3, 'triangle', 0.14, 0.003);
        this.tone(2093, t + 0.16, 0.4, 'sine', 0.08, 0.003);
        break;
      case 'success': {
        // Gentle marimba-like rising arpeggio with a soft shimmer.
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((f, i) => this.marimba(f, t + i * 0.11, 0.2));
        this.tone(2093, t + 0.6, 0.9, 'sine', 0.05, 0.02);
        this.tone(2637, t + 0.68, 0.9, 'sine', 0.035, 0.02);
        break;
      }
      case 'wave':
        this.marimba(783.99, t, 0.16);
        this.marimba(1046.5, t + 0.12, 0.16);
        break;
      case 'flutter':
        for (let i = 0; i < 4; i++) this.noise(t + i * 0.07, 0.05, 3200, 0.04);
        this.tone(1760, t + 0.05, 0.25, 'sine', 0.05, 0.01);
        break;
    }
  }

  private env(gain: GainNode, t: number, dur: number, peak: number, attack: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, peak: number, attack: number): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    this.env(gain, t, dur, peak, attack);
    osc.connect(gain).connect(this.master as GainNode);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private sweep(f0: number, f1: number, t: number, dur: number, type: OscillatorType, peak: number): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(gain, t, dur, peak, 0.005);
    osc.connect(gain).connect(this.master as GainNode);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private marimba(freq: number, t: number, peak: number): void {
    this.tone(freq, t, 0.55, 'sine', peak, 0.004);
    this.tone(freq * 4, t, 0.08, 'sine', peak * 0.25, 0.002);
  }

  private noise(t: number, dur: number, cutoff: number, peak: number): void {
    const ctx = this.ctx as AudioContext;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    this.env(gain, t, dur, peak, Math.min(0.03, dur / 3));
    src.connect(filter).connect(gain).connect(this.master as GainNode);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
