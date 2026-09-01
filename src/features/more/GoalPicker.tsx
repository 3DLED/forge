/**
 * Choosing what you are training for.
 *
 * Shared by Settings and by the sheet that starts a plan, because it is one answer stored in
 * one place — asking it twice with two different sets of words would be two answers as far as
 * anyone using it is concerned.
 *
 * The note under a goal is not decoration. Picking "lose fat" and being handed heavy triples
 * looks like the app ignored you unless it says why, so the goals that program against
 * expectation explain themselves at the point of choosing.
 */

import { profileRepo } from '../../data/repos';
import { PRIMARY_GOALS, PRIMARY_GOAL_ORDER, goalSpec } from '../../domain/goals';
import type { PrimaryGoal } from '../../domain/goals';
import type { Profile } from '../../domain/types';

export default function GoalPicker({
  profile,
  onPicked,
}: {
  profile: Profile;
  /** Fired after the answer is stored, for callers that want to move on. */
  onPicked?: (goal: PrimaryGoal) => void;
}) {
  const current = profile.primaryGoal;

  const pick = async (goal: PrimaryGoal) => {
    await profileRepo.update(profile.id, { primaryGoal: goal });
    onPicked?.(goal);
  };

  return (
    <>
      {/*
        Wrapped, not the usual scrolling chip row. That row is right for a long scale you skim
        — effort one to ten — but here it would push two of five options off the edge of a
        phone with nothing to say they were there, and this is a question asked once.
      */}
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {PRIMARY_GOAL_ORDER.map((goal) => (
          <button
            key={goal}
            className={`chip${current === goal ? ' on' : ''}`}
            onClick={() => void pick(goal)}
          >
            {PRIMARY_GOALS[goal].label}
          </button>
        ))}
      </div>

      {current && (
        <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
          {goalSpec(current).blurb}
        </p>
      )}

      {current && goalSpec(current).note && (
        <div className="card tight" style={{ marginTop: '0.5rem' }}>
          <p className="small muted" style={{ margin: 0 }}>
            {goalSpec(current).note}
          </p>
        </div>
      )}
    </>
  );
}
