/**
 * Which weights you actually own.
 *
 * This is the screen the load chart, the progression rules and the test ladder have all been
 * quietly waiting for. They round every number they produce to a real load, and until now had
 * nothing to round to — so a kettlebell prescription came back as 36.5 kg and a bench press
 * test opened at 134.5 lb.
 *
 * Bells and bars ask different questions, because they are different objects. A bell you own
 * or you do not, so the answer is a list you tick. A bar's loads are made rather than owned:
 * you have a bar and some plates, and 135 lb is what those add up to. Asking for the list of
 * makeable weights directly would be asking you to do that arithmetic by hand.
 *
 * Everything shows what it produces as you go — how many loads, the range, the smallest step
 * between them. That last number is the one that matters and the one nobody thinks about: it
 * is the size of the smallest progression you can actually make.
 */

import { useState } from 'react';
import { equipmentProfileRepo } from '../../data/repos';
import {
  COMMON_BARS,
  COMMON_DUMBBELLS,
  COMMON_KETTLEBELLS,
  COMMON_PLATES,
  DEFAULT_BAR_KG,
  barbellLoads,
  hasBarbellLoads,
  type PlatePair,
} from '../../domain/rack';
import { formatWeight, inputWeightToKg, lbToKg, weightLabel } from '../../domain/units';
import { plural } from '../../ui/text';
import type { EquipmentProfile, UnitSystem } from '../../domain/types';

/** Stored kilos never compare exactly after a pound conversion. */
const SAME = 0.01;
const owns = (list: number[], kg: number) => list.some((have) => Math.abs(have - kg) < SAME);

/** The standard sizes to offer, already in kilos, for the unit system in use. */
function standardLoads(sizes: { kg: readonly number[]; lb: readonly number[] }, units: UnitSystem) {
  return units === 'imperial' ? sizes.lb.map(lbToKg) : [...sizes.kg];
}

/** "12 loads · 45–225 lb · 5 lb steps" — what the rack actually buys you. */
function describe(loads: number[], units: UnitSystem): string | null {
  if (loads.length === 0) return null;
  const sorted = [...loads].sort((a, b) => a - b);
  if (sorted.length === 1) return `Just ${formatWeight(sorted[0], units)}`;

  const gaps = sorted.slice(1).map((load, i) => load - sorted[i]);
  const smallest = Math.min(...gaps);

  return [
    plural(sorted.length, 'load'),
    `${formatWeight(sorted[0], units, false)}–${formatWeight(sorted.at(-1)!, units)}`,
    `smallest step ${formatWeight(smallest, units)}`,
  ].join(' · ');
}

