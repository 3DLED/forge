/**
 * A once-only walk along the tab bar, straight after setup.
 *
 * One sentence per tab, pointing at the tab itself and opening its screen behind the dimming, so
 * each sentence is about something visible rather than something to remember. Five stops,
 * because there are five tabs; anything deeper is found by using the app, which is the better
 * teacher and costs the new tester nothing.
 *
 * Positioned from the tab bar's real layout rather than from assumed widths, so it still points
 * at the right place on an iPad or with larger text.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../ui/AppProvider';
import { profileRepo } from '../../data/repos';
import { useT } from '../../i18n/useT';

const PATHS = ['/today', '/plan', '/history', '/progress', '/more'];
const BUBBLE_W = 264;
const EDGE = 12;

interface Place {
  spot: { left: number; top: number; width: number; height: number };
  bubbleLeft: number;
  bubbleBottom: number;
  arrow: number;
}

export default function Tour() {
  const t = useT();
  const navigate = useNavigate();
  const { profile } = useApp();
  const [stop, setStop] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);

  /*
   * React Router hands back a new navigate function after every navigation. Held in a ref so
   * nothing below has to depend on it: as a dependency it re-ran the tab-opening effect the
   * moment Done navigated home, and sent the app straight back to the last tab.
   */
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  /** Set by Done and Skip, so no effect can navigate anywhere after leaving. */
  const leaving = useRef(false);

  const stops = [
    { title: t('Today'), body: t('What is planned for today, and where you start a workout or log a run.') },
    { title: t('Plan'), body: t('Your calendar. Start a plan, move or skip a day, or block out a holiday.') },
    { title: t('History'), body: t('Every session you have logged, newest first. Open one to review it or share it.') },
    { title: t('Progress'), body: t('Training load, pace, heart rate and personal bests, week by week.') },
    { title: t('More'), body: t('Equipment, reminders, Apple Health, backups and settings.') },
  ];

  const measure = useCallback(() => {
    const tab = document.querySelectorAll<HTMLElement>('.tabbar a')[stop];
    if (!tab) return setPlace(null);
    const rect = tab.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    const bubbleLeft = Math.min(Math.max(centre - BUBBLE_W / 2, EDGE), window.innerWidth - BUBBLE_W - EDGE);
    setPlace({
      spot: { left: rect.left + 4, top: rect.top + 4, width: rect.width - 8, height: rect.height - 8 },
      bubbleLeft,
      bubbleBottom: window.innerHeight - rect.top + 14,
      arrow: centre - bubbleLeft,
    });
  }, [stop]);

  /** The latest measure, for a timer that outlives the render that scheduled it. */
  const measureRef = useRef(measure);
  measureRef.current = measure;

  // Open this stop's tab. Keyed on the stop alone; see the note on navigateRef.
  useEffect(() => {
    if (leaving.current) return;
    navigateRef.current(PATHS[stop]);

    /*
     * And measure once more after the new page has laid out. A plain timer on purpose: animation
     * frames and resize observers both stop in a page that is not being drawn, and the preview
     * showed what happens then. A short page drops the scrollbar, the tabs widen, and the first
     * measurement stands for the whole stop, a few pixels to one side of the tab it names.
     */
    const timer = setTimeout(() => measureRef.current(), 150);
    return () => clearTimeout(timer);
  }, [stop]);

  /*
   * Measured now, again once the new tab's page has laid out, and again whenever the tab bar
   * changes size. Measuring once was not enough: a long page brings in a scrollbar, the tab bar
   * narrows, and the spotlight was left sitting a few pixels to one side of the tab it named.
   */
  useLayoutEffect(() => {
    measure();
    const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => measure()) : null;

    const bar = document.querySelector('.tabbar');
    const observer = typeof ResizeObserver === 'function' && bar ? new ResizeObserver(() => measure()) : null;
    if (observer && bar) {
      observer.observe(bar);
      observer.observe(document.documentElement);
    }
    window.addEventListener('resize', measure);

    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const done = () => {
    leaving.current = true;
    void profileRepo.update(profile.id, { touredAt: new Date().toISOString() });
    navigateRef.current('/today');
  };

  const last = stop === stops.length - 1;

  return (
    <>
      <div className="tour-blocker" onClick={(event) => event.stopPropagation()} />
      {place && (
        <>
          <div className="tour-spot" style={place.spot} />
          <div
            className="tour-bubble"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            style={{ left: place.bubbleLeft, bottom: place.bubbleBottom, '--arrow': `${place.arrow}px` } as React.CSSProperties}
          >
            <div className="row between">
              <strong id="tour-title">{stops[stop].title}</strong>
              <span className="tiny faint mono">
                {stop + 1} / {stops.length}
              </span>
            </div>
            <p className="small muted">{stops[stop].body}</p>
            <div className="row" style={{ gap: '0.5rem' }}>
              {!last && (
                <button className="btn ghost sm grow" onClick={done}>
                  {t('Skip')}
                </button>
              )}
              <button className="btn primary sm grow" onClick={() => (last ? done() : setStop(stop + 1))}>
                {last ? t('Done') : t('Next')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
