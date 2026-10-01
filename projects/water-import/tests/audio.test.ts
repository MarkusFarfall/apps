import assert from "node:assert/strict";
import test from "node:test";
import { GameAudio } from "../src/game/audio";
import type { Engine, Sfx } from "../src/game/engine";

/**
 * Звук проверяется на подставном BaseAudioContext: он считает созданные узлы и
 * записывает значения AudioParam. Это ловит регрессии, которые слышно, но не
 * видно в типах: немое меню, нечестный mute, «шторм узлов» и падение update().
 */

class Param {
  value: number;
  targets: number[] = [];
  constructor(v = 0) { this.value = v; }
  private chk(v: number, who: string) {
    if (!Number.isFinite(v)) throw new TypeError(`${who}: non-finite value ${v}`);
  }
  setValueAtTime(v: number) { this.chk(v, "setValueAtTime"); this.value = v; this.targets.push(v); return this; }
  setTargetAtTime(v: number) { this.chk(v, "setTargetAtTime"); this.value = v; this.targets.push(v); return this; }
  linearRampToValueAtTime(v: number) { this.chk(v, "linearRamp"); this.value = v; this.targets.push(v); return this; }
  exponentialRampToValueAtTime(v: number) {
    this.chk(v, "exponentialRamp");
    if (v === 0) throw new RangeError("exponentialRampToValueAtTime: ноль недостижим");
    this.value = v; this.targets.push(v); return this;
  }
  cancelScheduledValues() { return this; }
}

class MockNode {
  ctx: Ctx;
  constructor(ctx: Ctx) { this.ctx = ctx; }
  connect(target: unknown) { return target as never; }
  disconnect() { return this as never; }
}
class MockGain extends MockNode { gain = new Param(1); }
class MockOsc extends MockNode {
  frequency = new Param(440); detune = new Param(0); type: OscillatorType = "sine";
  onended: (() => void) | null = null;
  start() { /* noop */ } stop() { /* noop */ }
}
class MockBufSrc extends MockNode {
  buffer: unknown = null; loop = false; onended: (() => void) | null = null;
  start() { /* noop */ } stop() { /* noop */ }
}
class MockBiquad extends MockNode {
  type: BiquadFilterType = "lowpass";
  frequency = new Param(350); Q = new Param(1); gain = new Param(0); detune = new Param(0);
}
class MockPanner extends MockNode { pan = new Param(0); }
class MockComp extends MockNode {
  threshold = new Param(-24); knee = new Param(30); ratio = new Param(12);
  attack = new Param(0.003); release = new Param(0.25);
}
class MockConvolver extends MockNode { buffer: unknown = null; normalize = true; }
class MockBuffer {
  length: number; sampleRate: number; numberOfChannels: number;
  private data: Float32Array[];
  constructor(ch: number, len: number, sr: number) {
    this.numberOfChannels = ch; this.length = len; this.sampleRate = sr;
    this.data = Array.from({ length: ch }, () => new Float32Array(len));
  }
  getChannelData(i: number) { return this.data[i]; }
}

class Ctx {
  currentTime = 0;
  sampleRate = 8000;              // маленький sampleRate — тесты не ждут секунды
  state = "running";
  baseLatency = 0.02;
  destination = new MockNode(this);
  counts: Record<string, number> = {};
  private bump(k: string) { this.counts[k] = (this.counts[k] ?? 0) + 1; }
  total() { return Object.values(this.counts).reduce((a, b) => a + b, 0); }
  createGain() { this.bump("gain"); return new MockGain(this); }
  createOscillator() { this.bump("osc"); return new MockOsc(this); }
  createBufferSource() { this.bump("bufsrc"); return new MockBufSrc(this); }
  createBiquadFilter() { this.bump("biquad"); return new MockBiquad(this); }
  createStereoPanner() { this.bump("panner"); return new MockPanner(this); }
  createDynamicsCompressor() { this.bump("comp"); return new MockComp(this); }
  createConvolver() { this.bump("convolver"); return new MockConvolver(this); }
  createBuffer(ch: number, len: number, sr: number) { this.bump("buffer"); return new MockBuffer(ch, len, sr); }
}

type AnyAudio = GameAudio & Record<string, unknown>;
const bus = (a: GameAudio, name: string) => (a as unknown as Record<string, { gain: Param }>)[name].gain;

function stub(over: Record<string, unknown> = {}) {
  return {
    s: { weather: "clear", atPort: false, wind: 0.35, location: "bay" },
    activeEvents: [],
    loc: { waveMult: 0.6 },
    spot: { swell: 1 },
    isNight: false,
    boat: { tier: 1 },
    paused: false,
    hooked: null,
    phase: "waiting",
    reeling: false,
    reel: { value: 0.5 },
    ...over,
  } as unknown as Engine;
}

function makeAudio(quality = 2) {
  const ctx = new Ctx();
  const a = new GameAudio();
  a.enabled = true; a.music = true; a.volume = 0.8;
  a.init(ctx as unknown as BaseAudioContext);
  a.setQuality(quality);
  a.setActive(true); a.setEnabled(true); a.setMusic(true); a.setVolume(0.8);
  return { a: a as AnyAudio, ctx };
}

