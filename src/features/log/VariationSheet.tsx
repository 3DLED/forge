/**
 * Swapping a movement for an easier or harder version of the same thing.
 *
 * Shown as a ladder with your current rung marked, not as a menu of alternatives. That
 * framing is the whole point: the question being asked is almost never "what else could I
 * do", it is "this is too hard today" or "this got easy" — and both are answered by seeing
 * where you are standing and what is one step either side.
 *
 * Ordered easiest to hardest and banded into beginner / intermediate / advanced, because that
 * is the vocabulary people already use about themselves. Movements your equipment rules out
 * stay visible but dimmed, for the same reason the exercise picker keeps them: hiding a
 * movement you know exists makes the library look broken, while greying it shows you what the
 * next rung would need.
 */

import { useMemo, useState } from 'react';
import Sheet from '../../ui/Sheet';
import { useApp } from '../../ui/AppProvider';
import {
  BAND_LABELS,
  BAND_ORDER,
  bandOf,
  levelOf,
  levelPips,
  variationsOf,
} from '../../domain/difficulty';
import type { Exercise } from '../../domain/types';

export default function VariationSheet({
  exercise,
  available,
  onPick,
  onClose,
}: {
  exercise: Exercise;
  /** Movements performable with the equipment on hand for this session. */
  available: Set<string>;
  onPick: (next: Exercise) => void | Promise<void>;
  onClose: () => void;
}) {
  const { exercises } = useApp();
  const [showAll, setShowAll] = useState(false);

  const variations = useMemo(
    () => variationsOf(exercise, exercises, available),
    [exercise, exercises, available],
  );

  /*
   * Unavailable rungs are collapsed behind a toggle by default. A full gym's worth of
   * machines listed under a bodyweight session is a lot of grey to scroll past when you are
   * standing in a hotel room, but the current movement always stays visible even if the
   * session's equipment no longer covers it.
   */
  const shown = showAll ? variations : variations.filter((v) => v.available || v.current);
  const hiddenCount = variations.length - shown.length;

  const currentLevel = levelOf(exercise);

  return (
    <Sheet title={`Swap ${exercise.name}`} onClose={onClose}>
      <p className="small muted">
        {BAND_LABELS[bandOf(currentLevel)]} · level {currentLevel} of 5. Everything here trains
        the same pattern — pick a rung down if today is not the day, or up if this has stopped
        being hard.
      </p>

      {BAND_ORDER.map((band) => {
        const inBand = shown.filter((v) => v.band === band);
        if (inBand.length === 0) return null;

        return (
          <div key={band}>
            <div className="section-title">{BAND_LABELS[band]}</div>
            {inBand.map((variation) => (
              <button
                key={variation.exercise.id}
                className={`pick variation${variation.current ? ' selected' : ''}${
                  variation.available ? '' : ' unavailable'
                }`}
                onClick={() => {
                  if (variation.current) onClose();
                  else void onPick(variation.exercise);
                }}
              >
                <span className="grow">
                  <span style={{ fontWeight: 600 }}>{variation.exercise.name}</span>
                  <br />
                  <span className="tiny faint">
                    <span className="pips">{levelPips(variation.level)}</span>
                    {variation.current && ' · doing this now'}
                    {!variation.available && ' · no equipment for this'}
                  </span>
                </span>
                {variation.current ? (
                  <span className="pill">Current</span>
                ) : (
                  <span className={`pill${variation.available ? ' accent' : ''}`}>Swap</span>
                )}
              </button>
            ))}
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <button className="btn block" style={{ marginTop: '0.5rem' }} onClick={() => setShowAll(true)}>
          Show {hiddenCount} more you don’t have equipment for
        </button>
      )}
    </Sheet>
  );
}
