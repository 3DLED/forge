/**
 * Opening a workout or a plan somebody sent you.
 *
 * Nothing is written until you have seen what is in the file. A file from another person can
 * carry movements your library has never heard of, and it can share a name with something you
 * already have — both are fine, and both are things you should be told before they happen
 * rather than discover afterwards in a list.
 *
 * The file is parsed and checked once, on selection. Everything after that works from the
 * validated object, so a malformed file is refused at the door instead of getting half way in.
 */

import { useRef, useState } from 'react';
import Sheet from '../../ui/Sheet';
import { plural } from '../../ui/text';
import {
  ShareFileError,
  importPlan,
  importWorkout,
  parseShareFile,
  previewShareFile,
  type ShareFile,
  type SharePreview,
} from '../../data/share';
import { todayKey } from '../../domain/dates';
import type { DayKey } from '../../domain/types';

export default function ImportSheet({
  expecting,
  onClose,
  onImported,
}: {
  /** Which kind this entry point is for. A file of the other kind is refused by name. */
  expecting: 'workout' | 'plan';
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<ShareFile | null>(null);
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [startDate, setStartDate] = useState<DayKey>(todayKey());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const read = async (chosen: File) => {
    setError(null);
    try {
      const parsed = parseShareFile(await chosen.text());
      if (parsed.kind !== expecting) {
        setError(
          `That is a ${parsed.kind} file. Open it from ${
            parsed.kind === 'plan' ? 'the Plan tab' : 'your saved workouts'
          } instead.`,
        );
        return;
      }
      setFile(parsed);
      setPreview(await previewShareFile(parsed));
    } catch (caught) {
      setError(
        caught instanceof ShareFileError
          ? caught.message
          : 'That file could not be read. It may have been altered or truncated.',
      );
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      if (file.kind === 'workout') {
        const result = await importWorkout(file);
        onImported(
          [
            `“${result.template.name}” added to your saved workouts.`,
            result.renamedTo && 'Renamed, because that name was taken.',
            result.exercisesAdded > 0 &&
              `${plural(result.exercisesAdded, 'new movement')} added to your library.`,
            result.exercisesRestored > 0 &&
              `${plural(result.exercisesRestored, 'movement')} you had deleted brought back.`,
          ]
            .filter(Boolean)
            .join(' '),
        );
      } else {
        const result = await importPlan(file, startDate);
        onImported(
          [
            `“${result.plan.name}” added — ${plural(result.sessions, 'session')} on your calendar.`,
            result.renamedTo && 'Renamed, because that name was taken.',
            result.exercisesAdded > 0 &&
              `${plural(result.exercisesAdded, 'new movement')} added to your library.`,
            result.exercisesRestored > 0 &&
              `${plural(result.exercisesRestored, 'movement')} you had deleted brought back.`,
            'It is not your active plan yet — start it from the Plan tab when you are ready.',
          ]
            .filter(Boolean)
            .join(' '),
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That import did not work.');
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={expecting === 'plan' ? 'Import a plan' : 'Import a workout'}
      onClose={onClose}
      footer={
        preview ? (
          <button className="btn primary block" disabled={busy} onClick={() => void run()}>
            {busy ? 'Adding…' : `Add “${preview.name}”`}
          </button>
        ) : undefined
      }
    >
      <p className="small muted">
        {expecting === 'plan'
          ? 'A plan file someone shared, or one you exported yourself. Nothing is added until you have seen what is in it.'
          : 'A workout file someone shared, or one you exported yourself. Movements it uses that you do not have come with it.'}
      </p>

      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Choose a file"
        style={{ display: 'none' }}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) void read(chosen);
          // Cleared so choosing the same file twice still fires a change.
          event.target.value = '';
        }}
      />

      <button className="btn block" onClick={() => input.current?.click()}>
        {preview ? 'Choose a different file' : 'Choose a file'}
      </button>

      {error && (
        <div className="card tight" style={{ borderColor: 'var(--warn)', marginTop: '0.75rem' }}>
          <p className="small" style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {preview && (
        <>
          <div className="section-title">What is in it</div>
          <div className="card tight">
            <strong>{preview.name}</strong>
            <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
              {preview.kind === 'plan'
                ? `${plural(preview.sessionCount ?? 0, 'session')} over ${plural(preview.weeks ?? 0, 'week')}`
                : `${plural(preview.movements.length, 'movement')}${
                    preview.estimatedMinutes ? ` · about ${preview.estimatedMinutes} min` : ''
                  }`}
            </div>
            <div className="tiny" style={{ marginTop: '0.4rem' }}>
              {preview.movements.slice(0, 6).join(' · ')}
              {preview.movements.length > 6 && ` · and ${preview.movements.length - 6} more`}
            </div>
          </div>

          {preview.newExercises.length > 0 && (
            <div className="card tight">
              <strong className="small">
                {plural(preview.newExercises.length, 'movement')} new to your library
              </strong>
              <div className="tiny faint" style={{ marginTop: '0.25rem' }}>
                {preview.newExercises.map((e) => e.name).join(' · ')}
              </div>
              <div className="tiny faint" style={{ marginTop: '0.25rem' }}>
                They will be added so this works. Anything you already have is left alone.
              </div>
            </div>
          )}

          {preview.restoredExercises.length > 0 && (
            <div className="card tight">
              <strong className="small">
                {plural(preview.restoredExercises.length, 'movement')} you deleted
              </strong>
              <div className="tiny faint" style={{ marginTop: '0.25rem' }}>
                {preview.restoredExercises.map((e) => e.name).join(' · ')} — brought back, so
                this can actually be run. Your version is kept, not the one in the file.
              </div>
            </div>
          )}

          {preview.missing.length > 0 && (
            <div className="card tight" style={{ borderColor: 'var(--warn)' }}>
              <strong className="small">
                {plural(preview.missing.length, 'movement')} missing from the file
              </strong>
              <div className="tiny faint" style={{ marginTop: '0.25rem' }}>
                {preview.missing.join(' · ')} — these will come in as bare slugs with nothing
                behind them. The file was probably edited by hand.
              </div>
            </div>
          )}

          {preview.kind === 'plan' && (
            <>
              <div className="section-title">Start it on</div>
              <input
                type="date"
                value={startDate}
                aria-label="Plan start date"
                onChange={(event) => setStartDate(event.target.value as DayKey)}
              />
              <p className="tiny faint">
                Sessions are spaced the way the plan author laid them out, counted from this
                day. It comes in switched off — starting it is a separate choice.
              </p>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
