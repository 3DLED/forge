/**
 * Benchmarks: what you have measured, and what is worth measuring again.
 *
 * Ordered by how stale each one is rather than alphabetically, because the only question this
 * screen answers is "what should I test next". A movement never tested sits above one measured
 * five weeks ago, which sits above one measured on Tuesday.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import AskSheet from '../../ui/AskSheet';
import TestRunner from '../log/TestRunner';
import KnownMaxSheet from './KnownMaxSheet';
import ExercisePicker from '../log/ExercisePicker';
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import { allTestResults, deleteTestResult } from '../../data/fitnessTests';
import {
  RETEST_DUE_DAYS,
  TEST_KINDS,
  latestResult,
  testKindFor,
  testTiming,
} from '../../domain/fitnessTests';
import type { TestResult } from '../../domain/fitnessTests';
import { formatWeight } from '../../domain/units';
import { formatDayLabel, todayKey } from '../../domain/dates';
import type { Exercise } from '../../domain/types';

export default function TestsView() {
  const { units, exerciseBySlug, available } = useApp();
  const today = todayKey();
  const results = useLiveQuery(() => allTestResults(), []);
  const [picking, setPicking] = useState(false);
  const [running, setRunning] = useState<Exercise | null>(null);
  /** Non-null while entering a max by hand, rather than measuring one. */
  const [entering, setEntering] = useState<Exercise | null>(null);
  /** Which flow the picker is feeding. */
  const [pickingFor, setPickingFor] = useState<'test' | 'entry'>('test');
  /**
   * Bumped every time a test is started, and used as the runner's key.
   *
   * Without it React reuses the component instance and the previous run's state comes with it
   * — reopening lands you on the last test's result rather than at the start of a new one.
   */
  const [runKey, setRunKey] = useState(0);

  const startTest = (exercise: Exercise) => {
    setRunKey((n) => n + 1);
    setRunning(exercise);
  };
  const [deleting, setDeleting] = useState<TestResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const history = results ?? [];

  /** One row per movement ever tested, stalest first. */
  const tested = useMemo(() => {
    const slugs = [...new Set(history.map((result) => result.exerciseSlug))];
    return slugs
      .map((slug) => ({
        slug,
        exercise: exerciseBySlug.get(slug),
        latest: latestResult(history, slug)!,
        timing: testTiming(history, slug, today),
      }))
      .sort((a, b) => a.latest.date.localeCompare(b.latest.date));
  }, [history, exerciseBySlug, today]);

  const show = (result: TestResult): string => {
    if (result.kind === 'threeRepMax') return `${formatWeight(result.value, units)} × 3`;
    if (result.kind === 'maxLoad') {
      return `${formatWeight(result.value, units)} × ${result.reps ?? 1}`;
    }
    if (result.kind === 'hold') return `${result.value}s`;
    return plural(result.value, 'rep');
  };

  return (
    <>
      <PageHeader
        title="Tests"
        subtitle={tested.length > 0 ? `${plural(tested.length, 'movement')} measured` : undefined}
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      {notice && <p className="tiny faint">{notice}</p>}

      {tested.length === 0 && (
        <div className="empty">
          <span className="glyph">📏</span>
          <p>Nothing measured yet.</p>
          <p className="small faint">
            A test gives the app a real number to program from instead of a guess — and gives
            you something to beat.
          </p>
        </div>
      )}

      {tested.map(({ slug, exercise, latest, timing }) => (
        <div className="card" key={slug}>
          <div className="card-head" style={{ marginBottom: '0.35rem' }}>
            <h3 className="truncate grow">{exercise?.name ?? slug}</h3>
            {timing.state === 'due' && <span className="pill warn">Due</span>}
            {timing.state === 'tooSoon' && <span className="pill">Just tested</span>}
          </div>
          <div className="small muted">
            {show(latest)} · {TEST_KINDS[latest.kind].label.toLowerCase()}
            {latest.entry === 'manual' && ' · entered, not measured'}
          </div>
          <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
            {formatDayLabel(latest.date)}
            {timing.state !== 'never' && ` · ${plural(timing.daysSince, 'day')} ago`}
            {latest.estimated1RMKg
              ? ` · about ${formatWeight(latest.estimated1RMKg, units)} for one`
              : ''}
          </div>

          {exercise && (
            <button
              className="btn block"
              style={{ marginTop: '0.6rem' }}
              onClick={() => startTest(exercise)}
            >
              Test it again
            </button>
          )}
          <button
            className="btn ghost sm block danger"
            style={{ marginTop: '0.25rem' }}
            onClick={() => setDeleting(latest)}
          >
            Remove this result
          </button>
        </div>
      ))}

      <button
        className="btn primary block"
        style={{ marginTop: '1rem' }}
        onClick={() => {
          setPickingFor('test');
          setPicking(true);
        }}
      >
        Test a movement
      </button>

      {/*
        Offered beside testing rather than buried under it. Arriving with maxes you already
        know is the normal case, not the exception.
      */}
      <button
        className="btn block"
        style={{ marginTop: '0.5rem' }}
        onClick={() => {
          setPickingFor('entry');
          setPicking(true);
        }}
      >
        Enter a max I already know
      </button>

      <p className="tiny faint" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
        Worth repeating about every {RETEST_DUE_DAYS / 7} weeks, on a day of its own.
      </p>

      {picking && (
        <ExercisePicker
          available={available}
          onClose={() => setPicking(false)}
          onPick={(exercise) => {
            setPicking(false);
            if (pickingFor === 'entry') setEntering(exercise);
            else startTest(exercise);
          }}
        />
      )}

      {entering && (
        <KnownMaxSheet
          exercise={entering}
          units={units}
          onClose={() => setEntering(null)}
          onSaved={(loadKg) => {
            const name = entering.name;
            setEntering(null);
            setNotice(`${name}: ${formatWeight(loadKg, units)} saved. Used until you test it.`);
          }}
        />
      )}

      {running && (
        <TestRunner
          key={runKey}
          exercise={running}
          history={history}
          onClose={() => setRunning(null)}
          onRecorded={(result) => {
            setRunning(null);
            setNotice(
              `${running.name}: ${show(result)} recorded. ${TEST_KINDS[testKindFor(running)].label} again in ${RETEST_DUE_DAYS / 7} weeks.`,
            );
          }}
        />
      )}

      {deleting && (
        <AskSheet
          title="Remove this result?"
          message="A result is a record of a day, so it is removed rather than corrected. Test again to replace it."
          confirmLabel="Remove"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteTestResult(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
