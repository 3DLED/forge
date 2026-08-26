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
import { SEED_PLAN_TEMPLATES, type SeedPlanTemplate } from '../../data/seed/planTemplates';
import { activePlan, endPlan } from '../../data/plans';

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
  const { activeEquipment } = useApp();
  const [selected, setSelected] = useState<SeedPlanTemplate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = useLiveQuery(() => activePlan(), []);

  // First match wins. A Hyrox plan is tagged both 'hybrid' and 'hyrox', and listing it under
  // two headings makes the catalogue look longer than it is and the groups look arbitrary.
  // Must stay above the early return below — hooks cannot sit behind a conditional.
  const grouped = useMemo(() => {
    const claimed = new Set<string>();
    return GROUPS.map((group) => {
      const templates = SEED_PLAN_TEMPLATES.filter(
        (t) => !claimed.has(t.slug) && group.match(t),
      );
      for (const t of templates) claimed.add(t.slug);
      return { ...group, templates };
    }).filter((group) => group.templates.length > 0);
  }, []);

  if (selected) {
    return (
      <ApplyPlanSheet
        template={selected}
        onClose={() => setSelected(null)}
        onApplied={onClose}
      />
    );
  }

  const owned = new Set(activeEquipment?.items ?? []);

  return (
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

      <p className="small muted">
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
  );
}
