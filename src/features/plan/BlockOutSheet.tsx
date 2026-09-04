/**
 * Blocking days out, a stretch at a time.
 *
 * The reason to block days is almost never one day. It is a holiday, a work trip, a fortnight
 * with a new baby — and doing that a day at a time meant nine taps and nine chances to miss
 * one. The underlying record was always a range; only the screen insisted on singles.
 *
 * It says what is inside the range before you commit, because blocking a week you had four
 * sessions planned in is a different decision to blocking an empty one, and the calendar is
 * the wrong place to discover that afterwards. Those sessions are left where they are: the
 * block stops *new* scheduling landing here, and quietly deleting work you had planned is not
 * something a button labelled "block" should do.
 */

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Sheet from '../../ui/Sheet';
import { plural } from '../../ui/text';
import { addBlackout } from '../../data/plans';
import { plannedBetween } from '../../data/sessions';
import { daysBetween, formatDayLabel } from '../../domain/dates';
import type { DayKey } from '../../domain/types';

export default function BlockOutSheet({
  from,
  onClose,
  onBlocked,
}: {
  /** The day that was tapped. The range starts here. */
  from: DayKey;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const [until, setUntil] = useState<DayKey>(from);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // A backwards range is a typo, not an instruction.
  const end: DayKey = until >= from ? until : from;
  const days = daysBetween(from, end) + 1;

  const inRange = useLiveQuery(() => plannedBetween(from, end), [from, end]);
  const affected = (inRange ?? []).filter((session) => session.status === 'planned');

  return (
    <Sheet
      title={days === 1 ? 'Block this day out' : `Block out ${plural(days, 'day')}`}
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await addBlackout(from, end, reason.trim() || undefined);
            onBlocked();
          }}
        >
          {saving ? 'Blocking…' : days === 1 ? 'Block it' : `Block ${plural(days, 'day')}`}
        </button>
      }
    >
      <p className="small muted">
        Nothing new gets scheduled in a blocked stretch, and applying a plan routes around it.
      </p>

      <div className="section-title">From</div>
      <div className="card tight">
        <span className="small">{formatDayLabel(from)}</span>
      </div>

      <div className="section-title">Until</div>
      <input
        type="date"
        value={until}
        min={from}
        aria-label="Last day to block"
        onChange={(event) => setUntil(event.target.value as DayKey)}
      />
      <p className="tiny faint">
        {days === 1
          ? 'Just this day. Set a later date to block a stretch — a trip, a holiday, time off.'
          : `${formatDayLabel(from)} to ${formatDayLabel(end)}, inclusive.`}
      </p>

      <div className="section-title">Reason</div>
      <input
        value={reason}
        placeholder="Travel, rest, work…"
        aria-label="Reason (optional)"
        onChange={(event) => setReason(event.target.value)}
      />

      {affected.length > 0 && (
        <div className="card tight" style={{ borderColor: 'var(--warn)', marginTop: '0.75rem' }}>
          <strong className="small">
            {plural(affected.length, 'session')} already planned in here
          </strong>
          <div className="tiny faint" style={{ marginTop: '0.3rem' }}>
            They stay where they are — blocking stops new scheduling, it does not throw away
            work you had already planned. Skip or move them from their own days if you are
            not doing them.
          </div>
          <div className="tiny" style={{ marginTop: '0.4rem' }}>
            {affected
              .slice(0, 4)
              .map((session) => `${formatDayLabel(session.date)} · ${session.prescription.name}`)
              .join(' · ')}
            {affected.length > 4 && ` · and ${affected.length - 4} more`}
          </div>
        </div>
      )}
    </Sheet>
  );
}
