import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import SessionCard from '../../ui/SessionCard';
import LogRunSheet from '../log/LogRunSheet';
import WeekSheet from './WeekSheet';
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import { plannedBetween, sessionsBetween, startFromPlanned, startSession } from '../../data/sessions';
import {
  addDays,
  monthName,
  todayKey,
  weekDays,
  weekdayName,
  weekdayOf,
} from '../../domain/dates';
import { sessionLoad } from '../../domain/training';

export default function TodayView() {
  const navigate = useNavigate();
  const [loggingRun, setLoggingRun] = useState(false);
  const [openWeek, setOpenWeek] = useState(false);
  const { profile, activeEquipment } = useApp();
  const today = todayKey();
  const week = weekDays(today, profile.weekStartsOn);

  const weekSessions = useLiveQuery(
    () => sessionsBetween(week[0], week[6]),
    [week[0], week[6]],
  );
  const weekPlanned = useLiveQuery(
    () => plannedBetween(week[0], week[6]),
    [week[0], week[6]],
  );

  const todaySessions = (weekSessions ?? []).filter((s) => s.date === today);
  const todayPlanned = (weekPlanned ?? []).filter(
    (p) => p.date === today && p.status === 'planned',
  );
  const weekLoad = (weekSessions ?? []).reduce((total, s) => total + sessionLoad(s), 0);
  /** A session opened but never finished — resuming it beats starting another. */
  const inProgress = todaySessions.find((s) => !s.endedAt);

  const start = async () => {
    const session = await startSession({ name: defaultSessionName() });
    navigate(`/log/${session.id}`);
  };

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={`${weekdayName(weekdayOf(today))}, ${monthName(today, true)} ${Number(today.slice(8))}`}
      />

      {/*
        Week strip: a dot per day, filled where something was actually done.

        The whole strip is the control. Seven separate day targets across a phone width are
        about 40px each, which is under the tap size everything else here is built to, and the
        question the strip provokes — "what was Wednesday?" — is answered by the week, not by
        one day in isolation.
      */}
      <button
        className="card tight week-strip"
        onClick={() => setOpenWeek(true)}
        aria-label="Show this week's workouts"
      >
        <div className="row between" style={{ marginBottom: '0.5rem' }}>
          <span className="tiny faint" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            This week
          </span>
          {weekLoad > 0 && <span className="pill">load {weekLoad}</span>}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {week.map((day) => {
            const logged = (weekSessions ?? []).some((s) => s.date === day && s.endedAt);
            const planned = (weekPlanned ?? []).some((p) => p.date === day && p.status === 'planned');
            const isToday = day === today;
            return (
              <div key={day} style={{ textAlign: 'center', flex: 1 }}>
                <div className="tiny faint">{weekdayName(weekdayOf(day), true).slice(0, 1)}</div>
                <div
                  style={{
                    margin: '0.25rem auto 0',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: logged ? 'var(--good)' : planned ? 'var(--accent)' : 'var(--surface-3)',
                    outline: isToday ? '2px solid var(--accent)' : undefined,
                    outlineOffset: '2px',
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="tiny faint" style={{ marginTop: '0.4rem' }}>
          Tap for the week
        </div>
      </button>

      {openWeek && <WeekSheet days={week} onClose={() => setOpenWeek(false)} />}

      {todayPlanned.length > 0 && <div className="section-title">Planned for today</div>}
      {todayPlanned.map((planned) => (
        <div className="card" key={planned.id}>
          <div className="card-head" style={{ marginBottom: '0.35rem' }}>
            <h3 className="truncate grow">{planned.prescription.name}</h3>
            {planned.prescription.estimatedMinutes && (
              <span className="pill">{planned.prescription.estimatedMinutes} min</span>
            )}
          </div>
          <div className="small muted">
            {plural(planned.prescription.blocks.reduce((n, b) => n + b.items.length, 0), 'movement')}
          </div>
          <button
            className="btn primary block"
            style={{ marginTop: '0.6rem' }}
            onClick={async () => {
              const session = await startFromPlanned(planned);
              navigate(`/log/${session.id}`);
            }}
          >
            Start
          </button>
        </div>
      ))}

      {todaySessions.length > 0 && <div className="section-title">Today's sessions</div>}
      {todaySessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}

      {todaySessions.length === 0 && todayPlanned.length === 0 && (
        <div className="empty">
          <span className="glyph">🔥</span>
          <p>Nothing logged today.</p>
          <p className="small faint">
            Training as <strong>{activeEquipment?.name ?? 'no equipment set'}</strong>.
          </p>
        </div>
      )}

      {/*
        The accent goes to the most likely next action, not to a fixed button. With a session
        already open, "Start a workout" as the loudest control quietly invites you to begin a
        second one and split the day's training across two records.
      */}
      {inProgress && (
        <button
          className="btn primary block"
          style={{ marginTop: '0.5rem' }}
          onClick={() => navigate(`/log/${inProgress.id}`)}
        >
          Continue {inProgress.name}
        </button>
      )}

      <button
        className={`btn block${inProgress ? '' : ' primary'}`}
        onClick={start}
        style={{ marginTop: '0.5rem' }}
      >
        {inProgress ? 'Start a separate workout' : 'Start a workout'}
      </button>

      {/*
        A run is already finished by the time you are looking at this, so it does not want the
        session flow at all — it wants somewhere to put three numbers.
      */}
      <button className="btn block" onClick={() => setLoggingRun(true)} style={{ marginTop: '0.5rem' }}>
        🏃 Log a run
      </button>

      {loggingRun && (
        <LogRunSheet
          onClose={() => setLoggingRun(false)}
          // Stays here rather than opening the session. The run is over; landing in a logger
          // that offers to start a clock and "finish" it reads as though the save did not take.
          onSaved={() => setLoggingRun(false)}
        />
      )}

      <YesterdayHint />
    </>
  );
}

/** Time-of-day naming, because "Workout" as a default title ages badly in a long history. */
function defaultSessionName(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Morning session';
  if (hour < 16) return 'Midday session';
  if (hour < 21) return 'Evening session';
  return 'Late session';
}

function YesterdayHint() {
  const yesterday = addDays(todayKey(), -1);
  const sessions = useLiveQuery(() => sessionsBetween(yesterday, yesterday), [yesterday]);
  if (!sessions || sessions.length === 0) return null;

  return (
    <>
      <div className="section-title">Yesterday</div>
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </>
  );
}
