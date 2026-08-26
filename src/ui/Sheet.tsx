import { useEffect, type ReactNode } from 'react';

/**
 * Bottom sheet. Everything modal in this app is a sheet rather than a centred dialog —
 * one-handed on a phone, the bottom of the screen is the only part you can reach.
 */
export default function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Stop the page behind the sheet scrolling with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="card-head">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div style={{ paddingTop: '0.75rem' }}>{footer}</div>}
      </div>
    </div>
  );
}
