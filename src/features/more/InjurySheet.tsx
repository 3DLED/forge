/**
 * Logging something that hurts.
 *
 * The preview is the point, as it is everywhere else that rewrites the calendar: standing down
 * a week of training is not something to find out about afterwards. It updates as you change
 * the area or the date, so the consequence of "three weeks" is visible before you commit to it.
 */

import { useEffect, useMemo, useState } from 'react';
import Sheet from '../../ui/Sheet';
import { plural } from '../../ui/text';
import { useApp } from '../../ui/AppProvider';
import { logInjury, previewRest } from '../../data/injuries';
import { SEVERITIES, SEVERITY_ORDER, suggestedRestUntil } from '../../domain/injuries';
import type { Injury, InjurySeverity } from '../../domain/injuries';
import { BUILDABLE_REGIONS, REGION_LABELS } from '../../domain/regions';
import type { BodyRegion } from '../../domain/regions';
import { daysBetween, formatDayLabel, todayKey } from '../../domain/dates';

/** Conditioning and cardio can be hurt too, so the picker offers more than the builder does. */
const REGIONS: BodyRegion[] = [...BUILDABLE_REGIONS, 'conditioning', 'cardio'];

export default function InjurySheet({
  onClose,
  onLogged,
}: {
  onClose: () => void;
  onLogged: (result: { skipped: number }) => void;
}) {
  const { exerciseBySlug } = useApp();
  const today = todayKey();

  const [region, setRegion] = useState<BodyRegion>('upper');
  const [label, setLabel] = useState('');
  const [severity, setSeverity] = useState<InjurySeverity>('sore');
  const [restUntil, setRestUntil] = useState(() => suggestedRestUntil(today, 'sore'));
  const [cause, setCause] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ affected: number; unaffected: number } | null>(null);

  /** The severity proposes a window; changing the date afterwards overrides it. */
  const pickSeverity = (next: InjurySeverity) => {
    setSeverity(next);
    setRestUntil(suggestedRestUntil(today, next));
  };

  const fields = useMemo<Omit<Injury, 'id'>>(
    () => ({
      region,
      label: label.trim() || REGION_LABELS[region],
      severity,
      startDate: today,
      restUntil,
      cause: cause.trim() || undefined,
    }),
    [region, label, severity, today, restUntil, cause],
  );

  /** Only `planRest` reads the id, and only to hand it back, so a placeholder is honest here. */
  const draft = useMemo<Injury>(() => ({ id: 'preview', ...fields }), [fields]);

  useEffect(() => {
    let current = true;
    void previewRest(draft, exerciseBySlug, today).then((rest) => {
      if (current) setPreview({ affected: rest.affected.length, unaffected: rest.unaffected });
    });
    return () => {
      current = false;
    };
  }, [draft, exerciseBySlug, today]);

  const days = daysBetween(today, restUntil) + 1;

  return (
    <Sheet
      title="Log an injury"
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={saving || restUntil < today}
          onClick={async () => {
            setSaving(true);
            const { skipped } = await logInjury(fields, exerciseBySlug, today);
            onLogged({ skipped });
          }}
        >
          {saving ? 'Saving…' : 'Log it'}
        </button>
      }
    >
      <div className="section-title">What hurts</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {REGIONS.map((option) => (
          <button
            key={option}
            className={`chip${region === option ? ' on' : ''}`}
            onClick={() => setRegion(option)}
          >
            {REGION_LABELS[option]}
          </button>
        ))}
      </div>

      <input
        style={{ marginTop: '0.5rem' }}
        value={label}
        placeholder="Left shoulder"
        aria-label="What hurts, in your words"
        onChange={(event) => setLabel(event.target.value)}
      />

      <div className="section-title">How bad</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {SEVERITY_ORDER.map((option) => (
          <button
            key={option}
            className={`chip${severity === option ? ' on' : ''}`}
            onClick={() => pickSeverity(option)}
          >
            {SEVERITIES[option].label}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        {SEVERITIES[severity].blurb}
      </p>

      <div className="section-title">Rest until</div>
      <input
        type="date"
        value={restUntil}
        min={today}
        aria-label="Rest until"
        onChange={(event) => setRestUntil(event.target.value)}
      />
      <p className="tiny faint">
        {plural(days, 'day')} off that area. Adjust it freely — this is a starting point from
        how you rated it, not a diagnosis. Get anything sharp, swollen or not improving looked
        at properly.
      </p>

      <div className="section-title">How it happened</div>
      <input
        value={cause}
        placeholder="Optional — third set of overhead press"
        aria-label="How it happened"
        onChange={(event) => setCause(event.target.value)}
      />

      {preview && (
        <div className="card tight" style={{ marginTop: '0.75rem' }}>
          {preview.affected > 0 ? (
            <>
              <strong className="small">
                {plural(preview.affected, 'planned session')} will be skipped
              </strong>
              <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
                Everything that loads {REGION_LABELS[region].toLowerCase()} between now and then.
                {preview.unaffected > 0 &&
                  ` The other ${plural(preview.unaffected, 'session')} in that window carry on.`}
              </div>
            </>
          ) : (
            <span className="small muted">
              Nothing planned in that window loads {REGION_LABELS[region].toLowerCase()}, so your
              calendar is unchanged.
            </span>
          )}
          <div className="tiny faint" style={{ marginTop: '0.35rem' }}>
            Skipped, not deleted — mark the injury healed early and you can take them back.
          </div>
        </div>
      )}

      <p className="tiny faint" style={{ marginTop: '0.5rem' }}>
        Logged {formatDayLabel(today).toLowerCase()}.
      </p>
    </Sheet>
  );
}
