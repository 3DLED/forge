import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import SessionCard from '../../ui/SessionCard';
import { recentSessions, sessionsBetween } from '../../data/sessions';
import { formatDayLabel, monthName } from '../../domain/dates';
import { prEventsBySession, scanRecords } from '../../domain/training';

const PAGE = 30;

export default function HistoryView() {
  const [limit, setLimit] = useState(PAGE);
  const sessions = useLiveQuery(() => recentSessions(limit), [limit]);

  /*
   * Whether a workout beat anything is a fact about every workout before it, so the flags
   * cannot be worked out from the page currently on screen — a March PR is only a PR in the
   * light of January and February. The whole table is scanned once and indexed by session;
   * paging in another thirty re-uses the same index rather than recomputing per card.
   *
   * Bodyweight is deliberately not loaded here. It only scales the relative-strength figure,
   * which changes no verdict about whether a mark was beaten, and this view never shows it.
   */
  const allSessions = useLiveQuery(() => sessionsBetween('0000-01-01', '9999-12-31'), []);

  const prsBySession = useMemo(
    () => prEventsBySession(scanRecords(allSessions ?? []).events),
    [allSessions],
  );

  /** Grouped by month, because that is the unit people actually review training in. */
  const months = useMemo(() => {
    const groups = new Map<string, typeof sessions>();
    for (const session of sessions ?? []) {
      const key = session.date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(session);
    }
    return [...groups.entries()];
  }, [sessions]);

  if (!sessions) return <p className="muted">Loading…</p>;

  return (
    <>
      <PageHeader
        title="History"
        subtitle={sessions.length > 0 ? `${sessions.length} session${sessions.length === 1 ? '' : 's'}` : undefined}
      />

      {sessions.length === 0 && (
        <div className="empty">
          <span className="glyph">📋</span>
          <p>No sessions yet.</p>
          <p className="small faint">Everything you log shows up here, newest first.</p>
        </div>
      )}

      {months.map(([month, group]) => (
        <div key={month}>
          <div className="section-title">
            {monthName(`${month}-01`)} {month.slice(0, 4)}
          </div>
          {(group ?? []).map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              prs={prsBySession.get(session.id)}
            />
          ))}
        </div>
      ))}

      {sessions.length >= limit && (
        <button className="btn block" onClick={() => setLimit((n) => n + PAGE)}>
          Load more
        </button>
      )}

      {sessions.length > 0 && (
        <p className="tiny faint" style={{ textAlign: 'center', marginTop: '1rem' }}>
          Last session {formatDayLabel(sessions[0].date).toLowerCase()}.
        </p>
      )}
    </>
  );
}
