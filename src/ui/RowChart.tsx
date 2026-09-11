/**
 * A list of labelled horizontal bars, third of the small chart set.
 *
 * The vertical charts answer "how did this change" — twelve weeks along the bottom, one
 * quantity up the side. This one answers "how does this compare to that", where the things
 * being compared are named rather than dated and there are more of them than fit legibly
 * across a phone. A label sits beside its own bar instead of under a 32-pixel column, which
 * is the whole reason to turn the chart on its side.
 *
 * Rows are drawn in the order given. Sorting is the caller's business: what "first" means
 * depends on the question, and a component that sorted by value would quietly overrule a
 * caller that had ordered its rows to mean something.
 *
 * Zero is drawn as an empty track rather than skipped, because in this chart an empty row is
 * usually the finding.
 */

export interface ChartRow {
  key: string;
  label: string;
  value: number;
  /** The figure shown at the end of the row. Formatted by the caller, spoken as given. */
  detail: string;
  /** Any CSS colour. Defaults to a neutral that carries on all four themes. */
  fill?: string;
}

export default function RowChart({ rows }: { rows: ChartRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div
      className="rowchart"
      role="img"
      aria-label={rows.map((row) => `${row.label}: ${row.detail}`).join('. ')}
    >
      {rows.map((row) => (
        <div className="rowchart-row" key={row.key}>
          <span className="rowchart-label truncate">{row.label}</span>
          <span className="rowchart-track">
            <span
              className="rowchart-fill"
              style={{
                width: `${(row.value / max) * 100}%`,
                background: row.fill ?? 'var(--faint)',
              }}
            />
          </span>
          <span className="rowchart-detail mono">{row.detail}</span>
        </div>
      ))}
    </div>
  );
}
