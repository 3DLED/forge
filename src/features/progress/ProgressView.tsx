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
import RowChart from '../../ui/RowChart';
import { useApp } from '../../ui/AppProvider';
import { plannedBetween, sessionsBetween } from '../../data/sessions';
import { addWeeks, monthName, startOfWeek, todayKey, weekDays } from '../../domain/dates';
import {
  acuteChronicRatio,
  consistency,
  CONSISTENCY_LABELS,
  CONSISTENCY_PARTS,
  type Consistency,
  type ConsistencyPart,
  EFFORT_BANDS,
  EFFORT_LABELS,
  effortMinutes,
  type EffortBand,
  personalRecords,
  workoutIdFromKey,
  sessionFootDistanceM,
  sessionLoad,
  sessionVolumeKg,
  pushPullRatio,
  runTotals,
  volumeByPattern,
} from '../../domain/training';
import { PATTERN_LABELS } from '../../domain/regions';
import { formatDistance, formatPace, formatWeight, paceSecPerKm } from '../../domain/units';
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
  const plannedRows = useLiveQuery(
    () => plannedBetween(firstWeekStart, lastWeekEnd),
    [firstWeekStart, lastWeekEnd],
  );
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
        distanceM: inWeek.reduce((total, s) => total + sessionFootDistanceM(s), 0),
        volumeKg: inWeek.reduce(
          (total, s) => total + sessionVolumeKg(s, exerciseBySlug, bodyweight.at(s.date)),
          0,
        ),
        effort: effortMinutes(inWeek),
        run: runTotals(inWeek),
        consistency: consistency(
          (plannedRows ?? []).filter((p) => p.date >= days[0] && p.date <= days[6]),
          inWeek,
          todayKey(),
        ),
        count: inWeek.length,
      };
    });
  }, [sessions, plannedRows, firstWeekStart, profile.weekStartsOn, exerciseBySlug, bodyweight]);

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
   * The same ratio again, over mileage alone.
   *
   * Not a duplicate of the load one. Load adds running and lifting into a single number, which
   * is what makes it useful for judging a whole week and useless for judging a ramp: a big
   * lifting block can hold the combined figure flat while the running underneath it doubles,
   * and it is the running that breaks bone. Miles get their own denominator.
   */
  const mileageRatio = acuteChronicRatio(weeks.map((w) => w.distanceM));

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

  /*
   * Adherence over the window, matching `planProgress`: of the slots whose day came, how many
   * were completed. Extra sessions are outside it on purpose — unplanned work is training, but
   * it is not evidence a plan is being followed, and letting it push the figure over 100%
   * would turn the one number that measures discipline into a number that rewards ignoring it.
   */
  const consistencyTotals = useMemo(() => {
    const totals: Consistency = { due: 0, done: 0, skipped: 0, missed: 0, extra: 0 };
    for (const week of weeks) {
      totals.due += week.consistency.due;
      totals.done += week.consistency.done;
      totals.skipped += week.consistency.skipped;
      totals.missed += week.consistency.missed;
      totals.extra += week.consistency.extra;
    }
    return totals;
  }, [weeks]);

  const adherence = consistencyTotals.due > 0 ? consistencyTotals.done / consistencyTotals.due : null;

  /*
   * Summed over the window rather than per week, for the same reason effort is: one week's
   * split is a description of one week, and nobody has a balanced Tuesday. A neglected pattern
   * is only a neglected pattern if it stayed that way.
   *
   * Running is dropped. Its volume is distance, it has two charts of its own above, and a row
   * reading "Run: 14 sets" alongside a row of squats measures nothing anyone would want.
   */
  const patternRows = useMemo(
    () => volumeByPattern(sessions ?? [], exerciseBySlug, bodyweight).filter((r) => r.pattern !== 'gait'),
    [sessions, exerciseBySlug, bodyweight],
  );

  /*
   * Pace over the window, summed before dividing, so it is weighted by ground covered rather
   * than by how many times you went out.
   */
  const runWindow = useMemo(
    () => weeks.reduce(
      (total, week) => ({
        distanceM: total.distanceM + week.run.distanceM,
        timeSec: total.timeSec + week.run.timeSec,
      }),
      { distanceM: 0, timeSec: 0 },
    ),
    [weeks],
  );
  const windowPace = paceSecPerKm(runWindow.distanceM, runWindow.timeSec);

  /*
   * Bars are speed rather than pace, so the taller bar is the faster week — pace read as
   * height draws a good week short, which is the one way a chart can be read exactly
   * backwards. The values are then formatted back into a pace, which is what a runner thinks
   * in.
   */
  const paceBars = useMemo(
    () =>
      weeks.map((week, index) => ({
        label: week.label,
        value: week.run.timeSec > 0 ? week.run.distanceM / week.run.timeSec : 0,
        highlight: index === weeks.length - 1,
      })),
    [weeks],
  );

  /*
   * Running speeds sit in a narrow band well away from zero, so a zero axis draws every week
   * at the same height whatever happened. A tenth below the slowest week leaves that week a
   * visible bar and gives the rest somewhere to be taller than.
   */
  const paceFloor = useMemo(() => {
    const speeds = paceBars.map((bar) => bar.value).filter((v) => v > 0);
    return speeds.length > 1 ? Math.min(...speeds) * 0.9 : 0;
  }, [paceBars]);

  const patternSets = patternRows.reduce((total, row) => total + row.sets, 0);
  const pushPull = pushPullRatio(patternRows);

  const PART_FILL: Record<ConsistencyPart, string> = {
    done: 'var(--good)',
    extra: 'var(--accent)',
    skipped: 'var(--warn)',
    missed: 'var(--danger)',
  };

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
              {ratio.toFixed(2)}× {t('4-wk avg')}
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

      {/*
        Only when a plan exists to be consistent with. Without one every bar would be a solid
        block of "extra", which says nothing about adherence and quietly implies a failing.
      */}
      {consistencyTotals.due > 0 && adherence != null && (
        <section className="card">
          <div className="card-head">
            <h2>{t('Consistency')}</h2>
            <span className={`pill ${adherence >= 0.8 ? 'good' : adherence < 0.5 ? 'warn' : ''}`}>
              {Math.round(adherence * 100)}% {t('of what was due')}
            </span>
          </div>
          <StackedBarChart
            bars={weeks.map((week) => ({
              label: week.label,
              segments: CONSISTENCY_PARTS.map((part) => ({
                key: part,
                label: t(CONSISTENCY_LABELS[part]),
                value: week.consistency[part],
                fill: PART_FILL[part],
              })),
            }))}
          />

          <div className="cal-legend">
            {CONSISTENCY_PARTS.map((part) => (
              <span key={part}>
                <i
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: PART_FILL[part],
                    display: 'inline-block',
                  }}
                />
                {t(CONSISTENCY_LABELS[part])}{' '}
                <span className="mono">{consistencyTotals[part]}</span>
              </span>
            ))}
          </div>

          <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {t('Plan slots whose day has come, and what became of them. A skipped session counts against the figure, because deciding not to train is something that happened to the plan. Sessions no plan asked for are counted apart — they are training, but they are not evidence the plan is being followed.')}
          </p>
        </section>
      )}

      {hasDistance && (
        <section className="card">
          <div className="card-head">
            <h2>{t('Weekly distance')}</h2>
            {/*
              The ramp when there is enough history to compute one, and this week's mileage
              until then. Two pills would crowd the head on a phone, and the figure the ratio
              replaces is already on the chart twice — as the last bar, and in the peak line.
            */}
            {mileageRatio != null ? (
              <span
                className={`pill ${mileageRatio > 1.5 ? 'warn' : mileageRatio < 0.8 ? '' : 'good'}`}
              >
                {mileageRatio.toFixed(2)}× {t('4-wk avg')}
              </span>
            ) : (
              <span className="pill mono">{formatDistance(weeks.at(-1)!.distanceM, units)}</span>
            )}
          </div>
          <BarChart bars={distanceBars} formatValue={(v) => formatDistance(v, units)} />
          <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {t('Mileage on its own, against its own four-week average. Training load mixes running into lifting, which can hold the combined figure flat while the miles underneath it double — and it is the miles that break bone. Lungs adapt in weeks, tendon and bone over months, so the week that felt fine is the one to watch.')}
          </p>
        </section>
      )}

      {/*
        Beside distance rather than beside load: how far and how fast are the two halves of
        the same question, and a mileage jump that came with a pace jump is a different week
        from a mileage jump that came at the same effort.
      */}
      {windowPace != null && (
        <section className="card">
          <div className="card-head">
            <h2>{t('Pace')}</h2>
            <span className="pill mono">{formatPace(windowPace, units)}</span>
          </div>
          <BarChart
            bars={paceBars}
            floor={paceFloor}
            formatValue={(mps) => (mps > 0 ? formatPace(1000 / mps, units) : '—')}
          />
          <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {t('Average pace across every run that week, weighted by distance, so a long run counts for more than a shakeout. Taller is faster, and the axis starts just below your slowest week rather than at a standstill. Walks, rucks, rows and rides are left out — averaging them into a running pace describes none of them.')}
          </p>
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

      {/*
        Under weekly volume, because it divides it up. That chart says a week held more work
        than the last one; this says which patterns the work went into, and whether any of
        them have been getting none of it for three months.
      */}
      {patternSets > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>{t('Movement balance')}</h2>
            {pushPull != null && (
              <span className={`pill ${pushPull >= 0.75 && pushPull <= 1.35 ? 'good' : 'warn'}`}>
                {pushPull.toFixed(1)} {t('push per pull')}
              </span>
            )}
          </div>
          <RowChart
            rows={patternRows.map((row) => ({
              key: row.pattern,
              label: t(PATTERN_LABELS[row.pattern]),
              value: row.sets,
              detail:
                row.sets === 0
                  ? '—'
                  : row.volumeKg > 0
                    ? `${t.count(row.sets, 'set')} · ${formatWeight(row.volumeKg, units)}`
                    : t.count(row.sets, 'set'),
            }))}
          />
          <p className="tiny faint" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            {t('Bars are sets, because sets are the one measure that compares across patterns — a hinge outweighs an overhead press whatever you do, so the tonnage beside each row only means something against the same pattern a month ago. Read the bottom of the list, not the top. Running is left out; its volume is distance.')}
          </p>
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
