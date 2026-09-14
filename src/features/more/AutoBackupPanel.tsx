/**
 * Automatic backup: one copy, kept current, in a folder somebody chose.
 *
 * Sits inside the Your data card under the manual export, because they are the same promise
 * made two ways. The export is a snapshot you take on purpose; this is the copy that is simply
 * always there, and a person deciding how safe their history is should see both at once.
 *
 * Choosing a folder saves straight away. Otherwise the only evidence the choice worked would be
 * a "last saved" line that stays empty until the next workout, which reads as broken.
 *
 * iOS only, and it renders nothing anywhere else rather than a disabled control. The manual
 * export already covers the browser, and a button there that could never work is clutter.
 */

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getMeta, setMeta } from '../../db/repo';
import {
  backupFolder,
  chooseBackupFolder,
  folderBackupSupported,
  forgetBackupFolder,
} from '../../data/folderBackup';
import { AUTO_BACKUP_AT, AUTO_BACKUP_ERROR, backUpNow } from '../../ui/useAutoBackup';
import { useT } from '../../i18n/useT';

export default function AutoBackupPanel() {
  const t = useT();
  const supported = folderBackupSupported();
  /** Undefined while the plugin is still being asked, so nothing flashes the wrong state. */
  const [folder, setFolder] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lastAt = useLiveQuery(() => getMeta<string | null>(AUTO_BACKUP_AT, null), []);
  const lastError = useLiveQuery(() => getMeta<string | null>(AUTO_BACKUP_ERROR, null), []);

  useEffect(() => {
    if (supported) void backupFolder().then(setFolder);
  }, [supported]);

  const save = async () => {
    setBusy(true);
    setNote(null);
    const result = await backUpNow();
    setBusy(false);
    if (result.ok) {
      setNote(t('Backed up.'));
    } else if (result.code === 'FOLDER_GONE' || result.code === 'NO_FOLDER') {
      setFolder(null);
      setNote(t('That folder can no longer be reached. Choose it again.'));
    } else {
      setNote(result.reason);
    }
  };

  const choose = async () => {
    const picked = await chooseBackupFolder();
    if (!picked) return;
    setFolder(picked.folder);
    await save();
  };

  const turnOff = async () => {
    await forgetBackupFolder();
    await setMeta(AUTO_BACKUP_ERROR, null);
    setFolder(null);
    setNote(null);
  };

  if (!supported || folder === undefined) return null;

  return (
    <div style={{ marginTop: '1rem' }}>
      <strong className="small">{t('Automatic backup')}</strong>

      {folder == null ? (
        <>
          <p className="tiny faint" style={{ margin: '0.3rem 0 0.5rem' }}>
            {t('Pick a folder in Files, such as iCloud Drive, Google Drive or OneDrive, and Forge keeps one copy of your data there, replaced whenever your training changes.')}
          </p>
          <button className="btn block" onClick={() => void choose()}>
            {t('Choose a folder')}
          </button>
        </>
      ) : (
        <>
          <p className="small" style={{ margin: '0.3rem 0 0' }}>
            {t('Saving to')} <strong>{folder}</strong>
          </p>
          <p className="tiny faint" style={{ margin: '0 0 0.5rem' }}>
            {lastAt
              ? `${t('Last saved')} ${new Date(lastAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
              : t('Not saved yet')}
          </p>
          {lastError && !note && (
            <p className="tiny" style={{ color: 'var(--warn)', margin: '0 0 0.5rem' }}>
              {lastError}
            </p>
          )}
          <div className="row" style={{ gap: '0.5rem' }}>
            <button className="btn grow" disabled={busy} onClick={() => void save()}>
              {t('Back up now')}
            </button>
            <button className="btn grow" disabled={busy} onClick={() => void choose()}>
              {t('Change folder')}
            </button>
          </div>
          <button className="btn ghost block sm" style={{ marginTop: '0.4rem' }} onClick={() => void turnOff()}>
            {t('Turn off')}
          </button>
        </>
      )}

      {note && (
        <p className="tiny faint" style={{ marginTop: '0.4rem', marginBottom: 0 }}>
          {note}
        </p>
      )}
    </div>
  );
}
