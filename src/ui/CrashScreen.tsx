/**
 * What you see when something threw.
 *
 * Two shapes of the same screen, because two very different things have gone wrong.
 *
 * A `screen` crash took one tab down and left the rest of the app standing — the tab bar is
 * still underneath this, so the way out is to go somewhere else, and saying "reload the app"
 * would be talking someone out of the app over one bad page.
 *
 * An `app` crash happened above the router, which means it took the navigation with it and
 * there is nowhere left to go. Reloading really is the move.
 *
 * Both offer the backup, and that is the point of the screen rather than a courtesy. With no
 * server, an export is the only copy of a training history that survives the phone, and the
 * moment the app looks broken is the moment somebody decides to delete it.
 */

import { useState } from 'react';
import { exportBackup } from '../data/backup';

/**
 * Translation arrives as a prop rather than a hook.
 *
 * The outer boundary sits above the provider that answers `useT`, and calling a hook whose
 * context may be the very thing that just threw is how a crash screen crashes. Where a
 * translator can be captured safely — inside the provider, before anything went wrong — it is
 * passed in; where it cannot, English is not a gap but the only answer available, which is
 * the same call `AppProvider` makes on its own database-failure screen.
 */
export default function CrashScreen({
  error,
  scope,
  reset,
  t,
}: {
  error: Error;
  scope: 'app' | 'screen';
  reset: () => void;
  t?: (english: string) => string;
}) {
  const say = t ?? ((english: string) => english);
  const [status, setStatus] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const detail = [error.message, error.stack].filter(Boolean).join('\n\n');

  const saveBackup = async () => {
    setStatus(say('Saving…'));
    try {
      const result = await exportBackup();
      if (result.outcome === 'cancelled') return setStatus(null);
      setStatus(
        result.outcome === 'saved'
          ? `${say('Saved')} ${result.filename}`
          : (result.reason ?? say('Could not save the file.')),
      );
    } catch {
      // The export reads the database, which may be what broke. Saying so beats a second
      // crash on the screen whose job is to survive the first.
      setStatus(say('Could not save the file.'));
    }
  };

  return (
    <div className="crash">
      <span className="glyph">⚠️</span>
      {/* Both spelled out rather than a translated ternary: the copy check reads calls, and a
          string it cannot see is a string that quietly ships in English. */}
      <h2>{scope === 'app' ? say('Hybrid Forge hit a problem') : say('This screen hit a problem')}</h2>

      {/*
        Said plainly and early, because it is the thing somebody actually wants to know and
        the thing a blank screen most strongly implies the opposite of.
      */}
      <p className="small">
        {say('Your training data is safe — this is a display problem, and nothing was deleted.')}
      </p>

      <button className="btn primary block" onClick={() => void saveBackup()}>
        {say('Export backup')}
      </button>
      {status && <p className="tiny faint">{status}</p>}

      {/*
        Three weights for three different things. The export is filled because it is the one
        somebody would not think of and the only one that cannot be done later. Getting back
        in is an ordinary button. The details are for whoever is going to fix this, which on
        most days is nobody, so they stay quiet.
      */}
      {scope === 'app' ? (
        <button className="btn block" onClick={() => window.location.reload()}>
          {say('Reload the app')}
        </button>
      ) : (
        <button className="btn block" onClick={reset}>
          {say('Try this screen again')}
        </button>
      )}

      {/*
        Folded away by default and rendered as selectable text rather than behind a copy
        button alone: clipboard permissions are one more thing that can fail on the screen
        that exists for when things fail.
      */}
      <button className="btn ghost block sm" onClick={() => setShowDetail((open) => !open)}>
        {showDetail ? say('Hide details') : say('Show details')}
      </button>
      {showDetail && <pre className="crash-detail">{detail}</pre>}
    </div>
  );
}
