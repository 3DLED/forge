import { useEffect, useState, type ReactNode } from 'react';
import { lockScroll } from './scrollLock';

/**
 * Bottom sheet. Everything modal in this app is a sheet rather than a centred dialog —
 * one-handed on a phone, the bottom of the screen is the only part you can reach.
 *
 * `confirmClose` is for sheets holding state that cannot be recovered by reopening them.
 * By default a tap on the backdrop dismisses, which is right for a picker and wrong for a
 * running clock: the empty space above the sheet is large, sits exactly where a thumb goes
 * when you reach for a phone on the floor, and gives no warning before throwing the timer
 * away. With it set, the backdrop stops being a dismiss target entirely and closing moves
 * to a deliberate two-tap control.
 */
export default function Sheet({
  title,
  onClose,
  children,
  footer,
  confirmClose = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  confirmClose?: boolean;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!confirmClose) {
        onClose();
        return;
      }
      // Escape follows the same two-step, so a stray keypress cannot end a running block.
      setArmed((wasArmed) => {
        if (wasArmed) onClose();
        return !wasArmed;
      });
    };

    document.addEventListener('keydown', onKey);
    // Stop the page behind the sheet scrolling with it. Counted, because sheets stack.
    const unlock = lockScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [onClose, confirmClose]);

  /*
   * Disarm on its own, so a half-finished tap does not leave the control primed minutes
   * later. Eight seconds: long enough to tap, hesitate, and tap again while out of breath —
   * a shorter window silently reverts and the second tap only re-arms, which reads as the
   * button being broken.
   */
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 8000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div
      className="sheet-backdrop"
      onClick={confirmClose ? undefined : onClose}
      role="presentation"
    >
      {confirmClose && (
        <button
          className={`sheet-dismiss${armed ? ' armed' : ''}`}
          aria-label={armed ? 'Tap again to close' : 'Close'}
          onClick={(event) => {
            event.stopPropagation();
            if (armed) onClose();
            else setArmed(true);
          }}
        >
          {armed ? 'Tap again to close' : 'Close'}
        </button>
      )}

      <div
        className={`sheet${confirmClose ? ' with-dismiss' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="card-head">
          <h2>{title}</h2>
          {!confirmClose && (
            <button className="btn ghost sm" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div style={{ paddingTop: '0.75rem' }}>{footer}</div>}
      </div>
    </div>
  );
}
