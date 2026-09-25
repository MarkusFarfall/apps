import { useRef, useState } from 'react';
import { Download, Upload, Trash2, Smartphone, Share } from 'lucide-react';
import type { Prefs, Profile } from '../lib/types';
import { parseLocal } from '../lib/time';
import { DatesFields, ThemePicker, inputCls } from './ProfileForm';
import { Sheet, Toggle, SectionTitle } from './ui';
import { NotifySettings } from './NotifySettings';
import { useInstall } from '../lib/pwa';

export function Settings({
  open,
  onClose,
  profile,
  setProfile,
  prefs,
  setPrefs,
  notes,
  setNotes,
  reset,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  notes: Record<string, string>;
  setNotes: (n: Record<string, string>) => void;
  reset: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const fileRef = useRef<HTMLInputElement>(null);
  const { canInstall, install, standalone, ios } = useInstall();
  const valid = parseLocal(draft.end) > parseLocal(draft.start);

  const update = (p: Profile) => {
    setDraft(p);
    if (parseLocal(p.end) > parseLocal(p.start)) setProfile(p);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ profile, prefs, notes, v: 1 }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dmb-backup.json';
    a.click();
  };
  const importData = (f: File) => {
    f.text().then((t) => {
      try {
        const d = JSON.parse(t);
        if (d.profile) {
          setProfile(d.profile);
          setDraft(d.profile);
        }
        if (d.prefs) setPrefs(d.prefs);
        if (d.notes) setNotes(d.notes);
      } catch {
        alert('Файл повреждён');
      }
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Настройки">
      <div className="space-y-6">
        {!standalone && (
          <div className="rounded-3xl bg-accent/10 p-4">
            <div className="flex items-center gap-3">
              <div className="bg-grad grid h-11 w-11 place-items-center rounded-2xl text-black">
                <Smartphone size={20} />
              </div>
              <div className="flex-1">
                <div className="font-bold">Установить как приложение</div>
                <div className="text-xs text-white/55">Иконка на экране, работает без интернета</div>
              </div>
            </div>
            {canInstall ? (
              <button onClick={install} className="bg-grad mt-3 h-11 w-full rounded-2xl font-bold text-black">
                Установить
              </button>
            ) : (
              <div className="mt-3 flex items-start gap-2 text-xs text-white/60">
                <Share size={14} className="mt-0.5 shrink-0" />
                {ios
                  ? 'В Safari нажми «Поделиться» → «На экран «Домой»».'
                  : 'Открой меню браузера (⋮) → «Установить приложение» / «Добавить на главный экран».'}
              </div>
            )}
          </div>
        )}

        <div>
          <SectionTitle>Профиль</SectionTitle>
          <input value={draft.name} onChange={(e) => update({ ...draft, name: e.target.value })} placeholder="Имя / позывной" className={inputCls} maxLength={30} />
        </div>

        <div>
          <SectionTitle>Сроки {!valid && <span className="text-red-400">— не сохранено</span>}</SectionTitle>
          <DatesFields p={draft} set={update} />
        </div>

        <div>
          <SectionTitle>Войска / тема</SectionTitle>
          <ThemePicker value={draft.theme} onChange={(t) => update({ ...draft, theme: t })} />
        </div>

        <NotifySettings profile={profile} prefs={prefs} setPrefs={setPrefs} />

        <div className="space-y-2">
          <SectionTitle>Отображение</SectionTitle>
          <Toggle on={prefs.showMs} onChange={(v) => setPrefs({ ...prefs, showMs: v })} label="Миллисекунды" hint="Бегущие тысячные на главном кольце" />
          <Toggle on={prefs.haptics} onChange={(v) => setPrefs({ ...prefs, haptics: v })} label="Вибро-отклик" hint="Лёгкая вибрация при нажатиях" />
        </div>

        <div>
          <SectionTitle>Данные</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportData} className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-sm font-bold">
              <Download size={16} /> Бэкап
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-sm font-bold">
              <Upload size={16} /> Загрузить
            </button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </div>
          <button
            onClick={() => {
              if (confirm('Точно сбросить всё? Дневник тоже удалится.')) reset();
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/10 py-3 text-sm font-bold text-red-300"
          >
            <Trash2 size={16} /> Сбросить всё
          </button>
        </div>

        <p className="text-center text-[11px] text-white/30">ДМБ Таймер · данные хранятся только на твоём устройстве</p>
      </div>
    </Sheet>
  );
}
