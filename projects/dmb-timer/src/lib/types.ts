export type ThemeId = 'khaki' | 'vdv' | 'navy' | 'border' | 'night' | 'vks';
export type Tab = 'home' | 'stats' | 'calendar' | 'tape' | 'medals';

export interface Profile {
  name: string;
  start: string; // YYYY-MM-DDTHH:mm (local)
  end: string;
  theme: ThemeId;
}

export interface Prefs {
  showMs: boolean;
  unitMode: number;
  haptics: boolean;
}

export interface Ctx {
  profile: Profile;
  s: number;
  e: number;
  now: number;
}
