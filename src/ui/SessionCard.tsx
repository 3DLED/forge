import { Link } from 'react-router-dom';
import { useApp } from './AppProvider';
import { formatDayLabel } from '../domain/dates';
import { formatDistance, formatDuration, formatWeight } from '../domain/units';
import {
  sessionDistanceM,
  sessionLoad,
  sessionVolumeKg,
  sessionWorkSec,
} from '../domain/training';
import type { LoggedSession } from '../domain/types';

/**
 * One line that describes any session, whatever it was made of. A lift reads as volume, a
 * run as distance and time, a hold-based session as time under tension.
 */
export function sessionSummary(
  session: LoggedSession,
  bySlug: Parameters<typeof sessionVolumeKg>[1],
  units: 'imperial' | 'metric',
): string {
  const parts: string[] = [];

  const exercises = new Set(session.sets.map((s) => s.exerciseSlug)).size;
  const done = session.sets.filter((s) => s.completed).length;
  if (done > 0) parts.push(`${done} set${done === 1 ? '' : 's'} · ${exercises} movement${exercises === 1 ? '' : 's'}`);

  const distance = sessionDistanceM(session);
  if (distance > 0) parts.push(formatDistance(distance, units));

  const volume = sessionVolumeKg(session, bySlug);
  if (volume > 0) parts.push(`${formatWeight(volume, units)} moved`);

  const work = sessionWorkSec(session);
  if (work > 0 && distance === 0) parts.push(formatDuration(work));

  if (parts.length === 0) parts.push('Nothing logged yet');
  return parts.join(' · ');
}

export default function SessionCard({ session }: { session: LoggedSession }) {
  const { units, exerciseBySlug } = useApp();
  const inProgress = !session.endedAt;
  const load = sessionLoad(session);

  return (
    <Link to={`/log/${session.id}`} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div className="card-head" style={{ marginBottom: '0.35rem' }}>
        <h3 className="truncate grow">{session.name}</h3>
        {inProgress ? (
          <span className="pill accent">In progress</span>
        ) : (
          load > 0 && <span className="pill">load {load}</span>
        )}
      </div>
      <div className="small muted">{sessionSummary(session, exerciseBySlug, units)}</div>
      <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
        {formatDayLabel(session.date)}
        {session.durationMin ? ` · ${session.durationMin} min` : ''}
        {session.sessionRpe ? ` · RPE ${session.sessionRpe}` : ''}
      </div>
    </Link>
  );
}
