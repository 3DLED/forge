/**
 * What one day holds, and everything you can do to it.
 *
 * Two states in one sheet rather than nested sheets: the day itself, and the session picker
 * you drop into when adding something. Stacked modals on a phone are a trap — the back
 * gesture stops meaning anything.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import AskSheet from '../../ui/AskSheet';
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import { plannedOnDay, sessionsOnDay, startFromPlanned, startSession } from '../../data/sessions';
import { plannedSessionRepo, calendarExceptionRepo } from '../../data/repos';
import {
  addBlackout,
  calendarExceptions,
  movePlannedSession,
  skipPlannedSession,
  unskipPlannedSession,
} from '../../data/plans';
import { SEED_SESSION_TEMPLATES } from '../../data/seed/sessionTemplates';
import { savedWorkouts } from '../../data/namedWorkouts';
import { materialisePrescription } from '../../domain/planning';
import { resolveDayAvailability } from '../../domain/scheduling';
import { formatDayLabel, todayKey } from '../../domain/dates';
import type { DayKey, PlannedSession } from '../../domain/types';

const MODALITY_LABEL: Record<string, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  mobility: 'Mobility',
  skill: 'Skill',
};

export default function DaySheet({ date, onClose }: { date: DayKey; onClose: () => void }) {
  const navigate = useNavigate();
  const { profile, exerciseBySlug, available } = useApp();
  const [adding, setAdding] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [query, setQuery] = useState('');

  const planned = useLiveQuery(() => plannedOnDay(date), [date]);
  const logged = useLiveQuery(() => sessionsOnDay(date), [date]);
  const exceptions = useLiveQuery(() => calendarExceptions(), []);
  const saved = useLiveQuery(() => savedWorkouts(), []);

  const availability = resolveDayAvailability(date, profile.availability, exceptions ?? []);
  const blackout = (exceptions ?? []).find(
    (e) => e.kind === 'blackout' && date >= e.startDate && date <= e.endDate,
  );

  const addFromTemplate = async (slug: string) => {
    const seed = SEED_SESSION_TEMPLATES.find((t) => t.slug === slug);
    if (!seed) return;

    const { prescription } = materialisePrescription(seed, {
      weekIndex: 1,
      factor: 1,
      exerciseBySlug,
      available,
    });

    await plannedSessionRepo.create({
      date,
      prescription,
      status: 'planned',
    } as Omit<PlannedSession, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>);
    setAdding(false);
    setQuery('');
  };

  /**
   * A workout you named in the logger is already a SessionTemplate, so planning it is just
   * copying its blocks across — no substitution pass, because you built it from movements
   * you had rather than from an idealised template.
   */
  const addSavedWorkout = async (templateId: string) => {
    const template = (saved ?? []).find((t) => t.id === templateId);
    if (!template) return;

    await plannedSessionRepo.create({
      date,
      prescription: {
        name: template.name,
        modalities: template.modalities,
        estimatedMinutes: template.estimatedMinutes,
        blocks: template.blocks,
        sourceTemplateId: template.id,
      },
      status: 'planned',
    } as Omit<PlannedSession, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>);
    setAdding(false);
    setQuery('');
  };

  if (adding) {
    const needle = query.trim().toLowerCase();
    const results = SEED_SESSION_TEMPLATES.filter(
      (t) => !needle || t.name.toLowerCase().includes(needle) || t.slug.includes(needle),
    );

    return (
      <Sheet title="Add a session" onClose={() => setAdding(false)}>
        <input
          type="search"
          placeholder="Search workouts…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
        <div style={{ height: '0.6rem' }} />

        {(saved ?? []).filter(
          (t) => !needle || t.name.toLowerCase().includes(needle),
        ).length > 0 && (
          <>
            <div className="section-title">Your saved workouts</div>
            {(saved ?? [])
              .filter((t) => !needle || t.name.toLowerCase().includes(needle))
              .map((template) => (
                <button
                  key={template.id}
                  className="pick"
                  onClick={() => void addSavedWorkout(template.id)}
                >
                  <span className="grow">
                    <strong>{template.name}</strong>
                    <br />
                    <span className="tiny faint">
                      {template.blocks[0]?.items.length ?? 0} movements · your workout
                    </span>
                  </span>
                  <span className="pill accent">Add</span>
                </button>
              ))}
            <div className="section-title">From the library</div>
          </>
        )}

        {results.map((template) => (
          <button key={template.slug} className="pick" onClick={() => void addFromTemplate(template.slug)}>
            <span className="grow">
              <strong>{template.name}</strong>
              <br />
              <span className="tiny faint">
                {template.modalities.map((m) => MODALITY_LABEL[m]).join(' + ')} ·{' '}
                {template.estimatedMinutes} min · {template.blocks.length} block
                {template.blocks.length === 1 ? '' : 's'}
              </span>
            </span>
            <span className="pill accent">Add</span>
          </button>
        ))}
        <button className="btn ghost block" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={formatDayLabel(date)} onClose={onClose}>
      <div className="row wrap" style={{ gap: '0.35rem', marginBottom: '0.75rem' }}>
        {blackout ? (
          <span className="pill warn">Blocked{blackout.reason ? ` · ${blackout.reason}` : ''}</span>
        ) : availability.allowedModalities.length === 0 ? (
          <span className="pill">Rest day</span>
        ) : (
          availability.allowedModalities.map((modality) => (
            <span className="pill" key={modality}>
              {MODALITY_LABEL[modality]}
            </span>
          ))
        )}
      </div>

      {(planned ?? []).length === 0 && (logged ?? []).length === 0 && (
        <p className="small muted">Nothing scheduled or logged on this day.</p>
      )}

      {(planned ?? []).map((session) => (
        <div className="card tight" key={session.id}>
          <div className="row between" style={{ marginBottom: '0.4rem' }}>
            <strong className="grow truncate">{session.prescription.name}</strong>
            {session.status === 'completed' && <span className="pill good">Done</span>}
            {session.status === 'skipped' && <span className="pill">Skipped</span>}
          </div>
          <div className="tiny faint" style={{ marginBottom: '0.5rem' }}>
            {session.prescription.estimatedMinutes} min ·{' '}
            {plural(session.prescription.blocks.reduce((n, b) => n + b.items.length, 0), 'movement')}
          </div>

          {session.status === 'planned' && (
            <div className="row wrap" style={{ gap: '0.35rem' }}>
              <button
                className="btn primary sm"
                onClick={async () => {
                  const started = await startFromPlanned(session);
                  navigate(`/log/${started.id}`);
                }}
              >
                Start
              </button>
              <label className="btn sm" style={{ position: 'relative', overflow: 'hidden' }}>
                Move
                <input
                  type="date"
                  defaultValue={date}
                  aria-label="Move to date"
                  onChange={(event) => {
                    if (event.target.value) void movePlannedSession(session, event.target.value);
                  }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
              </label>
              <button className="btn sm" onClick={() => void skipPlannedSession(session)}>
                Skip
              </button>
              <button
                className="btn sm ghost danger"
                onClick={() => void plannedSessionRepo.remove(session.id)}
              >
                Remove
              </button>
            </div>
          )}

          {session.status === 'skipped' && (
            <button className="btn sm" onClick={() => void unskipPlannedSession(session)}>
              Un-skip
            </button>
          )}
        </div>
      ))}

      {(logged ?? []).map((session) => (
        <button
          key={session.id}
          className="pick"
          onClick={() => {
            onClose();
            navigate(`/log/${session.id}`);
          }}
        >
          <span className="grow">
            <strong>{session.name}</strong>
            <br />
            <span className="tiny faint">
              {session.sets.filter((s) => s.completed).length} sets logged
              {session.endedAt ? '' : ' · in progress'}
            </span>
          </span>
          <span className="pill good">Logged</span>
        </button>
      ))}

      <div className="divider" />

      <div className="stack">
        <button className="btn block" onClick={() => setAdding(true)}>
          + Add a planned session
        </button>

        <button
          className="btn block"
          onClick={async () => {
            const session = await startSession({ date, name: 'Workout' });
            onClose();
            navigate(`/log/${session.id}`);
          }}
        >
          {date === todayKey() ? 'Log a workout now' : 'Log a workout on this day'}
        </button>

        {blackout ? (
          <button className="btn block" onClick={() => void calendarExceptionRepo.remove(blackout.id)}>
            Unblock this day
          </button>
        ) : (
          <button className="btn ghost block" onClick={() => setBlocking(true)}>
            Block this day out
          </button>
        )}
      </div>

      {blocking && (
        <AskSheet
          title="Block this day out"
          message="Nothing will be scheduled here, and applying a plan will route around it."
          input={{ label: 'Reason (optional)', placeholder: 'Travel, rest, work…' }}
          confirmLabel="Block it"
          onCancel={() => setBlocking(false)}
          onConfirm={async (reason) => {
            await addBlackout(date, date, reason.trim() || undefined);
            setBlocking(false);
          }}
        />
      )}
    </Sheet>
  );
}
