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
import Sheet from '../../ui/Sheet';
import RackEditor from './RackEditor';
import { useApp } from '../../ui/AppProvider';
import { equipmentProfileRepo, profileRepo } from '../../data/repos';
import { EQUIPMENT_GROUPS, EQUIPMENT_LABELS, ALWAYS_AVAILABLE } from '../../data/seed/equipment';
import { availableSlugs } from '../../domain/equipment';
import type { EquipmentProfile, EquipmentTag } from '../../domain/types';

export default function EquipmentView() {
  const { equipmentProfiles, activeEquipment, exercises, profile, units } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [managing, setManaging] = useState<EquipmentProfile | null>(null);
  const [renaming, setRenaming] = useState<EquipmentProfile | null>(null);
  const [deleting, setDeleting] = useState<EquipmentProfile | null>(null);

  /**
   * Kit changes are staged, not applied as you tap.
   *
   * Ticking a tag changes what the whole app will offer you — the suggester, plan generation,
   * the movement picker — so the old behaviour meant tapping a chip to find out what it
   * unlocked had already committed you to it. Holding a draft turns the same taps into a
   * question you can ask and then decline, with the movement count answering live as you go.
   *
   * The rack below stays immediate on purpose: which bells you own is a fact about your
   * garage, not a plan you are trying out.
   */
  const [draft, setDraft] = useState<EquipmentTag[] | null>(null);

  const target = equipmentProfiles.find((p) => p.id === editing) ?? activeEquipment;
  const shown = draft ?? target?.items ?? [];

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

  const toggleTag = (tag: EquipmentTag) => {
    if (!draft) return;
    setDraft(draft.includes(tag) ? draft.filter((t) => t !== tag) : [...draft, tag]);
  };

  /** What the staged kit would make available, so the count answers before you commit. */
  const draftUnlocks = useMemo(() => availableSlugs(exercises, shown).size, [exercises, shown]);

  const removeProfile = async (victim: EquipmentProfile) => {
    const remaining = equipmentProfiles.filter((p) => p.id !== victim.id);
    await equipmentProfileRepo.remove(victim.id);

    // Never leave the app pointing at a profile that is gone.
    if (profile.activeEquipmentProfileId === victim.id) {
      const next = remaining.find((p) => p.isDefault) ?? remaining[0];
      await profileRepo.update(profile.id, { activeEquipmentProfileId: next?.id });
    }
    if (editing === victim.id) setEditing(null);
    setDraft(null);
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
          <div className="row" key={item.id} style={{ gap: '0.4rem', alignItems: 'stretch' }}>
            <button
              className={`pick grow${active ? ' selected' : ''}`}
              onClick={async () => {
                await profileRepo.update(profile.id, { activeEquipmentProfileId: item.id });
                setEditing(item.id);
                setDraft(null);
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
            <button
              className="btn ghost sm"
              aria-label={`Rename or delete ${item.name}`}
              onClick={() => setManaging(item)}
            >
              ✎
            </button>
          </div>
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

      {managing && (
        <Sheet title={managing.name} onClose={() => setManaging(null)}>
          <button
            className="btn block"
            onClick={() => {
              setRenaming(managing);
              setManaging(null);
            }}
          >
            Rename
          </button>
          <button
            className="btn block ghost danger"
            style={{ marginTop: '0.5rem' }}
            disabled={equipmentProfiles.length < 2}
            onClick={() => {
              setDeleting(managing);
              setManaging(null);
            }}
          >
            Delete
          </button>
          {equipmentProfiles.length < 2 && (
            <p className="tiny faint" style={{ marginTop: '0.5rem' }}>
              This is your only profile. Make another before deleting this one — the app has to
              know what you can train with.
            </p>
          )}
        </Sheet>
      )}

      {renaming && (
        <AskSheet
          title={`Rename “${renaming.name}”`}
          input={{ label: 'Name', defaultValue: renaming.name, required: true }}
          confirmLabel="Save"
          onCancel={() => setRenaming(null)}
          onConfirm={async (name) => {
            await equipmentProfileRepo.update(renaming.id, { name: name.trim() });
            setRenaming(null);
          }}
        />
      )}

      {deleting && (
        <AskSheet
          title={`Delete “${deleting.name}”?`}
          message="Workouts you logged with it are untouched — this only removes the profile, so it stops being somewhere you can train from."
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await removeProfile(deleting);
            setDeleting(null);
          }}
        />
      )}

      {target && (
        <>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div className="section-title grow">What's in “{target.name}”</div>
            {!draft && (
              <button className="btn sm ghost" onClick={() => setDraft([...target.items])}>
                ✎ Edit kit
              </button>
            )}
          </div>

          {EQUIPMENT_GROUPS.map((group) => (
            <section className="card" key={group.label}>
              <h3 style={{ marginBottom: '0.5rem' }}>{group.label}</h3>
              <div className="row wrap" style={{ gap: '0.4rem' }}>
                {group.tags.map((tag) => (
                  <button
                    key={tag}
                    className={`chip${shown.includes(tag) ? ' on' : ''}`}
                    aria-pressed={shown.includes(tag)}
                    disabled={!draft}
                    onClick={() => toggleTag(tag)}
                  >
                    {EQUIPMENT_LABELS[tag]}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {draft && (
            <div className="card tight">
              <div className="row between" style={{ marginBottom: '0.5rem' }}>
                <span className="grow small">
                  {draftUnlocks} movements
                  {draftUnlocks !== (unlockCounts.get(target.id) ?? 0) && (
                    <span className="faint">
                      {' '}
                      ({draftUnlocks > (unlockCounts.get(target.id) ?? 0) ? '+' : ''}
                      {draftUnlocks - (unlockCounts.get(target.id) ?? 0)})
                    </span>
                  )}
                </span>
              </div>
              <div className="row" style={{ gap: '0.5rem' }}>
                <button
                  className="btn primary grow"
                  onClick={async () => {
                    await equipmentProfileRepo.update(target.id, { items: draft });
                    setDraft(null);
                  }}
                >
                  Save kit
                </button>
                <button className="btn grow" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

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
