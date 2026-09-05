/**
 * Plans you built, kept somewhere you can find them.
 *
 * Building one is also reachable from Browse plans, which is where you go when you want a plan
 * *now*. This is the other question — "what have I made, and can I send it to someone" — and
 * it is not one you ask in the middle of picking a plan to start.
 *
 * Sharing an applied plan still lives on the plan itself, on the calendar, because that one
 * carries dates and a start. What is shared from here is the shape: the week, repeated.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '../../ui/PageHeader';
import LibraryRow from './LibraryRow';
import ImportSheet from './ImportSheet';
import CustomPlanBuilder from '../plan/CustomPlanBuilder';
import { plural } from '../../ui/text';
import {
  allCustomPlans,
  dayLabel,
  daysPerWeek,
  deleteCustomPlan,
  isTrainingDay,
} from '../../data/customPlans';
import { buildCustomPlanFile, downloadShareFile } from '../../data/share';
import { weekdayName } from '../../domain/dates';
import type { CustomPlan } from '../../domain/types';

export default function PlansView() {
  const plans = useLiveQuery(() => allCustomPlans(), []);
  const [building, setBuilding] = useState<CustomPlan | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const mine = plans ?? [];

  const share = async (plan: CustomPlan) => {
    const filename = downloadShareFile(await buildCustomPlanFile(plan));
    setNotice(`Saved ${filename}. Anyone with Forge can import it and pick their own start date.`);
  };

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle={mine.length > 0 ? plural(mine.length, 'plan') : 'Build one, or open one someone sent'}
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      {notice && (
        <div className="card tight">
          <p className="small" style={{ margin: 0 }}>
            {notice}
          </p>
          <button className="btn sm ghost" style={{ marginTop: '0.4rem' }} onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {mine.map((plan) => (
        <LibraryRow
          key={plan.id}
          name={plan.name}
          subtitle={`${plural(daysPerWeek(plan), 'day')} a week · ${
            plan.weeks ? `${plan.weeks} weeks` : 'ongoing'
          }`}
          detail={plan.days
            .filter(isTrainingDay)
            .map((day) => `${weekdayName(day.weekday, true)} ${dayLabel(day)}`)
            .join(' · ')}
          onShare={() => void share(plan)}
          onEdit={() => setBuilding(plan)}
          onDelete={() => deleteCustomPlan(plan.id)}
        />
      ))}

      {mine.length === 0 && (
        <div className="empty">
          <span className="glyph">🗓️</span>
          <p>No plans of your own yet.</p>
          <p className="small faint">
            Lay out a week — which days you train and what you do on them — and it repeats for
            as long as you set it to.
          </p>
        </div>
      )}

      <button className="btn primary block" style={{ marginTop: '0.5rem' }} onClick={() => setBuilding('new')}>
        + Build a plan
      </button>

      <button className="btn block" style={{ marginTop: '0.5rem' }} onClick={() => setImporting(true)}>
        📥 Import a plan
      </button>

      {building && (
        <CustomPlanBuilder
          existing={building === 'new' ? undefined : building}
          onClose={() => setBuilding(null)}
          onSaved={(plan) => {
            setBuilding(null);
            setNotice(`“${plan.name}” saved. Start it from the Plan tab when you are ready.`);
          }}
        />
      )}

      {importing && (
        <ImportSheet
          expecting="plan"
          onClose={() => setImporting(false)}
          onImported={(message) => {
            setImporting(false);
            setNotice(message);
          }}
        />
      )}
    </>
  );
}
