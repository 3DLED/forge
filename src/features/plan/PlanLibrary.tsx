/**
 * The plan catalogue.
 *
 * Grouped by what someone is actually trying to do, not by training theory. "I want to run a
 * half" and "I want to get stronger three days a week" are the two questions people arrive
 * with; the split names, phases, and deload schedules are implementation detail behind them.
 */

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import ApplyPlanSheet from './ApplyPlanSheet';
import CustomPlanBuilder from './CustomPlanBuilder';
import {
  allCustomPlans,
  dayLabel,
  daysPerWeek,
  deleteCustomPlan,
  isTrainingDay,
  translateCustomPlan,
} from '../../data/customPlans';
import type { CustomPlan } from '../../domain/types';
import { SEED_PLAN_TEMPLATES, type SeedPlanTemplate } from '../../data/seed/planTemplates';
import AskSheet from '../../ui/AskSheet';
import { activePlan, allPlans, endPlan } from '../../data/plans';
import { formatDayLabel, weekdayName } from '../../domain/dates';
import type { Plan } from '../../domain/types';
import { activateImportedPlan } from '../../data/share';
import { rankByGoal } from '../../domain/goals';

const GROUPS: { label: string; blurb: string; match: (t: SeedPlanTemplate) => boolean }[] = [
  {
    label: 'Race training',
    blurb: 'Set a race date and the plan counts backwards to it.',
    match: (t) => t.goal === 'race' && !t.tags.includes('hyrox') && !t.tags.includes('ocr'),
  },
  {
    label: 'Obstacle & hybrid racing',
    blurb: 'Running and strength in one plan, with grip work that matters on a rig.',
    match: (t) => t.tags.includes('ocr') || t.tags.includes('hyrox'),
  },
  {
    label: 'Strength & muscle',
    blurb: 'Ongoing splits with no end date. Pick the one that matches your week.',
    match: (t) => (t.goal === 'strength' || t.goal === 'physique') && !t.tags.includes('hybrid'),
  },
  {
    label: 'Everything at once',
    blurb: 'Stay strong and keep a running base without training for anything in particular.',
    match: (t) => t.goal === 'general' || t.tags.includes('hybrid'),
  },
];

