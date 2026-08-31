/**
 * How a timed block describes itself.
 *
 * Lives apart from any one component because the strip, the expanded timer and the block card
 * all name the same block, and three copies of "AMRAP 20:00" is three chances to disagree.
 */

import { formatClock } from '../../domain/units';
import type { LoggedBlock } from '../../domain/types';

/** The shape of the block — "AMRAP 20:00" — independent of any name it carries. */
export function blockShape(block: LoggedBlock): string {
  if (block.style === 'amrap') return `AMRAP ${formatClock(block.capSec ?? 0)}`;
  if (block.style === 'emom') {
    return `EMOM ${formatClock(block.intervalSec ?? 60)} × ${block.targetRounds ?? 10}`;
  }
  return block.capSec ? `For time (cap ${formatClock(block.capSec)})` : 'For time';
}

/** A name when it has one, otherwise the shape. */
export function blockTitle(block: LoggedBlock): string {
  return block.label?.trim() || blockShape(block);
}
