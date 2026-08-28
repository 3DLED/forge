import { Link } from 'react-router-dom';
import { useApp } from './AppProvider';
import { plural } from './text';
import { formatDayLabel } from '../domain/dates';
import { formatDistance, formatDuration, formatWeight } from '../domain/units';
import {
  sessionDistanceM,
  sessionLoad,
  sessionRounds,
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
  /**
   * Current bodyweight, so calisthenics sets contribute to the "moved" figure. The summary
   * line uses today's weight rather than the weight on the day: the precision matters for a
   * trend chart, not for one line on a card.
   */
  bodyweightKg?: number,
): string {
  const parts: string[] = [];

  const exercises = new Set(session.sets.map((s) => s.exerciseSlug)).size;

  /*
   * Only loose sets are counted here. A movement inside a timed block describes what one
   * round contains and is never ticked off, so counting completed sets across the whole
   * session reported an AMRAP as an empty workout.
   */
  const done = session.sets.filter((s) => !s.blockId && s.completed).length;
  if (done > 0) {
    parts.push(`${plural(done, 'set')} · ${plural(exercises, 'movement')}`);
  }

  const blocks = session.blocks ?? [];
  const rounds = sessionRounds(session);
  if (rounds > 0) {
    parts.push(plural(rounds, 'round'));
  } else if (blocks.length > 0) {
    // A block that was set up but never run still means the session is not empty.
    parts.push(`${plural(blocks.length, 'timed block')} · ${plural(exercises, 'movement')}`);
  }

  const distance = sessionDistanceM(session);
  if (distance > 0) parts.push(formatDistance(distance, units));

  const volume = sessionVolumeKg(session, bySlug, bodyweightKg);
  if (volume > 0) parts.push(`${formatWeight(volume, units)} moved`);

  const work = sessionWorkSec(session);
  if (work > 0 && distance === 0) parts.push(formatDuration(work));

  if (parts.length === 0) parts.push('Nothing logged yet');
  return parts.join(' · ');
}

export default function SessionCard({ session }: { session: LoggedSession }) {
  const { units, exerciseBySlug, profile } = useApp();
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
      <div className="small muted">
        {sessionSummary(session, exerciseBySlug, units, profile.bodyweightKg)}
      </div>
      <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
        {formatDayLabel(session.date)}
        {session.durationMin ? ` · ${session.durationMin} min` : ''}
        {session.sessionRpe ? ` · effort ${session.sessionRpe}` : ''}
      </div>
    </Link>
  );
}