export default function PlanLibrary({ onClose }: { onClose: () => void }) {
  const { activeEquipment, profile } = useApp();
  const [selected, setSelected] = useState<SeedPlanTemplate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState<Plan | null>(null);
  const [building, setBuilding] = useState<CustomPlan | 'new' | null>(null);
  const [applying, setApplying] = useState<CustomPlan | null>(null);
  const [removing, setRemoving] = useState<CustomPlan | null>(null);
  const mine = useLiveQuery(() => allCustomPlans(), []);
  const current = useLiveQuery(() => activePlan(), []);
  const everyPlan = useLiveQuery(() => allPlans(), []);

  /** On the calendar but not being followed — imported, or set aside for another. */
  const waiting = (everyPlan ?? []).filter((item) => !item.isActive);

  // First match wins. A Hyrox plan is tagged both 'hybrid' and 'hyrox', and listing it under
  // two headings makes the catalogue look longer than it is and the groups look arbitrary.
  // Must stay above the early return below — hooks cannot sit behind a conditional.
  const grouped = useMemo(() => {
    const claimed = new Set<string>();
    return GROUPS.map((group) => {
      const templates = rankByGoal(
        SEED_PLAN_TEMPLATES.filter((t) => !claimed.has(t.slug) && group.match(t)),
        profile.primaryGoal,
      );
      for (const t of templates) claimed.add(t.slug);
      return { ...group, templates };
    }).filter((group) => group.templates.length > 0);
    // Ordering follows the goal, so the catalogue is rebuilt when it changes.
  }, [profile.primaryGoal]);

  if (selected) {
    return (
      <ApplyPlanSheet
        template={selected}
        onClose={() => setSelected(null)}
        onApplied={onClose}
      />
    );
  }

  /* A plan you built goes through the same apply sheet, carrying its own session library. */
  if (applying) {
    const translated = translateCustomPlan(applying);
    return (
      <ApplyPlanSheet
        template={translated.template}
        sessionTemplates={translated.sessionTemplateBySlug}
        closedWeekdays={translated.restDays}
        onClose={() => setApplying(null)}
        onApplied={onClose}
      />
    );
  }

  const owned = new Set(activeEquipment?.items ?? []);

  return (
    <>
      <Sheet title="Plans" onClose={onClose}>
      {current && (
        <div className="card tight">
          <div className="row between">
            <div className="grow">
              <strong>{current.name}</strong>
              <div className="tiny faint">Currently active</div>
            </div>
            <button
              className="btn sm ghost danger"
              onClick={async () => {
                const removed = await endPlan(current);
                setNotice(
                  `Plan ended — ${plural(removed, 'upcoming session')} removed. Anything already logged stays.`,
                );
              }}
            >
              End plan
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="card tight">
          <p className="small" style={{ margin: 0 }}>{notice}</p>
        </div>
      )}

      {/*
        Plans that are here but not running — imported from a file, or set aside when another
        was started. Without this they would sit on the calendar with no way to pick them up,
        which is what importing one used to produce.
      */}
      {waiting.length > 0 && (
        <>
          <div className="section-title">Yours, not running</div>
          {waiting.map((item) => (
            <div className="card tight" key={item.id}>
              <div className="row between">
                <div className="grow">
                  <strong>{item.name}</strong>
                  <div className="tiny faint">
                    Starts {formatDayLabel(item.startDate)}
                    {item.endDate && ` · ends ${formatDayLabel(item.endDate)}`}
                  </div>
                </div>
                <button className="btn sm primary" onClick={() => setStarting(item)}>
                  Start
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/*
        Plans you built. Above the catalogue, because a plan you wrote is the one you meant
        to come here for; the built-in ones are what you browse when you have not.
      */}
      <div className="section-title">Built by you</div>
      {(mine ?? []).map((item) => (
        <div className="card tight" key={item.id}>
          <div className="row between">
            <div className="grow">
              <strong>{item.name}</strong>
              <div className="tiny faint">
                {plural(daysPerWeek(item), 'day')} a week ·{' '}
                {item.weeks ? `${item.weeks} weeks` : 'ongoing'}
              </div>
            </div>
            <button className="btn sm primary" onClick={() => setApplying(item)}>
              Use
            </button>
          </div>

          <div className="tiny faint" style={{ marginTop: '0.35rem' }}>
            {item.days
              .filter(isTrainingDay)
              .map((day) => `${weekdayName(day.weekday, true)} ${dayLabel(day)}`)
              .join(' · ')}
          </div>

          <div className="row" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="btn sm grow" onClick={() => setBuilding(item)}>
              Edit
            </button>
            <button className="btn sm ghost danger" onClick={() => setRemoving(item)}>
              Delete
            </button>
          </div>
        </div>
      ))}

      <button className="btn block" style={{ marginTop: '0.5rem' }} onClick={() => setBuilding('new')}>
        + Build a plan
      </button>

      <p className="small muted" style={{ marginTop: '1rem' }}>
        Every plan is a starting point — once it is on your calendar you can move, skip, or
        rewrite any session in it.
      </p>

      {grouped.map((group) => {
        return (
          <div key={group.label}>
            <div className="section-title">{group.label}</div>
            <p className="tiny faint" style={{ marginTop: '-0.25rem' }}>{group.blurb}</p>

            {group.templates.map((template) => {
              // A plan asking for kit you lack still works via substitution, but say so.
              const missing = (template.needs ?? []).filter((tag) => !owned.has(tag));

              return (
                <button
                  key={template.slug}
                  className="pick"
                  onClick={() => setSelected(template)}
                >
                  <span className="grow">
                    <strong>{template.name}</strong>
                    <br />
                    <span className="tiny faint">
                      {template.weeks ? `${template.weeks} weeks` : 'Ongoing'} ·{' '}
                      {template.daysPerWeek} days a week
                      {missing.length > 0 && ' · will substitute for your kit'}
                    </span>
                  </span>
                  <span className="faint">›</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </Sheet>

      {/*
        Starting one retires whatever was running and clears its future sessions, exactly as
        ending a plan does — two plans laying sessions on the same days is the thing stacking
        would have to solve properly, and quietly producing it here is worse than saying so.
      */}
      {building && (
        <CustomPlanBuilder
          existing={building === 'new' ? undefined : building}
          onClose={() => setBuilding(null)}
          onSaved={(plan) => {
            setBuilding(null);
            setNotice(`“${plan.name}” saved. Tap Use when you want it on the calendar.`);
          }}
        />
      )}

      {removing && (
        <AskSheet
          title={`Delete “${removing.name}”?`}
          message="Only the plan you built. Anything already on your calendar from it stays exactly where it is."
          confirmLabel="Delete"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await deleteCustomPlan(removing.id);
            setRemoving(null);
          }}
        />
      )}

      {starting && (
        <AskSheet
          title={`Start “${starting.name}”?`}
          message={
            current
              ? `“${current.name}” stops here. Its remaining sessions come off the calendar; everything you have logged stays.`
              : 'Its sessions are already on your calendar — this makes it the plan you are following.'
          }
          confirmLabel="Start it"
          onCancel={() => setStarting(null)}
          onConfirm={async () => {
            const previous = current;
            if (previous && previous.id !== starting.id) await endPlan(previous);
            await activateImportedPlan(starting.id);
            setNotice(
              previous && previous.id !== starting.id
                ? `Following “${starting.name}”. “${previous.name}” has ended.`
                : `Following “${starting.name}”.`,
            );
            setStarting(null);
          }}
        />
      )}
    </>
  );
}
