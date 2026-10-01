import type { Engine, Sfx } from "./engine";
import { WEATHER_INFO } from "./world";

type UiSound = "click" | "open" | "close" | "paper" | "confirm";

// Прогрессии: [корень в полутонах от A2, интервалы аккорда]
const PROGRESSIONS: Record<string, { root: number; chords: number[][]; dur: number }> = {
  bay: { root: 5, chords: [[0, 4, 7, 11, 14], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]], dur: 14 },
  cape: { root: 0, chords: [[0, 3, 7, 10, 14], [8, 12, 15, 19], [3, 7, 10, 14], [10, 14, 17, 21]], dur: 15 },
  fjord: { root: 7, chords: [[0, 3, 7, 14], [8, 12, 15, 19], [5, 8, 12, 15], [7, 10, 14, 17]], dur: 18 },
  reef: { root: 8, chords: [[0, 4, 7, 11, 18], [9, 12, 16, 19, 23], [5, 9, 12, 16], [7, 11, 14, 16]], dur: 13 },
  ocean: { root: 3, chords: [[0, 4, 7, 11, 14], [9, 12, 16, 19], [5, 9, 12, 16, 19], [7, 12, 14, 17]], dur: 16 },
  abyss: { root: 3, chords: [[0, 3, 7, 14], [8, 12, 15, 19], [5, 8, 12, 15, 20], [7, 12, 14, 17]], dur: 22 },
  estuary: { root: 2, chords: [[0, 4, 7, 14], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 19]], dur: 16 },
  skerries: { root: 10, chords: [[0, 3, 7, 10, 14], [5, 8, 12, 15], [3, 7, 10, 14], [7, 10, 14, 17]], dur: 17 },
  kelp: { root: 1, chords: [[0, 3, 7, 14], [10, 14, 17, 21], [8, 12, 15, 19], [5, 8, 12, 17]], dur: 18 },
  mangrove: { root: 6, chords: [[0, 4, 7, 9, 14], [5, 9, 12, 14], [2, 5, 9, 12], [7, 11, 14, 16]], dur: 14 },
  volcano: { root: 4, chords: [[0, 4, 7, 11], [2, 6, 9, 13], [9, 12, 16, 19], [5, 9, 12, 16, 19]], dur: 15 },
  antarctic: { root: 11, chords: [[0, 7, 14, 19], [5, 12, 17, 21], [8, 15, 19, 24], [3, 10, 15, 22]], dur: 24 },
};
const A2 = 110;
const hz = (semi: number) => A2 * Math.pow(2, semi / 12);

export class GameAudio {
  private ctx: BaseAudioContext | null = null;
  private muffle!: BiquadFilterNode;
  private limiter!: DynamicsCompressorNode;
  private master!: GainNode;
  private ambBus!: GainNode;
  private ambFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private uiBus!: GainNode;
  private verb!: ConvolverNode;
  private verbIn!: GainNode;
  private white!: AudioBuffer;
  private pink!: AudioBuffer;
  private brown!: AudioBuffer;

  private surfLow!: GainNode;
  private surfWashL!: GainNode;
  private surfWashR!: GainNode;
  private washFilter!: BiquadFilterNode;
  private windG!: GainNode;
  private windF!: BiquadFilterNode;
  private whistleG!: GainNode;
  private whistleF!: BiquadFilterNode;
  private rainHi!: GainNode;
  private rainLo!: GainNode;
  private drone!: GainNode;
  private engineG!: GainNode;
  private engineO!: OscillatorNode;
  private tensionG!: GainNode;
  private tensionO!: OscillatorNode;
  private tensionF!: BiquadFilterNode;
  private creakO!: OscillatorNode;
  private hidden = false;
  private creakG!: GainNode;
  private whirG!: GainNode;
  private whirO!: OscillatorNode;

  private waveT = 0;
  private wavePeriod = 7;
  private lapT = 1;
  private creakT = 3;
  private gullT = 6;
  private dropAcc = 0;
  private bubbleT = 1;
  private clickAcc = 0;
  private lastLine = 0;
  private chordT = 0;
  private chordIdx = 0;
  private musicKey = "";
  private pianoQueue: number[] = [];
  private updateAcc = 0;
  private active = true;

  enabled = true;
  music = true;
  volume = 0.8;

  get ready() { return !!this.ctx; }

