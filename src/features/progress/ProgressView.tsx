import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { bodyweightEntries } from '../../data/body';
import { savedWorkouts } from '../../data/namedWorkouts';
import { bodyweightLookup } from '../../domain/bodyweight';
import PageHeader from '../../ui/PageHeader';
import BarChart, { type Bar } from '../../ui/BarChart';
import PrSheet, { prMarks } from './PrSheet';
import StackedBarChart from '../../ui/StackedBarChart';
import { useApp } from '../../ui/AppProvider';
import { sessionsBetween } from '../../data/sessions';
import { addWeeks, monthName, startOfWeek, todayKey, weekDays } from '../../domain/dates';
import {
  acuteChronicRatio,
  EFFORT_BANDS,
  EFFORT_LABELS,
  effortMinutes,
  type EffortBand,
  personalRecords,
  workoutIdFromKey,
  sessionDistanceM,
  sessionLoad,
  sessionVolumeKg,
} from '../../domain/training';
import { formatDistance, formatWeight } from '../../domain/units';
import { useT } from '../../i18n/useT';

const WEEKS_SHOWN = 12;

export default function ProgressView() {
  const t = useT();
  const { profile, units, exerciseBySlug } = useApp();
  /** The movement whose record is open, by slug. */
  const [openPr, setOpenPr] = useState<string | null>(null);

  const firstWeekStart = startOfWeek(addWeeks(todayKey(), -(WEEKS_SHOWN - 1)), profile.weekStartsOn);
  const lastWeekEnd = weekDays(todayKey(), profile.weekStartsOn)[6];

  const sessions = useLiveQuery(
    () => sessionsBetween(firstWeekStart, lastWeekEnd),
    [firstWeekStart, lastWeekEnd],
  );
  const allSessions = useLiveQuery(() => sessionsBetween('0000-01-01', '9999-12-31'), []);
  const weighIns = useLiveQuery(() => bodyweightEntries(), [], undefined);
  /* Round records are keyed by saved workout, so their names come from the templates. */
  const saved = useLiveQuery(() => savedWorkouts(), []);

  const nameFor = (key: string): string => {
    const workoutId = workoutIdFromKey(key);
    if (workoutId) {
      return (saved ?? []).find((template) => template.id === workoutId)?.name ?? 'Saved workout';
    }
    return exerciseBySlug.get(key)?.name ?? key;
  };

  /*
   * Each session is valued at what you weighed that week, not what you weigh now. Otherwise a
   * ten-pound gain silently lifts every past bodyweight session on the chart.
   */
  const bodyweight = useMemo(
    () => bodyweightLookup(weighIns ?? [], profile.bodyweightKg),
    [weighIns, profile.bodyweightKg],
  );

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
        volumeKg: inWeek.reduce(
          (total, s) => total + sessionVolumeKg(s, exerciseBySlug, bodyweight.at(s.date)),
          0,
        ),
        effort: effortMinutes(inWeek),
        count: inWeek.length,
      };
    });
  }, [sessions, firstWeekStart, profile.weekStartsOn, exerciseBySlug, bodyweight]);

  const records = useMemo(
    () => personalRecords(allSessions ?? [], bodyweight),
    [allSessions, bodyweight],
  );

  /*
   * Records that actually hold a mark, newest first.
   *
   * Completing sets of a movement is enough to open a record for it, but not enough to put a
   * number in one: twenty reps is above the cap where an estimated 1RM still means anything,
   * and a rep count is only a mark when there was no load on it. Those entries are real and
   * worth keeping — they just have nothing to show, and a "personal best" row with no best on
   * it is a row that makes the list harder to read.
   */
  const ranked = useMemo(
    () =>
      [...records.values()]
        .map((record) => ({ record, marks: prMarks(record, units) }))
        .filter((entry) => entry.marks.length > 0)
        .sort((a, b) => b.record.date.localeCompare(a.record.date))
        .slice(0, 25),
    [records, units],
  );
  const ratio = acuteChronicRatio(weeks.map((w) => w.load));

  /*
   * Effort is summed across the whole window rather than read off the latest week.
   *
   * The eighty-twenty finding is about a training block, not a Tuesday. One week that ran hard
   * is a week, and a pill that swung between 40% and 90% as the week filled in would be read
   * as a verdict on each one — which is both wrong and the kind of number that makes people
   * train to the chart.
   */
  const effortTotals = useMemo(() => {
    const totals: Record<EffortBand, number> = { easy: 0, moderate: 0, hard: 0 };
    for (const week of weeks) {
      for (const band of EFFORT_BANDS) totals[band] += week.effort[band];
    }
    return totals;
  }, [weeks]);

  const effortTotal = EFFORT_BANDS.reduce((sum, band) => sum + effortTotals[band], 0);

  const BAND_FILL: Record<EffortBand, string> = {
    easy: 'var(--good)',
    moderate: 'var(--warn)',
    hard: 'var(--danger)',
  };

  if (!sessions || !allSessions) return <p className="muted">{t('Loading…')}</p>;

  if (allSessions.length === 0) {
    return (
      <>
        <PageHeader title={t('Progress')} />
        <div className="empty">
          <span className="glyph">📈</span>
          <p>{t('Nothing to chart yet.')}</p>
          <p className="small faint">
            {t('Log a few sessions and this fills in — load, mileage, volume, and every personal best.')}
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
      <PageHeader title={t('Progress')} subtitle={`Last ${WEEKS_SHOWN} weeks`} />

      <section className="card">
        <div className="card-head">
          <h2>{t('Training load')}</h2>
          {ratio != null && (
            <span className={`pill ${ratio > 1.5 ? 'warn' : ratio < 0.8 ? '' : 'good'}`}>
              {ratio.toFixed(2)}× 4-wk avg
            </span>
          )}
        </div>
        <BarChart bars={loadBars} />
        <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          {t('Effort × minutes, so running and lifting add into one number. Ramping past about 1.5× your four-week average is where injuries cluster.')}
        </p>
      </section>

      {/*
        Under load, because it explains it. Load says how much a week cost; this says what it
        was spent on, and the two together are the difference between "I did a lot" and "I did
        a lot of the same middling thing".
      */}
      {effortTotal > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>{t('Effort')}</h2>
            <span className={`pill ${effortTotals.easy / effortTotal >= 0.75 ? 'good' : ''}`}>
              {Math.round((effortTotals.easy / effortTotal) * 100)}% {t('easy')}
            </span>
          </div>
          <StackedBarChart
            bars={weeks.map((week) => ({
              label: week.label,
              segments: EFFORT_BANDS.map((band) => ({
                key: band,
                label: t(EFFORT_LABELS[band]),
                value: week.effort[band],
                fill: BAND_FILL[band],
              })),
            }))}
            formatValue={(v) => `${Math.round(v)} min`}
          />

          {/*
            The legend carries the numbers, not just the colours. Green, amber and red is the
            one palette a colour-blind reader cannot separate, and a stacked bar has no shape
            to fall back on, so the figures have to be readable on their own.
          */}
          <div className="cal-legend">
            {EFFORT_BANDS.map((band) => (
              <span key={band}>
                <i
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: BAND_FILL[band],
                    display: 'inline-block',
                  }}
                />
                {t(EFFORT_LABELS[band])}{' '}
                <span className="mono">
                  {Math.round((effortTotals[band] / effortTotal) * 100)}%
                </span>
              </span>
            ))}
          </div>

          <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {t('Minutes, by how hard they were. Most weeks want to be mostly easy with a little genuinely hard — it is the middle that quietly eats a training block, tiring enough to need recovering from and not hard enough to change anything.')}
          </p>
        </section>
      )}

      {hasDistance && (
        <section className="card">
          <div className="card-head">
            <h2>{t('Weekly distance')}</h2>
            <span className="pill mono">{formatDistance(weeks.at(-1)!.distanceM, units)}</span>
          </div>
          <BarChart bars={distanceBars} formatValue={(v) => formatDistance(v, units)} />
        </section>
      )}

      {hasVolume && (
        <section className="card">
          <div className="card-head">
            <h2>{t('Weekly volume')}</h2>
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

      {!bodyweight.latest && (
        <p className="tiny faint">
          <Link to="/more/body">{t('Log your bodyweight')}</Link> and push-ups, pull-ups and lunges
          start counting toward volume instead of reading as no work.
        </p>
      )}

      <div className="section-title">{t('Personal bests')}</div>
      {ranked.length === 0 && <p className="small muted">{t('Complete some sets and PRs land here.')}</p>}

      {/*
        One mark per movement, so the list can be scanned. Everything a record holds — the
        other marks, the caveats, the date — is a tap away in the sheet rather than crammed
        onto a line nobody finishes reading.
      */}
      {ranked.map(({ record, marks }) => {
          const [headline] = marks;
          const extra = marks.length - 1;

          return (
            <button
              className="card tight pr-row"
              key={record.exerciseSlug}
              onClick={() => setOpenPr(record.exerciseSlug)}
            >
              <div className="row between">
                <span className="grow truncate">{nameFor(record.exerciseSlug)}</span>
                <span className="small mono muted">{headline.value}</span>
              </div>
              <div className="tiny faint" style={{ marginTop: '0.15rem', textAlign: 'left' }}>
                {headline.label}
                {extra > 0 && ` · +${extra} more`}
              </div>
            </button>
          );
        })}

      {openPr && (() => {
        const record = records.get(openPr);
        if (!record) return null;
        return (
          <PrSheet
            record={record}
            name={nameFor(openPr)}
            units={units}
            onClose={() => setOpenPr(null)}
          />
        );
      })()}
    </>
  );
}
