import { useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import type { Profile } from '../lib/types';
import { addMonths, parseLocal, toLocalInput } from '../lib/time';
import { DatesFields, ThemePicker, inputCls } from './ProfileForm';
import { cn } from '../utils/cn';
import { buzz } from '../lib/hooks';

const STEPS = 3;

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>({
    name: '',
    theme: 'khaki',
    start: toLocalInput(now.getTime()),
    end: toLocalInput(addMonths(now.getTime(), 12)),
  });

  const valid = parseLocal(p.end) > parseLocal(p.start);
  const next = () => {
    buzz(12);
    if (step < STEPS - 1) setStep(step + 1);
    else onDone(p);
  };
  const applyTheme = (t: Profile['theme']) => {
    document.documentElement.dataset.theme = t;
    setP({ ...p, theme: t });
  };

  return (
    <div className="camo-bg flex min-h-dvh flex-col px-5 safe-top safe-bottom">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center gap-2 pt-4">
          {Array.from({ length: STEPS }, (_, i) => (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className={cn('h-full bg-grad transition-all duration-500', i <= step ? 'w-full' : 'w-0')} />
            </div>
          ))}
        </div>

        <div key={step} className="pop-in flex-1 pt-10">
          {step === 0 && (
            <>
              <div className="mb-2 font-display text-5xl font-black leading-none">
                <span className="text-grad">ДМБ</span>
                <br />
                таймер
              </div>
              <p className="mb-8 text-white/60">Считаем каждый день, час и секунду до свободы.</p>
              <h2 className="mb-2 font-display text-3xl font-black">Как тебя звать, боец?</h2>
              <p className="mb-6 text-white/55">Будет на карточке и в приветствии. Можно позывной.</p>
              <input
                autoFocus
                value={p.name}
                onChange={(e) => setP({ ...p, name: e.target.value })}
                placeholder="Рядовой Иванов"
                className={inputCls + ' text-lg'}
                maxLength={30}
              />
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="mb-2 font-display text-3xl font-black">Сроки службы</h2>
              <p className="mb-6 text-white/55">Укажи точное время — таймер учитывает часы и минуты.</p>
              <DatesFields p={p} set={setP} />
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="mb-2 font-display text-3xl font-black">Выбери войска</h2>
              <p className="mb-6 text-white/55">Цветовая схема приложения. Поменять можно в любой момент.</p>
              <ThemePicker value={p.theme} onChange={applyTheme} />
            </>
          )}
        </div>

        <div className="flex gap-3 py-6">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5">
              <ArrowLeft />
            </button>
          )}
          <button
            disabled={step === 1 && !valid}
            onClick={next}
            className="bg-grad glow flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-display font-bold text-black transition active:scale-[0.98] disabled:opacity-40"
          >
            {step === STEPS - 1 ? 'Погнали!' : 'Дальше'} <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