export default function RackEditor({
  target,
  units,
}: {
  target: EquipmentProfile;
  units: UnitSystem;
}) {
  const [adding, setAdding] = useState<'kettlebell' | 'dumbbell' | null>(null);
  const [custom, setCustom] = useState('');

  const kettlebells = target.availableWeightsKg?.kettlebell ?? [];
  const dumbbells = target.availableWeightsKg?.dumbbell ?? [];
  const barbell = target.barbell;

  const saveBells = async (kind: 'kettlebell' | 'dumbbell', loads: number[]) => {
    await equipmentProfileRepo.update(target.id, {
      availableWeightsKg: {
        ...target.availableWeightsKg,
        [kind]: [...loads].sort((a, b) => a - b),
      },
    });
  };

  const toggleBell = (kind: 'kettlebell' | 'dumbbell', current: number[], kg: number) =>
    saveBells(
      kind,
      owns(current, kg) ? current.filter((have) => Math.abs(have - kg) >= SAME) : [...current, kg],
    );

  const saveBarbell = async (next: Partial<{ barKg: number; plates: PlatePair[] }>) => {
    await equipmentProfileRepo.update(target.id, {
      barbell: {
        barKg: next.barKg ?? barbell?.barKg ?? DEFAULT_BAR_KG,
        plates: next.plates ?? barbell?.plates ?? [],
      },
    });
  };

  const setPairs = (kg: number, pairs: number) => {
    const others = (barbell?.plates ?? []).filter((plate) => Math.abs(plate.kg - kg) >= SAME);
    const next = pairs > 0 ? [...others, { kg, pairs }] : others;
    return saveBarbell({ plates: next.sort((a, b) => b.kg - a.kg) });
  };

  const bellSection = (
    kind: 'kettlebell' | 'dumbbell',
    label: string,
    current: number[],
    sizes: { kg: readonly number[]; lb: readonly number[] },
  ) => {
    const summary = describe(current, units);

    return (
      <section className="card" key={kind}>
        <div className="row between" style={{ marginBottom: '0.5rem' }}>
          <h3 className="grow">{label}</h3>
          {current.length > 0 && <span className="pill">{current.length}</span>}
        </div>

        <div className="row wrap" style={{ gap: '0.4rem' }}>
          {standardLoads(sizes, units).map((kg) => (
            <button
              key={kg}
              className={`chip${owns(current, kg) ? ' on' : ''}`}
              aria-pressed={owns(current, kg)}
              onClick={() => void toggleBell(kind, current, kg)}
            >
              {formatWeight(kg, units, false)}
            </button>
          ))}
        </div>

        {/* Anything the standard ladder does not cover — adjustable bells, odd sizes. */}
        {current.filter((kg) => !owns(standardLoads(sizes, units), kg)).length > 0 && (
          <div className="row wrap" style={{ gap: '0.4rem', marginTop: '0.4rem' }}>
            {current
              .filter((kg) => !owns(standardLoads(sizes, units), kg))
              .map((kg) => (
                <button
                  key={kg}
                  className="chip on"
                  aria-pressed
                  onClick={() => void toggleBell(kind, current, kg)}
                >
                  {formatWeight(kg, units, false)} ✕
                </button>
              ))}
          </div>
        )}

        {adding === kind ? (
          <div className="row" style={{ gap: '0.4rem', marginTop: '0.5rem' }}>
            <input
              type="number"
              inputMode="decimal"
              value={custom}
              autoFocus
              placeholder={units === 'imperial' ? '37.5' : '18'}
              aria-label={`Weight in ${weightLabel(units)}`}
              onChange={(event) => setCustom(event.target.value)}
              style={{ maxWidth: '7rem' }}
            />
            <button
              className="btn sm primary"
              disabled={!Number(custom)}
              onClick={async () => {
                await toggleBell(kind, current, inputWeightToKg(Number(custom), units));
                setCustom('');
                setAdding(null);
              }}
            >
              Add
            </button>
            <button className="btn sm ghost" onClick={() => { setCustom(''); setAdding(null); }}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="btn sm ghost"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setAdding(kind)}
          >
            + Another size
          </button>
        )}

        <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          {summary ?? 'Nothing ticked, so loads are suggested in round numbers instead of yours.'}
        </p>
      </section>
    );
  };

  const has = (tag: string) => target.items.includes(tag as never);
  const anything = has('kettlebell') || has('dumbbell') || has('barbell');

  if (!anything) return null;

  const barLoads = hasBarbellLoads(barbell) ? barbellLoads(barbell) : [];

  return (
    <>
      <div className="section-title">Weights you own</div>
      <p className="small muted" style={{ marginTop: '-0.25rem' }}>
        Suggested loads, progressions and test ladders all snap to these. Leave a section empty
        and that movement falls back to round numbers.
      </p>

      {has('kettlebell') &&
        bellSection('kettlebell', 'Kettlebells', kettlebells, COMMON_KETTLEBELLS)}
      {has('dumbbell') && bellSection('dumbbell', 'Dumbbells', dumbbells, COMMON_DUMBBELLS)}

      {has('barbell') && (
        <section className="card">
          <div className="row between" style={{ marginBottom: '0.5rem' }}>
            <h3 className="grow">Barbell</h3>
            {barLoads.length > 0 && <span className="pill">{barLoads.length}</span>}
          </div>

          <div className="section-title" style={{ marginTop: 0 }}>The bar</div>
          <div className="row wrap" style={{ gap: '0.4rem' }}>
            {standardLoads(COMMON_BARS, units).map((kg) => {
              const on = Math.abs((barbell?.barKg ?? DEFAULT_BAR_KG) - kg) < SAME;
              return (
                <button
                  key={kg}
                  className={`chip${on && barbell ? ' on' : ''}`}
                  aria-pressed={Boolean(on && barbell)}
                  onClick={() => void saveBarbell({ barKg: kg })}
                >
                  {formatWeight(kg, units, false)}
                </button>
              );
            })}
          </div>

          <div className="section-title">Plates, in pairs</div>
          <p className="tiny faint" style={{ marginTop: '-0.35rem' }}>
            One pair goes on as two plates, one per side — so a pair of{' '}
            {formatWeight(standardLoads(COMMON_PLATES, units).at(-1)!, units)} adds twice that
            to the bar.
          </p>

          {[...standardLoads(COMMON_PLATES, units)].reverse().map((kg) => {
            const owned = (barbell?.plates ?? []).find((p) => Math.abs(p.kg - kg) < SAME);
            const pairs = owned?.pairs ?? 0;

            return (
              <div className="row between" key={kg} style={{ padding: '0.25rem 0' }}>
                <span className="grow">{formatWeight(kg, units)}</span>
                <div className="row" style={{ gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    className="btn sm ghost"
                    aria-label={`One fewer pair of ${formatWeight(kg, units)}`}
                    disabled={pairs === 0}
                    onClick={() => void setPairs(kg, pairs - 1)}
                  >
                    −
                  </button>
                  <span
                    className="mono"
                    style={{ minWidth: '3.5rem', textAlign: 'center' }}
                  >
                    {pairs === 0 ? '—' : plural(pairs, 'pair')}
                  </span>
                  <button
                    className="btn sm ghost"
                    aria-label={`One more pair of ${formatWeight(kg, units)}`}
                    onClick={() => void setPairs(kg, pairs + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}

          <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {describe(barLoads, units) ??
              'No bar set, so barbell loads are suggested in round numbers instead of yours.'}
          </p>
        </section>
      )}
    </>
  );
}
