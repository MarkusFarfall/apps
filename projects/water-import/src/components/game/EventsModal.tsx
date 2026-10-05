"use client";

import { useEffect, useState } from "react";
import type { Engine } from "@/game/engine";
import { CATEGORY_INFO, TIER_INFO, effectChips, type EventCategory } from "@/game/events";
import { Icon } from "./Icons";

const CATEGORIES = Object.keys(CATEGORY_INFO) as EventCategory[];

export function EventsModal({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [, setTick] = useState(0);
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const director = engine.eventDirector;

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  const active = director.activeList();
  const buffs = director.buffList();
  const stats = director.stats();
  const weights = director.weights();
  const fit = new Map(weights.map((w) => [w.def.id, w.ok]));
  const activeIds = new Set(active.map((x) => x.live.id));
  const events = director.catalog.filter((e) => category === "all" || e.cat === category);
  const atmo = engine.atmosphere.summary();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(1,5,10,0.76)] p-2 backdrop-blur-sm sm:p-5" onPointerDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="События и явления"
        className="glass flex max-h-[min(92dvh,900px)] w-full max-w-[920px] flex-col overflow-hidden border border-[var(--line-2)] shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <div className="label-brass">Живое море · {atmo.seasonName.toLowerCase()}, {atmo.phaseName}</div>
            <h2 className="mt-1 font-serif text-[26px] leading-none text-[#f4eee0] sm:text-[32px]">Явления и события</h2>
            <p className="mt-2 text-[11px] leading-snug dim">{stats.seen} из {stats.total} открыто · {atmo.weatherName}, {atmo.temp > 0 ? "+" : ""}{atmo.temp}° · ветер {atmo.wind} м/с</p>
          </div>
          <button className="iconbtn shrink-0" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={16} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-3 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="cell px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="label">Полевой журнал</span>
                <span className="num text-[12px] text-[var(--brass-2,#e3c996)]">{stats.seen}/{stats.total}</span>
              </div>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--line)]">
                <div className="h-full bg-[var(--brass)] transition-[width] duration-500" style={{ width: `${stats.total ? (stats.seen / stats.total) * 100 : 0}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <button
                  onClick={() => { engine.setEventsAuto(!director.auto); setTick((x) => x + 1); }}
                  className={`flex items-center gap-2 ${director.auto ? "text-[var(--brass-2,#e3c996)]" : "dim"}`}
                  aria-pressed={director.auto}
                >
                  <span className={`relative inline-block h-3.5 w-6 rounded-full border transition-colors ${director.auto ? "border-[var(--brass)] bg-[var(--brass-soft)]" : "border-[var(--line-2)]"}`}>
                    <span className={`absolute top-[1px] h-2.5 w-2.5 rounded-full transition-all ${director.auto ? "left-[11px] bg-[var(--brass)]" : "left-[1px] bg-[var(--dim)]"}`} />
                  </span>
                  Случайные события
                </button>
                {director.auto && <span className="num dim">следующее ориентировочно через {Math.max(1, Math.ceil(director.nextIn))} мин</span>}
              </div>
            </div>
            <div className="cell flex items-center gap-3 px-4 py-3 md:min-w-[205px] md:flex-col md:items-start md:justify-center">
              <span className="text-2xl">{CATEGORY_INFO.hazard.icon}</span>
              <span className="text-[11px] leading-snug dim">События зависят от времени, сезона, климата, глубины и текущей атмосферы.</span>
            </div>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="label">Сейчас</span>
              <span className="num text-[10px] dim">{active.length} / 3 явления</span>
            </div>
            {active.length === 0 && buffs.length === 0 && <p className="cell px-3 py-3 text-[12px] dim">Море спокойно. Пока.</p>}
            <div className="space-y-2">
              {active.map((entry) => {
                const tier = TIER_INFO[entry.def.tier];
                const omen = entry.live.phase === "omen";
                const pending = !omen && !!entry.def.choices?.length && !entry.live.choice;
                return (
                  <article key={entry.live.uid} className="cell relative overflow-hidden px-3 py-3" style={{ borderLeft: `2px solid ${tier.color}` }}>
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl leading-none">{omen ? "❔" : entry.def.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h3 className="text-[13px] text-[#f1ebdd]">{omen ? `Предвестие: ${entry.def.name}` : entry.def.name}</h3>
                          <span className="num text-[10px] dim">{omen ? `начнётся через ${Math.max(1, Math.ceil(entry.left))} мин` : `ещё ${Math.max(1, Math.ceil(entry.left))} мин · сила ${Math.round(entry.k * 100)}%`}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug muted">{omen ? entry.def.omen?.text ?? entry.def.desc : entry.live.outcome?.text ?? entry.def.desc}</p>
                        {!omen && (
                          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                            {effectChips(entry.def.effects).map((chip) => <span key={chip.label} className={`num text-[10px] ${chip.good ? "text-[var(--color-ok)]" : "text-[var(--color-bad)]"}`}>{chip.label}</span>)}
                          </div>
                        )}
                        {pending && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {entry.def.choices!.map((choice) => (
                              <button key={choice.id} className="btn btn-sm !h-auto !py-1.5 !normal-case !tracking-normal" onClick={() => engine.chooseEvent(entry.live.uid, choice.id)}>
                                <span className="flex flex-col items-start text-left">
                                  <span className="text-[11px] font-semibold">{choice.label}</span>
                                  {choice.hint && <span className="text-[9.5px] font-normal opacity-70">{choice.hint}</span>}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {!omen && <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--line)]"><div className="h-full bg-[var(--brass)] transition-[width]" style={{ width: `${Math.max(0, (1 - entry.p) * 100)}%` }} /></div>}
                  </article>
                );
              })}
            </div>
          </section>

          {buffs.length > 0 && (
            <section>
              <span className="label mb-2 block">Временные эффекты</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {buffs.map((buff) => (
                  <div key={buff.id} className="cell px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-[12px] text-[#ece6d8]"><span>{buff.label}</span><span className="num dim">{Math.max(1, Math.ceil(buff.left))} мин</span></div>
                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">{effectChips(buff.effects).map((chip) => <span key={chip.label} className={`num text-[10px] ${chip.good ? "text-[var(--color-ok)]" : "text-[var(--color-bad)]"}`}>{chip.label}</span>)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="label">Каталог наблюдений</span>
              <span className="text-[10px] dim">Точка показывает, подходят ли условия сейчас</span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              <button onClick={() => setCategory("all")} className={`cell px-2 py-1 text-[10px] ${category === "all" ? "!border-[var(--brass)] text-[var(--brass-2,#e3c996)]" : "muted"}`}>Все</button>
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)} className={`cell px-2 py-1 text-[10px] ${category === cat ? "!border-[var(--brass)] text-[var(--brass-2,#e3c996)]" : "muted"}`}>
                  {CATEGORY_INFO[cat].icon} {CATEGORY_INFO[cat].name}
                </button>
              ))}
            </div>
            <div className="grid gap-1.5 md:grid-cols-2">
              {events.map((event) => {
                const tier = TIER_INFO[event.tier];
                const seen = director.seenInfo(event.id);
                const available = (fit.get(event.id) ?? 0) > 0;
                const isActive = activeIds.has(event.id);
                return (
                  <article key={event.id} className="cell flex items-center gap-2 px-2.5 py-2" title={event.desc} style={{ borderLeft: `2px solid ${seen ? tier.color : "var(--line-2)"}` }}>
                    <span className="w-6 shrink-0 text-center text-base leading-none">{event.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[11.5px] ${seen ? "text-[#ece6d8]" : "dim"}`}>{event.name}</span>
                      <span className="block truncate text-[9.5px] dim">{seen ? `${tier.name} · ${seen.n} наблюдений` : "Ещё не встречалось"}</span>
                    </span>
                    {event.chainOnly && <span className="text-[9px] uppercase tracking-wider dim">цепочка</span>}
                    {event.choices && <span className="text-[9px] uppercase tracking-wider text-[var(--brass)]">выбор</span>}
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${available ? "bg-[var(--color-ok)]" : "bg-[var(--line-2)]"}`} title={available ? "Условия подходят" : "Пока не по погоде"} />
                    {isActive && <span className="num text-[9px] text-[var(--brass)]">идёт</span>}
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-2.5 sm:px-6">
          <span className="text-[10px] dim">Условия событий учитывают все акватории, погоду и астрономическое время.</span>
          <button className="btn btn-quiet btn-sm shrink-0" onClick={onClose}>Готово</button>
        </footer>
      </section>
    </div>
  );
}
