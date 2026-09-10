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
import type {
  CustomEquipment,
  EquipmentProfile,
  EquipmentTag,
  Exercise,
  Language,
  Profile,
  UnitSystem,
} from '../domain/types';
import {
  allCustomEquipment,
  customEquipmentByTag,
  equipmentLabel,
} from '../data/customEquipment';
import { availableSlugs } from '../domain/equipment';
import { setDateLocale } from '../domain/dates';
import { DEFAULT_THEME, isThemeId } from './themes';

interface AppState {
  profile: Profile;
  units: UnitSystem;
  /** What the app speaks and writes in. Absent on the profile means English. */
  lang: Language;
  exercises: Exercise[];
  /** Kit added by the athlete, alongside the seeded vocabulary. */
  customEquipment: CustomEquipment[];
  /** What to call a piece of equipment, seeded or added. */
  equipmentName: (tag: EquipmentTag) => string;
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
  /*
   * Names for movements that have been deleted, so history keeps reading in English. Kept
   * apart from `exercises`, which is what every picker and list draws from — a deleted
   * movement must stop being offered without taking its name out of the workouts that used
   * it. See `allIncludingDeleted`.
   */
  const everyExercise = useLiveQuery(() => exerciseRepo.allIncludingDeleted(), [], undefined);
  /* Kit somebody added. Its names live in the database; the seeded ones are a static table. */
  const customKit = useLiveQuery(() => allCustomEquipment(), [], undefined);
  const equipmentProfiles = useLiveQuery(() => equipmentProfileRepo.all(), [], undefined);

  // Paint the theme on <html> so it covers the whole document, including areas React does
  // not render into — the backdrop behind a sheet, and the browser's own scroll gutter.
  const activeTheme = profiles?.[0]?.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = isThemeId(activeTheme) ? activeTheme : DEFAULT_THEME;
  }, [activeTheme]);

  /*
   * Movement names in Spanish, loaded only when they are wanted.
   *
   * Translated here rather than at each of the several dozen places a movement name is
   * rendered: the library is built once, in one memo, and every list, picker and log reads
   * from it. What goes to the database is untouched -- sessions reference slugs, so the
   * stored history stays in one language whatever the app is set to.
   *
   * Lazily imported for the same reason the catalogue is: an English install should not carry
   * it. Until it arrives the names are English, which is exactly the fallback for the half of
   * the catalogue the translator cannot name yet.
   */
  const language = profiles?.[0]?.language;
  const [movementNames, setMovementNames] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (language !== 'es') {
      setMovementNames(null);
      return;
    }
    let live = true;
    void import('../data/seed/names.es')
      .then((module) => {
        if (live) setMovementNames(module.NAMES_ES);
      })
      .catch(() => {
        // Names stay English. Nothing else depends on this resolving.
      });
    return () => {
      live = false;
    };
  }, [language]);

  const value = useMemo<AppState | null>(() => {
    const profile = profiles?.[0];
    if (!profile || !exercises || !equipmentProfiles) return null;

    const activeEquipment =
      equipmentProfiles.find((p) => p.id === profile.activeEquipmentProfileId) ??
      equipmentProfiles.find((p) => p.isDefault) ??
      equipmentProfiles[0];

    /*
     * One row per slug, defensively.
     *
     * A picker once showed three of every movement, and a restart cleared it — which rules
     * out duplicated rows, and leaves no mechanism I have been able to find or reproduce.
     * This is a guard rather than a diagnosis: two rows sharing a slug is never a legitimate
     * state, `exerciseBySlug` already collapses them silently, and every list that does not
     * would show the duplicate. If it happens again it will now happen somewhere else, which
     * is itself worth knowing.
     */
    const named = movementNames
      ? exercises.map((e) => {
          const translated = movementNames[e.slug];
          return translated ? { ...e, name: translated } : e;
        })
      : exercises;
    const unique = [...new Map(named.map((e) => [e.slug, e])).values()];
    const customByTag = customEquipmentByTag(customKit ?? []);

    // Dates format through a module-level locale rather than an argument -- see the note
    // in domain/dates. Set here, so the first render is already in the right language.
    setDateLocale(profile.language);

    return {
      profile,
      units: profile.units,
      lang: profile.language ?? 'en',
      exercises: unique,
      exerciseBySlug: new Map((everyExercise ?? exercises).map((e) => [e.slug, e])),
      equipmentProfiles,
      activeEquipment,
      available: availableSlugs(unique, activeEquipment?.items ?? []),
      customEquipment: customKit ?? [],
      equipmentName: (tag: EquipmentTag) => equipmentLabel(tag, customByTag),
    };
  }, [profiles, exercises, everyExercise, equipmentProfiles, customKit, movementNames]);

  /*
   * Deliberately untranslated.
   *
   * The chosen language lives on the profile, and the profile lives in the database this
   * branch exists because it could not open. There is nothing to read the setting from, so
   * English is not a gap here — it is the only answer available.
   */
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
