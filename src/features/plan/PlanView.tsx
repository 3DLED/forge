/**
 * The calendar. Month at a glance, tap a day for detail.
 *
 * Deliberately shows planned and completed together: the gap between the two is the whole
 * reason to plan in the first place, and hiding it behind a separate "adherence" screen is
 * how you end up not looking at it.
 */

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import DaySheet from './DaySheet';
import PlanLibrary from './PlanLibrary';
import { plannedBetween, sessionsBetween } from '../../data/sessions';
import { activePlan, calendarExceptions, planAdherence } from '../../data/plans';
import {
  addDays,
  daysBetween,
  isSameMonth,
  monthGrid,
  monthName,
  startOfMonth,
  todayKey,
  weekdayName,
} from '../../domain/dates';
import { resolveDayAvailability } from '../../domain/scheduling';
import type { Weekday } from '../../domain/types';

export default function PlanView() {
  const { profile } = useApp();
  const today = todayKey();
  const [anchor, setAnchor] = useState(() => startOfMonth(today));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const grid = useMemo(
    () => monthGrid(anchor, profile.weekStartsOn),
    [anchor, profile.weekStartsOn],
  );
  const from = grid[0];
  const to = grid[grid.length - 1];

  const planned = useLiveQuery(() => plannedBetween(from, to), [from, to]);
  const logged = useLiveQuery(() => sessionsBetween(from, to), [from, to]);
  const exceptions = useLiveQuery(() => calendarExceptions(), []);
  const plan = useLiveQuery(() => activePlan(), []);
  const adherence = useLiveQuery(
    () => (plan ? planAdherence(plan.startDate, plan.endDate ?? to) : Promise.resolve(null)),
    [plan?.id, plan?.startDate, plan?.endDate, to],
  );

  const weekdayHeaders = Array.from(
    { length: 7 },
    (_, i) => ((profile.weekStartsOn + i) % 7) as Weekday,
  );

  const planTotalWeeks = plan?.endDate
    ? Math.ceil((daysBetween(plan.startDate, plan.endDate) + 1) / 7)
    : null;

  /**
   * Where the plan stands today. A plan scheduled to begin next month has not started, and
   * calling that "week 1 of 12" reads as though you are already behind on it.
   */
  const planStatus = (() => {
    if (!plan) return null;
    const daysUntilStart = daysBetween(today, plan.startDate);
    if (daysUntilStart > 0) {
      return `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`;
    }
    const week = Math.floor(daysBetween(plan.startDate, today) / 7) + 1;
    if (planTotalWeeks && week > planTotalWeeks) return 'Finished';
    return planTotalWeeks ? `Week ${week} of ${planTotalWeeks}` : `Week ${week}`;
  })();

  return (
    <>
      <PageHeader
        title="Plan"
        subtitle={`${monthName(anchor)} ${anchor.slice(0, 4)}`}
        action={
          <span className="row" style={{ gap: '0.25rem' }}>
            <button
              className="btn sm"
              aria-label="Previous month"
              onClick={() => setAnchor(startOfMonth(addDays(anchor, -1)))}
            >
              ‹
            </button>
            <button className="btn sm" onClick={() => setAnchor(startOfMonth(today))}>
              Today
            </button>
            <button
              className="btn sm"
              aria-label="Next month"
              onClick={() => setAnchor(startOfMonth(addDays(anchor, 32)))}
            >
              ›
            </button>
          </span>
        }
      />

      {plan && (
        <div className="card tight">
          <div className="row between">
            <div className="grow">
              <strong>{plan.name}</strong>
              <div className="tiny faint">
                {planStatus}
                {plan.goal.eventDate && ` · ${daysBetween(today, plan.goal.eventDate)} days to race`}
              </div>
            </div>
            {adherence?.ratio != null && (
              <span className={`pill ${adherence.ratio >= 0.8 ? 'good' : adherence.ratio >= 0.5 ? 'warn' : ''}`}>
                {Math.round(adherence.ratio * 100)}% done
              </span>
            )}
          </div>
        </div>
      )}

      <div className="calendar" style={{ marginTop: '0.5rem' }}>
        {weekdayHeaders.map((weekday) => (
          <div className="cal-weekday" key={weekday}>
            {weekdayName(weekday, true).slice(0, 2)}
          </div>
        ))}

        {grid.map((day) => {
          const dayPlanned = (planned ?? []).filter((p) => p.date === day);
          const dayLogged = (logged ?? []).filter((s) => s.date === day && s.endedAt);
          const availability = resolveDayAvailability(day, profile.availability, exceptions ?? []);
          const isBlackout = (exceptions ?? []).some(
            (e) => e.kind === 'blackout' && day >= e.startDate && day <= e.endDate,
          );

          const classes = [
            'cal-day',
            isSameMonth(day, anchor) ? '' : 'outside',
            day === today ? 'today' : '',
            isBlackout ? 'blocked' : availability.blocked ? 'rest' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={day}
              className={classes}
              onClick={() => setOpenDay(day)}
              aria-label={`${day}, ${dayPlanned.length} planned, ${dayLogged.length} completed`}
            >
              {Number(day.slice(8))}
              <span className="cal-dots">
                {dayLogged.map((session) => (
                  <span className="cal-dot done" key={session.id} />
                ))}
                {dayPlanned
                  .filter((p) => p.status !== 'completed')
                  .map((p) => (
                    <span
                      className={`cal-dot${p.status === 'skipped' ? ' skipped' : ''}`}
                      key={p.id}
                    />
                  ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><i className="cal-dot" /> Planned</span>
        <span><i className="cal-dot done" /> Done</span>
        <span><i className="cal-dot skipped" /> Skipped</span>
        <span style={{ opacity: 0.6 }}>Striped = blocked out</span>
      </div>

      <button
        className="btn primary block"
        style={{ marginTop: '1rem' }}
        onClick={() => setBrowsing(true)}
      >
        {plan ? 'Browse plans' : 'Start a plan'}
      </button>

      {!plan && (
        <p className="tiny faint" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          Or tap any day to add a single session.
        </p>
      )}

      {openDay && <DaySheet date={openDay} onClose={() => setOpenDay(null)} />}
      {browsing && <PlanLibrary onClose={() => setBrowsing(false)} />}
    </>
  );
}
