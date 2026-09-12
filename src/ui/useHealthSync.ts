/**
 * Asks Apple Health what the watch recorded, once per app open.
 *
 * Once, and not on a timer. The thing it is waiting for — a watch finishing its sync — happens
 * on a scale of minutes, and polling HealthKit in the background to catch it a little sooner
 * would spend battery on a question whose answer is on the Health screen's own button.
 *
 * Everything it needs to be careful about is in the layers below: it does nothing at all off a
 * phone, nothing unless the switch is on, and nothing to a session that already has a figure.
 */

import { useEffect } from 'react';
import { syncHeartRates } from '../data/healthSync';
import { useApp } from './AppProvider';

/**
 * Long enough to be out of the way of the first paint, which matters more here than anywhere
 * else in the app: this is a permission-gated cross-process query and the one screen nobody
 * opened the app to see.
 */
const DELAY_MS = 2500;

export function useHealthSync(): void {
  const { profile } = useApp();
  const on = profile.appleHealth ?? false;

  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => void syncHeartRates(), DELAY_MS);
    return () => clearTimeout(timer);
  }, [on]);
}
