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

/**
 * "9:23–8:03 /mi" rather than "9:23 /mi–8:03 /mi".
 *
 * The formatter knows how to render one value and has no idea two of them are about to be
 * printed side by side, so the unit arrives twice. Said once it reads as a range; said twice
 * it reads as two separate facts that happen to be touching.
 */
function range(low: string, high: string): string {
  const cut = low.lastIndexOf(' ');
  const unit = cut > 0 ? low.slice(cut) : '';
  return unit && high.endsWith(unit) ? `${low.slice(0, cut)}–${high}` : `${low}–${high}`;
}

export default function BarChart({
  bars,
  height = 120,
  floor = 0,
  formatValue = (v) => String(Math.round(v)),
}: {
  bars: Bar[];
  height?: number;
  /**
   * Where the axis starts, when zero is not a useful floor.
   *
   * Quantities that vary around a large number — a pace, a bodyweight — draw as a row of
   * near-identical bars against a zero axis, and a chart whose every week looks the same is
   * not a chart. Starting the axis below the data restores the difference.
   *
   * A truncated axis exaggerates, which is why the footer stops saying "peak" and states the
   * range the bars actually span instead. Bars at or below the floor draw as nothing, which is
   * also what a week with no data draws as: both mean there is nothing to compare here.
   */
  floor?: number;
  formatValue?: (value: number) => string;
}) {
  const values = bars.map((b) => b.value);
  const highest = Math.max(0, ...values);
  // The fallback only has to stop a zero span. Taking it as the max instead would leave the
  // tallest bar short of the top and report a peak that nobody ran.
  const max = highest > floor ? highest : floor + 1;
  const span = max - floor;
  const lowest = Math.min(...values.filter((v) => v > floor));
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
          const barHeight = Math.max(0, (bar.value - floor) / span) * 96;
          return (
            <rect
              key={bar.label + index}
              x={index * slot + (slot - barWidth) / 2}
              y={100 - barHeight}
              width={barWidth}
              height={Math.max(bar.value > floor ? 1.5 : 0, barHeight)}
              rx={1}
              fill={bar.highlight ? 'var(--accent)' : 'var(--surface-3)'}
            />
          );
        })}
      </svg>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.35rem' }}>
        <span className="tiny faint">{bars[0]?.label}</span>
        <span className="tiny faint mono">
          {floor > 0 && Number.isFinite(lowest)
            ? range(formatValue(lowest), formatValue(max))
            : `peak ${formatValue(max)}`}
        </span>
        <span className="tiny faint">{bars.at(-1)?.label}</span>
      </div>
    </div>
  );
}
