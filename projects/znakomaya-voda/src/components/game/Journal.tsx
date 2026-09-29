"use client";

import { useEffect, useState } from "react";
import type { Engine } from "@/game/engine";
import { FISH, FISH_BY_ID } from "@/game/fish";
import { ACHIEVEMENTS, FINDS, MAX_LEVEL, PERKS, PERK_GROUPS, QUESTS, RANK_LEVEL, TOTAL_PERK_COST, levelFromXp, levelTitle, rankCost, spentPoints, xpForLevel } from "@/game/progress";
import { LOC_BY_ID } from "@/game/world";
import { streakBonus } from "@/game/daily";
import { FIND_ICON, Icon, PERK_ICON } from "./Icons";
import { fmt, fmtW, Modal } from "./Panels";

type Tab = "daily" | "story" | "perks" | "ach" | "finds" | "stats" | "settings";

export interface Settings {
  quality: number;
  sound: boolean;
  music: boolean;
  volume: number;
}

export function XpBar({ engine }: { engine: Engine }) {
  const lvl = engine.level;
  const lo = lvl === 1 ? 0 : xpForLevel(lvl - 1);
  const hi = xpForLevel(lvl);
  const k = lvl >= MAX_LEVEL ? 1 : (engine.s.xp - lo) / (hi - lo);
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="label">Уровень <span className="num text-[#ece6d8]">{lvl}</span> · <span className="normal-case tracking-normal text-[#cfc6b3]">{levelTitle(lvl)}</span></span>
        <span className="num text-[10px] dim">{lvl >= MAX_LEVEL ? "максимум" : `${fmt(engine.s.xp - lo)} / ${fmt(hi - lo)}`}</span>
      </div>
      <div className="mt-1.5 h-px w-full bg-[var(--line-2)]">
        <div className="h-px bg-[var(--brass)] transition-all duration-700" style={{ width: `${k * 100}%` }} />
      </div>
    </div>
  );
}

export function QuestTracker({ engine, onOpen }: { engine: Engine; onOpen: () => void }) {
  const s = engine.s;
  if (s.quest >= QUESTS.length) return null;
  const q = QUESTS[s.quest];
  const [a, b] = q.progress(s);
  return (
    <button onClick={onOpen} className="glass block w-full px-4 py-3 text-left transition hover:border-[var(--line-2)]">
      <div className="flex items-center justify-between">
        <span className="label-brass">Письмо {s.quest + 1} · {QUESTS.length}</span>
        {engine.hasLetter && <span className="label pulse-soft !text-[var(--brass)]">новое</span>}
      </div>
      <div className="font-serif mt-1 text-[18px] leading-tight text-[#f1ebdd]">{q.title}</div>
      <div className="mt-0.5 flex items-baseline gap-3 text-[12px] muted">
        <span className="flex-1">{q.goal}</span>
        {b > 1 && <span className="num text-[11px] text-[#ddd7ca]">{fmt(a)} / {fmt(b)}</span>}
      </div>
      {b > 1 && <div className="mt-2 h-px bg-[var(--line-2)]"><div className="h-px bg-[var(--brass)]" style={{ width: `${Math.min(1, a / b) * 100}%` }} /></div>}
    </button>
  );
}

export function LetterModal({ engine, index, onClose }: { engine: Engine; index: number; onClose: () => void }) {
  const q = QUESTS[index];
  if (!q) return null;
  return (
    <div className="fade-in absolute inset-0 z-50 flex items-center justify-center bg-[#02050a]/70 p-0 backdrop-blur-[2px] sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className="paper reveal max-h-[100dvh] w-full max-w-[560px] overflow-y-auto px-6 py-7 sm:max-h-[94vh] sm:px-12 sm:py-10">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-[#6b5530]">
          <span>Письмо {index + 1} из {QUESTS.length}</span>
          <span>{engine.s.name}</span>
        </div>
        <div className="mt-3 h-px bg-[#6b5530]/30" />
        <h3 className="font-serif mt-5 text-center text-[30px] font-medium leading-none text-[#2b2012] sm:mt-6 sm:text-[36px]">{q.title}</h3>
        <p className="font-serif mt-5 text-[18px] italic leading-[1.55] text-[#3a2c18] sm:mt-7 sm:text-[21px]">{q.letter}</p>
        <p className="font-serif mt-4 text-right text-[19px] italic text-[#3a2c18]">— Отец</p>
        <div className="mt-7 h-px bg-[#6b5530]/30" />
        <div className="mt-4 flex items-baseline justify-between text-[13px] text-[#3a2c18]">
          <span><span className="text-[10px] uppercase tracking-[0.22em] text-[#6b5530]">Задание</span><br />{q.goal}</span>
          <span className="text-right"><span className="text-[10px] uppercase tracking-[0.22em] text-[#6b5530]">Награда</span><br /><span className="num">{fmt(q.reward)} ₽</span></span>
        </div>
        <button className="mt-8 h-10 w-full border border-[#6b5530]/50 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3a2c18] transition hover:bg-[#6b5530]/10" onClick={onClose}>Сложить письмо</button>
      </div>
    </div>
  );
}

