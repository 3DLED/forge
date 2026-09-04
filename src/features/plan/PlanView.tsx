/**
 * The calendar. Month at a glance, tap a day for detail.
 *
 * Deliberately shows planned and completed together: the gap between the two is the whole
 * reason to plan in the first place, and hiding it behind a separate "adherence" screen is
 * how you end up not looking at it.
 */

import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import DaySheet from './DaySheet';
import PlanLibrary from './PlanLibrary';
import PlanSheet from './PlanSheet';
import ImportSheet from '../more/ImportSheet';
import { plannedBetween, sessionsBetween } from '../../data/sessions';
import { activePlan, calendarExceptions, planProgress } from '../../data/plans';
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
import type { DayKey, Weekday } from '../../domain/types';

/** How far a finger has to travel across the grid before it counts as a month change. */
const SWIPE_PX = 50;

/**
 * The month either side of `key`.
 *
 * Stepping a day back from the first lands on the last of the previous month; stepping 32
 * forward clears even a 31-day month without ever skipping one, since the shortest month
 * still leaves you on the 5th at the far end.
 */
function shiftMonth(key: DayKey, delta: -1 | 1): DayKey {
  return startOfMonth(delta < 0 ? addDays(key, -1) : addDays(key, 32));
}

export default function PlanView() {
  const { profile } = useApp();
  const today = todayKey();
  const [anchor, setAnchor] = useState(() => startOfMonth(today));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [openPlan, setOpenPlan] = useState(false);
  const [importingPlan, setImportingPlan] = useState(false);
  /** Said out loud after a plan ends, because the card that was there has gone. */
  const [planNotice, setPlanNotice] = useState<string | null>(null);

  /*
   * Swipe state.
   *
   * `swiped` is what stops a swipe from also opening whichever day it happened to start on:
   * a horizontal drag across a grid of buttons still delivers a click to the one under the
   * finger, so the day handler checks this flag before opening its sheet. A ref rather than
   * state, because that click arrives in the same tick as the touchend and a re-render would
   * come too late to be consulted.
   */
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  /**
   * The grid itself, moved directly rather than through state.
   *
   * A swipe that does nothing until you lift your finger reads as a swipe that did not
   * register, so the calendar tracks the drag. It does so by writing to the node: re-rendering
   * forty-two day cells on every touchmove is a great deal of work to move one element, and it
   * shows on a phone.
   */
  const gridRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  /** Damped, so it reads as attached to the finger rather than sliding loose. */
  const FOLLOW = 0.55;

  const settle = (animate: boolean) => {
    const node = gridRef.current;
    if (!node) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    node.style.transition = animate && !reduced ? 'transform 180ms ease-out, opacity 180ms ease-out' : 'none';
    node.style.transform = '';
    node.style.opacity = '';
  };

  const onTouchStart = (event: React.TouchEvent) => {
    const point = event.touches[0];
    touchStart.current = { x: point.clientX, y: point.clientY };
    swiped.current = false;
    dragging.current = false;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    const start = touchStart.current;
    const node = gridRef.current;
    if (!start || !node) return;

    const point = event.touches[0];
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;

    // Leave vertical drags alone; the page still has to scroll.
    if (!dragging.current && Math.abs(dx) <= Math.abs(dy)) return;
    dragging.current = true;

    node.style.transition = 'none';
    node.style.transform = `translateX(${dx * FOLLOW}px)`;
    // Fading towards the edge says the month is leaving, not that the grid came loose.
    node.style.opacity = String(1 - Math.min(Math.abs(dx) / 500, 0.4));
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    dragging.current = false;
    if (!start) {
      settle(true);
      return;
    }

    const point = event.changedTouches[0];
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;

    // Comfortably horizontal, or it was a page scroll that drifted sideways on the way.
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) {
      settle(true);
      return;
    }

    swiped.current = true;
    setAnchor((current) => shiftMonth(current, dx < 0 ? 1 : -1));
    // The new month arrives in place rather than sliding back from where the old one went.
    settle(false);
  };

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
  /*
   * Counted over the whole plan by its id, not over the month on screen. The old figure moved
   * as you paged the calendar, because its range ended at the last day of the visible grid.
   */
  const progress = useLiveQuery(
    () => (plan ? planProgress(plan.id) : Promise.resolve(null)),
    [plan?.id],
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
              onClick={() => setAnchor((current) => shiftMonth(current, -1))}
            >
              ‹
            </button>
            <button className="btn sm" onClick={() => setAnchor(startOfMonth(today))}>
              Today
            </button>
            <button
              className="btn sm"
              aria-label="Next month"
              onClick={() => setAnchor((current) => shiftMonth(current, 1))}
            >
              ›
            </button>
          </span>
        }
      />

      {planNotice && (
        <div className="card tight">
          <p className="small" style={{ margin: 0 }}>
            {planNotice}
          </p>
          <button
            className="btn sm ghost"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setPlanNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/*
        The card is the way in to the plan. Everything you might want to do to a plan — read
        where it stands, stop it — used to live in the library you go to in order to start a
        different one.
      */}
      {plan && (
        <button
          className="card tight plan-card"
          onClick={() => setOpenPlan(true)}
          aria-label={`Open ${plan.name}`}
        >
          <div className="row between">
            <div className="grow">
              <strong>{plan.name}</strong>
              <div className="tiny faint">
                {planStatus}
                {plan.goal.eventDate && ` · ${daysBetween(today, plan.goal.eventDate)} days to race`}
              </div>
            </div>
            {/*
              Progress through the plan, not adherence to date. Next to "week 3 of 12" a
              percentage is read as how far along you are, so that is what it now says; the
              stricter question keeps its own labelled place inside.
            */}
            {progress != null && progress.total > 0 && (
              <span className="pill">{Math.round(progress.ratio * 100)}% done</span>
            )}
          </div>
        </button>
      )}

      <div
        className="calendar"
        ref={gridRef}
        // pan-y keeps vertical scrolling with the browser while we take the horizontal axis.
        style={{ marginTop: '0.5rem', touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touchStart.current = null;
          dragging.current = false;
          settle(true);
        }}
      >
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
              onClick={() => {
                if (swiped.current) return;
                setOpenDay(day);
              }}
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

      <p className="tiny faint" style={{ textAlign: 'center', marginTop: '0.35rem' }}>
        Swipe the calendar to change month.
      </p>

      <button
        className="btn primary block"
        style={{ marginTop: '1rem' }}
        onClick={() => setBrowsing(true)}
      >
        {plan ? 'Browse plans' : 'Start a plan'}
      </button>

      {/* A plan someone sent you, or one you exported from another phone. */}
      <button
        className="btn block"
        style={{ marginTop: '0.5rem' }}
        onClick={() => setImportingPlan(true)}
      >
        📥 Import a plan
      </button>

      {!plan && (
        <p className="tiny faint" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          Or tap any day to add a single session.
        </p>
      )}

      {openDay && <DaySheet date={openDay} onClose={() => setOpenDay(null)} />}
      {browsing && <PlanLibrary onClose={() => setBrowsing(false)} />}

      {importingPlan && (
        <ImportSheet
          expecting="plan"
          onClose={() => setImportingPlan(false)}
          onImported={(message) => {
            setImportingPlan(false);
            setPlanNotice(message);
          }}
        />
      )}

      {openPlan && plan && (
        <PlanSheet
          plan={plan}
          weekLabel={planStatus}
          onClose={() => setOpenPlan(false)}
          onEnded={(message) => {
            setOpenPlan(false);
            setPlanNotice(message);
          }}
        />
      )}
    </>
  );
}
