/**
 * @vitest-environment jsdom
 *
 * The pace wheels.
 *
 * Written after a long run where the typed field could not take a colon: the number pad has
 * none, and "11" was saved as eleven seconds a mile. So the first assertion is the one that
 * matters: choosing 11 on the minutes wheel means eleven minutes.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { M_PER_MILE } from '../../domain/units';

vi.mock('../../i18n/useT', () => ({ useT: () => (english: string) => english }));

const { PaceField } = await import('./PaceAlertControls');

const PER_KM_FROM_MILE = M_PER_MILE / 1000;
const perMile = (min: number, sec = 0) => (min * 60 + sec) / PER_KM_FROM_MILE;

function field(value: number | undefined, optional = false, units: 'imperial' | 'metric' = 'imperial') {
  const onChange = vi.fn();
  render(<PaceField label="Target pace (/mi)" value={value} units={units} optional={optional} onChange={onChange} />);
  return {
    onChange,
    minutes: screen.getByRole('combobox', { name: 'Minutes' }) as HTMLSelectElement,
    seconds: screen.getByRole('combobox', { name: 'Seconds' }) as HTMLSelectElement,
  };
}

describe('PaceField', () => {
  it('reads 11 on the minutes wheel as eleven minutes, not eleven seconds', async () => {
    const { minutes, onChange } = field(undefined, true);
    await userEvent.selectOptions(minutes, '11');
    expect(onChange).toHaveBeenLastCalledWith(perMile(11));
  });

  it('shows a saved pace on the two wheels, and keeps the minutes when the seconds change', async () => {
    const { minutes, seconds, onChange } = field(perMile(8, 30));
    expect(minutes.value).toBe('8');
    expect(seconds.value).toBe('30');

    await userEvent.selectOptions(seconds, '45');
    expect(onChange).toHaveBeenLastCalledWith(perMile(8, 45));
  });

  it('keeps the seconds when the minutes change', async () => {
    const { minutes, onChange } = field(perMile(8, 30));
    await userEvent.selectOptions(minutes, '9');
    expect(onChange).toHaveBeenLastCalledWith(perMile(9, 30));
  });

  it('offers No target on a pace the run can do without, and clears it', async () => {
    const { minutes, onChange } = field(perMile(10), true);
    await userEvent.selectOptions(minutes, '');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('has no No target on a piece that must have a pace', () => {
    const { minutes } = field(perMile(7));
    expect([...minutes.options].map((option) => option.text)).not.toContain('No target');
  });

  it('leaves the seconds wheel off until there is a minute to go with it', () => {
    const { seconds } = field(undefined, true);
    expect(seconds.disabled).toBe(true);
  });

  it('still shows a pace from outside the usual range rather than a wrong one', () => {
    const { minutes } = field(perMile(25, 5));
    expect(minutes.value).toBe('25');
  });

  it('works in kilometres too', async () => {
    const { minutes, onChange } = field(undefined, true, 'metric');
    await userEvent.selectOptions(minutes, '5');
    expect(onChange).toHaveBeenLastCalledWith(300);
  });
});
