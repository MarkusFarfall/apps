"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { GameAudio } from "@/game/audio";
import { depthToU, Engine, newSave, uToDepth, type TravelMode, type Trip } from "@/game/engine";
import { FISH } from "@/game/fish";
import { clearLocal, deleteRemote, fetchMe, loadLocal, loadRemote, logCatch, logout as apiLogout, pickNewest, saveLocal, saveRemote, type AccountUser } from "@/game/persist";
import { AccountBadge, ProfileModal, type AccountState } from "./Account";
import { AuthScreen } from "./AuthScreen";
import { MILESTONES } from "@/game/world";
import { CAM_MODES, Scene, type CamMode } from "@/game/render/scene";
import { PortScene, type Building } from "@/game/render/port";
import { installCanvasGuards, setFonts } from "@/game/render/util";
import type { BaitId, SaveData } from "@/game/types";
import { BAITS, EVENT_BY_ID, PORT_BY_ID, SEASONS, WEATHER_INFO, spotsOf } from "@/game/world";
import { BaitIcon, EVENT_ICON, Icon, MoonIcon, WEATHER_ICON } from "./Icons";
import { DailyTracker, FindModal, JournalModal, LetterModal, QuestTracker, XpBar, type Settings } from "./Journal";
import { CatchModal, CodexModal, fmt, PortModal, type PortTab } from "./Panels";
import { TravelChoice, TravelOverlay } from "./Travel";
import { PortHub } from "./PortHub";

const CAM_NAMES: Record<CamMode, string> = { auto: "авто", surface: "поверхность", hook: "за снастью", bottom: "дно" };
const MOON_NAMES = ["Новолуние", "Молодая луна", "Первая четверть", "Прибывающая", "Полнолуние", "Убывающая", "Последняя четверть", "Старая луна"];
const SETTINGS_KEY = "zv_settings";
const DEFAULT_SETTINGS: Settings = { quality: 2, sound: true, music: true, volume: 0.8 };

