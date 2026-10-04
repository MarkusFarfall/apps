/**
 * Звук экрана входа «Знакомой воды». Полностью процедурный WebAudio — ни одного файла.
 *
 *  Эмбиент:  два слоя волн, шипение пены, ветер, плеск о борт, скрип лодки,
 *            ночью — колокол буя и ревун маяка, на рассвете — чайки,
 *            тихий пэд (ночь — минор, рассвет — мажор) и редкие ноты «музыкальной шкатулки».
 *  Глубина:  под водой всё уходит в lowpass + гул; при всплытии — прорыв поверхности.
 *  События:  капли, пузыри, всплески, трещотка катушки, улов с колокольчиками.
 *  Интерфейс: капли при наборе текста, переливы при смене вкладки, заброс, ошибка.
 */

export interface SeaSfx {
  /** 0 — над водой, 1 — камера под водой */
  depth(u: number): void;
  /** натяжение лески 0..1 — трещотка катушки */
  tension(t: number): void;
  splash(power: number, pan: number): void;
  plip(pan: number, size?: number): void;
  bubbles(pan: number, n?: number): void;
  jump(pan: number, delay: number): void;
  landed(): void;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const NIGHT_CHORD = [110, 164.81, 196, 246.94, 261.63]; // Am(add9)
const DAWN_CHORD = [130.81, 196, 246.94, 293.66, 329.63]; // Cmaj9
const NIGHT_SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // ля-минорная пентатоника
const DAWN_SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66]; // до-мажорная пентатоника

interface NoiseOpts {
  t?: number;
  dur: number;
  type?: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  peak: number;
  pan?: number;
  verb?: number;
  a?: number;
  to?: AudioNode;
  brown?: boolean;
}

interface ToneOpts {
  t?: number;
  type?: OscillatorType;
  f0: number;
  f1?: number;
  glide?: number;
  dur: number;
  peak: number;
  pan?: number;
  verb?: number;
  a?: number;
  to?: AudioNode;
}

