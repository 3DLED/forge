/**
 * Boots the database and exposes the handful of things nearly every screen needs:
 * the profile (units, week start), the active equipment profile, and the exercise library.
 *
 * Everything here comes from `useLiveQuery`, so a write anywhere in the app re-renders
 * whatever depends on it — there is no separate store to keep in sync with IndexedDB.
 */

import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { bootstrap } from '../data/bootstrap';
import {
  equipmentProfileRepo,
  exerciseRepo,
  profileRepo,
} from '../data/repos';
import type { EquipmentProfile, Exercise, Profile, UnitSystem } from '../domain/types';
import { availableSlugs } from '../domain/equipment';
import { DEFAULT_THEME, isThemeId } from './themes';

interface AppState {
  profile: Profile;
  units: UnitSystem;
  exercises: Exercise[];
  exerciseBySlug: Map<string, Exercise>;
  equipmentProfiles: EquipmentProfile[];
  activeEquipment: EquipmentProfile | undefined;
  /** Slugs the active equipment profile actually allows. */
  available: Set<string>;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = use(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap()
      .then(() => setReady(true))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const profiles = useLiveQuery(() => profileRepo.all(), [], undefined);
  const exercises = useLiveQuery(() => exerciseRepo.all(), [], undefined);
  const equipmentProfiles = useLiveQuery(() => equipmentProfileRepo.all(), [], undefined);

  // Paint the theme on <html> so it covers the whole document, including areas React does
  // not render into — the backdrop behind a sheet, and the browser's own scroll gutter.
  const activeTheme = profiles?.[0]?.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = isThemeId(activeTheme) ? activeTheme : DEFAULT_THEME;
  }, [activeTheme]);

  const value = useMemo<AppState | null>(() => {
    const profile = profiles?.[0];
    if (!profile || !exercises || !equipmentProfiles) return null;

    const activeEquipment =
      equipmentProfiles.find((p) => p.id === profile.activeEquipmentProfileId) ??
      equipmentProfiles.find((p) => p.isDefault) ??
      equipmentProfiles[0];

    return {
      profile,
      units: profile.units,
      exercises,
      exerciseBySlug: new Map(exercises.map((e) => [e.slug, e])),
      equipmentProfiles,
      activeEquipment,
      available: availableSlugs(exercises, activeEquipment?.items ?? []),
    };
  }, [profiles, exercises, equipmentProfiles]);

  if (error) {
    return (
      <div className="empty">
        <span className="glyph">⚠️</span>
        <h2>Could not open your training data</h2>
        <p className="small">{error}</p>
        <p className="small faint">
          Private browsing blocks local storage in some browsers. Try a normal window.
        </p>
      </div>
    );
  }

  if (!ready || !value) {
    return (
      <div className="empty">
        <span className="glyph">🔥</span>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return <AppContext value={value}>{children}</AppContext>;
}
