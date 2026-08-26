/**
 * Unit conversion and formatting.
 *
 * Storage is always canonical SI (kg, meters, seconds); only the edges convert. That way
 * switching a profile between imperial and metric is a display change, never a data
 * migration, and history stays comparable across the switch.
 */

import type { UnitSystem } from './types';

export const KG_PER_LB = 0.45359237;
export const M_PER_MILE = 1609.344;
export const M_PER_KM = 1000;

// --- weight ----------------------------------------------------------------

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** Convert a stored weight into the number to show in the given system. */
export function displayWeight(kg: number, units: UnitSystem): number {
  return units === 'imperial' ? kgToLb(kg) : kg;
}

/** Convert a number the user typed back into storage units. */
export function inputWeightToKg(value: number, units: UnitSystem): number {
  return units === 'imperial' ? lbToKg(value) : value;
}

export function weightLabel(units: UnitSystem): string {
  return units === 'imperial' ? 'lb' : 'kg';
}

/** "45 lb", "22.5 kg" — trailing zeros trimmed, since 45.0 lb reads like a machine wrote it. */
export function formatWeight(kg: number, units: UnitSystem, withUnit = true): string {
  const value = displayWeight(kg, units);
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return withUnit ? `${text} ${weightLabel(units)}` : text;
}

// --- distance --------------------------------------------------------------

export function metersToMiles(m: number): number {
  return m / M_PER_MILE;
}

export function metersToKm(m: number): number {
  return m / M_PER_KM;
}

export function displayDistance(m: number, units: UnitSystem): number {
  return units === 'imperial' ? metersToMiles(m) : metersToKm(m);
}

export function inputDistanceToMeters(value: number, units: UnitSystem): number {
  return units === 'imperial' ? value * M_PER_MILE : value * M_PER_KM;
}

export function distanceLabel(units: UnitSystem): string {
  return units === 'imperial' ? 'mi' : 'km';
}

/**
 * Short distances read better in yards/meters than in fractions of a mile — "400 m"
 * beats "0.25 mi" on a track workout.
 */
export function formatDistance(m: number, units: UnitSystem): string {
  if (units === 'imperial') {
    if (m < M_PER_MILE / 2) return `${Math.round(m)} m`;
    return `${(m / M_PER_MILE).toFixed(2).replace(/\.?0+$/, '')} mi`;
  }
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / M_PER_KM).toFixed(2).replace(/\.?0+$/, '')} km`;
}

/**
 * Parses whatever someone actually types into a distance field.
 *
 * Track work is written in metres ("400m") and long runs in miles ("6.2"), and forcing one
 * of those into the other's units is how a logging screen starts feeling hostile. A bare
 * number means the profile's unit; an explicit suffix always wins.
 */
export function parseDistanceInput(input: string, units: UnitSystem): number | null {
  const text = input.trim().toLowerCase().replace(/,/g, '');
  if (!text) return null;

  const match = /^(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|k|m|yd|yards?)?$/.exec(text);
  if (!match) return null;

  const value = Number(match[1]);
  switch (match[2]) {
    case 'mi':
    case 'mile':
    case 'miles':
      return value * M_PER_MILE;
    case 'km':
    case 'k':
      return value * M_PER_KM;
    case 'm':
      return value;
    case 'yd':
    case 'yard':
    case 'yards':
      return value * 0.9144;
    default:
      return inputDistanceToMeters(value, units);
  }
}

// --- time and pace ---------------------------------------------------------

/** "45s", "12:30", "1:04:15" — the shortest form that is still unambiguous. */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s}s`;
}

/** Accepts "8:30", "830", "90" (seconds), or "1:04:15". Returns seconds, or null. */
export function parseDuration(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const parts = text.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+(\.\d+)?$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

export function paceSecPerKm(distanceM: number, timeSec: number): number | null {
  if (distanceM <= 0 || timeSec <= 0) return null;
  return timeSec / (distanceM / M_PER_KM);
}

export function displayPace(secPerKm: number, units: UnitSystem): number {
  return units === 'imperial' ? secPerKm * (M_PER_MILE / M_PER_KM) : secPerKm;
}

export function paceLabel(units: UnitSystem): string {
  return units === 'imperial' ? '/mi' : '/km';
}

/** "8:34 /mi" */
export function formatPace(secPerKm: number, units: UnitSystem): string {
  const per = displayPace(secPerKm, units);
  const m = Math.floor(per / 60);
  const s = Math.round(per % 60);
  const carry = s === 60;
  return `${carry ? m + 1 : m}:${String(carry ? 0 : s).padStart(2, '0')} ${paceLabel(units)}`;
}

/** Convenience for a logged set: pace straight from stored distance and time. */
export function formatPaceFor(distanceM: number, timeSec: number, units: UnitSystem): string | null {
  const pace = paceSecPerKm(distanceM, timeSec);
  return pace === null ? null : formatPace(pace, units);
}
