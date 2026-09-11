/**
 * @vitest-environment jsdom
 *
 * The scaling, which is the only thing in this component that can be wrong in a way nobody
 * notices. A bar drawn at the wrong height still looks like a bar.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import BarChart from './BarChart';

const bars = (values: number[]) => values.map((value, i) => ({ label: `w${i}`, value }));

/** Heights in the 0-100 viewBox, in the order drawn. */
function heights(container: HTMLElement): number[] {
  return [...container.querySelectorAll('rect')].map((r) => Number(r.getAttribute('height')));
}

describe('BarChart', () => {
  it('measures from zero by default, so the tallest bar fills the chart', () => {
    const { container } = render(<BarChart bars={bars([100, 50, 0])} />);
    expect(heights(container)).toEqual([96, 48, 0]);
  });

  it('says peak when the axis starts at zero', () => {
    const { container } = render(<BarChart bars={bars([700, 350])} />);
    expect(container.textContent).toContain('peak 700');
  });

  /*
   * A week with nothing in it must not divide by zero, and must not be drawn as a full bar
   * either — which is what taking the fallback as the maximum would do.
   */
  it('draws nothing at all when every week is empty', () => {
    const { container } = render(<BarChart bars={bars([0, 0, 0])} />);
    expect(heights(container)).toEqual([0, 0, 0]);
  });

  it('spreads the bars across the range when given a floor', () => {
    // Without a floor these would be 96, 93.1 and 89.3 — three bars nobody can tell apart.
    const { container } = render(<BarChart bars={bars([100, 97, 93])} floor={90} />);
    const [a, b, c] = heights(container);
    expect(a).toBeCloseTo(96);
    expect(b).toBeCloseTo(67.2);
    expect(c).toBeCloseTo(28.8);
  });

  /*
   * A truncated axis exaggerates, so the footer has to stop claiming a peak and say what the
   * bars actually span — and it must report the smallest week that happened, not the floor,
   * which is a number nobody ran.
   */
  it('states the range rather than the peak once the axis is truncated', () => {
    const { container } = render(<BarChart bars={bars([100, 97, 93, 0])} floor={90} />);
    expect(container.textContent).toContain('93–100');
    expect(container.textContent).not.toContain('peak');
    expect(container.textContent).not.toContain('90');
  });

  /*
   * The formatter renders one value at a time and cannot know two are about to sit side by
   * side, so without this the unit arrives twice and the range reads as two separate facts.
   */
  it('says the unit once across a range', () => {
    const { container } = render(
      <BarChart
        bars={bars([3.33, 2.86])}
        floor={2.5}
        formatValue={(v) => `${Math.round(1000 / v / 60)}:00 /mi`}
      />,
    );
    expect(container.textContent).toContain('6:00–5:00 /mi');
  });

  it('draws a week below the floor as nothing rather than as a negative bar', () => {
    const { container } = render(<BarChart bars={bars([100, 0])} floor={90} />);
    expect(heights(container)).toEqual([96, 0]);
  });
});