type Boot = { state: "loading" } | { state: "auth" } | { state: "title"; save: SaveData | null };

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine0] = useState(() => new Engine());
  const engineRef = useRef<Engine>(engine0);
  const [scene0] = useState(() => new Scene());
  const sceneRef = useRef<Scene>(scene0);
  const [portScene0] = useState(() => new PortScene());
  const portSceneRef = useRef<PortScene>(portScene0);
  const [audio0] = useState(() => new GameAudio());
  const audioRef = useRef<GameAudio>(audio0);
  const pidRef = useRef<string>("");
  const [boot, setBoot] = useState<Boot>({ state: "loading" });
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<null | "codex" | "port" | "journal">(null);
  const [letter, setLetter] = useState<number | null>(null);
  const [tripReq, setTripReq] = useState<Trip | null>(null);
  const [travelling, setTravelling] = useState<{ trip: Trip; mode: TravelMode } | null>(null);
  const [portTab, setPortTab] = useState<PortTab>("market");
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [touch, setTouch] = useState(false);
  const [view, setView] = useState({ compact: false, land: true });
  const [info, setInfo] = useState(false);
  const [account, setAccount] = useState<AccountState>({ user: null, stats: null, offline: false });
  const [authOpen, setAuthOpen] = useState<null | "profile">(null);
  const [camMode, setCamModeState] = useState<CamMode>("auto");
  const [cloud, setCloud] = useState<string>("проверка…");
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [name, setName] = useState("");
  const lastRemote = useRef(0);
  const remoteDirty = useRef(false);

  const engine = engine0;
  const audio = audio0;
  useEffect(() => {
    const w = window as unknown as { __zv?: Engine; __zvAudio?: typeof GameAudio };
    w.__zv = engine;
    w.__zvAudio = GameAudio;
    const vis = () => audioRef.current.setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [engine]);

  /** Лучшее из локального и серверного сохранения профиля */
  const loadBest = useCallback(async (pid: string) => {
    const local = loadLocal(pid);
    const remote = await loadRemote(pid);
    setCloud(remote === undefined ? "только на устройстве" : "сервер и устройство");
    const best = pickNewest(local, remote);
    engineRef.current.s = best ?? newSave();
    engineRef.current.phase = "idle";
    return best;
  }, []);

  // Настройки и данные устройства доступны только в браузере, поэтому читаются при монтировании
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    installCanvasGuards();
    const cs = getComputedStyle(document.documentElement);
    setFonts(cs.getPropertyValue("--font-text").trim(), cs.getPropertyValue("--font-display").trim());
    try {
      const cm = localStorage.getItem("zv_cam") as CamMode | null;
      if (cm && CAM_MODES.includes(cm)) { sceneRef.current.camMode = cm; setCamModeState(cm); }
    } catch { /* ignore */ }
    let st = DEFAULT_SETTINGS;
    try {
      const a = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<Settings> | null;
      if (a) st = { ...DEFAULT_SETTINGS, ...a };
      else if ((navigator.hardwareConcurrency ?? 8) <= 4 || window.matchMedia("(pointer: coarse)").matches) st = { ...st, quality: 1 };
    } catch { /* ignore */ }
    setSettingsState(st);
    audioRef.current.enabled = st.sound;
    audioRef.current.music = st.music;
    audioRef.current.volume = st.volume;
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const onResize = () => setView({ compact: window.innerWidth < 820 || window.innerHeight < 560, land: window.innerWidth >= window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    (async () => {
      const me = await fetchMe();
      // Гостевого режима нет: без аккаунта показываем вход.
      if ("offline" in me) {
        setAccount((a) => ({ ...a, offline: true }));
        engineRef.current.s = newSave();
        setBoot({ state: "auth" });
        return;
      }
      if (!me.user || !me.playerId) {
        engineRef.current.s = newSave();
        setBoot({ state: "auth" });
        return;
      }
      pidRef.current = me.playerId;
      setAccount({ user: me.user, stats: me.stats, offline: false });
      const best = await loadBest(me.playerId);
      setName(best?.name ?? me.user.username);
      setBoot({ state: "title", save: best });
    })();
  }, [loadBest]);
  /* eslint-enable react-hooks/set-state-in-effect */


  const unlockAudio = useCallback(() => audioRef.current.init(), []);

  const setSettings = useCallback((st: Settings) => {
    setSettingsState(st);
    audioRef.current.setEnabled(st.sound);
    audioRef.current.setMusic(st.music);
    audioRef.current.setVolume(st.volume);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(st));
  }, []);

  const persist = useCallback(async (remote: boolean) => {
    const e = engineRef.current;
    const pid = pidRef.current;
    saveLocal(pid, e.s);
    if (!remote || !pid) return;
    const r = await saveRemote(pid, e.s);
    if (r.ok) {
      setCloud("сервер и устройство");
      remoteDirty.current = false;
    } else if (r.conflict) {
      // на сервере более свежий прогресс (другое устройство)
      const keep = confirm("На сервере найден более поздний прогресс с другого устройства.\n\nОК — загрузить прогресс с сервера.\nОтмена — перезаписать сервер текущим.");
      if (keep) {
        e.s = r.conflict;
        e.phase = "idle";
        saveLocal(pid, e.s);
        e.toast("Загружен прогресс с сервера", "info");
      } else {
        await saveRemote(pid, e.s, true);
      }
      remoteDirty.current = false;
    } else if (r.unauthorized) {
      setCloud("требуется вход");
    } else setCloud("только на устройстве");
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await fetchMe();
    if ("offline" in me) return;
    setAccount({ user: me.user, stats: me.stats, offline: false });
  }, []);

  const onAuthed = useCallback(async (user: AccountUser, playerId: string, mode: "login" | "register") => {
    const e = engineRef.current;
    setAuthOpen(null);
    setAccount({ user, stats: null, offline: false });
    pidRef.current = playerId;
    if (mode === "register") {
      // новая учётная запись: имя рыбака берём из имени пользователя, если своё ещё не задано
      if (!e.s.name || e.s.name === "Рыбак") e.s.name = user.username;
      saveLocal(playerId, e.s);
      await saveRemote(playerId, e.s, true);
      setBoot({ state: "title", save: e.s });
      e.toast("Учётная запись создана", "good", "Прогресс сохраняется на сервере");
    } else {
      const best = await loadBest(playerId);
      if (!best) {
        e.s = newSave(user.username);
        await saveRemote(playerId, e.s, true);
      }
      setBoot({ state: "title", save: best ?? e.s });
      e.toast(`С возвращением, ${user.username}`, "good");
    }
    setName(e.s.name);
    void refreshMe();
  }, [loadBest, refreshMe]);

  /** Выход: сохраняем прогресс на сервер и возвращаемся на экран входа. */
  const onLogout = useCallback(async () => {
    await persist(true);
    await apiLogout();
    setAccount({ user: null, stats: null, offline: false });
    setAuthOpen(null);
    pidRef.current = "";
    engineRef.current.s = newSave();
    engineRef.current.phase = "idle";
    setBoot({ state: "auth" });
    setPlaying(false);
    setPanel(null);
    setTravelling(null);
    setTripReq(null);
    setLetter(null);
  }, [persist]);

  const onDeleted = useCallback(async () => {
    clearLocal(pidRef.current);
    setAccount({ user: null, stats: null, offline: false });
    setAuthOpen(null);
    pidRef.current = "";
    engineRef.current.s = newSave();
    engineRef.current.phase = "idle";
    setBoot({ state: "auth" });
    setPlaying(false);
    setPanel(null);
  }, []);

  const setCamMode = useCallback((m: CamMode) => {
    sceneRef.current.camMode = m;
    setCamModeState(m);
    try { localStorage.setItem("zv_cam", m); } catch { /* ignore */ }
  }, []);
  const cycleCam = useCallback(() => {
    const i = CAM_MODES.indexOf(sceneRef.current.camMode);
    const m = CAM_MODES[(i + 1) % CAM_MODES.length];
    setCamMode(m);
    engineRef.current.toast(`Камера: ${CAM_NAMES[m]}`, "info");
  }, [setCamMode]);

  useEffect(() => {
    const unsub = engine.subscribe(force);
    engineRef.current.onCatchLogged = (c) => { if (pidRef.current) logCatch(pidRef.current, c); };
    const iv = setInterval(() => {
      force();
      if (playing) engine.refreshDaily();
      if (engine.dirty && playing) {
        engine.dirty = false;
        remoteDirty.current = true;
        saveLocal(pidRef.current, engine.s);
      }
      if (playing && remoteDirty.current && Date.now() - lastRemote.current > 25000) {
        lastRemote.current = Date.now();
        persist(true);
      }
    }, 1000);
    const onHide = () => { if (playing && document.visibilityState !== "visible") { saveLocal(pidRef.current, engine.s); if (pidRef.current) void saveRemote(pidRef.current, engine.s); } };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsub();
      clearInterval(iv);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [engine, playing, persist]);

  const quality = settings.quality;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let W = 0, H = 0;
    sceneRef.current.quality = quality;
    const resize = () => {
      const dpr = quality >= 2 ? Math.min(2, window.devicePixelRatio || 1) : quality === 1 ? Math.min(1.5, window.devicePixelRatio || 1) : 1;
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const e = engineRef.current;
      e.update(dt);
      const a = audioRef.current;
      const scene = sceneRef.current;
      // Размер canvas может оказаться нулевым (окно свёрнуто, элемент ещё не разложен).
      // Рисовать в этом случае нечего, но цикл обязан выжить: следующий кадр
      // планируется в любом случае, иначе игра «замерзает» до перезапуска.
      if (W > 0 && H > 0) {
        if (e.s.atPort) portSceneRef.current.render(ctx, e, W, H, dt);
        else scene.render(ctx, e, W, H, dt);
        if (a.ready) {
          while (e.sfx.length) a.play(e.sfx.shift()!);
          const under = Math.max(0, Math.min(1, (scene.camY - H * 0.05) / (H * 0.35)));
          a.update(e, dt, under);
        } else e.sfx.length = 0;
      } else {
        e.sfx.length = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [quality]);

  useEffect(() => {
    engineRef.current.paused = !playing || panel !== null || letter !== null || authOpen !== null || boot.state === "auth" || engine.s.atPort || !!travelling || !!tripReq;
    audioRef.current.setMuffled(playing && (panel !== null || letter !== null || authOpen !== null));
  }, [engine, playing, panel, letter, authOpen, travelling, tripReq, engine.s.atPort, boot.state]);

  const openPanel = useCallback((p: "codex" | "journal") => {
    audioRef.current.ui("open");
    setPanel((cur) => (cur === p ? null : cur === "port" ? cur : p));
  }, []);
  const closePanel = useCallback(() => { audioRef.current.ui("close"); setPanel(null); }, []);
  const openPort = useCallback(() => {
    if (engine.s.atPort) return;
    if (engine.phase === "fight" || engine.phase === "bite" || engine.phase === "caught") { engine.toast("Сначала закончите с рыбой", "bad"); return; }
    audioRef.current.ui("open");
    setTripReq({ kind: "port", port: engine.nearestPort() });
  }, [engine]);
  const requestTrip = useCallback((t: Trip) => { audioRef.current.ui("click"); setPanel(null); setTripReq(t); }, []);
  const startTrip = useCallback((mode: TravelMode) => {
    if (!tripReq) return;
    audioRef.current.play("travel");
    setTravelling({ trip: tripReq, mode });
    setTripReq(null);
  }, [tripReq]);
  const finishTrip = useCallback(() => {
    if (!travelling) return;
    engine.travel(travelling.trip, travelling.mode);
    setTravelling(null);
    void persist(true);
  }, [engine, travelling, persist]);
  const openBuilding = useCallback((b: Building | "dock" | "map" | "orders") => {
    audioRef.current.ui("open");
    const tab: PortTab = b === "market" ? "market" : b === "shop" ? "gear" : b === "shipyard" ? "boats" : b === "tavern" ? "rest" : b === "orders" ? "orders" : "map";
    setPortTab(tab);
    setPanel("port");
  }, []);
  const openLetter = useCallback(() => {
    if (engine.s.quest >= 20) { openPanel("journal"); return; }
    audioRef.current.ui("paper");
    engineRef.current.hasLetter = false;
    setLetter(engine.s.quest);
  }, [engine, openPanel]);

  useEffect(() => {
    if (!playing) return;
    const down = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) {
        if (ev.code !== "Escape") return;
        tgt.blur();
      }
      unlockAudio();
      if (travelling) return;
      if (ev.code === "Space") { ev.preventDefault(); if (!ev.repeat && !panel && !letter && !engine.lastCatch && !engine.lastFind && !engine.s.atPort && !tripReq) engine.pointerDown(); }
      else if (ev.code === "KeyC") openPanel("codex");
      else if (ev.code === "KeyJ") openPanel("journal");
      else if (ev.code === "KeyP" && !panel) openPort();
      else if (ev.code === "KeyV" && !panel) cycleCam();
      else if (ev.code === "KeyM") setSettings({ ...settings, sound: !settings.sound });
      else if (ev.code === "Escape") { if (authOpen) setAuthOpen(null); else if (tripReq) setTripReq(null); else if (panel) closePanel(); setLetter(null); }
      else if ((ev.code === "ArrowUp" || ev.code === "KeyW") && !panel) engine.setDepth(uToDepth(depthToU(engine.s.targetDepth) - 0.08));
      else if ((ev.code === "ArrowDown" || ev.code === "KeyS") && !panel) engine.setDepth(uToDepth(depthToU(engine.s.targetDepth) + 0.08));
      else if (/^Digit[0-9]$/.test(ev.code) && !panel) {
        const n = Number(ev.code.slice(5));
        const b = BAITS[n === 0 ? 9 : n - 1];
        if (b) engine.setBait(b.id);
      }
      else if (ev.code === "ArrowLeft" || ev.code === "KeyA") { engine.keyDir = -1; engine.pullDir = -1; }
      else if (ev.code === "ArrowRight" || ev.code === "KeyD") { engine.keyDir = 1; engine.pullDir = 1; }
    };
    const up = (ev: KeyboardEvent) => {
      if (ev.code === "Space") engine.pointerUp();
      if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(ev.code)) { engine.keyDir = 0; engine.pullDir = 0; }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [playing, panel, letter, engine, openPort, openPanel, closePanel, unlockAudio, settings, setSettings, cycleCam, travelling, tripReq, authOpen]);

  const start = (fresh: boolean) => {
    unlockAudio();
    audio.ui("confirm");
    const e = engineRef.current;
    if (fresh) {
      e.s = newSave(name.trim() || "Рыбак");
      e.phase = "idle";
      setTimeout(() => setLetter(0), 1400);
      setTimeout(() => e.tip("tip_cast", "Удерживайте левую кнопку мыши или пробел, чтобы набрать силу заброса. Отпустите — снасть уйдёт в воду."), 5000);
    } else if (name.trim()) e.s.name = name.trim();
    e.fade = 1.4;
    e.dirty = true;
    e.checkProgress();
    e.refreshDaily();
    setPlaying(true);
    setTimeout(() => persist(true), 500);
  };

  const reset = async () => {
    clearLocal(pidRef.current);
    await deleteRemote(pidRef.current);
    engineRef.current.s = newSave();
    engineRef.current.phase = "idle";
    setPanel(null);
    setPlaying(false);
    setBoot({ state: "title", save: null });
  };

  const s = engine.s;
  const maxD = engine.maxDepth;
  const cands = playing ? engine.candidates(Math.min(s.targetDepth, maxD)) : [];
  const newCands = cands.filter((c) => !s.codex[c.fish.id]).length;
  const found = Object.keys(s.codex).length;
  const rank = [...MILESTONES].reverse().find((m) => found >= m.count)?.title ?? "Новичок";
  const hh = String(Math.floor(engine.hour)).padStart(2, "0");
  const mm = String(Math.floor(((engine.hour % 1) * 60) / 10) * 10).padStart(2, "0");
  const w = WEATHER_INFO[s.weather];
  const fc = engine.forecast;
  const busy = engine.phase === "fight" || engine.phase === "bite" || engine.phase === "caught";
  const events = engine.activeEvents.filter((e) => e.id !== "bottle");

  const status: Record<string, [string, string]> = {
    idle: engine.coolerFull ? ["Садок полон", "Вернитесь в порт"] : ["Готов к забросу", "Удерживайте ЛКМ или пробел"],
    charging: ["Заброс", "Отпустите для броска"],
    casting: ["Заброс", ""],
    sinking: ["Снасть уходит на глубину", "Клик — смотать"],
    waiting: ["Ожидание поклёвки", `Клик — смотать · ${engine.bait.name.toLowerCase()}`],
    bite: ["Поклёвка", "Подсекайте"],
    fight: ["Вываживание", "Удерживайте — подмотка · A / D — против рывка"],
    caught: ["Улов", ""],
  };
  const [stTitle, stSub] = status[engine.phase];

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-[#050a12] text-[#e6e1d6]" onPointerDownCapture={unlockAudio}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          if (e.button === 0 && playing && !panel && !letter && !engine.lastCatch && !engine.lastFind && !engine.s.atPort) {
            engine.pointerDown();
            const k = e.clientX / window.innerWidth;
            engine.setPointerDir(k < 0.4 ? -1 : k > 0.6 ? 1 : 0);
          }
        }}
        onPointerMove={(e) => {
          if (engine.reeling) {
            const k = e.clientX / window.innerWidth;
            engine.setPointerDir(k < 0.4 ? -1 : k > 0.6 ? 1 : 0);
          }
        }}
        onPointerUp={() => engine.pointerUp()}
        onPointerLeave={() => engine.pointerUp()}
        onWheel={(e) => { if (playing && !panel) engine.setDepth(uToDepth(depthToU(engine.s.targetDepth) + (e.deltaY > 0 ? 0.06 : -0.06))); }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* ───────── ТИТУЛ ───────── */}
      {!playing && boot.state !== "auth" && (
        <div className="absolute inset-0 z-50 flex items-center bg-[linear-gradient(90deg,rgba(3,7,12,0.88)_0%,rgba(3,7,12,0.55)_38%,rgba(3,7,12,0)_70%)]">
          <div className="title-in mx-6 max-h-[100dvh] max-w-[520px] overflow-y-auto py-6 sm:ml-[7vw]">
            <div className="label-brass">Симулятор морской рыбалки</div>
            <h1 className="font-serif mt-3 text-[clamp(48px,8vw,112px)] font-light leading-[0.92] text-[#f4eee0] sm:mt-4">Знакомая<br />вода</h1>
            <p className="font-serif mt-4 max-w-sm text-[18px] italic leading-snug text-[#d8cfbd] sm:mt-6 sm:text-[22px]">Лодка, удочка, море и одинокий рыбак на рассвете. Никакой спешки.</p>
            <div className="mt-6 h-px w-24 bg-[var(--brass)] sm:mt-10" />
            {boot.state === "loading" ? (
              <div className="label pulse-soft mt-10">Загрузка</div>
            ) : (
              <div className="mt-6 w-full max-w-[340px] space-y-3 sm:mt-10">
                <div className="label">Имя</div>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Рыбак" className="field !text-left" />
                {boot.save && (
                  <button className="btn btn-solid h-12 w-full justify-between px-5" onClick={() => start(false)}>
                    <span>Продолжить</span>
                    <span className="num text-[10px] opacity-70">день {Math.floor(boot.save.minutes / 1440) + 1} · {Object.keys(boot.save.codex).length}/{FISH.length}</span>
                  </button>
                )}
                <button className={`btn ${boot.save ? "btn-quiet" : "btn-solid"} h-12 w-full`} onClick={() => { if (!boot.save || confirm("Начать заново? Текущий прогресс будет перезаписан.")) start(true); }}>
                  Новая игра
                </button>
                <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                  <div className="text-[11px] leading-snug">
                    <span className="dim">Учётная запись</span><br />
                    <span className="text-[#ece6d8]">{account.user?.username ?? "—"}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="btn btn-sm btn-quiet" onClick={() => setAuthOpen("profile")}>Профиль</button>
                    <button className="btn btn-sm" onClick={onLogout}>Выйти</button>
                  </div>
                </div>
                <div className="text-[11px] dim">Сохранение: {cloud}{account.offline ? " · сервер недоступен" : ""}</div>
              </div>
            )}
          </div>
          <div className="absolute bottom-6 left-[7vw] right-6 hidden flex-wrap gap-x-6 gap-y-1 text-[11px] dim md:flex">
            <span>ЛКМ / Пробел — заброс и подмотка</span><span>A · D — против рывка</span><span>Колесо — глубина</span><span>C · J · P — кодекс, журнал, порт</span>
          </div>
        </div>
      )}

      {boot.state === "auth" && <AuthScreen onReady={onAuthed} />}
      {authOpen === "profile" && account.user && <ProfileModal account={account} sync={cloud} onClose={() => setAuthOpen(null)} onLogout={onLogout} onDeleted={onDeleted} />}

      {playing && engine.s.atPort && !travelling && (
        <PortHub engine={engine} hot={portScene0.hot} compact={view.compact} onOpen={openBuilding} onTravel={requestTrip} onJournal={() => openPanel("journal")} onCodex={() => openPanel("codex")} account={account} onAccount={() => setAuthOpen("profile")} />
      )}
      {tripReq && <TravelChoice engine={engine} trip={tripReq} onCancel={() => setTripReq(null)} onGo={startTrip} />}
      {travelling && <TravelOverlay engine={engine} trip={travelling.trip} mode={travelling.mode} onDone={finishTrip} quality={settings.quality} />}

      {playing && (
        <>
          {!view.compact && !engine.s.atPort && (
            <>
          {/* ───────── ЛЕВЫЙ ВЕРХ ───────── */}
          <div className="absolute left-4 top-4 z-20 w-[300px] space-y-2">
            <div className="glass px-4 pb-3 pt-3.5">
              <div className="label-brass">{engine.loc.name}</div>
              <div className="flex items-end justify-between gap-3">
                <div className="font-serif text-[22px] leading-tight text-[#f4eee0]">{engine.spot.name}</div>
                <div className="num text-[26px] font-light leading-none text-[#f1ebdd]">{hh}<span className="opacity-50">:</span>{mm}</div>
              </div>
              <div className="mt-1 flex justify-between text-[11px] muted">
                <span>{SEASONS[engine.season]}, день {engine.dayOfSeason} из 7</span>
                <span>год {engine.year}</span>
              </div>
              <div className="rule my-2.5" />
              <div className="flex items-center justify-between text-[12px] text-[#ddd7ca]">
                <span className="flex items-center gap-1.5" title={w.desc}><Icon name={WEATHER_ICON[s.weather]} size={15} className="text-[var(--brass)]" />{w.name}</span>
                <span className="num flex items-center gap-1"><Icon name="thermo" size={14} className="opacity-60" />{engine.temperature > 0 ? "+" : ""}{engine.temperature}°</span>
                <span className="num flex items-center gap-1"><Icon name="wind" size={14} className="opacity-60" />{Math.round(s.wind * 14)} м/с</span>
                <span title={MOON_NAMES[engine.moonIndex]}><MoonIcon phase={engine.moonIndex} size={16} /></span>
              </div>
              <div className="mt-1.5 text-[11px] dim">Далее — {WEATHER_INFO[fc.w].name.toLowerCase()}, через ~{Math.max(1, Math.round(fc.inMin / 60))} ч</div>
              <div className="mt-3 border-t border-[var(--line)] pt-2" onPointerDown={(e) => e.stopPropagation()}>
                {spotsOf(s.location).map((sp) => {
                  const on = s.spot === sp.id;
                  return (
                    <button key={sp.id} disabled={busy || on} title={sp.desc} onClick={() => { audio.ui("click"); engine.moveSpot(sp.id); }} className={`group flex w-full items-center gap-2 py-[3px] text-left text-[12px] transition disabled:cursor-default ${on ? "text-[#f1ebdd]" : "muted hover:text-white"}`}>
                      <span className={`h-1.5 w-1.5 rotate-45 ${on ? "bg-[var(--brass)]" : "border border-white/30"}`} />
                      <span className="flex-1 truncate">{sp.name}</span>
                      <span className={`num text-[10px] ${sp.maxDepth > engine.line.value ? "text-[var(--color-bad)]" : "dim"}`}>{sp.maxDepth} м</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div onPointerDown={(e) => e.stopPropagation()}><QuestTracker engine={engine} onOpen={openLetter} /></div>
            <div onPointerDown={(e) => e.stopPropagation()}><DailyTracker engine={engine} onOpen={() => openPanel("journal")} /></div>
            {events.map((ev) => {
              const d = EVENT_BY_ID[ev.id];
              const left = Math.max(0, (ev.endsAt - s.minutes) / 60);
              return (
                <div key={ev.id} className="glass flex items-center gap-3 px-4 py-2.5">
                  <Icon name={EVENT_ICON[ev.id] ?? "sparkle"} size={16} className="text-[var(--brass)]" />
                  <span className="flex-1 text-[12px] text-[#ece6d8]">{d.name}</span>
                  <span className="num text-[11px] dim">{left >= 1 ? `${left.toFixed(1)} ч` : `${Math.round(left * 60)} мин`}</span>
                </div>
              );
            })}
          </div>

          {/* ───────── ПРАВЫЙ ВЕРХ ───────── */}
          <div className="absolute right-4 top-4 z-20 flex w-[330px] flex-col items-stretch gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <div className="glass px-4 py-3">
              <div className="grid grid-cols-3 gap-3">
                <div><div className="label">Средства</div><div className="num text-[17px] text-[var(--brass-2,#e3c996)]">{fmt(s.money)} ₽</div></div>
                <div><div className="label">Садок</div><div className={`num text-[17px] ${engine.coolerFull ? "text-[var(--color-bad)]" : "text-[#f1ebdd]"}`}>{s.cooler.length}<span className="dim">/{engine.coolerCap}</span></div></div>
                <div><div className="label">Кодекс</div><div className="num text-[17px] text-[#f1ebdd]">{found}<span className="dim">/{FISH.length}</span></div></div>
              </div>
              <div className="rule my-2.5" />
              <XpBar engine={engine} />
              <div className="mt-1.5 flex justify-between text-[10px] dim"><span>{s.name}</span><span>{rank}</span></div>
            </div>
            <div className="flex justify-end gap-1.5">
              <button className="iconbtn" onClick={cycleCam} title={`Камера: ${CAM_NAMES[camMode]} [V]`}><Icon name="target" size={15} /><span className="normal-case tracking-normal">{CAM_NAMES[camMode]}</span></button>
              <button className="iconbtn" onClick={() => setSettings({ ...settings, sound: !settings.sound })} title="Звук [M]"><Icon name={settings.sound ? "speaker" : "mute"} size={16} /></button>
              <AccountBadge account={account} compact onClick={() => setAuthOpen("profile")} />
              <button className="iconbtn" onClick={() => openPanel("journal")} title="Журнал [J]"><Icon name="journal" size={16} />{(engine.perkPoints > 0 || engine.hasLetter || engine.daily.tasks.some((t) => t.done && !t.claimed)) && <span className="dot" />}</button>
              <button className="iconbtn" onClick={() => openPanel("codex")} title="Кодекс [C]"><Icon name="book" size={16} /></button>
              <button className="iconbtn" onClick={openPort} title={`В порт ${PORT_BY_ID[engine.nearestPort()].name} [P]`}><Icon name="anchor" size={16} /><span className="normal-case tracking-normal">{PORT_BY_ID[engine.nearestPort()].name}</span></button>
            </div>
          </div>

            </>
          )}
          {view.compact && !engine.s.atPort && (
            <div className="hud-layer z-20">
              <div className="!pointer-events-none flex items-start justify-between gap-2">
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { audio.ui(info ? "close" : "open"); setInfo((v) => !v); }} className={`glass pointer-events-auto relative flex min-w-0 max-w-[58vw] items-center gap-2.5 px-3 py-2 text-left ${info ? "!border-[var(--brass)]" : ""}`}>
                  <span className="num text-[18px] font-light leading-none text-[#f1ebdd]">{hh}<span className="opacity-50">:</span>{mm}</span>
                  <span className="h-6 w-px shrink-0 bg-[var(--line-2)]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] leading-tight text-[#f1ebdd]">{engine.spot.name}</span>
                    <span className="block truncate text-[10px] leading-tight dim">{engine.loc.name}</span>
                  </span>
                  <Icon name={WEATHER_ICON[s.weather]} size={16} className="shrink-0 text-[var(--brass)]" />
                  <span className="num hidden shrink-0 text-[11px] muted min-[420px]:inline">{engine.temperature > 0 ? "+" : ""}{engine.temperature}°</span>
                  {(events.length > 0 || engine.hasLetter) && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--brass)] shadow-[0_0_6px_var(--brass)]" />}
                </button>
                <div className="pointer-events-auto flex flex-col items-end gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="flex gap-1.5">
                    <button className="iconbtn" onClick={cycleCam} aria-label="Камера"><Icon name="target" size={16} /></button>
                    <button className="iconbtn" onClick={() => openPanel("journal")} aria-label="Журнал"><Icon name="journal" size={16} />{(engine.perkPoints > 0 || engine.hasLetter || engine.daily.tasks.some((t) => t.done && !t.claimed)) && <span className="dot" />}</button>
                    <button className="iconbtn" onClick={() => openPanel("codex")} aria-label="Кодекс"><Icon name="book" size={16} /></button>
                    <button className="iconbtn" onClick={openPort} aria-label="Порт"><Icon name="anchor" size={16} /></button>
                  </div>
                  <div className="glass num flex items-center gap-3 whitespace-nowrap px-3 py-1.5 text-[12px]">
                    <span className="text-[var(--brass-2,#e3c996)]">{fmt(s.money)} ₽</span>
                    <span className={engine.coolerFull ? "text-[var(--color-bad)]" : "text-[#ece6d8]"}><Icon name="basket" size={12} className="mr-1 inline -translate-y-px opacity-60" />{s.cooler.length}/{engine.coolerCap}</span>
                  </div>
                </div>
              </div>
              {info && (
                <>
                  <div className="fixed inset-0 z-0" onPointerDown={(e) => { e.stopPropagation(); setInfo(false); }} />
                  <div className="sheet-up glass relative z-10 mt-2 max-h-[calc(100dvh-150px)] w-[min(360px,100%)] overflow-y-auto overscroll-contain p-4" onPointerDown={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                      <span className="label-brass">{engine.loc.name}</span>
                      <span className="text-[11px] dim">{SEASONS[engine.season]}, день {engine.dayOfSeason}/7 · год {engine.year}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-[#ddd7ca]">
                      <span className="flex items-center gap-1.5"><Icon name={WEATHER_ICON[s.weather]} size={15} className="text-[var(--brass)]" />{w.name}</span>
                      <span className="num flex items-center gap-1"><Icon name="wind" size={14} className="opacity-60" />{Math.round(s.wind * 14)} м/с</span>
                      <span className="flex items-center gap-1.5"><MoonIcon phase={engine.moonIndex} size={15} />{MOON_NAMES[engine.moonIndex]}</span>
                    </div>
                    <div className="mt-1 text-[11px] dim">{w.desc}. Далее — {WEATHER_INFO[fc.w].name.toLowerCase()}, через ~{Math.max(1, Math.round(fc.inMin / 60))} ч</div>
                    <div className="label mt-4">Точки ловли</div>
                    <div className="mt-1">
                      {spotsOf(s.location).map((sp) => {
                        const on = s.spot === sp.id;
                        return (
                          <button key={sp.id} disabled={busy || on} onClick={() => { audio.ui("click"); engine.moveSpot(sp.id); setInfo(false); }} className={`flex w-full items-center gap-2 border-b border-[var(--line)] py-2.5 text-left text-[13px] ${on ? "text-[#f1ebdd]" : "muted"}`}>
                            <span className={`h-1.5 w-1.5 rotate-45 ${on ? "bg-[var(--brass)]" : "border border-white/30"}`} />
                            <span className="flex-1">{sp.name}</span>
                            <span className={`num text-[11px] ${sp.maxDepth > engine.line.value ? "text-[var(--color-bad)]" : "dim"}`}>{sp.maxDepth} м</span>
                          </button>
                        );
                      })}
                    </div>
                    {events.length > 0 && (
                      <>
                        <div className="label mt-4">События</div>
                        {events.map((ev) => (
                          <div key={ev.id} className="flex items-center gap-2 border-b border-[var(--line)] py-2 text-[12px]">
                            <Icon name={EVENT_ICON[ev.id] ?? "sparkle"} size={14} className="text-[var(--brass)]" />
                            <span className="flex-1 text-[#ece6d8]">{EVENT_BY_ID[ev.id].name}</span>
                            <span className="num dim">{Math.max(0, (ev.endsAt - s.minutes) / 60).toFixed(1)} ч</span>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="mt-4"><QuestTracker engine={engine} onOpen={() => { setInfo(false); openLetter(); }} /></div>
                    <div className="mt-2"><DailyTracker engine={engine} onOpen={() => { setInfo(false); openPanel("journal"); }} /></div>
                    <div className="mt-3"><XpBar engine={engine} /></div>
                    <div className="mt-4 flex gap-2">
                      <button className="iconbtn flex-1" onClick={() => setSettings({ ...settings, sound: !settings.sound })}><Icon name={settings.sound ? "speaker" : "mute"} size={15} />{settings.sound ? "Звук" : "Без звука"}</button>
                    </div>
                    <div className="label mt-4">Камера</div>
                    <div className="seg mt-1.5 w-full">
                      {CAM_MODES.map((m) => (
                        <button key={m} className={`flex-1 !px-1 ${camMode === m ? "on" : ""}`} onClick={() => setCamMode(m)}>{CAM_NAMES[m]}</button>
                      ))}
                    </div>
                    <button className="iconbtn mt-3 w-full justify-between" onClick={() => { setInfo(false); setAuthOpen("profile"); }}>
                      <span className="normal-case tracking-normal">{account.user?.username ?? "Аккаунт"}</span>
                      <span className="dim normal-case tracking-normal">{cloud}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {/* ───────── БАННЕР ───────── */}
          {engine.banner && (
            <div key={engine.banner.id} className={`banner pointer-events-none absolute left-1/2 z-20 flex w-[92vw] -translate-x-1/2 flex-col items-center text-center ${view.compact ? "top-[22vh]" : "top-[13vh]"}`}>
              <div className="flex items-center gap-5">
                <span className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--brass)]" />
                <span className={`font-serif font-medium text-[#f4eee0] [text-shadow:0_2px_24px_rgba(0,0,0,0.6)] ${view.compact ? "text-[26px]" : "whitespace-nowrap text-[38px]"}`}>{engine.banner.text}</span>
                <span className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--brass)]" />
              </div>
              {engine.banner.sub && <div className="label-brass mt-1 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{engine.banner.sub}</div>}
            </div>
          )}

          {/* ───────── ЛЕНТА ───────── */}
          <div className="pointer-events-none absolute left-3 z-20 flex max-w-[78vw] flex-col gap-1.5" style={{ bottom: view.compact ? (view.land ? 70 : 142) : 116 }}>
            {(view.compact ? engine.toasts.slice(-2) : engine.toasts).map((t) => (
              <div key={t.id} className={`log-item log-${t.kind}`}>
                <div>
                  <div className="text-[12px] text-[#ece6d8]">{t.text}</div>
                  {t.sub && <div className="text-[11px] dim">{t.sub}</div>}
                </div>
              </div>
            ))}
          </div>

          {!view.compact && !engine.s.atPort && (
            <>
          {/* ───────── НИЖНЯЯ ПАНЕЛЬ ───────── */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-4 pb-4" onPointerDown={(e) => e.stopPropagation()}>
            {engine.tipNow && (
              <div key={engine.tipNow.id} className="tip glass flex max-w-[640px] items-start gap-3 px-4 py-2.5">
                <span className="label-brass mt-0.5 shrink-0">Совет</span>
                <span className="text-[12px] leading-relaxed text-[#ddd7ca]">{engine.tipNow.text}</span>
                <button className="dim hover:text-white" onClick={() => engine.dismissTip()} aria-label="Скрыть"><Icon name="close" size={13} /></button>
              </div>
            )}
            <div className="glass grid w-full max-w-[1120px] grid-cols-1 items-center md:grid-cols-[220px_1fr_auto]">
              <div className={`border-b border-[var(--line)] px-4 py-3 md:border-b-0 md:border-r ${engine.phase === "bite" ? "bg-[var(--brass-soft)]" : ""}`}>
                <div className={`text-[13px] ${engine.phase === "bite" ? "pulse-soft font-semibold tracking-[0.12em] text-[var(--brass-2,#e3c996)] uppercase" : "text-[#f1ebdd]"}`}>{stTitle}</div>
                <div className="truncate text-[11px] dim">{stSub}</div>
              </div>
              <div className="flex items-center gap-4 px-5 py-3">
                <span className="label shrink-0">Глубина</span>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  disabled={!["idle", "charging"].includes(engine.phase)}
                  value={Math.round((depthToU(Math.min(s.targetDepth, maxD)) / depthToU(maxD)) * 1000)}
                  onChange={(e) => engine.setDepth(uToDepth((Number(e.target.value) / 1000) * depthToU(maxD)))}
                  className="depth-range min-w-[120px] flex-1"
                />
                <span className="num w-14 text-right text-[16px] text-[#f1ebdd]">{Math.min(s.targetDepth, maxD)}<span className="ml-0.5 text-[11px] dim">м</span></span>
                <span className="hidden w-[190px] shrink-0 text-[11px] leading-tight dim lg:block">
                  {cands.length === 0 ? <span className="text-[var(--color-bad)]">На этой глубине сейчас пусто</span> : s.sonar === 0 ? "Рыба здесь есть" : <>Видов на горизонте: <span className="num text-[#ece6d8]">{cands.length}</span>{s.sonar >= 2 && newCands > 0 && <span className="text-[var(--brass)]"> · новых {newCands}</span>}</>}
                  {engine.maxDepth < engine.spot.maxDepth && <><br /><span className="text-[var(--color-bad)]/80">Леска до {engine.line.value} м</span></>}
                </span>
              </div>
              <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3 md:border-l md:border-t-0">
                <span className="label shrink-0">Наживка</span>
                <div className="seg">
                  {BAITS.map((b, i) => {
                    const n = b.id === "worm" ? Infinity : s.baits[b.id] ?? 0;
                    if (n <= 0 && b.id !== s.currentBait) return null;
                    return (
                      <button key={b.id} title={`${b.desc} [${i + 1}]`} onClick={() => { audio.ui("click"); engine.setBait(b.id as BaitId); }} className={s.currentBait === b.id ? "on" : ""}>
                        <BaitIcon id={b.id} size={16} className="mr-1.5 inline-block -translate-y-px align-middle" />
                        {b.name}{n !== Infinity && <span className="num ml-1 dim">{n}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

            </>
          )}
          {view.compact && !engine.s.atPort && (
            <div className="absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))]" onPointerDown={(e) => e.stopPropagation()}>
              {engine.tipNow && engine.phase !== "fight" && engine.phase !== "bite" && (
                <div key={engine.tipNow.id} className="tip glass mx-auto mb-1.5 flex max-w-[560px] items-start gap-2 px-3 py-2">
                  <span className="flex-1 text-[11px] leading-snug text-[#ddd7ca]">{engine.tipNow.text}</span>
                  <button className="dim" onClick={() => engine.dismissTip()} aria-label="Скрыть"><Icon name="close" size={12} /></button>
                </div>
              )}
              {view.land ? (
                <div className="glass flex items-center gap-3 px-3 py-2">
                  <div className={`w-[128px] shrink-0 truncate text-[12px] ${engine.phase === "bite" ? "pulse-soft font-semibold uppercase tracking-[0.12em] text-[var(--brass-2,#e3c996)]" : "text-[#f1ebdd]"}`}>{stTitle}</div>
                  <input
                  type="range"
                  min={0}
                  max={1000}
                  disabled={!["idle", "charging"].includes(engine.phase)}
                  value={Math.round((depthToU(Math.min(s.targetDepth, maxD)) / depthToU(maxD)) * 1000)}
                  onChange={(e) => engine.setDepth(uToDepth((Number(e.target.value) / 1000) * depthToU(maxD)))}
                  className="depth-range min-w-0 flex-1"
                />
                  <span className="num w-12 shrink-0 text-right text-[14px] text-[#f1ebdd]">{Math.min(s.targetDepth, maxD)}<span className="text-[10px] dim"> м</span></span>
                  <div className="no-scrollbar flex max-w-[38%] gap-1 overflow-x-auto">
                  {BAITS.map((b) => {
                    const n = b.id === "worm" ? Infinity : s.baits[b.id] ?? 0;
                    if (n <= 0 && b.id !== s.currentBait) return null;
                    const on = s.currentBait === b.id;
                    return (
                      <button key={b.id} onClick={() => { audio.ui("click"); engine.setBait(b.id as BaitId); }} className={`flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[11px] ${on ? "border-[rgba(200,164,106,0.6)] bg-[var(--brass-soft)] text-[#f0dcb4]" : "border-[var(--line)] muted"}`}>
                        <BaitIcon id={b.id} size={15} />
                        {b.name}{n !== Infinity && <span className="num dim">{n}</span>}
                      </button>
                    );
                  })}
                  </div>
                </div>
              ) : (
                <div className="glass px-3 pb-2 pt-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-[13px] ${engine.phase === "bite" ? "pulse-soft font-semibold uppercase tracking-[0.12em] text-[var(--brass-2,#e3c996)]" : "text-[#f1ebdd]"}`}>{stTitle}</span>
                    <span className="truncate text-[10px] dim">{cands.length === 0 ? "здесь сейчас пусто" : s.sonar >= 1 ? `видов: ${cands.length}` : ""}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="label shrink-0">Глубина</span>
                    <input
                  type="range"
                  min={0}
                  max={1000}
                  disabled={!["idle", "charging"].includes(engine.phase)}
                  value={Math.round((depthToU(Math.min(s.targetDepth, maxD)) / depthToU(maxD)) * 1000)}
                  onChange={(e) => engine.setDepth(uToDepth((Number(e.target.value) / 1000) * depthToU(maxD)))}
                  className="depth-range min-w-0 flex-1"
                />
                    <span className="num w-12 shrink-0 text-right text-[15px] text-[#f1ebdd]">{Math.min(s.targetDepth, maxD)}<span className="text-[10px] dim"> м</span></span>
                  </div>
                  <div className="no-scrollbar -mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3">
                  {BAITS.map((b) => {
                    const n = b.id === "worm" ? Infinity : s.baits[b.id] ?? 0;
                    if (n <= 0 && b.id !== s.currentBait) return null;
                    const on = s.currentBait === b.id;
                    return (
                      <button key={b.id} onClick={() => { audio.ui("click"); engine.setBait(b.id as BaitId); }} className={`flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[11px] ${on ? "border-[rgba(200,164,106,0.6)] bg-[var(--brass-soft)] text-[#f0dcb4]" : "border-[var(--line)] muted"}`}>
                        <BaitIcon id={b.id} size={15} />
                        {b.name}{n !== Infinity && <span className="num dim">{n}</span>}
                      </button>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          )}
          {touch && engine.phase === "fight" && (
            <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-between px-4" style={{ bottom: view.compact ? (view.land ? 84 : 146 + 92 + 26) : 150 + 118 }}>
              {([-1, 1] as const).map((d) => (
                <button
                  key={d}
                  className="glass pointer-events-auto flex h-20 w-20 items-center justify-center text-[#ece6d8] active:border-[var(--brass)] active:text-[var(--brass)]"
                  onPointerDown={(e) => { e.stopPropagation(); engine.keyDir = d; engine.pullDir = d; engine.reeling = true; }}
                  onPointerUp={(e) => { e.stopPropagation(); engine.keyDir = 0; engine.pullDir = 0; engine.reeling = false; }}
                  onPointerLeave={() => { engine.keyDir = 0; engine.pullDir = 0; }}
                ><Icon name={d < 0 ? "arrowL" : "arrowR"} size={28} /></button>
              ))}
            </div>
          )}

          {engine.phase === "caught" && engine.lastCatch && <CatchModal engine={engine} />}
          {engine.phase === "caught" && engine.lastFind && <FindModal engine={engine} />}
          {panel === "codex" && <CodexModal engine={engine} onClose={closePanel} />}
          {panel === "journal" && <JournalModal engine={engine} onClose={closePanel} settings={settings} setSettings={setSettings} />}
          {panel === "port" && <PortModal key={portTab} engine={engine} cloud={cloud} initialTab={portTab} onClose={closePanel} onTravel={requestTrip} onReset={reset} />}
          {letter !== null && <LetterModal engine={engine} index={letter} onClose={() => { audio.ui("paper"); setLetter(null); }} />}
        </>
      )}
    </div>
  );
}
