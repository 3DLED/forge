/**
 * The week behind the strip on Today.
 *
 * The strip answers "did I train Tuesday" with a dot. This answers "with what" — every day of
 * the week laid out, what was logged, and what is still planned.
 *
 * Deliberately a flat list rather than a way into the day editor. Tapping a day on the Plan
 * calendar opens DaySheet, which can add, move, skip and black out; stacking that inside this
 * sheet would be a modal on a modal, which is the trap DaySheet's own header warns about.
 * Here a tap goes to the thing itself — the workout, or the start of it.
 */

import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import SessionCard from '../../ui/SessionCard';
import { plural } from '../../ui/text';
import { plannedBetween, sessionsBetween, startFromPlanned } from '../../data/sessions';
import { monthName, todayKey, weekdayName, weekdayOf } from '../../domain/dates';
import { sessionLoad } from '../../domain/training';
import type { DayKey } from '../../domain/types';

export default function WeekSheet({ days, onClose }: { days: DayKey[]; onClose: () => void }) {
  const navigate = useNavigate();
  const today = todayKey();

  const sessions = useLiveQuery(() => sessionsBetween(days[0], days[6]), [days[0], days[6]]);
  const planned = useLiveQuery(() => plannedBetween(days[0], days[6]), [days[0], days[6]]);

  const logged = sessions ?? [];
  const load = logged.reduce((total, session) => total + sessionLoad(session), 0);
  const done = logged.filter((session) => session.endedAt).length;

  const title = `${monthName(days[0], true)} ${Number(days[0].slice(8))} – ${
    monthName(days[6], true)
  } ${Number(days[6].slice(8))}`;

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="row between" style={{ marginBottom: '0.5rem' }}>
        <span className="small muted">
          {done > 0 ? plural(done, 'workout') + ' done' : 'Nothing done yet this week'}
        </span>
        {load > 0 && <span className="pill">load {load}</span>}
      </div>

      {days.map((day) => {
        const dayLogged = logged.filter((session) => session.date === day);
        const dayPlanned = (planned ?? []).filter(
          (entry) => entry.date === day && entry.status === 'planned',
        );
        const isToday = day === today;

        return (
          <section key={day} style={{ marginTop: '0.75rem' }}>
            <div className="row between">
              <span
                className="tiny faint"
                style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}
              >
                {weekdayName(weekdayOf(day))} {Number(day.slice(8))}
              </span>
              {isToday && <span className="pill accent">Today</span>}
            </div>

            {dayLogged.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}

            {dayPlanned.map((entry) => (
              <div className="card tight" key={entry.id}>
                <div className="row between">
                  <span className="grow truncate">{entry.prescription.name}</span>
                  <span className="pill">Planned</span>
                </div>
                {/*
                  Only forward. Starting Tuesday's session on Thursday files the work under the
                  wrong day, and the calendar is the thing that then stops being true.
                */}
                {day >= today && (
                  <button
                    className="btn sm block"
                    style={{ marginTop: '0.4rem' }}
                    onClick={async () => {
                      const session = await startFromPlanned(entry);
                      onClose();
                      navigate(`/log/${session.id}`);
                    }}
                  >
                    Start
                  </button>
                )}
              </div>
            ))}

            {dayLogged.length === 0 && dayPlanned.length === 0 && (
              /*
                An empty day reads differently depending on where it sits. Behind you it was a
                rest day; ahead of you nothing is planned yet; today it is neither — the day is
                not over, and calling it a rest day at 7am writes it off on your behalf.
              */
              <div className="tiny faint" style={{ padding: '0.15rem 0 0.1rem' }}>
                {isToday ? 'Nothing yet' : day > today ? 'Nothing planned' : 'Rest'}
              </div>
            )}
          </section>
        );
      })}
    </Sheet>
  );
}
