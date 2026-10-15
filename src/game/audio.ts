/**
 * The game's sound (PRD §7, docs/SOUND_PLAN.md): effects, music and voices
 * made with ElevenLabs and mastered by tools/audio/master.mjs into
 * public/assets/audio (audioManifest.json).
 *
 *   - Three channels the parents switch separately: effects, music, voices.
 *   - Files are fetched and decoded on first need (effects and music right
 *     after the first gesture); until an effect is ready, a small synthesised
 *     stand-in plays, so a tap is never silent.
 *   - One voice at a time (a new line stops the previous one); music dips under
 *     speech. Effects vary their pitch a little, so repeats never sound
 *     mechanical.
 *   - Starts only after a user gesture, suspends while the page is hidden. No
 *     error buzzers, nothing continuous while drawing, no music in a maze.
 */
import manifest from '../data/audioManifest.json';
import type { Lang } from '../domain/types';

export type Sfx = keyof typeof manifest.fx;
export type MusicId = keyof typeof manifest.music;
export type Speaker = 'bill' | 'tiny' | 'mazu' | 'rocky' | 'giganto' | 'narrator';
export interface Channels {
  effects: boolean;
  music: boolean;
  voices: boolean;
}
interface Clip {
  src: string;
  s: number;
}

const MUSIC_LEVEL = 0.8;
/** Voices sit a little under full level (owner, round 6: they stood out over everything). */
const VOICE_LEVEL = 0.7;
const DUCKED = 0.3;