export function FindModal({ engine }: { engine: Engine }) {
  const f = engine.lastFind;
  if (!f) return null;
  const count = FINDS.filter((x) => engine.s.finds[x.id]).length;
  return (
    <div className="fade-in absolute inset-0 z-30 flex items-center justify-center bg-[#02050a]/55 p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet reveal w-full max-w-[420px] p-8 text-center">
        <div className="label-brass">{f.isNew ? `Новая находка · ${count} из ${FINDS.length}` : "Находка со дна"}</div>
        <div className="plate mx-auto my-6 flex h-36 w-36 items-center justify-center rounded-full">
          <Icon name={FIND_ICON[f.def.id]} size={64} strokeWidth={1} className="text-[#e3c996]" />
        </div>
        <h3 className="font-serif text-[34px] font-medium leading-none text-[#f4eee0]">{f.def.name}</h3>
        <p className="font-serif mx-auto mt-3 max-w-xs text-[17px] italic leading-snug muted">{f.def.desc}</p>
        <div className="rule my-6" />
        <button className="btn btn-solid w-full" onClick={() => engine.takeFind()}>Забрать · {fmt(Math.round(f.def.value * (1 + engine.perk("trader") * 0.05)))} ₽</button>
      </div>
    </div>
  );
}

export function JournalModal({ engine, onClose, settings, setSettings, initial = "daily" }: { engine: Engine; onClose: () => void; settings: Settings; setSettings: (s: Settings) => void; initial?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);
  const s = engine.s;
  const tabs: [Tab, string, string][] = [
    ["daily", "На сегодня", `${engine.daily.tasks.filter((t) => t.done).length}/${engine.daily.tasks.length}`],
    ["story", "Письма", `${Math.min(s.quest + 1, QUESTS.length)}/${QUESTS.length}`],
    ["perks", "Навыки", engine.perkPoints > 0 ? `+${engine.perkPoints}` : ""],
    ["ach", "Достижения", `${s.achievements.length}/${ACHIEVEMENTS.length}`],
    ["finds", "Находки", `${FINDS.filter((f) => s.finds[f.id]).length}/${FINDS.length}`],
    ["stats", "Статистика", ""],
    ["settings", "Настройки", ""],
  ];
  return (
    <Modal
      label="Журнал"
      title={s.name}
      onClose={onClose}
      tabs={tabs.map(([id, n, b]) => (
        <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
          {n}{b && <span className={`num ml-1.5 ${id === "perks" ? "text-[var(--brass)]" : "dim"}`}>{b}</span>}
        </button>
      ))}
      right={<div className="hidden w-64 md:block"><XpBar engine={engine} /></div>}
    >
      <div className="p-4 sm:p-7">
        {tab === "daily" && <DailyPanel engine={engine} />}

        {tab === "story" && (
          <div className="mx-auto max-w-3xl">
            {QUESTS.map((q, i) => {
              const done = i < s.quest;
              const cur = i === s.quest;
              if (i > s.quest) return (
                <div key={q.id} className="flex items-center gap-4 border-b border-[var(--line)] py-3 opacity-35">
                  <span className="num w-8 text-[12px] dim">{romanNum(i + 1)}</span>
                  <span className="font-serif text-[17px] italic">Запечатано</span>
                </div>
              );
              const [a, b] = q.progress(s);
              return (
                <details key={q.id} open={cur} className={`border-b border-[var(--line)] ${cur ? "bg-[rgba(200,164,106,0.04)]" : ""}`}>
                  <summary className="flex cursor-pointer items-center gap-3 py-3 sm:gap-4">
                    <span className="num w-8 text-[12px] dim">{romanNum(i + 1)}</span>
                    <span className="font-serif flex-1 text-[19px] text-[#f1ebdd]">{q.title}</span>
                    <span className="hidden text-[12px] muted md:inline">{q.goal}</span>
                    <span className="w-28 text-right text-[11px]">{done ? <span className="inline-flex items-center gap-1 text-[var(--color-ok)]"><Icon name="check" size={13} />выполнено</span> : b > 1 ? <span className="num text-[var(--brass)]">{fmt(a)} / {fmt(b)}</span> : <span className="text-[var(--brass)]">в работе</span>}</span>
                  </summary>
                  <div className="pb-5 pl-4 pr-2 sm:pl-12 sm:pr-4">
                    <p className="font-serif border-l border-[var(--brass)]/40 pl-4 text-[17px] italic leading-relaxed text-[#d8cfbd]">{q.letter}</p>
                    <div className="mt-2 pl-4 text-[11px] dim">Награда {fmt(q.reward)} ₽</div>
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {tab === "perks" && (
          <div>
            <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <p className="max-w-2xl text-[13px] leading-relaxed muted">
                Каждый уровень даёт очко навыка, каждый десятый — ещё два. Ранг стоит столько очков, какой он по счёту, и открывается с определённого уровня:
                {" "}<span className="text-[#ddd7ca]">II — 8, III — 16, IV — 27, V — 40</span>. Всех навыков не освоить — выбирайте специализацию.
              </p>
              <div className="flex items-center gap-5">
                <div className="text-right"><div className="label">Свободно</div><div className="num text-[22px] text-[var(--brass-2,#e3c996)]">{engine.perkPoints}</div></div>
                <div className="text-right"><div className="label">Вложено</div><div className="num text-[22px] text-[#ece6d8]">{spentPoints(s.perks)}<span className="text-[12px] dim">/{TOTAL_PERK_COST}</span></div></div>
              </div>
            </div>
            {(Object.keys(PERK_GROUPS) as (keyof typeof PERK_GROUPS)[]).map((g) => (
              <div key={g} className="mb-6">
                <div className="label-brass mb-2">{PERK_GROUPS[g]}</div>
                <div className="grid border-l border-t border-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
                  {PERKS.filter((p) => p.group === g).map((p) => {
                    const l = engine.perk(p.id);
                    const block = engine.perkBlock(p.id);
                    const next = l + 1;
                    return (
                      <div key={p.id} className="flex flex-col border-b border-r border-[var(--line)] bg-[#0a121c] p-5">
                        <div className="flex items-center gap-3">
                          <Icon name={PERK_ICON[p.id] ?? "sparkle"} size={20} className="text-[var(--brass)]" />
                          <span className="font-serif flex-1 text-[19px] text-[#f1ebdd]">{p.name}</span>
                          <span className="num text-[11px] dim">{l}/{p.max}</span>
                        </div>
                        <div className="mt-3 flex gap-1">
                          {Array.from({ length: p.max }, (_, i) => (
                            <div key={i} className="flex-1">
                              <div className={`h-[3px] ${i < l ? "bg-[var(--brass)]" : "bg-white/10"}`} />
                              <div className={`num mt-1 text-center text-[9px] ${i < l ? "text-[var(--brass)]" : engine.level >= RANK_LEVEL[i + 1] ? "dim" : "text-white/20"}`}>{RANK_LEVEL[i + 1]}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[13px] text-[#ddd7ca]">{l > 0 ? p.desc(l) : "Не изучено"}</div>
                        {next <= p.max && <div className="text-[11px] dim">Ранг {next}: {p.desc(next)}</div>}
                        <button className="btn btn-sm mt-auto w-full" style={{ marginTop: 14 }} disabled={!!block} onClick={() => engine.buyPerk(p.id)}>
                          {block ?? `Изучить · ${rankCost(next)} ${rankCost(next) === 1 ? "очко" : rankCost(next) < 5 ? "очка" : "очков"}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
              <span className="text-[12px] muted">Переучиться можно в таверне порта или здесь — за плату, растущую с уровнем.</span>
              <button className="btn btn-sm btn-quiet" disabled={!spentPoints(s.perks) || s.money < engine.respecCost} onClick={() => { if (confirm(`Сбросить все навыки за ${fmt(engine.respecCost)} ₽? Очки вернутся.`)) engine.respec(); }}>Сбросить навыки · {fmt(engine.respecCost)} ₽</button>
            </div>
          </div>
        )}

        {tab === "ach" && (
          <div className="grid gap-x-8 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => {
              const got = s.achievements.includes(a.id);
              return (
                <div key={a.id} className={`flex items-center gap-4 border-b border-[var(--line)] py-3 ${got ? "" : "opacity-50"}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center border ${got ? "border-[var(--brass)] text-[var(--brass)]" : "border-[var(--line-2)] dim"}`}><Icon name={got ? "medal" : "lock"} size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-[#ece6d8]">{a.name}</div>
                    <div className="text-[12px] dim">{a.desc}</div>
                  </div>
                  <span className={`num text-[11px] ${got ? "text-[var(--color-ok)]" : "dim"}`}>{got ? "получено" : `${fmt(a.reward)} ₽`}</span>
                </div>
              );
            })}
          </div>
        )}

        {tab === "finds" && (
          <div>
            <p className="mb-6 max-w-2xl text-[13px] muted">Иногда на крючок попадает не рыба. У каждой находки свои акватории и глубины.</p>
            <div className="grid grid-cols-2 border-l border-t border-[var(--line)] sm:grid-cols-3 lg:grid-cols-5">
              {FINDS.map((f) => {
                const n = s.finds[f.id] ?? 0;
                return (
                  <div key={f.id} className="border-b border-r border-[var(--line)] bg-[#0a121c] p-5 text-center">
                    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${n ? "border-[var(--brass)]/50 text-[#e3c996]" : "border-[var(--line)] text-white/15"}`}>
                      <Icon name={n ? FIND_ICON[f.id] : "lock"} size={n ? 30 : 18} strokeWidth={n ? 1.2 : 1.5} />
                    </div>
                    <div className={`font-serif mt-3 text-[17px] ${n ? "text-[#f1ebdd]" : "dim"}`}>{n ? f.name : "Не найдено"}</div>
                    <div className="mt-1 text-[11px] leading-snug dim">{f.loc.map((l) => LOC_BY_ID[l].name).join(", ")}{f.minDepth ? ` · от ${f.minDepth} м` : ""}</div>
                    {n > 0 && <div className="num mt-1 text-[11px] muted">×{n} · {fmt(f.value)} ₽</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "stats" && (
          <div className="grid gap-x-10 md:grid-cols-2">
            {([
              ["Уровень", `${levelFromXp(s.xp)} · ${fmt(s.xp)} опыта`],
              ["Поймано рыб", fmt(s.stats.totalCaught)],
              ["Видов в кодексе", `${Object.keys(s.codex).length} / ${FISH.length}`],
              ["Заработано", `${fmt(s.stats.totalEarned)} ₽`],
              ["Потрачено на топливо", `${fmt(s.stats.fuelSpent ?? 0)} ₽`],
              ["Потеряно оснастки", `${fmt(s.stats.gearLost ?? 0)} ₽`],
              ["Точных подсечек", fmt(s.stats.perfectHooks)],
              ["Удержано прыжков", fmt(s.stats.jumps)],
              ["Ночных уловов", fmt(s.stats.nightCatches)],
              ["Уловов в шторм", fmt(s.stats.stormCatches)],
              ["Отпущено", fmt(s.stats.releases)],
              ["Обрывов лески", fmt(s.stats.linesSnapped)],
              ["Сходов", fmt(s.stats.escaped)],
              ["Заказов выполнено", fmt(s.ordersDone)],
              ["Глубочайший улов", `${Math.round(s.stats.maxDepthCaught)} м`],
              ["Крупнейшая рыба", s.stats.biggest ? `${FISH_BY_ID[s.stats.biggest.fishId]?.name}, ${fmtW(s.stats.biggest.weight)}` : "—"],
              ["Дней в море", fmt(engine.day)],
              ["Время в игре", `${Math.floor(s.stats.playSeconds / 3600)} ч ${Math.floor((s.stats.playSeconds % 3600) / 60)} мин`],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-[var(--line)] py-2.5">
                <span className="text-[13px] muted">{k}</span>
                <span className="num text-[14px] text-[#ece6d8]">{v}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && (
          <div className="grid gap-8 md:grid-cols-2 md:gap-10">
            <section>
              <div className="label mb-3">Графика</div>
              <div className="seg w-full">
                {["Низкое", "Среднее", "Высокое"].map((n, i) => (
                  <button key={n} className={`flex-1 ${settings.quality === i ? "on" : ""}`} onClick={() => setSettings({ ...settings, quality: i })}>{n}</button>
                ))}
              </div>
              <ul className="mt-3 space-y-1 text-[12px] dim">
                <li>Низкое — без отражений, световых столбов и каустики</li>
                <li>Среднее — без бликов объектива, пониженная чёткость</li>
                <li>Высокое — все эффекты, полная чёткость</li>
              </ul>
              <div className="label mb-3 mt-8">Камера по умолчанию</div>
              <p className="-mt-1 mb-2 text-[12px] dim">Переключается клавишей V или кнопкой на экране.</p>
              <ul className="space-y-1 text-[12px] muted">
                <li><span className="text-[#ddd7ca]">Авто</span> — следит за снастью, при поклёвке показывает поплавок</li>
                <li><span className="text-[#ddd7ca]">Поверхность</span> — всегда лодка и горизонт</li>
                <li><span className="text-[#ddd7ca]">За снастью</span> — всегда рядом с крючком</li>
                <li><span className="text-[#ddd7ca]">Дно</span> — рельеф и донные обитатели</li>
              </ul>
              <div className="label mb-3 mt-8">Управление</div>
              <dl className="text-[12px]">
                {[
                  ["Заброс, подсечка, подмотка", "ЛКМ / Пробел"],
                  ["Противодействие рывку", "A · D / курсор к краю"],
                  ["Глубина", "Колесо / W · S"],
                  ["Наживка", "1 – 9, 0"],
                  ["Камера", "V"],
                  ["Кодекс · Журнал · Порт", "C · J · P"],
                  ["Звук", "M"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-[var(--line)] py-2"><span className="muted">{k}</span><span className="text-[#ddd7ca]">{v}</span></div>
                ))}
              </dl>
            </section>
            <section>
              <div className="label mb-3">Звук</div>
              <div className="space-y-4">
                <label className="flex items-center justify-between border-b border-[var(--line)] pb-3 text-[13px]">
                  <span className="text-[#ddd7ca]">Громкость</span>
                  <input type="range" min={0} max={100} value={Math.round(settings.volume * 100)} onChange={(e) => setSettings({ ...settings, volume: Number(e.target.value) / 100 })} className="depth-range w-48" />
                </label>
                <label className="flex cursor-pointer items-center justify-between border-b border-[var(--line)] pb-3 text-[13px]">
                  <span className="text-[#ddd7ca]">Звуки мира и снасти</span>
                  <Toggle on={settings.sound} onChange={(v) => setSettings({ ...settings, sound: v })} />
                </label>
                <label className="flex cursor-pointer items-center justify-between border-b border-[var(--line)] pb-3 text-[13px]">
                  <span className="text-[#ddd7ca]">Музыка</span>
                  <Toggle on={settings.music} onChange={(v) => setSettings({ ...settings, music: v })} />
                </label>
              </div>
              <p className="mt-4 text-[12px] leading-relaxed dim">Звук синтезируется в реальном времени: прибой, ветер, дождь, скрип корпуса, трещотка фрикциона. Лучше всего слушать в наушниках.</p>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className={`relative h-5 w-9 border transition ${on ? "border-[var(--brass)] bg-[var(--brass-soft)]" : "border-[var(--line-2)]"}`} aria-pressed={on}>
      <span className={`absolute top-[3px] h-3 w-3 transition-all ${on ? "left-[19px] bg-[var(--brass)]" : "left-[3px] bg-white/30"}`} />
    </button>
  );
}

const romanNum = (n: number) => {
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
};


function useCountdown() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((x) => x + 1), 30000);
    return () => clearInterval(iv);
  }, []);
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const m = Math.max(0, Math.round((next.getTime() - now.getTime()) / 60000));
  return `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, "0")} мин`;
}

export function DailyPanel({ engine }: { engine: Engine }) {
  const d = engine.daily;
  const left = useCountdown();
  const [, force] = useState(0);
  const allClaimed = d.tasks.length > 0 && d.tasks.every((t) => t.claimed);
  const k = streakBonus(d.streak);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-brass">Задания на {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</div>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed muted">Три поручения на реальные сутки. Выполните все — получите сундук дня и продлите серию: каждый день подряд добавляет 10% к наградам (до +60%).</p>
        </div>
        <div className="flex gap-6 text-right">
          <div><div className="label">Серия</div><div className="num text-[22px] text-[var(--brass-2,#e3c996)]">{d.streak} <span className="text-[12px] dim">дн.</span></div></div>
          <div><div className="label">Бонус</div><div className="num text-[22px] text-[#ece6d8]">+{Math.round((k - 1) * 100)}%</div></div>
          <div><div className="label">Обновление</div><div className="num text-[15px] text-[#ece6d8]">{left}</div></div>
        </div>
      </div>
      <div className="space-y-2.5">
        {d.tasks.map((t, i) => (
          <div key={t.id} className={`cell flex flex-wrap items-center gap-4 p-4 ${t.done && !t.claimed ? "!border-[rgba(200,164,106,0.6)]" : ""} ${t.claimed ? "opacity-55" : ""}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center border ${t.done ? "border-[var(--brass)] text-[var(--brass)]" : "border-[var(--line-2)] dim"}`}>
              <Icon name={t.claimed ? "check" : i === 2 ? "star" : "target"} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] text-[#f1ebdd]">{t.title}</span>
                {i === 2 && <span className="label-brass !text-[9px]">сложное</span>}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-[3px] flex-1 bg-white/10"><div className="h-full bg-[var(--brass)] transition-all" style={{ width: `${(t.progress / t.goal) * 100}%` }} /></div>
                <span className="num w-20 text-right text-[11px] muted">{fmt(Math.floor(t.progress))} / {fmt(t.goal)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="num text-right text-[12px]"><span className="text-[var(--brass-2,#e3c996)]">{fmt(Math.round(t.reward * k))} ₽</span><br /><span className="dim">+{Math.round(t.xp * k)} опыта</span></span>
              {t.claimed ? (
                <span className="label !text-[var(--color-ok)]">получено</span>
              ) : t.done ? (
                <button className="btn btn-sm btn-solid" onClick={() => { engine.claimDaily(t.id); force((x) => x + 1); }}>Забрать</button>
              ) : (
                <button className="btn btn-sm btn-quiet" disabled={d.rerolls <= 0} title="Заменить задание (раз в день)" onClick={() => { engine.rerollDaily(t.id); force((x) => x + 1); }}>Заменить</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-5 flex flex-wrap items-center gap-4 border p-5 ${allClaimed && !d.bonusClaimed ? "border-[var(--brass)] bg-[var(--brass-soft)]" : "border-[var(--line)]"}`}>
        <span className="flex h-12 w-12 items-center justify-center border border-[var(--brass)]/60 text-[var(--brass)]"><Icon name="chest" size={24} /></span>
        <div className="flex-1">
          <div className="font-serif text-[20px] text-[#f1ebdd]">Сундук дня</div>
          <div className="text-[12px] muted">{d.bonusClaimed ? "Получен. Новые задания — после полуночи." : `${fmt(engine.dailyChest)} ₽ и редкая наживка — за все три задания`}</div>
        </div>
        <button className="btn btn-solid" disabled={!allClaimed || d.bonusClaimed} onClick={() => { engine.claimDailyChest(); force((x) => x + 1); }}>{d.bonusClaimed ? "Получено" : "Открыть"}</button>
      </div>
    </div>
  );
}

/** Компактный трекер для экрана */
export function DailyTracker({ engine, onOpen }: { engine: Engine; onOpen: () => void }) {
  const d = engine.daily;
  if (!d.tasks.length) return null;
  const ready = d.tasks.filter((t) => t.done && !t.claimed).length;
  const done = d.tasks.filter((t) => t.done).length;
  const next = d.tasks.find((t) => !t.done);
  return (
    <button onClick={onOpen} className="glass block w-full px-4 py-2.5 text-left transition hover:border-[var(--line-2)]">
      <div className="flex items-center justify-between">
        <span className="label-brass">Задания дня · {done}/{d.tasks.length}</span>
        {ready > 0 ? <span className="label pulse-soft !text-[var(--brass)]">награда ×{ready}</span> : d.streak > 0 && <span className="label">серия {d.streak}</span>}
      </div>
      {next ? (
        <div className="mt-1 flex items-center gap-3 text-[12px]">
          <span className="flex-1 truncate text-[#ddd7ca]">{next.title}</span>
          <span className="num text-[11px] muted">{fmt(Math.floor(next.progress))}/{fmt(next.goal)}</span>
        </div>
      ) : (
        <div className="mt-1 text-[12px] text-[var(--color-ok)]">{d.bonusClaimed ? "Всё выполнено на сегодня" : "Все выполнены — откройте сундук"}</div>
      )}
    </button>
  );
}
