/**
 * In-app replacement for `prompt()` and `confirm()`.
 *
 * Native dialogs are not merely ugly here — they are unavailable in some embedded and
 * standalone-PWA contexts, where `prompt()` throws and takes the rest of the click handler
 * with it. A button that silently does nothing is worse than an ugly dialog, so every
 * confirmation and short text entry goes through this instead.
 */

import { useState, type ReactNode } from 'react';
import Sheet from './Sheet';

export interface AskInput {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Require a non-empty value before confirming. */
  required?: boolean;
  /** Require this exact string — used for destructive confirmations. */
  mustEqual?: string;
}

export default function AskSheet({
  title,
  message,
  input,
  confirmLabel = 'OK',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: ReactNode;
  input?: AskInput;
  confirmLabel?: string;
  danger?: boolean;
  /** Receives the typed value, or an empty string when there is no input. */
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(input?.defaultValue ?? '');
  const [busy, setBusy] = useState(false);

  const text = value.trim();
  const blocked =
    (input?.required && text.length === 0) ||
    (input?.mustEqual != null && value !== input.mustEqual);

  const confirm = async () => {
    if (blocked || busy) return;
    setBusy(true);
    await onConfirm(value);
  };

  return (
    <Sheet
      title={title}
      onClose={onCancel}
      footer={
        <div className="row" style={{ gap: '0.5rem' }}>
          <button className="btn grow" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn grow ${danger ? 'danger' : 'primary'}`}
            onClick={() => void confirm()}
            disabled={blocked || busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      }
    >
      {message && <p className="small muted">{message}</p>}

      {input && (
        <>
          {input.label && <div className="section-title">{input.label}</div>}
          <input
            type="text"
            value={value}
            placeholder={input.placeholder}
            aria-label={input.label ?? title}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void confirm();
            }}
          />
        </>
      )}
    </Sheet>
  );
}
