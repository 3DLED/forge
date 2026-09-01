/**
 * What changing your week would do to the plan, before it does it.
 *
 * Applying this rewrites dates across the calendar and removes sessions outright, which is
 * more than a settings toggle should ever do without showing its working first. So every move
 * and every drop is listed by name, and nothing is written until the button at the bottom.
 *
 * Modelled on ApplyPlanSheet, which makes the same argument about writing fifty sessions
 * sight-unseen.
 */

import { useState } from 'react';
import Sheet from '../../ui/Sheet';
import { plural } from '../../ui/text';
import { applyReshuffle } from '../../data/plans';
import { formatDayLabel, weekdayName, weekdayOf } from '../../domain/dates';
import type { ReshufflePlan } from '../../domain/reshuffle';

/** "Wed 7 → Thu 8" — the weekday is the part you actually think in. */
function dayLabel(date: string): string {
  return `${weekdayName(weekdayOf(date), true)} ${Number(date.slice(8))}`;
}

export default function ReshuffleSheet({
  plan,
  onClose,
  onApplied,
}: {
  plan: ReshufflePlan;
  onClose: () => void;
  onApplied: (result: { moved: number; dropped: number }) => void;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <Sheet
      title="Fit the plan to your week"
      onClose={onClose}
      footer={
        <div className="stack">
          <button
            className="btn primary block"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              onApplied(await applyReshuffle(plan));
            }}
          >
            {saving ? 'Moving…' : 'Move them'}
          </button>
          <button className="btn block" onClick={onClose} disabled={saving}>
            Leave the plan alone
          </button>
        </div>
      }
    >
      <p className="small muted">
        Your availability no longer matches where these sessions sit. Completed and skipped
        sessions are never touched, and nothing before today moves.
      </p>

      {plan.moves.length > 0 && (
        <>
          <div className="section-title">{plural(plan.moves.length, 'session')} moving</div>
          {plan.moves.map((move) => (
            <div className="card tight" key={move.session.id}>
              <div className="row between">
                <span className="grow truncate">{move.session.prescription.name}</span>
                <span className="small mono">
                  {dayLabel(move.from)} → <strong>{dayLabel(move.to)}</strong>
                </span>
              </div>
              <div className="tiny faint">{formatDayLabel(move.to)}</div>
            </div>
          ))}
        </>
      )}

      {plan.drops.length > 0 && (
        <>
          <div className="section-title">
            {plural(plan.drops.length, 'session')} coming off the calendar
          </div>
          {plan.drops.map((drop) => (
            <div className="card tight" key={drop.session.id}>
              <div className="row between">
                <span className="grow truncate">{drop.session.prescription.name}</span>
                <span className="pill warn">{dayLabel(drop.session.date)}</span>
              </div>
              <div className="tiny faint">{drop.reason}</div>
            </div>
          ))}
          <p className="tiny faint">
            Dropped sessions are removed from the plan, not from your history. Your adherence
            is measured against what remains.
          </p>
        </>
      )}

      {plan.kept > 0 && (
        <p className="tiny faint" style={{ marginTop: '0.75rem' }}>
          {plural(plan.kept, 'other session')} already {plan.kept === 1 ? 'fits' : 'fit'} your
          week and will not move.
        </p>
      )}
    </Sheet>
  );
}
