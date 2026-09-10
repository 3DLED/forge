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
import { EQUIPMENT_GROUPS, ALWAYS_AVAILABLE } from '../../data/seed/equipment';
import {
  addCustomEquipment,
  deleteCustomEquipment,
  movementsNeeding,
  renameCustomEquipment,
} from '../../data/customEquipment';
import { availableSlugs } from '../../domain/equipment';
import type { CustomEquipment, EquipmentProfile, EquipmentTag } from '../../domain/types';
import { useT } from '../../i18n/useT';

/** Where kit goes when nobody said, or said something the list no longer has. */
const CATCH_ALL_GROUP = 'Odd objects';

export default function EquipmentView() {
  const t = useT();
  const { equipmentProfiles, activeEquipment, exercises, profile, units, customEquipment, equipmentName } =
    useApp();
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
  const [addingKit, setAddingKit] = useState(false);
  const [renamingKit, setRenamingKit] = useState<CustomEquipment | null>(null);
  /**
   * Managing your own kit, rather than choosing what is in a profile.
   *
   * A separate mode because the chips mean two different things: normally tapping one puts it
   * in the profile, and here it marks it for removal. Running both at once would make every
   * tap ambiguous, so entering one leaves the other.
   */
  const [culling, setCulling] = useState(false);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [confirmCull, setConfirmCull] = useState(false);
  const [affected, setAffected] = useState<string[]>([]);

  const markedItems = customEquipment.filter((item) => marked.has(item.id));

  /**
   * The custom kit filed under a group.
   *
   * Anything whose group no longer exists — or which predates being asked — falls into the
   * catch-all rather than vanishing from the screen, which is the one outcome that would
   * make it unreachable.
   */
  const groupNames = new Set(EQUIPMENT_GROUPS.map((group) => group.label));
  const customIn = (label: string) =>
    customEquipment.filter((item) =>
      item.group && groupNames.has(item.group) ? item.group === label : label === CATCH_ALL_GROUP,
    );

  const startCulling = () => {
    setDraft(null);
    setMarked(new Set());
    setCulling(true);
  };

  const stopCulling = () => {
    setCulling(false);
    setMarked(new Set());
  };

  const toggleMark = (id: string) =>
    setMarked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        title={t('Equipment')}
        subtitle="What you can train with today"
        action={<Link to="/more" className="btn ghost sm">{t('Back')}</Link>}
      />

      <div className="section-title">{t('Profiles')}</div>
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
              {active && <span className="pill accent">{t('Active')}</span>}
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
          title={t('New equipment profile')}
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

      {addingKit && (
        <AddKitSheet
          onClose={() => setAddingKit(false)}
          onAdded={() => setAddingKit(false)}
        />
      )}

      {renamingKit && (
        <AskSheet
          title={`Rename “${renamingKit.name}”`}
          message="Renaming it renames it everywhere — the same rebounder can sit in three profiles."
          input={{ label: 'Name', defaultValue: renamingKit.name, required: true }}
          confirmLabel="Save"
          onCancel={() => setRenamingKit(null)}
          onConfirm={async (name) => {
            await renameCustomEquipment(renamingKit.id, name);
            setRenamingKit(null);
          }}
        />
      )}

      {confirmCull && (
        <AskSheet
          title={
            markedItems.length === 1
              ? `Delete “${markedItems[0].name}”?`
              : `Delete ${markedItems.length} pieces of kit?`
          }
          message={
            affected.length > 0
              ? `${affected.length === 1 ? 'One movement needs' : `${affected.length} movements need`} this: ${affected.slice(0, 4).join(', ')}${affected.length > 4 ? ', and more' : ''}. They are not deleted — they simply stop being offered, exactly as a barbell movement does without a barbell.`
              : 'Nothing needs it. It comes out of any profile holding it.'
          }
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmCull(false)}
          onConfirm={async () => {
            for (const item of markedItems) await deleteCustomEquipment(item);
            setConfirmCull(false);
            stopCulling();
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
            {t('Rename')}
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
            {t('Delete')}
          </button>
          {equipmentProfiles.length < 2 && (
            <p className="tiny faint" style={{ marginTop: '0.5rem' }}>
              {t('This is your only profile. Make another before deleting this one — the app has to know what you can train with.')}
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
          </div>

          {/*
            Two different jobs, and the names have to carry the difference.
            
            "Edit kit" changes what is in *this profile* — the frequent one. The other two are
            about the vocabulary itself, which every profile draws from. That distinction was
            not landing while the second was labelled "Delete": renaming lives in the same
            mode as deleting, and nobody goes looking for a rename under a bin icon.
          */}
          <div className="row wrap" style={{ gap: '0.4rem', marginBottom: '0.5rem' }}>
            {!draft && !culling && (
              <button className="btn sm ghost" onClick={() => setDraft([...target.items])}>
                ✎ Tick what you have
              </button>
            )}
            {!culling && (
              <button className="btn sm ghost" onClick={() => setAddingKit(true)}>
                + Add
              </button>
            )}
            {customEquipment.length > 0 && !draft && (
              <button
                className={`btn sm ${culling ? 'danger' : 'ghost'}`}
                onClick={async () => {
                  if (!culling) return startCulling();
                  if (markedItems.length === 0) return stopCulling();
                  // Gathered before asking, so the question can name what depends on it.
                  const needed = await Promise.all(markedItems.map((item) => movementsNeeding(item.tag)));
                  setAffected([...new Set(needed.flat())]);
                  setConfirmCull(true);
                }}
              >
                {culling
                  ? markedItems.length > 0
                    ? `🗑 Delete ${markedItems.length}`
                    : 'Done'
                  : '⚙ Rename or delete'}
              </button>
            )}
            {culling && markedItems.length === 1 && (
              <button className="btn sm ghost" onClick={() => setRenamingKit(markedItems[0])}>
                ✎ Rename
              </button>
            )}
            {culling && (
              <button className="btn sm ghost" onClick={stopCulling}>
                {t('Cancel')}
              </button>
            )}
          </div>

          {culling && (
            <p className="tiny faint" style={{ marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
              {t('Tap the kit you added — the square-cornered ones — to mark it. One at a time to rename, any number to delete. Built-in kit cannot be changed.')}
            </p>
          )}

          {EQUIPMENT_GROUPS.map((group) => (
            <section className="card" key={group.label}>
              <h3 style={{ marginBottom: '0.5rem' }}>{t(group.label)}</h3>
              <div className="row wrap" style={{ gap: '0.4rem' }}>
                {group.tags.map((tag) => (
                  <button
                    key={tag}
                    className={`chip${shown.includes(tag) ? ' on' : ''}`}
                    aria-pressed={shown.includes(tag)}
                    disabled={!draft}
                    onClick={() => toggleTag(tag)}
                  >
                    {equipmentName(tag)}
                  </button>
                ))}

                {/*
                  Kit you added sits with the built-in kit it belongs beside, rather than in a
                  pile of its own — a rebounder is conditioning, and looking for it under
                  "yours" means knowing you were the one who added it. Square corners are what
                  say it is yours; a separate heading was buying the same information twice.
                */}
                {customIn(group.label).map((item) => (
                  <button
                    key={item.id}
                    className={`chip custom${
                      culling
                        ? marked.has(item.id)
                          ? ' marked'
                          : ''
                        : shown.includes(item.tag)
                          ? ' on'
                          : ''
                    }`}
                    aria-pressed={culling ? marked.has(item.id) : shown.includes(item.tag)}
                    disabled={!draft && !culling}
                    onClick={() => (culling ? toggleMark(item.id) : toggleTag(item.tag))}
                  >
                    {item.name}
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
                  {t('Save kit')}
                </button>
                <button className="btn grow" onClick={() => setDraft(null)}>
                  {t('Cancel')}
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
              <div className="section-title">{t('Biggest gaps')}</div>
              <div className="card">
                <p className="small muted">
                  {t('What one more piece of kit would unlock, on top of this profile.')}
                </p>
                {upgrades.map((row) => (
                  <div className="row between" key={row.tag} style={{ padding: '0.3rem 0' }}>
                    <span>{equipmentName(row.tag)}</span>
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

/**
 * Adding a piece of kit the built-in list does not name.
 *
 * Asks which shelf it belongs on, because that is where it will appear from then on — filed
 * with the kit it sits beside rather than in a pile of everything anyone ever added. The
 * default is the catch-all, so the question can be ignored by anyone who does not care.
 */
function AddKitSheet({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<string>(CATCH_ALL_GROUP);
  const [saving, setSaving] = useState(false);

  return (
    <Sheet
      title={t('Add a piece of kit')}
      onClose={onClose}
      footer={
        <button
          className="btn primary block"
          disabled={saving || !name.trim()}
          onClick={async () => {
            setSaving(true);
            await addCustomEquipment(name, group);
            onAdded();
          }}
        >
          {saving ? 'Adding…' : 'Add it'}
        </button>
      }
    >
      <p className="small muted">
        {t('Whatever you train with that the list does not name. It behaves like any other equipment: tick it into a profile, and movements can require it.')}
      </p>

      <div className="section-title">{t('What is it')}</div>
      <input
        value={name}
        autoFocus
        aria-label={t('Equipment name')}
        placeholder={t('Rebounder, macebell, sledgehammer…')}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="section-title">{t('Where it belongs')}</div>
      <div className="row wrap" style={{ gap: '0.4rem' }}>
        {EQUIPMENT_GROUPS.map((option) => (
          <button
            key={option.label}
            className={`chip${group === option.label ? ' on' : ''}`}
            aria-pressed={group === option.label}
            onClick={() => setGroup(option.label)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="tiny faint" style={{ marginTop: '0.35rem' }}>
        {t('Which shelf it shows up on. It will have square corners either way, which is how kit you added is told apart from the built-in list.')}
      </p>
    </Sheet>
  );
}
