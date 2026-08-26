import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import BarChart, { type Bar } from '../../ui/BarChart';
import { useApp } from '../../ui/AppProvider';
import { sessionsBetween } from '../../data/sessions';
import { addWeeks, monthName, startOfWeek, todayKey, weekDays } from '../../domain/dates';
import {
  acuteChronicRatio,
  personalRecords,
  sessionDistanceM,
  sessionLoad,
  sessionVolumeKg,
} from '../../domain/training';
import { formatDistance, formatDuration, formatPace, formatWeight } from '../../domain/units';

const WEEKS_SHOWN = 12;

export default function ProgressView() {
  const { profile, units, exerciseBySlug } = useApp();

  const firstWeekStart = startOfWeek(addWeeks(todayKey(), -(WEEKS_SHOWN - 1)), profile.weekStartsOn);
  const lastWeekEnd = weekDays(todayKey(), profile.weekStartsOn)[6];

  const sessions = useLiveQuery(
    () => sessionsBetween(firstWeekStart, lastWeekEnd),
    [firstWeekStart, lastWeekEnd],
  );
  const allSessions = useLiveQuery(() => sessionsBetween('0000-01-01', '9999-12-31'), []);

  const weeks = useMemo(() => {
    return Array.from({ length: WEEKS_SHOWN }, (_, index) => {
      const start = startOfWeek(addWeeks(firstWeekStart, index), profile.weekStartsOn);
      const days = weekDays(start, profile.weekStartsOn);
      const inWeek = (sessions ?? []).filter((s) => s.date >= days[0] && s.date <= days[6]);
      return {
        start,
        label: `${monthName(start, true)} ${Number(start.slice(8))}`,
        load: inWeek.reduce((total, s) => total + sessionLoad(s), 0),
        distanceM: inWeek.reduce((total, s) => total + sessionDistanceM(s), 0),
        volumeKg: inWeek.reduce((total, s) => total + sessionVolumeKg(s, exerciseBySlug), 0),
        count: inWeek.length,
      };
    });
  }, [sessions, firstWeekStart, profile.weekStartsOn, exerciseBySlug]);

  const records = useMemo(() => personalRecords(allSessions ?? []), [allSessions]);
  const ratio = acuteChronicRatio(weeks.map((w) => w.load));

  if (!sessions || !allSessions) return <p className="muted">Loading…</p>;

  if (allSessions.length === 0) {
    return (
      <>
        <PageHeader title="Progress" />
        <div className="empty">
          <span className="glyph">📈</span>
          <p>Nothing to chart yet.</p>
          <p className="small faint">
            Log a few sessions and this fills in — load, mileage, volume, and every personal best.
          </p>
        </div>
      </>
    );
  }

  const loadBars: Bar[] = weeks.map((week, index) => ({
    label: week.label,
    value: week.load,
    highlight: index === weeks.length - 1,
  }));

  const distanceBars: Bar[] = weeks.map((week, index) => ({
    label: week.label,
    value: week.distanceM,
    highlight: index === weeks.length - 1,
  }));

  const hasDistance = weeks.some((w) => w.distanceM > 0);
  const hasVolume = weeks.some((w) => w.volumeKg > 0);

  return (
    <>
      <PageHeader title="Progress" subtitle={`Last ${WEEKS_SHOWN} weeks`} />

      <section className="card">
        <div className="card-head">
          <h2>Training load</h2>
          {ratio != null && (
            <span className={`pill ${ratio > 1.5 ? 'warn' : ratio < 0.8 ? '' : 'good'}`}>
              {ratio.toFixed(2)}× 4-wk avg
            </span>
          )}
        </div>
        <BarChart bars={loadBars} />
        <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          Session RPE × minutes, so running and lifting add into one number. Ramping past
          about 1.5× your four-week average is where injuries cluster.
        </p>
      </section>

      {hasDistance && (
        <section className="card">
          <div className="card-head">
            <h2>Weekly distance</h2>
            <span className="pill mono">{formatDistance(weeks.at(-1)!.distanceM, units)}</span>
          </div>
          <BarChart bars={distanceBars} formatValue={(v) => formatDistance(v, units)} />
        </section>
      )}

      {hasVolume && (
        <section className="card">
          <div className="card-head">
            <h2>Weekly volume</h2>
            <span className="pill mono">{formatWeight(weeks.at(-1)!.volumeKg, units)}</span>
          </div>
          <BarChart
            bars={weeks.map((week, index) => ({
              label: week.label,
              value: week.volumeKg,
              highlight: index === weeks.length - 1,
            }))}
            formatValue={(v) => formatWeight(v, units)}
          />
        </section>
      )}

      <div className="section-title">Personal bests</div>
      {records.size === 0 && <p className="small muted">Complete some sets and PRs land here.</p>}

      {[...records.values()]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 25)
        .map((record) => {
          const exercise = exerciseBySlug.get(record.exerciseSlug);
          const marks = [
            record.best1RMKg && `est. 1RM ${formatWeight(record.best1RMKg, units)}`,
            record.bestReps && `${record.bestReps} reps`,
            record.bestTimeSec && formatDuration(record.bestTimeSec),
            record.bestDistanceM && formatDistance(record.bestDistanceM, units),
            record.bestPaceSecPerKm && formatPace(record.bestPaceSecPerKm, units),
          ].filter(Boolean);

          return (
            <div className="card tight" key={record.exerciseSlug}>
              <div className="row between">
                <span className="grow truncate">{exercise?.name ?? record.exerciseSlug}</span>
                <span className="small mono muted">{marks.join(' · ')}</span>
              </div>
            </div>
          );
        })}
    </>
  );
}
