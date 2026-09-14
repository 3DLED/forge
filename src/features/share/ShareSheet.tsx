/**
 * A look at the card before it goes anywhere, then the share sheet.
 *
 * The preview is the page #7 asked for. Somebody about to post a run to a group chat wants to
 * see what their friends will see first, and a share button that sends an image nobody has
 * looked at is how a card with the wrong name on it ends up in front of forty people.
 */

import { useEffect, useMemo, useState } from 'react';
import Sheet from '../../ui/Sheet';
import { useApp } from '../../ui/AppProvider';
import { saveImageFile } from '../../data/fileSave';
import { cardData, renderCard } from './shareCard';
import type { LoggedSession } from '../../domain/types';
import { useT } from '../../i18n/useT';

function filenameFor(session: LoggedSession): string {
  const name = session.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'session';
  return `forge-${name}-${session.date}.png`;
}

export default function ShareSheet({ session, onClose }: { session: LoggedSession; onClose: () => void }) {
  const t = useT();
  const { exerciseBySlug, units, profile } = useApp();
  const [image, setImage] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<string | null>(null);

  const data = useMemo(
    () => cardData(session, { bySlug: exerciseBySlug, units, t, bodyweightKg: profile.bodyweightKg }),
    [session, exerciseBySlug, units, t, profile.bodyweightKg],
  );

  // Drawn after the sheet is on screen, so opening it never waits on the canvas.
  useEffect(() => {
    const timer = setTimeout(() => setImage(renderCard(data)), 0);
    return () => clearTimeout(timer);
  }, [data]);

  const share = async () => {
    if (!image) return;
    const result = await saveImageFile(filenameFor(session), image);
    if (result.outcome === 'cancelled') return;
    setStatus(
      result.outcome === 'saved'
        ? `${t('Saved')} ${result.filename}`
        : (result.reason ?? t('Could not save the file.')),
    );
  };

  return (
    <Sheet title={t('Share')} onClose={onClose}>
      {image === undefined && <p className="small muted">{t('Drawing the card…')}</p>}
      {image === null && <p className="small muted">{t('This device could not draw the card.')}</p>}
      {image && <img className="share-preview" src={image} alt={`${data.title}, ${data.date}`} />}

      <button className="btn primary block" disabled={!image} onClick={() => void share()}>
        {t('Share image')}
      </button>
      {status && (
        <p className="tiny faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          {status}
        </p>
      )}
    </Sheet>
  );
}