test("звук собирается и мир готов к кадру", () => {
  const { a } = makeAudio();
  const d = a.debug();
  assert.equal(d.ready, true);
  assert.equal(d.worldReady, true, "среда и реверб должны быть собраны");
});

test("интерфейс звучит вне игры: active не глушит клики", () => {
  const { a, ctx } = makeAudio();
  a.setActive(false);
  a.setUiActive(true);
  const before = ctx.total();
  a.ui("click");
  assert.ok(ctx.total() > before, "клик в меню обязан создавать узлы (раньше ui() выходил по !active)");
  assert.equal(bus(a, "ambBus").value, 0, "мир вне игры молчит");
  assert.equal(bus(a, "musicBus").value, 0, "музыка вне игры молчит");
  assert.ok(bus(a, "uiBus").value > 0, "шина интерфейса вне игры открыта");
});

test("выключенный звук глушит всё, включая музыку и фанфары", () => {
  const { a, ctx } = makeAudio();
  a.setEnabled(false);
  assert.equal(bus(a, "musicBus").value, 0, "музыка обязана уважать sound=off");
  const before = ctx.total();
  for (const s of ["catch", "newSpecies", "legend", "levelUp", "quest"] as Sfx[]) a.play(s);
  assert.equal(ctx.total(), before, "фанфары не должны звучать при выключенном звуке");
});

test("update() не падает на повреждённом сохранении", () => {
  const { a } = makeAudio();
  const broken: Record<string, unknown>[] = [
    { loc: undefined },
    { boat: undefined },
    { spot: undefined },
    { activeEvents: undefined },
    { loc: { waveMult: NaN } },
    { s: { weather: "blizzard", atPort: false, wind: 0.3, location: "bay" } },
    { s: { weather: "clear", atPort: false, wind: NaN, location: "atlantis" } },
    { s: { weather: "clear", atPort: false, wind: 0.3, location: "bay" }, hooked: { line: NaN, tension: NaN }, phase: "fight", reeling: true },
  ];
  for (const over of broken) {
    assert.doesNotThrow(() => {
      a.update(stub(over), 0.05, 0.4);
      a.update(stub(over), 0.05, 0.4);
    }, `update() бросил на ${JSON.stringify(over).slice(0, 90)}`);
  }
});

test("бюджет голосов: шторм событий не плодит тысячи узлов", () => {
  const { a, ctx } = makeAudio();
  const before = ctx.total();
  for (let i = 0; i < 200; i++) a.play("reelIn");   // 14 щелчков на вызов
  const created = ctx.total() - before;
  assert.ok(created > 0, "звук должен создаваться");
  assert.ok(created < 400, `без бюджета было бы ~8400 узлов, получено ${created}`);

  // голоса истекают со временем — звук не глохнет навсегда
  ctx.currentTime += 2;
  const mid = ctx.total();
  a.play("reelIn");
  assert.ok(ctx.total() > mid, "после истечения голосов звук снова создаётся");
});

test("латка качества: телефонный режим дешевле в шторм", () => {
  const storm = (quality: number) => {
    const { a, ctx } = makeAudio(quality);
    const engine = stub({ s: { weather: "storm", atPort: false, wind: 0.95, location: "bay" } });
    const before = ctx.total();
    for (let i = 0; i < 600; i++) { ctx.currentTime += 1 / 60; a.update(engine, 1 / 60, 0); }
    return ctx.total() - before;
  };
  const full = storm(2);
  const mobile = storm(1);
  assert.ok(full > 0 && mobile > 0, "шторм должен рождать события в обоих режимах");
  assert.ok(mobile < full, `мобильный режим обязан быть дешевле: ${mobile} против ${full}`);
});

test("AudioContext создаётся с latencyHint=playback (больше буфер — меньше дропаутов)", () => {
  let opts: unknown = null;
  class FakeAC extends Ctx {
    constructor(o?: unknown) { super(); opts = o; }
  }
  const g = globalThis as unknown as { window?: unknown };
  g.window = { AudioContext: FakeAC };
  try {
    const a = new GameAudio();
    a.init();
    assert.deepEqual(opts, { latencyHint: "playback" });
  } finally {
    delete g.window;
  }
});

test("дакинг: событие прибирает фон, а не наращивает общий уровень", () => {
  const { a } = makeAudio();
  const g = bus(a, "ambBus");
  const before = g.value;
  assert.ok(before > 0, "фон включён");
  g.targets.length = 0;
  a.play("cast");
  // Подставной параметр применяет таргеты сразу, поэтому смотрим их историю:
  // дакинг обязан коротко опустить фон ниже исходного уровня и вернуть обратно.
  assert.ok(g.targets.some((t) => t < before), `фон должен прибираться: таргеты ${JSON.stringify(g.targets)} при базе ${before}`);
  assert.equal(g.targets[g.targets.length - 1], before, "после дакинга фон возвращается к прежнему уровню");
});
