/**
 * A deliberately small bar chart in plain SVG.
 *
 * A charting library would be most of the bundle for what amounts to twelve rectangles,
 * and this app has to load instantly with no network. Bars are drawn in a 0-100 viewBox
 * and stretched, so the whole thing scales without any measurement code.
 */

export interface Bar {
  label: string;
  value: number;
  /** Draws in the accent colour — used for the current, incomplete week. */
  highlight?: boolean;
}

export default function BarChart({
  bars,
  height = 120,
  formatValue = (v) => String(Math.round(v)),
}: {
  bars: Bar[];
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = 100 / Math.max(1, bars.length);
  const barWidth = slot * 0.62;

  return (
    <div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
        role="img"
        aria-label={bars.map((b) => `${b.label}: ${formatValue(b.value)}`).join(', ')}
      >
        {bars.map((bar, index) => {
          const barHeight = (bar.value / max) * 96;
          return (
            <rect
              key={bar.label + index}
              x={index * slot + (slot - barWidth) / 2}
              y={100 - barHeight}
              width={barWidth}
              height={Math.max(bar.value > 0 ? 1.5 : 0, barHeight)}
              rx={1}
              fill={bar.highlight ? 'var(--accent)' : 'var(--surface-3)'}
            />
          );
        })}
      </svg>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.35rem' }}>
        <span className="tiny faint">{bars[0]?.label}</span>
        <span className="tiny faint mono">peak {formatValue(max)}</span>
        <span className="tiny faint">{bars.at(-1)?.label}</span>
      </div>
    </div>
  );
}
