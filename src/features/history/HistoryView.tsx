import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import SessionCard from '../../ui/SessionCard';
import { recentSessions } from '../../data/sessions';
import { formatDayLabel, monthName } from '../../domain/dates';

const PAGE = 30;

export default function HistoryView() {
  const [limit, setLimit] = useState(PAGE);
  const sessions = useLiveQuery(() => recentSessions(limit), [limit]);

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
            <SessionCard key={session.id} session={session} />
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
