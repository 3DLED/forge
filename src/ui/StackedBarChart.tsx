/**
 * A stacked bar chart in plain SVG, sibling to `BarChart`.
 *
 * Separate rather than folded into that one. A stacked bar needs a list of segments where a
 * plain bar needs a number, and threading an optional array through the simpler component
 * would complicate the three screens that only ever wanted twelve rectangles.
 *
 * Bars share one maximum, so height still means how much work a week held and the segments
 * say how it was spent. Normalising each bar to full height instead would draw a recovery
 * week and a peak week identically, which is the one comparison this chart exists to allow.
 *
 * Colour alone does not carry the meaning. Three segments cannot be told apart by shape, so
 * whatever renders this owes the reader a legend with the numbers in it — the SVG is the
 * shape of the month, not the reading of it.
 */

export interface StackedSegment {
  key: string;
  /** Spoken, not drawn: the legend labels the colours on screen. */
  label: string;
  value: number;
  /** Any CSS colour. Pass a token so it follows the theme. */
  fill: string;
}

export interface StackedBar {
  label: string;
  segments: StackedSegment[];
}

export default function StackedBarChart({
  bars,
  height = 120,
  formatValue = (v) => String(Math.round(v)),
}: {
  bars: StackedBar[];
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const totals = bars.map((bar) => bar.segments.reduce((sum, s) => sum + s.value, 0));
  const max = Math.max(1, ...totals);
  const slot = 100 / Math.max(1, bars.length);
  const barWidth = slot * 0.62;

  const spoken = bars
    .map((bar, index) => {
      if (totals[index] <= 0) return `${bar.label}: nothing`;
      const parts = bar.segments
        .filter((s) => s.value > 0)
        .map((s) => `${s.label} ${formatValue(s.value)}`);
      return `${bar.label}: ${parts.join(', ')}`;
    })
    .join('. ');

  return (
    <div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
        role="img"
        aria-label={spoken}
      >
        {bars.map((bar, index) => {
          // Drawn from the baseline up, so the first segment sits at the bottom of the bar.
          let top = 100;
          return (
            <g key={bar.label + index}>
              {bar.segments.map((segment) => {
                const segmentHeight = (segment.value / max) * 96;
                if (segmentHeight <= 0) return null;
                top -= segmentHeight;
                return (
                  <rect
                    key={segment.key}
                    x={index * slot + (slot - barWidth) / 2}
                    y={top}
                    width={barWidth}
                    height={segmentHeight}
                    fill={segment.fill}
                  />
                );
              })}
            </g>
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