class AuthAudio implements SeaSfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private muffle!: BiquadFilterNode;
  private bus!: GainNode;
  private ui!: GainNode;
  private verbIn!: GainNode;
  private white!: AudioBuffer;
  private brown!: AudioBuffer;
  private padN!: GainNode;
  private padD!: GainNode;
  private wind!: GainNode;
  private under!: GainNode;
  private enabled: boolean;
  private failed = false;
  private active = true;
  private k = 0;
  private u = 1;
  private uSet = -1;
  private tens = 0;
  private last = { plip: 0, bubble: 0, key: 0 };
  private next: Record<'gull' | 'bell' | 'horn' | 'creak' | 'lap' | 'note', number> = {
    gull: 5,
    bell: 6,
    horn: 16,
    creak: 4,
    lap: 1,
    note: 2,
  };
  private volume = 0.8;

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('zv-sound');
    } catch {
      /* приватный режим */
    }
    this.enabled = saved !== 'off';
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else if (this.enabled && this.active) void this.ctx.resume();
      });
  }

  get isEnabled() {
    return this.enabled;
  }
  /** Звук реально играет (контекст разбужен жестом пользователя) */
  get isRunning() {
    return this.enabled && !!this.ctx && this.ctx.state === 'running';
  }

  private listeners = new Set<(running: boolean) => void>();
  subscribe(cb: (running: boolean) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  private emit() {
    const r = this.isRunning;
    this.listeners.forEach((f) => f(r));
  }

  /**
   * Вызывать из КАЖДОГО жеста пользователя, пока звук не заиграл.
   * На телефонах pointerdown не считается «разрешающим» жестом — нужен pointerup/touchend/click,
   * поэтому контекст будится повторно, а не один раз.
   */
  unlock(): boolean {
    if (!this.enabled || this.failed || typeof window === 'undefined') return false;
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) {
      this.failed = true;
      return false;
    }
    if (!this.ctx) {
      try {
        // iOS 16.4+: играть даже при беззвучном режиме
        const nav = navigator as unknown as { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
      } catch {
        /* ignore */
      }
      try {
        // 'playback' давал заметную задержку звука относительно картинки
        this.build(new AC({ latencyHint: 'balanced' }));
      } catch {
        this.failed = true;
        return false;
      }
    }
    const ctx = this.ctx!;
    if (ctx.state !== 'running') {
      ctx.resume().then(
        () => this.emit(),
        () => {},
      );
      // iOS Safari: проиграть тишину прямо внутри жеста — это «открывает» звук
      try {
        const b = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = b;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem('zv-sound', on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (on) {
      this.unlock();
      if (this.ctx) {
        void this.ctx.resume();
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(this.active ? this.volume : 0, now, 0.4);
      }
    } else if (this.ctx) {
      const c = this.ctx;
      this.master.gain.setTargetAtTime(0, c.currentTime, 0.12);
      setTimeout(() => {
        if (!this.enabled) void c.suspend();
      }, 600);
    }
    this.emit();
  }

  setMode(k: number) {
    this.k = k;
    if (this.ctx) this.applyMode(false);
  }

  /** Экран входа снова показан: начинаем «под водой» */
  reset() {
    this.active = true;
    this.u = 1;
    this.uSet = -1;
    this.tens = 0;
    if (this.ctx && this.enabled) {
      void this.ctx.resume();
      const now = this.ctx.currentTime;
      this.muffle.frequency.cancelScheduledValues(now);
      this.muffle.frequency.setValueAtTime(this.freqFor(1), now);
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.volume, now, 0.8);
    }
  }

  /** Экран входа ушёл: мягко гасим */
  fadeOut() {
    this.active = false;
    this.tens = 0;
    if (!this.ctx) return;
    const c = this.ctx;
    this.master.gain.setTargetAtTime(0, c.currentTime, 0.7);
    setTimeout(() => {
      if (!this.active) void c.suspend();
    }, 3000);
  }

  /* ─────────────── граф ─────────────── */

  private build(ctx: AudioContext) {
    this.ctx = ctx;
    ctx.onstatechange = () => this.emit();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.knee.value = 12;
    comp.attack.value = 0.008;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp).connect(ctx.destination);

    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.Q.value = 0.8;
    this.muffle.frequency.value = this.freqFor(this.u);
    this.muffle.connect(this.master);

    this.bus = ctx.createGain();
    this.bus.connect(this.muffle);
    this.ui = ctx.createGain();
    this.ui.gain.value = 0.9;
    this.ui.connect(this.master);

    // Дешёвое эхо: 4 линии задержки с затуханием в петле обратной связи.
    // ConvolverNode (свёртка с 2-секундным импульсом) на телефонах сам по себе забивал звуковой поток.
    this.verbIn = ctx.createGain();
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.32;
    verbOut.connect(this.muffle);
    const pre = this.filter('lowpass', 3800, 0.5);
    this.verbIn.connect(pre);
    (
      [
        [0.0437, -0.7],
        [0.0571, 0.7],
        [0.0797, -0.35],
        [0.1063, 0.35],
      ] as const
    ).forEach(([time, pan]) => {
      const d = ctx.createDelay(0.2);
      d.delayTime.value = time;
      const damp = this.filter('lowpass', 2600, 0.4);
      const fb = this.gain(0.62);
      pre.connect(d);
      d.connect(damp).connect(fb).connect(d);
      d.connect(this.panNode(pan)).connect(verbOut);
    });

    const len = ctx.sampleRate * 3;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0);
    const b = this.brown.getChannelData(0);
    let l = 0;
    for (let i = 0; i < len; i++) {
      const r = Math.random() * 2 - 1;
      w[i] = r;
      l = (l + 0.02 * r) / 1.02;
      b[i] = l * 3.5;
    }

    this.startAmbience();
    this.startPads();
    this.applyMode(true);
    this.master.gain.setTargetAtTime(this.active ? this.volume : 0, ctx.currentTime + 0.05, 1.2);
    window.setInterval(() => this.tick(), 60);
  }



  private freqFor(u: number) {
    return 380 * Math.pow(18000 / 380, 1 - clamp(u, 0, 1));
  }

  private panNode(v: number): AudioNode {
    const ctx = this.ctx!;
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(v, -1, 1);
      return p;
    }
    return ctx.createGain();
  }

  private loopSrc(buf: AudioBuffer) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(0, Math.random() * buf.duration);
    return s;
  }

  private lfo(freq: number, depth: number, target: AudioParam) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
  }

  private filter(type: BiquadFilterType, f: number, q = 1) {
    const n = this.ctx!.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    return n;
  }

  private gain(v: number) {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    return g;
  }

  private startAmbience() {
    const amb = this.gain(1);
    amb.connect(this.bus);

    // волны — два медленно дышащих слоя слева и справа
    (
      [
        [-0.55, 0.075, 520],
        [0.55, 0.11, 700],
      ] as const
    ).forEach(([p, f, cut]) => {
      const lp = this.filter('lowpass', cut, 0.7);
      this.lfo(f * 0.7, cut * 0.45, lp.frequency);
      const g = this.gain(0.22);
      this.lfo(f, 0.16, g.gain);
      this.loopSrc(this.brown).connect(lp).connect(g).connect(this.panNode(p)).connect(amb);
    });

    // шипение пены
    const fg = this.gain(0.018);
    this.lfo(0.09, 0.014, fg.gain);
    this.loopSrc(this.white).connect(this.filter('bandpass', 2400, 0.7)).connect(fg).connect(amb);

    // ветер
    const wb = this.filter('bandpass', 520, 1.4);
    this.lfo(0.045, 260, wb.frequency);
    this.wind = this.gain(0.04);
    this.lfo(0.06, 0.018, this.wind.gain);
    this.loopSrc(this.white).connect(wb).connect(this.wind).connect(this.panNode(0.25)).connect(amb);

    // подводный гул
    this.under = this.gain(this.u * 0.5);
    this.under.connect(this.bus);
    this.loopSrc(this.brown).connect(this.filter('lowpass', 180, 0.7)).connect(this.under);
    const hum = this.ctx!.createOscillator();
    hum.frequency.value = 48;
    hum.connect(this.gain(0.03)).connect(this.under);
    hum.start();
  }

  private startPads() {
    const music = this.gain(1);
    music.connect(this.bus);
    const mk = (freqs: number[]) => {
      const out = this.gain(0);
      const lp = this.filter('lowpass', 1100, 0.5);
      this.lfo(0.05, 400, lp.frequency);
      lp.connect(out);
      out.connect(music);
      const send = this.gain(0.35);
      out.connect(send).connect(this.verbIn);
      // по одному генератору на ноту (было по три с LFO) — в разы дешевле для слабых телефонов
      freqs.forEach((f, i) => {
        const o = this.ctx!.createOscillator();
        o.type = i % 2 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.detune.value = rand(-7, 7);
        o.connect(this.gain(0.07)).connect(lp);
        o.start();
      });
      this.lfo(0.07, 0.03, out.gain);
      return out;
    };
    this.padN = mk(NIGHT_CHORD);
    this.padD = mk(DAWN_CHORD);
  }

  private applyMode(instant: boolean) {
    const now = this.ctx!.currentTime;
    const tc = instant ? 0.01 : 1.4;
    this.padN.gain.setTargetAtTime((1 - this.k) * 0.1, now, tc);
    this.padD.gain.setTargetAtTime(this.k * 0.1, now, tc);
    this.wind.gain.setTargetAtTime(0.045 - this.k * 0.02, now, tc);
  }

  private ready() {
    return !!this.ctx && this.enabled && this.ctx.state === 'running';
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.active) return;
    const dt = 0.06;

    if (this.tens > 0.05 && Math.random() < this.tens * (this.tens > 0.95 ? 0.9 : 0.45)) this.ratchet(this.tens);

    const n = this.next;
    (Object.keys(n) as (keyof typeof n)[]).forEach((key) => (n[key] -= dt));
    if (n.lap <= 0) {
      this.lap();
      n.lap = rand(0.5, 2.2);
    }
    if (n.creak <= 0) {
      this.creak();
      n.creak = rand(5, 13);
    }
    if (n.gull <= 0) {
      if (this.k > 0.35 && this.u < 0.3) this.gull();
      n.gull = rand(4, 11);
    }
    if (n.bell <= 0) {
      this.buoy();
      n.bell = rand(9, 17);
    }
    if (n.horn <= 0) {
      if (this.k < 0.4) this.horn();
      n.horn = rand(30, 55);
    }
    if (n.note <= 0) {
      this.note();
      n.note = rand(2.2, 6);
    }
  }

  /* ─────────────── примитивы ─────────────── */

  private env(g: GainNode, t0: number, peak: number, a: number, d: number) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  /**
   * Общие шины: 5 позиций панорамы × (сухая / с эхом) × (сцена / интерфейс).
   * Раньше на каждый короткий звук создавались свой панорамер и отправка в эхо —
   * всплеск плодил по 40+ узлов, и звуковой поток захлёбывался.
   */
  private buses = new Map<string, AudioNode>();
  private static PANS = [-0.8, -0.4, 0, 0.4, 0.8];
  private dest(pan: number, verb: number, to?: AudioNode): AudioNode {
    const ui = to === this.ui;
    const wet = verb > 0.05;
    const idx = Math.round((clamp(pan, -1, 1) + 1) * 2);
    const key = `${ui ? 'u' : 'b'}${wet ? 1 : 0}${idx}`;
    let n = this.buses.get(key);
    if (!n) {
      const g = this.gain(1);
      const p = this.panNode(AuthAudio.PANS[idx]);
      g.connect(p);
      p.connect(to ?? this.bus);
      if (wet) p.connect(this.gain(0.45)).connect(this.verbIn);
      this.buses.set(key, g);
      n = g;
    }
    return n;
  }

  /** Ограничение одновременных голосов: лишние короткие звуки просто не создаём */
  private voices = 0;
  private claim(ui: boolean) {
    if (this.voices >= (ui ? 40 : 26)) return false;
    this.voices++;
    return true;
  }
  private release = () => {
    this.voices = Math.max(0, this.voices - 1);
  };
  /** Небольшой запас по времени: старт «в прошлом» даёт щелчки */
  private at(t?: number) {
    const now = this.ctx!.currentTime + 0.012;
    return t && t > now ? t : now;
  }

  private noise(o: NoiseOpts) {
    const ctx = this.ctx!;
    if (!this.claim(o.to === this.ui)) return;
    const t0 = this.at(o.t);
    const src = ctx.createBufferSource();
    src.buffer = o.brown ? this.brown : this.white;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 && o.f1 !== o.f0) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    const g = ctx.createGain();
    const a = o.a ?? Math.min(0.01, o.dur * 0.2);
    this.env(g, t0, o.peak, a, o.dur);
    src.connect(f).connect(g).connect(this.dest(o.pan ?? 0, o.verb ?? 0, o.to));
    src.onended = this.release;
    src.start(t0, Math.random() * 2);
    src.stop(t0 + a + o.dur + 0.1);
  }

  private tone(o: ToneOpts) {
    const ctx = this.ctx!;
    if (!this.claim(o.to === this.ui)) return;
    const t0 = this.at(o.t);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + (o.glide ?? o.dur));
    const g = ctx.createGain();
    const a = o.a ?? 0.005;
    this.env(g, t0, o.peak, a, o.dur);
    osc.connect(g).connect(this.dest(o.pan ?? 0, o.verb ?? 0, o.to));
    osc.onended = this.release;
    osc.start(t0);
    osc.stop(t0 + a + o.dur + 0.05);
  }

  private bell(f: number, t: number, peak: number, pan: number, verb: number, to?: AudioNode, bright = 1) {
    const parts: [number, number, number][] = [
      [1, 1, 2.6],
      [2, 0.45 * bright, 1.5],
      [2.76, 0.3 * bright, 1.1],
      [5.4, 0.12 * bright, 0.5],
      [8.93, 0.06 * bright, 0.3],
    ];
    // тихие обертоны не слышны, но стоят голосов — пропускаем
    for (const [r, a, d] of parts) if (a >= 0.1) this.tone({ t, f0: f * r, dur: d, peak: peak * a, pan, verb, a: 0.003, to });
  }

  private splashAt(t: number, power: number, pan: number, to?: AudioNode, vol = 1) {
    const p = clamp(power, 0.15, 1.6);
    this.noise({ t, dur: 0.18 + 0.5 * p, f0: 3200, f1: 420, q: 0.7, peak: 0.32 * p * vol, pan, verb: 0.3, to, a: 0.006 });
    this.noise({ t, dur: 0.09 + 0.08 * p, type: 'highpass', f0: 3500, q: 0.5, peak: 0.16 * p * vol, pan, to });
    this.tone({ t, f0: 150, f1: 48, dur: 0.22, peak: 0.22 * p * vol, pan, to });
    const drops = Math.round(2 + 4 * p);
    for (let i = 0; i < drops; i++) {
      const tt = t + 0.12 + Math.random() * (0.35 + 0.4 * p);
      const f = rand(900, 2200);
      this.tone({ t: tt, f0: f, f1: f * 2.2, glide: 0.04, dur: 0.05, peak: rand(0.015, 0.045) * vol, pan: pan + rand(-0.3, 0.3), verb: 0.2, to });
    }
  }

  /* ─────────────── эмбиент-события ─────────────── */

  private ratchet(t: number) {
    const now = this.ctx!.currentTime;
    const clicks = t > 0.95 ? 2 : 1;
    for (let i = 0; i < clicks; i++)
      this.noise({ t: now + i * 0.03 + Math.random() * 0.02, dur: 0.012, f0: rand(2600, 4200), q: 3, peak: 0.05 + 0.06 * t, pan: 0.2, a: 0.001 });
  }

  private lap() {
    const f = rand(500, 900);
    this.noise({ dur: rand(0.16, 0.32), f0: f, f1: f * 0.45, q: 1.6, peak: rand(0.035, 0.07), pan: rand(-0.3, 0.1), verb: 0.1, a: 0.02 });
    if (Math.random() < 0.5) this.tone({ f0: rand(80, 110), f1: 55, dur: 0.18, peak: 0.035, pan: -0.1 });
  }

  private creak() {
    const t0 = this.ctx!.currentTime;
    const n = Math.floor(rand(10, 17));
    const dur = rand(0.45, 0.9);
    const base = rand(500, 800);
    for (let i = 0; i < n; i++) {
      const q = i / n;
      const t = t0 + dur * Math.pow(q, 0.85) + rand(0, 0.008);
      this.noise({ t, dur: 0.014, f0: base * (1 + 0.25 * Math.sin(q * Math.PI)), q: 14, peak: 0.07 * Math.sin(q * Math.PI) + 0.01, pan: -0.15, verb: 0.08, a: 0.001 });
    }
  }

  private gull() {
    const ctx = this.ctx!;
    const pan = rand(-0.1, 0.9);
    const calls = Math.floor(rand(2, 5));
    const base = rand(1400, 1900);
    let t = ctx.currentTime;
    for (let c = 0; c < calls; c++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f0 = base * rand(0.95, 1.05);
      osc.frequency.setValueAtTime(f0 * 0.85, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.2, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + 0.32);
      const vib = ctx.createOscillator();
      vib.frequency.value = rand(24, 34);
      vib.connect(this.gain(f0 * 0.03)).connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.028, t + 0.03);
      g.gain.setValueAtTime(0.028, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(this.filter('bandpass', 2000, 2.5)).connect(g).connect(this.dest(pan, 0.7));
      osc.start(t);
      vib.start(t);
      osc.stop(t + 0.4);
      vib.stop(t + 0.4);
      t += rand(0.3, 0.45);
    }
  }

  private buoy() {
    const t = this.ctx!.currentTime;
    const f = rand(620, 700);
    this.bell(f, t, 0.03, -0.55, 0.9, undefined, 0.8);
    if (Math.random() < 0.6) this.bell(f, t + rand(0.7, 1.4), 0.022, -0.55, 0.9, undefined, 0.8);
  }

  private horn() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const lp = this.filter('lowpass', 320, 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.7);
    g.gain.setValueAtTime(0.045, t + 2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    [86, 86.6, 172.4].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(this.gain(i === 2 ? 0.3 : 1)).connect(lp);
      o.start(t);
      o.stop(t + 3.7);
    });
    lp.connect(g).connect(this.dest(-0.75, 1));
  }

  private note() {
    const t = this.ctx!.currentTime;
    const sc = this.k > 0.5 ? DAWN_SCALE : NIGHT_SCALE;
    const f = sc[Math.floor(Math.random() * sc.length)];
    this.bell(f, t, 0.018, rand(-0.6, 0.6), 0.8, undefined, 0.35);
    if (Math.random() < 0.35) {
      const f2 = sc[Math.floor(Math.random() * sc.length)];
      this.bell(f2, t + rand(0.25, 0.6), 0.013, rand(-0.6, 0.6), 0.8, undefined, 0.35);
    }
  }

  private breach() {
    const now = this.ctx!.currentTime;
    this.splashAt(now, 0.9, 0, this.ui, 0.6);
    this.noise({ dur: 0.9, type: 'lowpass', f0: 400, f1: 6000, q: 0.6, peak: 0.1, to: this.ui, a: 0.3 });
  }

  private plunge() {
    this.noise({ dur: 1.4, type: 'lowpass', f0: 5000, f1: 220, q: 0.8, peak: 0.22, to: this.ui, a: 0.04 });
    this.tone({ f0: 120, f1: 40, dur: 0.6, peak: 0.25, to: this.ui });
    this.bubbles(0, 14);
  }

  /* ─────────────── SeaSfx: события сцены ─────────────── */

  depth(u: number) {
    const prev = this.u;
    this.u = u;
    if (!this.ready()) return;
    if (Math.abs(u - this.uSet) > 0.008) {
      this.uSet = u;
      const now = this.ctx!.currentTime;
      this.muffle.frequency.setTargetAtTime(this.freqFor(u), now, 0.06);
      this.under.gain.setTargetAtTime(u * 0.5, now, 0.15);
    }
    if (prev > 0.5 && u <= 0.5) this.breach();
    else if (prev < 0.5 && u >= 0.5) this.plunge();
  }

  tension(t: number) {
    this.tens = t;
  }

  plip(pan: number, size = 1) {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    if (now - this.last.plip < 0.045) return;
    this.last.plip = now;
    const base = rand(700, 1300) / size;
    this.tone({ f0: base, f1: base * rand(2, 2.8), glide: 0.05, dur: 0.07 + 0.05 * size, peak: 0.09 * Math.min(1.4, size), pan, verb: 0.25 });
  }

  bubbles(pan: number, n = 1) {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    if (n === 1 && now - this.last.bubble < 0.035) return;
    this.last.bubble = now;
    let t = now;
    for (let i = 0; i < n; i++) {
      const f = rand(220, 520);
      this.tone({ t, f0: f, f1: f * rand(2.2, 3.2), glide: 0.04, dur: rand(0.03, 0.06), peak: rand(0.03, 0.06), pan: pan + rand(-0.15, 0.15) });
      t += rand(0.02, 0.06);
    }
  }

  splash(power: number, pan: number) {
    if (!this.ready()) return;
    this.splashAt(this.ctx!.currentTime, power, pan);
  }

  jump(pan: number, delay: number) {
    if (!this.ready()) return;
    this.splashAt(this.ctx!.currentTime + delay, 0.3, pan, undefined, 0.35);
  }

  landed() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone({ t, type: 'triangle', f0: 190, f1: 80, dur: 0.2, peak: 0.28, pan: -0.1 });
    this.noise({ t, dur: 0.12, type: 'lowpass', f0: 900, f1: 300, peak: 0.2, pan: -0.1 });
    [0.28, 0.5, 0.66, 0.8].forEach((d, i) =>
      this.tone({ t: t + d, type: 'triangle', f0: 240 - i * 15, f1: 110, dur: 0.07, peak: 0.08 / (i * 0.4 + 1), pan: -0.1 }),
    );
    const sc = this.k > 0.5 ? DAWN_SCALE : NIGHT_SCALE;
    [0, 2, 4, 6].forEach((ix, i) => this.bell(sc[ix], t + 0.18 + i * 0.12, 0.05, rand(-0.3, 0.3), 0.6, this.ui, 0.6));
    this.bell(sc[4] * 2, t + 0.75, 0.035, 0.2, 0.8, this.ui, 0.4);
  }

  /* ─────────────── интерфейс ─────────────── */

  key() {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    if (now - this.last.key < 0.03) return;
    this.last.key = now;
    this.noise({ dur: 0.016, f0: rand(1800, 3200), q: 2.5, peak: 0.03, pan: rand(0.1, 0.4), to: this.ui, a: 0.001 });
    const f = rand(1300, 1800);
    this.tone({ f0: f, f1: f * 1.6, glide: 0.03, dur: 0.04, peak: 0.014, pan: rand(0, 0.4), to: this.ui });
  }

  switchTab(toDawn: boolean) {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const sc = toDawn ? DAWN_SCALE : NIGHT_SCALE;
    const seq = toDawn ? [0, 2, 4, 5] : [5, 4, 2, 0];
    seq.forEach((ix, i) => this.bell(sc[ix], now + i * 0.07, 0.03, -0.3 + i * 0.2, 0.6, this.ui, 0.5));
    this.noise({ dur: 1.4, f0: toDawn ? 300 : 2400, f1: toDawn ? 2400 : 300, q: 0.8, peak: 0.05, to: this.ui, a: 0.5 });
  }

  cast() {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    this.noise({ dur: 0.4, f0: 700, f1: 3800, q: 2.2, peak: 0.11, pan: 0.35, to: this.ui, a: 0.12 });
    this.tone({ t: now + 0.05, type: 'triangle', f0: 1800, f1: 2600, dur: 0.25, peak: 0.015, pan: 0.4, to: this.ui });
  }

  error() {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    this.tone({ f0: 330, f1: 220, glide: 0.2, dur: 0.28, peak: 0.07, to: this.ui });
    this.tone({ t: now + 0.09, f0: 262, f1: 165, glide: 0.25, dur: 0.34, peak: 0.06, to: this.ui });
  }

  success() {
    if (!this.ready()) return;
    this.noise({ dur: 0.3, f0: 3800, f1: 600, q: 1.5, peak: 0.14, pan: 0.3, to: this.ui, a: 0.02 });
  }
}

export const authAudio = new AuthAudio();