/** Voice clips are looked up by the exact words shown (case and spacing aside). */
export function voiceKey(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

const VOICE_INDEX: Record<string, Map<string, Clip>> = {};
for (const [lang, speakers] of Object.entries(manifest.voice as Record<string, Record<string, Record<string, Clip>>>)) {
  for (const [speaker, lines] of Object.entries(speakers)) {
    for (const [text, clip] of Object.entries(lines)) (VOICE_INDEX[lang] ??= new Map()).set(`${speaker}|${voiceKey(text)}`, clip);
  }
}

/** The clip that says `text` in `speaker`'s voice, if there is one. */
export function voiceClip(lang: Lang, speaker: Speaker, text: string): Clip | null {
  return VOICE_INDEX[lang]?.get(`${speaker}|${voiceKey(text)}`) ?? null;
}

/** Every voice file of one language (to keep them for offline play). */
export function voiceFiles(lang: Lang): string[] {
  return [...(VOICE_INDEX[lang]?.values() ?? [])].map((c) => c.src);
}

const url = (src: string): string => `${import.meta.env.BASE_URL}${src}`;

export class SoundBoard {
  private ctx: AudioContext | null = null;
  private fxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duck: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private channels: Channels = { effects: true, music: true, voices: true };
  private unlocked = false;
  private hidden = false;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private ready = new Map<string, AudioBuffer>();
  private music: { id: MusicId; loop: boolean; node: AudioBufferSourceNode | null; gain: GainNode | null; token: number; at: number } | null = null;
  private ambience: { node: AudioBufferSourceNode | null; gain: GainNode | null; token: number } | null = null;
  private ambienceLevel = 0;
  private voice: AudioBufferSourceNode | null = null;
  private voiceToken = 0;
  private token = 0;
  private loops = new Map<Sfx, { node: AudioBufferSourceNode; gain: GainNode }>();

  setChannels(c: Channels): void {
    this.channels = { ...c };
    const ctx = this.ctx;
    if (!ctx || !this.fxBus || !this.musicBus || !this.voiceBus) return;
    this.fxBus.gain.setTargetAtTime(c.effects ? 1 : 0, ctx.currentTime, 0.03);
    this.musicBus.gain.setTargetAtTime(c.music ? MUSIC_LEVEL : 0, ctx.currentTime, 0.08);
    this.voiceBus.gain.setTargetAtTime(c.voices ? VOICE_LEVEL : 0, ctx.currentTime, 0.03);
    if (!c.voices) this.stopVoice();
    if (!c.effects) for (const id of [...this.loops.keys()]) this.stopLoop(id);
  }

  /** Effects off or on (the first switch; kept for the existing setting). */
  setMuted(muted: boolean): void {
    this.setChannels({ ...this.channels, effects: !muted });
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.unlocked && this.ctx?.state === 'running') return;
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.ratio.value = 2.5;
        comp.connect(ctx.destination);
        const bus = (level: number): GainNode => {
          const g = ctx.createGain();
          g.gain.value = level;
          g.connect(comp);
          return g;
        };
        this.fxBus = bus(this.channels.effects ? 1 : 0);
        this.voiceBus = bus(this.channels.voices ? VOICE_LEVEL : 0);
        this.duck = bus(1);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = this.channels.music ? MUSIC_LEVEL : 0;
        this.musicBus.connect(this.duck);
      }
      if (!this.hidden) void this.ctx.resume().then(() => this.resumed());
      this.unlocked = true;
      // Effects and music are small: decode them now, so they play on time.
      for (const c of Object.values(manifest.fx)) void this.load(c.src);
      for (const c of Object.values(manifest.music)) void this.load(c.src);
    } catch {
      // Audio unavailable: continue silently (the game never depends on sound).
      this.ctx = null;
    }
  }

  /**
   * Whether this browser lets sound start without a tap. Only browsers with
   * navigator.getAutoplayPolicy can tell in advance (Firefox); the others
   * (Safari, Chrome) are treated as needing a tap.
   */
  autoplayAllowed(): boolean {
    const nav = navigator as Navigator & { getAutoplayPolicy?: (type: 'audiocontext') => string };
    try {
      return nav.getAutoplayPolicy?.('audiocontext') === 'allowed';
    } catch {
      return false;
    }
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else if (this.unlocked) void this.ctx.resume();
  }

  private get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /**
   * Run `fn` once sound may play. Safari resumes the context asynchronously,
   * so a sound asked for by the very first tap waits for it instead of being lost.
   */
  private whenRunning(fn: () => void): void {
    const ctx = this.ctx;
    if (!ctx || this.hidden) return;
    if (ctx.state === 'running') fn();
    else if (this.unlocked) void ctx.resume().then(() => ctx.state === 'running' && fn(), () => undefined);
  }

  /** A loop that was asked for before the first gesture starts once sound is allowed. */
  private resumed(): void {
    const m = this.music;
    if (m && !m.node && (m.loop || performance.now() - m.at < 1500)) this.startMusic(m.id, m.loop, 1.5);
    if (this.ambience && !this.ambience.node) {
      this.ambience = null;
      this.setAmbience(this.ambienceLevel);
    }
  }

  private load(src: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    let p = this.buffers.get(src);
    if (!p) {
      p = fetch(url(src))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          this.ready.set(src, buf);
          return buf;
        })
        .catch(() => {
          // Offline without this file, or undecodable: try again next time.
          this.buffers.delete(src);
          return null;
        });
      this.buffers.set(src, p);
    }
    return p;
  }

  private source(buf: AudioBuffer, bus: AudioNode, gain = 1, rate = 1, pan = 0): { node: AudioBufferSourceNode; gain: GainNode } {
    const ctx = this.ctx as AudioContext;
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(g).connect(p).connect(bus);
    } else node.connect(g).connect(bus);
    return { node, gain: g };
  }

  /** An effect (`pan` −1 left … 1 right). A missing or not-yet-decoded file falls back to a synthesised stand-in. */
  play(id: Sfx, gain = 1, pan = 0): void {
    if (!this.channels.effects || !this.fxBus) return;
    if (!this.running) return this.whenRunning(() => this.play(id, gain, pan));
    const clip = manifest.fx[id];
    const buf = clip && this.ready.get(clip.src);
    if (buf) {
      this.source(buf, this.fxBus, gain, 0.97 + Math.random() * 0.06, pan).node.start();
      return;
    }
    if (clip) void this.load(clip.src);
    this.synth(id);
  }

  /** A looping effect (the sleepy friend's snore) until stopLoop. */
  loop(id: Sfx, gain = 1): void {
    if (!this.channels.effects || !this.running || !this.fxBus || this.loops.has(id)) return;
    const clip = manifest.fx[id];
    void this.load(clip.src).then((buf) => {
      if (!buf || this.loops.has(id) || !this.fxBus || !this.ctx) return;
      const s = this.source(buf, this.fxBus, 0);
      s.node.loop = true;
      s.gain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.4);
      s.node.start();
      this.loops.set(id, s);
    });
  }

  stopLoop(id: Sfx): void {
    const s = this.loops.get(id);
    if (!s || !this.ctx) return;
    this.loops.delete(id);
    s.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    s.node.stop(this.ctx.currentTime + 0.8);
  }

  /** A short tune on the effects channel (the win jingle is feedback, not background music). */
  jingle(id: MusicId): void {
    if (!this.channels.effects || !this.fxBus) return;
    if (!this.running) return this.whenRunning(() => this.jingle(id));
    const buf = this.ready.get(manifest.music[id].src);
    if (buf) this.source(buf, this.fxBus, 0.9).node.start();
    else {
      void this.load(manifest.music[id].src);
      this.synth('maze-arrive');
    }
  }

  /** Background music: replaces what plays (with a short fade); `loop` keeps it going. */
  playMusic(id: MusicId, loop = false, fadeIn = 0): void {
    if (this.music?.id === id && (this.music.node || !this.running)) return;
    this.stopMusic(0.4);
    this.music = { id, loop, node: null, gain: null, token: ++this.token, at: performance.now() };
    if (this.running) this.startMusic(id, loop, fadeIn);
  }

  private startMusic(id: MusicId, loop: boolean, fadeIn: number): void {
    const m = this.music;
    if (!m) return;
    const token = m.token;
    void this.load(manifest.music[id].src).then((buf) => {
      const ctx = this.ctx;
      if (!buf || !ctx || !this.musicBus || this.music?.token !== token || this.music.node) return;
      const s = this.source(buf, this.musicBus, fadeIn > 0 ? 0 : 1);
      s.node.loop = loop;
      if (fadeIn > 0) s.gain.gain.setTargetAtTime(1, ctx.currentTime, fadeIn / 3);
      s.node.onended = () => {
        if (this.music?.token === token) this.music = null;
      };
      s.node.start();
      this.music = { ...this.music, node: s.node, gain: s.gain };
    });
  }

  stopMusic(fade = 0.6): void {
    const m = this.music;
    this.music = null;
    if (!m?.node || !m.gain || !this.ctx) return;
    m.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    m.node.stop(this.ctx.currentTime + fade + 0.1);
  }

  /**
   * The rainforest around the game (music channel): full on the welcome
   * screen, quieter in the maze so the child still draws in the heart of the
   * jungle (owner, round 6); 0 stops it.
   */
  setAmbience(level: number): void {
    const ctx = this.ctx;
    this.ambienceLevel = level;
    if (level <= 0) {
      const a = this.ambience;
      this.ambience = null;
      if (a?.node && a.gain && ctx) {
        a.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        a.node.stop(ctx.currentTime + 1);
      }
      return;
    }
    if (this.ambience?.node) {
      if (ctx) this.ambience.gain?.gain.setTargetAtTime(level, ctx.currentTime, 0.6);
      return;
    }
    if (this.ambience) return;
    const token = ++this.token;
    this.ambience = { node: null, gain: null, token };
    if (!this.running) return;
    void this.load(manifest.fx.ambience.src).then((buf) => {
      if (!buf || !this.ctx || !this.musicBus || this.ambience?.token !== token) return;
      const s = this.source(buf, this.musicBus, 0);
      s.node.loop = true;
      s.gain.gain.setTargetAtTime(this.ambienceLevel, this.ctx.currentTime, 0.8);
      s.node.start();
      this.ambience = { node: s.node, gain: s.gain, token };
    });
  }

  /**
   * Say `text` in `speaker`'s voice. Returns the clip's length in seconds (0
   * when voices are off or the line has no clip), so bubbles can wait for it.
   */
  say(lang: Lang, speaker: Speaker, text: string): number {
    const clip = voiceClip(lang, speaker, text);
    if (!clip || !this.channels.voices || !this.ctx || this.hidden) return 0;
    this.stopVoice();
    const token = ++this.voiceToken;
    void this.load(clip.src).then((buf) => new Promise<AudioBuffer | null>((done) => (this.running ? done(buf) : this.whenRunning(() => done(buf))))).then((buf) => {
      const ctx = this.ctx;
      if (!buf || !ctx || !this.voiceBus || !this.duck || token !== this.voiceToken) return;
      const s = this.source(buf, this.voiceBus);
      this.voice = s.node;
      this.duck.gain.setTargetAtTime(DUCKED, ctx.currentTime, 0.08);
      s.node.onended = () => {
        if (token !== this.voiceToken) return;
        this.voice = null;
        this.duck?.gain.setTargetAtTime(1, ctx.currentTime, 0.25);
      };
      s.node.start();
    });
    return clip.s;
  }

  /** Fetch and decode lines that are about to be said, so they start on time. */
  prepare(lang: Lang, lines: Array<[Speaker, string]>): void {
    if (!this.ctx || !this.channels.voices) return;
    for (const [speaker, text] of lines) {
      const clip = voiceClip(lang, speaker, text);
      if (clip) void this.load(clip.src);
    }
  }

  stopVoice(): void {
    this.voiceToken++;
    const v = this.voice;
    this.voice = null;
    if (v) {
      try {
        v.stop();
      } catch {
        // already stopped
      }
    }
    if (this.ctx && this.duck) this.duck.gain.setTargetAtTime(1, this.ctx.currentTime, 0.25);
  }

  // ---------------------------------------------------------------------------
  // Synthesised stand-ins (the first version's sounds), until a file is ready.

  private synth(id: Sfx): void {
    if (!this.ctx || !this.fxBus) return;
    const t = this.ctx.currentTime + 0.005;
    switch (id) {
      case 'ui-wood':
      case 'ui-leaf':
        this.tone(660, t, 0.09, 'sine', 0.12, 0.004);
        break;
      case 'pop':
      case 'friend-tap':
        this.marimba(783.99, t, 0.09);
        this.marimba(1046.5, t + 0.1, 0.09);
        break;
      case 'maze-arrive':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.marimba(f, t + i * 0.1, 0.1));
        break;
      case 'bum':
        this.sweep(120, 48, t, 0.32, 'sine', 0.25);
        break;
      case 'bum-far':
        this.sweep(90, 42, t, 0.4, 'sine', 0.1);
        break;
      case 'toot':
        this.sweep(392, 440, t, 0.16, 'triangle', 0.07);
        this.sweep(523, 587, t + 0.17, 0.24, 'triangle', 0.07);
        break;
      default:
        if (id.startsWith('treasure-') || id === 'reward-fly' || id === 'badge' || id === 'chest') {
          [1568, 2093, 2637].forEach((f, i) => this.marimba(f, t + i * 0.07, 0.05));
        }
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
    osc.connect(gain).connect(this.fxBus as GainNode);
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
    osc.connect(gain).connect(this.fxBus as GainNode);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private marimba(freq: number, t: number, peak: number): void {
    this.tone(freq, t, 0.55, 'sine', peak, 0.004);
    this.tone(freq * 4, t, 0.08, 'sine', peak * 0.25, 0.002);
  }
}
