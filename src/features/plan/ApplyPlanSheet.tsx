/**
 * Configure a plan, see exactly what it would do, then commit.
 *
 * The preview is the point. Applying a twelve-week program writes fifty-odd sessions onto
 * your calendar, and doing that sight-unseen is how people end up with a plan they quietly
 * abandon. Conflicts and equipment swaps are shown *before* anything is written.
 */

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import { useApp } from '../../ui/AppProvider';
import { applyPlan, calendarExceptions } from '../../data/plans';
import { SEED_SESSION_TEMPLATE_BY_SLUG } from '../../data/seed/sessionTemplates';
import type { SeedPlanTemplate } from '../../data/seed/planTemplates';
import {
  ONGOING_PLAN_WEEKS,
  generatePlan,
  startDateForRace,
} from '../../domain/planning';
import { addDays, formatDayLabel, startOfWeek, todayKey } from '../../domain/dates';
import { formatDistance } from '../../domain/units';

export default function ApplyPlanSheet({
  template,
  onClose,
  onApplied,
}: {
  template: SeedPlanTemplate;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { profile, units, exerciseBySlug, available, activeEquipment } = useApp();
  const exceptions = useLiveQuery(() => calendarExceptions(), []);

  const isRace = template.goal === 'race';
  const defaultStart = startOfWeek(addDays(todayKey(), 7), profile.weekStartsOn);

  const [weeks, setWeeks] = useState(template.weeks ?? ONGOING_PLAN_WEEKS);
  const [manualStart, setManualStart] = useState(defaultStart);
  const [raceDate, setRaceDate] = useState('');
  const [saving, setSaving] = useState(false);

  // A race date pins the finish; everything else counts forward from a start date.
  const startDate =
    isRace && raceDate ? startDateForRace(raceDate, weeks, profile.weekStartsOn) : manualStart;

  const generated = useMemo(
    () =>
      generatePlan({
        template,
        startDate,
        weeks,
        availability: profile.availability,
        exceptions: exceptions ?? [],
        weekStartsOn: profile.weekStartsOn,
        exerciseBySlug,
        available,
        sessionTemplateBySlug: SEED_SESSION_TEMPLATE_BY_SLUG,
      }),
    [template, startDate, weeks, profile.availability, profile.weekStartsOn, exceptions, exerciseBySlug, available],
  );

  /** One line per week: how many sessions, and the long run if there is one. */
  const weekRows = useMemo(() => {
    const rows = new Map<number, { count: number; deload: boolean; longestM: number }>();
    for (const session of generated.sessions) {
      const row = rows.get(session.weekIndex) ?? { count: 0, deload: session.isDeload, longestM: 0 };
      row.count++;
      row.deload = session.isDeload;
      for (const block of session.prescription.blocks) {
        for (const item of block.items) {
          if (item.distanceM && item.distanceM > row.longestM) row.longestM = item.distanceM;
        }
      }
      rows.set(session.weekIndex, row);
    }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]);
  }, [generated]);

  const trainingDays = profile.availability.filter((r) => r.allowedModalities.length > 0).length;

  return (
    <Sheet
      title={template.name}
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={saving || generated.sessions.length === 0}
          onClick={async () => {
            setSaving(true);
            await applyPlan({
              template,
              generated,
              startDate,
              eventDate: isRace && raceDate ? raceDate : undefined,
              equipmentProfileId: activeEquipment?.id,
              replaceExisting: true,
            });
            onApplied();
          }}
        >
          {saving ? 'Adding to calendar…' : `Add ${generated.sessions.length} sessions to calendar`}
        </button>
      }
    >
      <p className="small muted">{template.description}</p>

      {trainingDays < template.daysPerWeek && (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="pill warn">Heads up</span>
          <p className="small" style={{ margin: '0.5rem 0 0' }}>
            This plan wants {template.daysPerWeek} days a week, but your availability allows{' '}
            {trainingDays}. Sessions that will not fit are listed below — widen your
            availability in Settings, or expect to double up.
          </p>
        </div>
      )}

      {isRace && (
        <>
          <div className="section-title">Race day</div>
          <input
            type="date"
            value={raceDate}
            min={todayKey()}
            onChange={(event) => setRaceDate(event.target.value)}
            aria-label="Race date"
          />
          <p className="tiny faint">
            {raceDate
              ? `Training starts ${formatDayLabel(startDate)} and tapers into race day.`
              : 'Optional. Set it and the plan counts backwards so the taper lands right.'}
          </p>
        </>
      )}

      {!(isRace && raceDate) && (
        <>
          <div className="section-title">Start</div>
          <input
            type="date"
            value={manualStart}
            onChange={(event) => setManualStart(event.target.value)}
            aria-label="Start date"
          />
          <p className="tiny faint">
            Nothing is scheduled before {formatDayLabel(startDate)}.
          </p>
        </>
      )}

      {template.weeks === null && (
        <>
          <div className="section-title">How many weeks to lay down</div>
          <div className="chip-row">
            {[4, 8, 12, 16, 26].map((option) => (
              <button
                key={option}
                className={`chip${weeks === option ? ' on' : ''}`}
                onClick={() => setWeeks(option)}
              >
                {option} weeks
              </button>
            ))}
          </div>
          <p className="tiny faint">
            This plan has no end. Lay down a stretch now and extend it whenever you like.
          </p>
        </>
      )}

      <div className="section-title">What you'll get</div>
      <div className="card tight">
        {weekRows.slice(0, 8).map(([weekIndex, row]) => (
          <div className="week-row" key={weekIndex}>
            <span className="week-no">Wk {weekIndex}</span>
            <span className="grow small">
              {row.count} session{row.count === 1 ? '' : 's'}
              {row.longestM > 0 && ` · longest ${formatDistance(row.longestM, units)}`}
            </span>
            {row.deload && <span className="pill">easy</span>}
          </div>
        ))}
        {weekRows.length > 8 && (
          <p className="tiny faint" style={{ margin: '0.5rem 0 0' }}>
            …and {weekRows.length - 8} more weeks, through {formatDayLabel(generated.endDate)}.
          </p>
        )}
      </div>

      {generated.substitutions.length > 0 && (
        <>
          <div className="section-title">Swapped for your equipment</div>
          <div className="card tight">
            <p className="tiny faint" style={{ marginTop: 0 }}>
              Using <strong>{activeEquipment?.name}</strong>. These movements were replaced with
              the closest thing you can actually do.
            </p>
            {generated.substitutions.slice(0, 8).map((swap) => (
              <div className="row between small" key={`${swap.from}-${swap.to}`} style={{ padding: '0.15rem 0' }}>
                <span className="truncate">
                  {exerciseBySlug.get(swap.from)?.name ?? swap.from} →{' '}
                  <strong>{exerciseBySlug.get(swap.to)?.name ?? swap.to}</strong>
                </span>
                <span className="tiny faint">×{swap.count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {generated.unavailable.length > 0 && (
        <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
          <span className="pill warn">No substitute</span>
          <p className="small" style={{ margin: '0.5rem 0 0' }}>
            {generated.unavailable
              .map((slug) => exerciseBySlug.get(slug)?.name ?? slug)
              .join(', ')}{' '}
            — prescribed as written, but you have no equipment for these and nothing close
            enough to swap in.
          </p>
        </div>
      )}

      {generated.conflicts.length > 0 && (
        <>
          <div className="section-title">Couldn't be scheduled</div>
          <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
            {generated.conflicts.slice(0, 6).map((conflict, index) => (
              <div className="small" key={index} style={{ padding: '0.15rem 0' }}>
                <strong>Week {conflict.weekIndex}</strong> · {conflict.sessionName} —{' '}
                <span className="faint">{conflict.reason.toLowerCase()}</span>
              </div>
            ))}
            {generated.conflicts.length > 6 && (
              <p className="tiny faint" style={{ marginBottom: 0 }}>
                …and {generated.conflicts.length - 6} more.
              </p>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
