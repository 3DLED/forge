/**
 * Equipment profiles.
 *
 * The count of movements each profile unlocks is shown next to it, and the gap list at the
 * bottom names what one more purchase would buy. That was the most useful thing the old
 * version did — "a pull-up bar unlocks 14 movements" is a far better answer than a
 * catalogue of gear.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../ui/PageHeader';
import AskSheet from '../../ui/AskSheet';
import RackEditor from './RackEditor';
import { useApp } from '../../ui/AppProvider';
import { equipmentProfileRepo, profileRepo } from '../../data/repos';
import { EQUIPMENT_GROUPS, EQUIPMENT_LABELS, ALWAYS_AVAILABLE } from '../../data/seed/equipment';
import { availableSlugs } from '../../domain/equipment';
import type { EquipmentTag } from '../../domain/types';

export default function EquipmentView() {
  const { equipmentProfiles, activeEquipment, exercises, profile, units } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);

  const target = equipmentProfiles.find((p) => p.id === editing) ?? activeEquipment;

  /** How many movements each profile makes available — the honest measure of a kit. */
  const unlockCounts = useMemo(() => {
    return new Map(
      equipmentProfiles.map((p) => [p.id, availableSlugs(exercises, p.items).size]),
    );
  }, [equipmentProfiles, exercises]);

  /** What one more piece of equipment would add, on top of the active profile. */
  const upgrades = useMemo(() => {
    if (!target) return [];
    const current = availableSlugs(exercises, target.items);
    const candidates = new Set<EquipmentTag>();
    for (const exercise of exercises) {
      for (const tag of exercise.equipment) {
        if (!target.items.includes(tag) && !ALWAYS_AVAILABLE.includes(tag)) candidates.add(tag);
      }
    }

    return [...candidates]
      .map((tag) => ({
        tag,
        gain: availableSlugs(exercises, [...target.items, tag]).size - current.size,
      }))
      .filter((row) => row.gain > 0)
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 6);
  }, [exercises, target]);

  const toggleTag = async (tag: EquipmentTag) => {
    if (!target) return;
    const items = target.items.includes(tag)
      ? target.items.filter((t) => t !== tag)
      : [...target.items, tag];
    await equipmentProfileRepo.update(target.id, { items });
  };

  return (
    <>
      <PageHeader
        title="Equipment"
        subtitle="What you can train with today"
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      <div className="section-title">Profiles</div>
      {equipmentProfiles.map((item) => {
        const active = item.id === activeEquipment?.id;
        return (
          <button
            key={item.id}
            className={`pick${active ? ' selected' : ''}`}
            onClick={async () => {
              await profileRepo.update(profile.id, { activeEquipmentProfileId: item.id });
              setEditing(item.id);
            }}
          >
            <span className="grow">
              <strong>{item.name}</strong>
              <br />
              <span className="tiny faint">
                {unlockCounts.get(item.id) ?? 0} movements available
              </span>
            </span>
            {active && <span className="pill accent">Active</span>}
          </button>
        );
      })}

      <button className="btn block" style={{ marginTop: '0.5rem' }} onClick={() => setNaming(true)}>
        + New profile
      </button>

      {naming && (
        <AskSheet
          title="New equipment profile"
          message="Start from nothing but bodyweight, then tick what you have."
          input={{ label: 'Name', defaultValue: 'New profile', placeholder: 'Hotel gym', required: true }}
          confirmLabel="Create"
          onCancel={() => setNaming(false)}
          onConfirm={async (name) => {
            const created = await equipmentProfileRepo.create({
              name: name.trim(),
              items: [...ALWAYS_AVAILABLE],
              isDefault: false,
            });
            setNaming(false);
            setEditing(created.id);
          }}
        />
      )}

      {target && (
        <>
          <div className="section-title">What's in “{target.name}”</div>
          {EQUIPMENT_GROUPS.map((group) => (
            <section className="card" key={group.label}>
              <h3 style={{ marginBottom: '0.5rem' }}>{group.label}</h3>
              <div className="row wrap" style={{ gap: '0.4rem' }}>
                {group.tags.map((tag) => (
                  <button
                    key={tag}
                    className={`chip${target.items.includes(tag) ? ' on' : ''}`}
                    onClick={() => void toggleTag(tag)}
                  >
                    {EQUIPMENT_LABELS[tag]}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {/*
            Which weights, not just which kit. Ticking "kettlebell" says a bell exists; this
            says which ones, which is what every prescription in the app rounds to.
          */}
          <RackEditor target={target} units={units} />

          {upgrades.length > 0 && (
            <>
              <div className="section-title">Biggest gaps</div>
              <div className="card">
                <p className="small muted">
                  What one more piece of kit would unlock, on top of this profile.
                </p>
                {upgrades.map((row) => (
                  <div className="row between" key={row.tag} style={{ padding: '0.3rem 0' }}>
                    <span>{EQUIPMENT_LABELS[row.tag]}</span>
                    <span className="pill good">+{row.gain} movements</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