  /** Можно передать внешний контекст (для офлайн-проверки) */
  init(ext?: BaseAudioContext) {
    if (this.ctx) {
      const c = this.ctx as AudioContext;
      if (c.state === "suspended" && !this.hidden && typeof c.resume === "function") void c.resume();
      return;
    }
    let ctx: BaseAudioContext;
    if (ext) ctx = ext;
    else {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: "interactive" });
    }
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    // мягкая компрессия + лимитер: никаких перегрузов при наложении событий
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.3;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.1;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = "lowpass";
    this.muffle.frequency.value = 20000;
    this.master.connect(this.muffle).connect(comp).connect(this.limiter).connect(ctx.destination);

    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.2, 2.4);
    this.verbIn = ctx.createGain();
    this.verbIn.gain.value = 1;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    this.verbIn.connect(this.verb).connect(verbOut).connect(this.master);

    this.ambFilter = ctx.createBiquadFilter();
    this.ambFilter.type = "lowpass";
    this.ambFilter.frequency.value = 18000;
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = this.enabled ? 1 : 0;
    this.ambBus.connect(this.ambFilter).connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.enabled ? 1 : 0;
    this.sfxBus.connect(this.master);
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.18;
    this.sfxBus.connect(sfxSend).connect(this.verbIn);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 9000;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.music && this.active ? 0.55 : 0;
    this.musicBus.connect(this.musicFilter);
    this.musicFilter.connect(this.master);
    const mSend = ctx.createGain();
    mSend.gain.value = 0.7;
    this.musicFilter.connect(mSend).connect(this.verbIn);

    this.uiBus = ctx.createGain();
    this.uiBus.gain.value = this.enabled ? 0.6 : 0;
    this.uiBus.connect(this.master);

    this.makeNoise();
    this.buildAmbience();
  }

  // ─────────── инфраструктура ───────────
  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.15 + t * 0.8;
        lp = lp + (Math.random() * 2 - 1 - lp) * (1 - k);
        const early = i < ctx.sampleRate * 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.8 : 0;
        d[i] = (lp * 1.6 + early) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  private makeNoise() {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    this.pink = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0), p = this.pink.getChannelData(0), b = this.brown.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
      b6 = x * 0.115926;
      last = (last + 0.02 * x) / 1.02;
      b[i] = last * 3.5;
    }
  }

  private loopSrc(buf: AudioBuffer) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(0, Math.random() * 2);
    return s;
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private gain(v = 0) {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    return g;
  }

  private pan(v: number) {
    const p = this.ctx!.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, v));
    return p;
  }

  private buildAmbience() {
    const ctx = this.ctx!;
    // низкий гул прибоя
    this.surfLow = this.gain();
    this.loopSrc(this.brown).connect(this.filter("lowpass", 320)).connect(this.surfLow).connect(this.ambBus);
    // шипение волн, стерео
    this.washFilter = this.filter("bandpass", 900, 0.6);
    const washSrc = this.loopSrc(this.pink);
    washSrc.connect(this.washFilter);
    this.surfWashL = this.gain();
    this.surfWashR = this.gain();
    this.washFilter.connect(this.surfWashL).connect(this.pan(-0.7)).connect(this.ambBus);
    const wf2 = this.filter("bandpass", 1300, 0.6);
    this.loopSrc(this.pink).connect(wf2).connect(this.surfWashR).connect(this.pan(0.7)).connect(this.ambBus);
    // ветер
    this.windF = this.filter("bandpass", 600, 0.8);
    this.windG = this.gain();
    this.loopSrc(this.pink).connect(this.windF).connect(this.windG).connect(this.pan(0.25)).connect(this.ambBus);
    this.whistleF = this.filter("bandpass", 1800, 14);
    this.whistleG = this.gain();
    this.loopSrc(this.white).connect(this.whistleF).connect(this.whistleG).connect(this.pan(-0.35)).connect(this.ambBus);
    // дождь
    this.rainHi = this.gain();
    this.loopSrc(this.white).connect(this.filter("highpass", 2600)).connect(this.filter("lowpass", 9000)).connect(this.rainHi).connect(this.ambBus);
    this.rainLo = this.gain();
    this.loopSrc(this.pink).connect(this.filter("lowpass", 700)).connect(this.rainLo).connect(this.ambBus);
    // подводный гул (минуя фильтр)
    this.drone = this.gain();
    this.loopSrc(this.brown).connect(this.filter("lowpass", 160, 1.2)).connect(this.drone).connect(this.master);
    // дизель
    this.engineO = ctx.createOscillator();
    this.engineO.type = "sawtooth";
    this.engineO.frequency.value = 36;
    this.engineG = this.gain();
    const eLfo = ctx.createOscillator();
    eLfo.frequency.value = 7.5;
    const eLfoG = this.gain(0.35);
    eLfo.connect(eLfoG);
    const eAm = this.gain(1);
    eLfoG.connect(eAm.gain);
    this.engineO.connect(this.filter("lowpass", 140, 1.5)).connect(eAm).connect(this.engineG).connect(this.ambBus);
    this.engineO.start();
    eLfo.start();
    // натяжение лески: «пение» натянутой лески на ветру — узкополосный шум, а не писк
    this.tensionF = this.filter("bandpass", 1400, 4);
    this.tensionG = this.gain();
    this.loopSrc(this.pink).connect(this.tensionF).connect(this.tensionG).connect(this.pan(0.2)).connect(this.sfxBus);
    this.tensionO = ctx.createOscillator();
    this.tensionO.frequency.value = 0;
    // скрип бланка: низкий пильный тон через резонанс с плавным «стоном»
    this.creakG = this.gain();
    const crO = ctx.createOscillator();
    crO.type = "sawtooth";
    crO.frequency.value = 62;
    this.creakO = crO;
    const crF = this.filter("bandpass", 620, 6);
    const crAm = this.gain(0.5);
    const crLfo = ctx.createOscillator();
    crLfo.frequency.value = 3.1;
    const crLfoG = this.gain(0.5);
    crLfo.connect(crLfoG).connect(crAm.gain);
    crO.connect(crF).connect(crAm).connect(this.creakG).connect(this.sfxBus);
    crO.start();
    crLfo.start();
    // шестерни катушки
    this.whirO = ctx.createOscillator();
    this.whirO.type = "sawtooth";
    this.whirO.frequency.value = 160;
    this.whirG = this.gain();
    this.whirO.connect(this.filter("bandpass", 1100, 3)).connect(this.whirG).connect(this.sfxBus);
    this.whirO.start();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambBus.gain.setTargetAtTime(on && this.active ? 1 : 0, t, 0.15);
    this.sfxBus.gain.setTargetAtTime(on && this.active ? 1 : 0, t, 0.15);
    this.uiBus.gain.setTargetAtTime(on && this.active ? 0.6 : 0, t, 0.15);
  }
  setMusic(on: boolean) {
    this.music = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on && this.active ? 0.55 : 0, this.ctx.currentTime, 0.5);
  }
  /** Вне игры процедурная среда молчит, но сам AudioContext не пересоздаётся. */
  setActive(on: boolean) {
    this.active = on;
    this.updateAcc = 0;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambBus.gain.setTargetAtTime(on && this.enabled ? 1 : 0, t, 0.18);
    this.sfxBus.gain.setTargetAtTime(on && this.enabled ? 1 : 0, t, 0.18);
    this.musicBus.gain.setTargetAtTime(on && this.music ? 0.55 : 0, t, 0.35);
    this.uiBus.gain.setTargetAtTime(on && this.enabled ? 0.6 : 0, t, 0.18);
  }
  /** Приглушение мира, пока открыто окно интерфейса */
  setMuffled(on: boolean) {
    if (this.ctx) this.muffle.frequency.setTargetAtTime(on ? 900 : 20000, this.ctx.currentTime, 0.25);
  }
  /** Вкладка скрыта — останавливаем звук полностью */
  setHidden(h: boolean) {
    this.hidden = h;
    const c = this.ctx as AudioContext | null;
    if (!c || typeof c.suspend !== "function") return;
    if (h) void c.suspend();
    else if (c.state !== "running") void c.resume();
  }
  get time() { return this.ctx?.currentTime ?? 0; }
  private warned = new Set<string>();
  /** Безопасная установка параметра: нечисловое значение не должно ронять кадр */
  private tgt(p: AudioParam, v: number, now: number, tc: number, label: string) {
    if (!Number.isFinite(v)) {
      if (!this.warned.has(label)) { this.warned.add(label); console.warn("[audio] non-finite", label); }
      return;
    }
    p.setTargetAtTime(v, now, tc);
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  // ─────────── примитивы звука ───────────
  private burst(o: { buf?: AudioBuffer; type: BiquadFilterType; f: number; f2?: number; q?: number; g: number; a?: number; d: number; at?: number; pan?: number; bus?: AudioNode }) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const s = ctx.createBufferSource();
    s.buffer = o.buf ?? this.white;
    const f = this.filter(o.type, o.f, o.q ?? 0.8);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    const g = this.gain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.g, t0 + (o.a ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    let node: AudioNode = s.connect(f).connect(g);
    if (o.pan) node = node.connect(this.pan(o.pan));
    node.connect(o.bus ?? this.sfxBus);
    s.start(t0, Math.random() * 2);
    s.stop(t0 + o.d + 0.05);
  }

  private osc(o: { type?: OscillatorType; f: number; f2?: number; g: number; a?: number; d: number; at?: number; pan?: number; bus?: AudioNode; curve?: "exp" | "lin" }) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const os = ctx.createOscillator();
    os.type = o.type ?? "sine";
    os.frequency.setValueAtTime(o.f, t0);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d * 0.9);
    const g = this.gain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.g, t0 + (o.a ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    let node: AudioNode = os.connect(g);
    if (o.pan) node = node.connect(this.pan(o.pan));
    node.connect(o.bus ?? this.sfxBus);
    os.start(t0);
    os.stop(t0 + o.d + 0.05);
  }

  /** Металлический звон: неcкратные обертоны */
  private metal(base: number, partials: number[], g: number, d: number, at = 0, bus?: AudioNode, pan = 0) {
    partials.forEach((p, i) => this.osc({ f: base * p, g: g / (i + 1.3), d: d * (1 - i * 0.12), at, bus, pan }));
  }

  /** «Фортепиано» — аддитивный синтез */
  private piano(freq: number, vel: number, at = 0, pan = 0) {
    const partials: [number, number, number][] = [[1, 1, 1], [2, 0.42, 0.7], [3, 0.2, 0.5], [4.02, 0.1, 0.35], [5.03, 0.05, 0.25]];
    const dur = 2.5 + (220 / freq) * 1.5;
    for (const [m, a, dk] of partials) this.osc({ f: freq * m, g: 0.06 * vel * a, a: 0.006, d: dur * dk, at, bus: this.musicBus, pan });
  }

  private splashDrops(n: number, spread: number, at = 0, g = 0.05) {
    for (let i = 0; i < n; i++) {
      const f = 1800 + Math.random() * 3200;
      this.osc({ f, f2: f * (1.3 + Math.random() * 0.5), g: g * (0.4 + Math.random() * 0.6), a: 0.002, d: 0.03 + Math.random() * 0.05, at: at + Math.random() * spread, pan: (Math.random() - 0.5) * 0.8 });
    }
  }

  private seagull(pan: number) {
    const ctx = this.ctx!;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 1300 + Math.random() * 500;
    const p = this.pan(pan);
    const g0 = this.gain(1);
    g0.connect(p).connect(this.ambBus);
    const send = this.gain(0.4);
    g0.connect(send).connect(this.verbIn);
    for (let i = 0; i < n; i++) {
      const t0 = ctx.currentTime + i * (0.32 + Math.random() * 0.12);
      const d = 0.24 + Math.random() * 0.12;
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modG = this.gain();
      car.frequency.setValueAtTime(base * 1.15, t0);
      car.frequency.linearRampToValueAtTime(base, t0 + d * 0.3);
      car.frequency.exponentialRampToValueAtTime(base * 0.7, t0 + d);
      mod.frequency.value = base * 0.5;
      modG.gain.setValueAtTime(base * 0.8, t0);
      modG.gain.linearRampToValueAtTime(base * 0.2, t0 + d);
      mod.connect(modG).connect(car.frequency);
      const g = this.gain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.022, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      car.connect(this.filter("bandpass", 2200, 1.2)).connect(g).connect(g0);
      car.start(t0);
      mod.start(t0);
      car.stop(t0 + d + 0.05);
      mod.stop(t0 + d + 0.05);
    }
  }

  ui(kind: UiSound) {
    if (!this.ctx || !this.enabled || !this.active) return;
    switch (kind) {
      case "click": this.burst({ type: "bandpass", f: 3200, q: 2, g: 0.08, d: 0.025, bus: this.uiBus }); break;
      case "open": this.burst({ buf: this.pink, type: "bandpass", f: 500, f2: 1400, q: 0.8, g: 0.07, a: 0.05, d: 0.22, bus: this.uiBus }); break;
      case "close": this.burst({ buf: this.pink, type: "bandpass", f: 1400, f2: 500, q: 0.8, g: 0.06, a: 0.02, d: 0.18, bus: this.uiBus }); break;
      case "paper":
        for (let i = 0; i < 5; i++) this.burst({ type: "bandpass", f: 2500 + Math.random() * 2500, q: 1.5, g: 0.05, a: 0.01, d: 0.06 + Math.random() * 0.06, at: i * 0.05 + Math.random() * 0.03, bus: this.uiBus });
        break;
      case "confirm":
        this.osc({ f: 180, f2: 120, g: 0.12, d: 0.18, bus: this.uiBus });
        this.burst({ type: "bandpass", f: 2400, q: 2, g: 0.05, d: 0.03, bus: this.uiBus });
        break;
    }
  }

  play(s: Sfx) {
    if (!this.ctx || !this.active) return;
    if (!this.enabled && !["catch", "newSpecies", "legend", "levelUp", "quest"].includes(s)) return;
    switch (s) {
      case "cast":
        this.burst({ buf: this.pink, type: "bandpass", f: 350, f2: 2600, q: 1.4, g: 0.22, a: 0.08, d: 0.38 });
        this.burst({ type: "highpass", f: 5000, g: 0.05, a: 0.05, d: 0.9, at: 0.1, pan: 0.3 });
        break;
      case "splash":
        this.osc({ f: 900, f2: 260, g: 0.12, d: 0.08 });
        this.burst({ type: "lowpass", f: 1800, f2: 500, g: 0.12, d: 0.22, pan: 0.2 });
        this.splashDrops(4, 0.25, 0.03, 0.03);
        break;
      case "jump":
        this.burst({ type: "lowpass", f: 3200, f2: 350, g: 0.4, a: 0.01, d: 0.8, pan: 0.2 });
        this.osc({ f: 90, f2: 40, g: 0.25, d: 0.35 });
        this.splashDrops(14, 0.8, 0.05, 0.05);
        break;
      case "bite":
        this.osc({ f: 540, f2: 170, g: 0.22, d: 0.13, pan: 0.25 });
        this.burst({ type: "lowpass", f: 1400, f2: 400, g: 0.08, d: 0.15, pan: 0.25 });
        this.osc({ f: 420, f2: 160, g: 0.1, d: 0.1, at: 0.17, pan: 0.25 });
        break;
      case "hook":
        this.burst({ buf: this.pink, type: "bandpass", f: 1600, f2: 250, q: 1.2, g: 0.3, a: 0.005, d: 0.16 });
        this.osc({ f: 120, f2: 48, g: 0.3, d: 0.25 });
        this.osc({ type: "triangle", f: 330, f2: 300, g: 0.06, d: 0.35 });
        break;
      case "perfect":
        this.metal(1318, [1, 2.76, 5.4], 0.03, 1.2, 0.05, this.musicBus);
        break;
      case "snap":
        this.burst({ type: "bandpass", f: 3200, q: 1.2, g: 0.3, a: 0.004, d: 0.05 });
        this.osc({ type: "triangle", f: 1100, f2: 110, g: 0.14, d: 0.4 });
        this.burst({ buf: this.pink, type: "bandpass", f: 900, f2: 200, g: 0.15, d: 0.3, at: 0.02 });
        break;
      case "escape":
        this.burst({ type: "lowpass", f: 1200, f2: 250, g: 0.12, d: 0.35, pan: 0.3 });
        this.osc({ type: "triangle", f: 200, f2: 150, g: 0.04, d: 0.3 });
        break;
      case "reelIn":
        for (let i = 0; i < 14; i++) this.burst({ type: "bandpass", f: 2400 + Math.random() * 400, q: 5, g: 0.05, d: 0.012, at: i * 0.035 });
        break;
      case "bottom":
        this.osc({ f: 70, f2: 45, g: 0.2, d: 0.3 });
        this.burst({ buf: this.brown, type: "lowpass", f: 700, g: 0.2, d: 0.2 });
        break;
      case "catch":
        this.landing();
        this.stinger([0, 7, 16], 0.8);
        break;
      case "newSpecies":
        this.landing();
        this.stinger([0, 7, 14, 19], 1);
        this.pad([0, 7, 16], 5, 0.018);
        break;
      case "legend":
        this.landing();
        this.pad([-12, 0, 7, 10, 15], 7, 0.03);
        this.stinger([0, 3, 7, 14, 19], 1.1, 0.6);
        this.metal(220, [1, 2.76, 5.4, 8.9], 0.05, 4, 0.2, this.musicBus);
        break;
      case "coins":
        for (let i = 0; i < 4; i++) this.metal(2900 + Math.random() * 900, [1, 1.47, 2.09], 0.035, 0.35, i * 0.07 + Math.random() * 0.03, this.uiBus, (Math.random() - 0.5) * 0.5);
        break;
      case "buy":
        this.osc({ f: 160, f2: 110, g: 0.12, d: 0.15, bus: this.uiBus });
        this.metal(2400, [1, 1.47, 2.09], 0.04, 0.4, 0.06, this.uiBus);
        break;
      case "event":
        this.metal(392, [1, 2.76, 5.4, 8.9], 0.05, 3.2, 0, this.musicBus, -0.3);
        break;
      case "thunder": {
        const d = 0.4 + Math.random() * 1.8;
        if (d < 0.8) this.burst({ type: "highpass", f: 1800, g: 0.25, a: 0.002, d: 0.12, at: d });
        this.burst({ buf: this.brown, type: "lowpass", f: 320, f2: 70, g: 0.7, a: 0.12, d: 4.5, at: d + 0.05 });
        for (let i = 0; i < 4; i++) this.burst({ buf: this.brown, type: "lowpass", f: 200, g: 0.35, a: 0.2, d: 1 + Math.random(), at: d + 0.3 + i * (0.4 + Math.random() * 0.5), pan: (Math.random() - 0.5) * 0.8 });
        break;
      }
      case "travel":
        this.osc({ type: "sawtooth", f: 42, f2: 80, g: 0.08, a: 0.3, d: 1.8 });
        this.burst({ buf: this.brown, type: "lowpass", f: 400, g: 0.2, a: 0.4, d: 1.8 });
        break;
      case "levelUp":
        this.piano(hz(19), 1, 0);
        this.piano(hz(26), 0.8, 0.14);
        this.metal(1760, [1, 2.76], 0.012, 2, 0.3, this.musicBus);
        break;
      case "quest":
        this.ui("paper");
        this.piano(hz(12), 0.8, 0.1);
        this.piano(hz(19), 0.7, 0.3);
        this.piano(hz(28), 0.6, 0.5);
        break;
      case "find":
        this.metal(540, [1, 2.4, 4.1], 0.08, 0.9);
        this.burst({ type: "lowpass", f: 1400, f2: 300, g: 0.1, d: 0.25 });
        break;
    }
  }

  private landing() {
    this.burst({ type: "lowpass", f: 1500, f2: 400, g: 0.25, a: 0.002, d: 0.14 });
    this.osc({ f: 150, f2: 80, g: 0.18, d: 0.14 });
    for (let i = 0; i < 3; i++) this.burst({ type: "lowpass", f: 900, g: 0.08, d: 0.06, at: 0.2 + i * (0.12 + Math.random() * 0.1) });
  }

  private stinger(semis: number[], vel: number, at = 0.1) {
    const root = PROGRESSIONS[this.musicKey]?.root ?? 5;
    semis.forEach((n, i) => this.piano(hz(root + 12 + n), vel * (1 - i * 0.08), at + i * 0.09, (i - semis.length / 2) * 0.15));
  }

  private pad(semis: number[], dur: number, g: number) {
    const ctx = this.ctx!;
    const root = PROGRESSIONS[this.musicKey]?.root ?? 5;
    const t0 = ctx.currentTime;
    const f = this.filter("lowpass", 400, 0.8);
    f.frequency.setValueAtTime(300, t0);
    f.frequency.linearRampToValueAtTime(2200, t0 + dur * 0.4);
    f.frequency.linearRampToValueAtTime(500, t0 + dur);
    const out = this.gain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(g, t0 + dur * 0.35);
    out.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    f.connect(out).connect(this.musicBus);
    for (const n of semis) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(root + n);
        o.detune.value = det;
        o.connect(f);
        o.start(t0);
        o.stop(t0 + dur + 0.1);
      }
    }
  }

  private playChord(e: Engine) {
    const ctx = this.ctx!;
    const prog = PROGRESSIONS[e.s.location] ?? PROGRESSIONS.bay;
    const night = e.isNight;
    const chord = prog.chords[this.chordIdx % prog.chords.length];
    this.chordIdx++;
    const dur = prog.dur * (night ? 1.25 : 1);
    const t0 = ctx.currentTime;
    const f = this.filter("lowpass", night ? 700 : 1100, 0.6);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.05;
    const lfoG = this.gain(night ? 200 : 380);
    lfo.connect(lfoG).connect(f.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 7);
    const out = this.gain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(0.028, t0 + 4.5);
    out.gain.setValueAtTime(0.028, t0 + dur);
    out.gain.linearRampToValueAtTime(0.0001, t0 + dur + 6);
    f.connect(out).connect(this.musicBus);
    const oct = night || e.s.location === "abyss" ? 0 : 12;
    chord.slice(0, night ? 3 : 4).forEach((n, i) => {
      for (const det of [-5, 6]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? "triangle" : "sawtooth";
        o.frequency.value = hz(prog.root + n + oct);
        o.detune.value = det + (Math.random() - 0.5) * 4;
        const vg = this.gain(i === 0 ? 1.4 : 0.6);
        o.connect(vg).connect(f);
        o.start(t0);
        o.stop(t0 + dur + 6.2);
      }
    });
    // бас
    this.osc({ f: hz(prog.root + chord[0] - 12), g: 0.035, a: 2.5, d: dur + 3, bus: this.musicBus });
    // рояль
    const tones = chord.map((n) => prog.root + n + 24);
    const count = night ? 2 : 3 + Math.floor(Math.random() * 3);
    this.pianoQueue = [];
    for (let i = 0; i < count; i++) this.pianoQueue.push(tones[Math.floor(Math.random() * tones.length)]);
    this.pianoQueue.forEach((n, i) => this.piano(hz(n + (Math.random() < 0.25 ? 12 : 0)), 0.45 + Math.random() * 0.35, 1.5 + i * (dur / (count + 1)) + Math.random() * 1.2, (Math.random() - 0.5) * 0.6));
    return dur;
  }

  // ─────────── кадр ───────────
  update(e: Engine, dt: number, under: number) {
    if (!this.ctx || !this.active) return;
    // Параметры ambience не требуют 60 обновлений в секунду. Ограничение
    // управляющего цикла до 30 Гц снижает число AudioParam-вызовов и частоту
    // рождения коротких rain/reel-узлов, не меняя само звучание.
    this.updateAcc += dt;
    if (this.updateAcc < 1 / 30) return;
    dt = this.updateAcc;
    this.updateAcc = 0;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const w = WEATHER_INFO[e.s.weather];
    const port = e.s.atPort;
    const calmEv = e.activeEvents.some((a) => a.id === "calm") ? 0.3 : 1;
    const waveAmp = w.wave * e.loc.waveMult * (e.spot.swell ?? 1) * calmEv;

    // волны: цикл набегания
    this.waveT += dt;
    if (this.waveT > this.wavePeriod) {
      this.waveT = 0;
      this.wavePeriod = 5 + Math.random() * 5 - Math.min(2.5, waveAmp);
    }
    const ph = this.waveT / this.wavePeriod;
    const env = ph < 0.55 ? Math.pow(ph / 0.55, 1.6) : Math.exp(-(ph - 0.55) * 5);
    const base = port ? 0.25 : 1;
    this.tgt(this.surfLow.gain, base * (0.08 + waveAmp * 0.08) * (0.6 + env * 0.5), now, 0.25, "surfLow#1");
    this.tgt(this.surfWashL.gain, base * (0.03 + waveAmp * 0.07) * env, now, 0.15, "surfWashL#2");
    this.surfWashR.gain.setTargetAtTime(base * (0.03 + waveAmp * 0.07) * Math.max(0, Math.sin((ph + 0.3) * Math.PI)) * 0.9, now, 0.15);
    this.tgt(this.washFilter.frequency, 700 + env * 900, now, 0.2, "washFilter#3");

    // ветер с порывами
    const gust = 0.55 + 0.45 * Math.sin(now * 0.37) * Math.sin(now * 0.13 + 1.3);
    const wind = e.s.wind + (e.s.weather === "storm" ? 0.35 : 0);
    this.tgt(this.windG.gain, port ? 0.01 : wind * 0.09 * gust, now, 0.4, "windG#4");
    this.tgt(this.windF.frequency, 380 + gust * 700 * (0.5 + wind), now, 0.4, "windF#5");
    this.tgt(this.whistleG.gain, port ? 0 : Math.max(0, wind - 0.5) * 0.018 * gust, now, 0.6, "whistleG#6");
    this.tgt(this.whistleF.frequency, 1500 + gust * 900, now, 0.5, "whistleF#7");

    // дождь
    const rain = e.s.weather === "storm" ? 1 : e.s.weather === "rain" ? 0.6 : e.s.weather === "snow" ? 0.05 : 0;
    this.tgt(this.rainHi.gain, port ? rain * 0.01 : rain * 0.06, now, 1, "rainHi#8");
    this.tgt(this.rainLo.gain, port ? rain * 0.03 : rain * 0.07, now, 1, "rainLo#9");
    if (rain > 0.3 && this.enabled && !port) {
      this.dropAcc += dt * rain * 16;
      while (this.dropAcc > 1) {
        this.dropAcc -= 1;
        const f = 2500 + Math.random() * 4500;
        this.osc({ f, f2: f * 0.7, g: 0.012 + Math.random() * 0.012, a: 0.001, d: 0.02, at: Math.random() * 0.05, pan: (Math.random() - 0.5) * 1.6, bus: this.ambBus });
      }
    }

    // под водой
    this.tgt(this.ambFilter.frequency, 18000 - under * 17400, now, 0.3, "ambFilter#10");
    this.tgt(this.musicFilter.frequency, 9000 - under * 6800, now, 0.4, "musicFilter#11");
    this.tgt(this.drone.gain, this.enabled ? under * 0.08 : 0, now, 0.4, "drone#12");
    if (under > 0.5 && this.enabled) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 0.4 + Math.random() * 2;
        const f = 300 + Math.random() * 500;
        this.osc({ f, f2: f * 2.2, g: 0.025 * under, a: 0.004, d: 0.06, pan: (Math.random() - 0.5) * 1.2, bus: this.master });
      }
    }

    // плеск о борт и скрип корпуса
    if (!port && this.enabled) {
      this.lapT -= dt;
      if (this.lapT <= 0) {
        this.lapT = 0.5 + Math.random() * 1.4 / (0.6 + waveAmp * 0.4);
        const f = 250 + Math.random() * 450;
        this.burst({ buf: this.pink, type: "bandpass", f, f2: f * 0.6, q: 2.5, g: (0.03 + waveAmp * 0.03) * (1 - under * 0.6), a: 0.02, d: 0.16 + Math.random() * 0.12, pan: -0.4 + Math.random() * 0.3, bus: this.ambBus });
      }
      this.creakT -= dt;
      if (this.creakT <= 0) {
        this.creakT = 4 + Math.random() * 9 / (0.5 + waveAmp);
        if (e.boat.tier <= 2) {
          const f = 70 + Math.random() * 60;
          const t0 = now;
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(f, t0);
          o.frequency.linearRampToValueAtTime(f * (1.2 + Math.random() * 0.4), t0 + 0.5);
          const bf = this.filter("bandpass", 700 + Math.random() * 500, 7);
          const g = this.gain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.018 * (0.5 + waveAmp * 0.5), t0 + 0.15);
          g.gain.linearRampToValueAtTime(0.0001, t0 + 0.6);
          o.connect(bf).connect(g).connect(this.pan(-0.5)).connect(this.ambBus);
          o.start(t0);
          o.stop(t0 + 0.7);
        }
      }
    }
    const tier = e.boat.tier;
    this.tgt(this.engineG.gain, !port && tier >= 2 && !e.paused ? 0.02 + (tier - 2) * 0.012 : 0, now, 0.8, "engineG#13");
    this.tgt(this.engineO.frequency, tier >= 4 ? 30 : 36, now, 1, "engineO#14");

    // чайки
    this.gullT -= dt;
    if (this.gullT <= 0) {
      const gullsEv = e.activeEvents.some((a) => a.id === "gulls" || a.id === "shoal");
      this.gullT = gullsEv ? 3 + Math.random() * 5 : 14 + Math.random() * 24;
      if (this.enabled && !port && !e.isNight && e.s.weather !== "storm" && under < 0.5 && (["bay", "cape", "reef"].includes(e.s.location) || gullsEv)) this.seagull((Math.random() - 0.3) * 1.4);
    }

    // снасть
    const h = e.hooked;
    if (h && e.phase === "fight" && !e.paused) {
      const dLine = h.line - this.lastLine;
      this.lastLine = h.line;
      const outRate = dLine > 0 ? dLine / Math.max(dt, 0.001) : 0;
      const inRate = dLine < 0 ? -dLine / Math.max(dt, 0.001) : 0;
      if (this.enabled) {
        const clicksPerSec = outRate > 0.05 ? Math.min(70, 18 + outRate * 14) : e.reeling ? Math.min(28, 8 + inRate * 4) : 0;
        this.clickAcc += dt * clicksPerSec;
        while (this.clickAcc > 1) {
          this.clickAcc -= 1;
          const drag = outRate > 0.05;
          this.burst({ type: "bandpass", f: drag ? 3600 + Math.random() * 600 : 2300 + Math.random() * 300, q: drag ? 6 : 4, g: drag ? 0.06 : 0.035, a: 0.0008, d: drag ? 0.01 : 0.014, at: Math.random() * 0.01, pan: 0.15 });
        }
      }
      const t = Math.min(1.2, h.tension);
      this.tgt(this.tensionG.gain, this.enabled ? Math.pow(Math.max(0, t - 0.5) * 1.6, 1.5) * 0.35 : 0, now, 0.06, "tensionG#15");
      this.tgt(this.tensionF.frequency, 700 + t * 1300, now, 0.08, "tensionF#16");
      this.tgt(this.creakG.gain, this.enabled ? Math.max(0, t - 0.75) * 0.55 : 0, now, 0.08, "creakG#17");
      this.tgt(this.creakO.frequency, 55 + t * 30, now, 0.1, "creakO#18");
      this.tgt(this.whirG.gain, this.enabled && e.reeling ? 0.012 : 0, now, 0.05, "whirG#19");
      this.tgt(this.whirO.frequency, 120 + e.reel.value * 30 + inRate * 6, now, 0.1, "whirO#20");
    } else {
      this.lastLine = 0;
      this.tgt(this.tensionG.gain, 0, now, 0.05, "tensionG#21");
      this.tgt(this.creakG.gain, 0, now, 0.05, "creakG#22");
      const sinking = e.phase === "sinking" && !e.paused;
      this.tgt(this.whirG.gain, this.enabled && sinking ? 0.006 : 0, now, 0.05, "whirG#23");
      if (sinking && this.enabled) {
        this.clickAcc += dt * 16;
        while (this.clickAcc > 1) {
          this.clickAcc -= 1;
          this.burst({ type: "bandpass", f: 3000, q: 5, g: 0.02, d: 0.01 });
        }
      }
    }

    // музыка
    const key = e.s.location;
    if (key !== this.musicKey) {
      this.musicKey = key;
      this.chordIdx = 0;
      this.chordT = Math.min(this.chordT, 2);
    }
    const duck = e.phase === "fight" ? 0.35 : port ? 1.15 : 1;
    this.tgt(this.musicBus.gain, this.music ? 0.55 * duck : 0, now, 1.2, "musicBus#24");
    this.chordT -= dt;
    if (this.chordT <= 0) {
      this.chordT = this.music ? this.playChord(e) : 4;
    }
  }
}
