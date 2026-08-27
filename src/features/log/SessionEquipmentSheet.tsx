/**
 * Equipment for one session.
 *
 * More → Equipment is the default; this overrides it for today only. The common case is a
 * hotel gym or a friend's garage — you want the change to apply to the workout in front of
 * you and be forgotten afterwards, not to quietly redefine "Home" for every future session.
 *
 * Start from a profile, then tick what is actually there. The result is stored as a plain
 * tag list, so the record stays true even if the profile it started from is edited later.
 */

import { useState } from 'react';
import Sheet from '../../ui/Sheet';
import { useApp } from '../../ui/AppProvider';
import { availableSlugs } from '../../domain/equipment';
import { ALWAYS_AVAILABLE, EQUIPMENT_GROUPS, EQUIPMENT_LABELS } from '../../data/seed/equipment';
import { plural } from '../../ui/text';
import type { EquipmentTag } from '../../domain/types';

export default function SessionEquipmentSheet({
  current,
  isOverridden,
  onApply,
  onReset,
  onClose,
}: {
  current: EquipmentTag[];
  isOverridden: boolean;
  onApply: (tags: EquipmentTag[]) => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { equipmentProfiles, exercises, activeEquipment } = useApp();
  const [tags, setTags] = useState<EquipmentTag[]>(current);

  const unlocked = availableSlugs(exercises, tags).size;

  const toggle = (tag: EquipmentTag) =>
    setTags((previous) =>
      previous.includes(tag) ? previous.filter((t) => t !== tag) : [...previous, tag],
    );

  return (
    <Sheet
      title="Equipment for this workout"
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: '0.5rem' }}>
          {isOverridden && (
            <button className="btn grow" onClick={() => void onReset()}>
              Use my default
            </button>
          )}
          <button className="btn primary grow" onClick={() => void onApply(tags)}>
            Use for this workout
          </button>
        </div>
      }
    >
      <p className="small muted">
        Changes what this session suggests and substitutes. Your default stays{' '}
        <strong>{activeEquipment?.name ?? 'unset'}</strong>.
      </p>

      <div className="section-title">Start from a profile</div>
      <div className="chip-row">
        {equipmentProfiles.map((profile) => (
          <button
            key={profile.id}
            className="chip"
            onClick={() => setTags([...profile.items])}
          >
            {profile.name}
          </button>
        ))}
        <button className="chip" onClick={() => setTags([...ALWAYS_AVAILABLE])}>
          Nothing but bodyweight
        </button>
      </div>

      <div className="section-title">{plural(unlocked, 'movement')} available</div>

      {EQUIPMENT_GROUPS.map((group) => (
        <section className="card tight" key={group.label}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '0.92rem' }}>{group.label}</h3>
          <div className="row wrap" style={{ gap: '0.4rem' }}>
            {group.tags.map((tag) => (
              <button
                key={tag}
                className={`chip${tags.includes(tag) ? ' on' : ''}`}
                onClick={() => toggle(tag)}
              >
                {EQUIPMENT_LABELS[tag]}
              </button>
            ))}
          </div>
        </section>
      ))}
    </Sheet>
  );
}
