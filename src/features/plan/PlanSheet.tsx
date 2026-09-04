/**
 * The active plan, opened from the calendar.
 *
 * Ending a plan used to live in the plan library — the screen you go to in order to *start*
 * one — which meant stopping the thing you were doing required going to the place you pick a
 * new thing. The plan is on the calendar; what you can do to it belongs there too.
 *
 * Two numbers, kept apart on purpose. Progress is how much of the whole plan is behind you,
 * which is what a percentage next to "week 3 of 12" is read as. Adherence is how much of what
 * was due you actually did, which is a different question and the more uncomfortable one —
 * you can be 40% through a plan and have missed most of it. Showing either alone invites it
 * to be mistaken for the other, so both appear, labelled.
 */

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import AskSheet from '../../ui/AskSheet';
import { plural } from '../../ui/text';
import { endPlan, planProgress } from '../../data/plans';
import { daysBetween, formatDayLabel, todayKey } from '../../domain/dates';
import type { Plan } from '../../domain/types';

export default function PlanSheet({
  plan,
  weekLabel,
  onClose,
  onEnded,
}: {
  plan: Plan;
  /** "Week 3 of 12", worked out by the calendar, which already needs it for the header. */
  weekLabel: string | null;
  onClose: () => void;
  /**
   * Ending a plan takes it off the calendar, which unmounts this sheet before it could say
   * what happened. The calendar reports it instead — it is the thing still on screen.
   */
  onEnded: (message: string) => void;
}) {
  const progress = useLiveQuery(() => planProgress(plan.id), [plan.id]);
  const [ending, setEnding] = useState(false);

  const today = todayKey();
  const done = progress?.completed ?? 0;
  const total = progress?.total ?? 0;

  return (
    <>
      <Sheet title={plan.name} onClose={onClose}>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <span className="grow">{weekLabel}</span>
          <span className="mono">
            <strong>{Math.round((progress?.ratio ?? 0) * 100)}%</strong>
          </span>
        </div>

        {/* The bar is the point: how much is behind you, at a glance. */}
        <div
          className="bar"
          role="img"
          aria-label={`${done} of ${total} sessions done`}
          style={{
            height: 8,
            background: 'var(--surface-3)',
            borderRadius: 4,
            overflow: 'hidden',
            marginTop: '0.4rem',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.round((progress?.ratio ?? 0) * 100)}%`,
              background: 'var(--good)',
            }}
          />
        </div>

        <div className="tiny faint" style={{ marginTop: '0.35rem' }}>
          {plural(done, 'session')} done of {total}
          {(progress?.skipped ?? 0) > 0 && ` · ${progress?.skipped} skipped`}
          {(progress?.remaining ?? 0) > 0 && ` · ${progress?.remaining} to go`}
        </div>

        <div className="section-title">Dates</div>
        <div className="card tight">
          <div className="row between">
            <span className="grow small">Started</span>
            <span className="tiny faint">{formatDayLabel(plan.startDate)}</span>
          </div>
          {plan.endDate && (
            <div className="row between" style={{ marginTop: '0.2rem' }}>
              <span className="grow small">Ends</span>
              <span className="tiny faint">
                {formatDayLabel(plan.endDate)}
                {daysBetween(today, plan.endDate) > 0 &&
                  ` · ${plural(daysBetween(today, plan.endDate), 'day')} left`}
              </span>
            </div>
          )}
          {plan.goal.eventDate && (
            <div className="row between" style={{ marginTop: '0.2rem' }}>
              <span className="grow small">Race day</span>
              <span className="tiny faint">
                {formatDayLabel(plan.goal.eventDate)} ·{' '}
                {plural(daysBetween(today, plan.goal.eventDate), 'day')} away
              </span>
            </div>
          )}
        </div>

        {progress?.adherence != null && (
          <>
            <div className="section-title">Keeping up</div>
            <div className="card tight">
              <div className="row between">
                <span className="grow small">
                  Of the {plural(progress.due, 'session')} due so far
                </span>
                <span
                  className={`pill ${
                    progress.adherence >= 0.8 ? 'good' : progress.adherence >= 0.5 ? 'warn' : ''
                  }`}
                >
                  {Math.round(progress.adherence * 100)}%
                </span>
              </div>
              <div className="tiny faint" style={{ marginTop: '0.25rem' }}>
                A different question to the one above — you can be part-way through a plan
                and have missed most of what it asked for.
              </div>
            </div>
          </>
        )}

        <button
          className="btn block ghost danger"
          style={{ marginTop: '0.9rem' }}
          onClick={() => setEnding(true)}
        >
          End this plan
        </button>
      </Sheet>

      {ending && (
        <AskSheet
          title={`End “${plan.name}”?`}
          message="Sessions you have already logged stay exactly as they are. Only the ones still ahead of you are cleared off the calendar."
          confirmLabel="End it"
          danger
          onCancel={() => setEnding(false)}
          onConfirm={async () => {
            const removed = await endPlan(plan);
            setEnding(false);
            onEnded(
              `Plan ended. ${plural(removed, 'upcoming session')} cleared — everything you logged stays.`,
            );
          }}
        />
      )}
    </>
  );
}
