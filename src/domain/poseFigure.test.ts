/**
 * The figure is a pure function of where it is in the loop, which is the whole reason to
 * build it this way: an animation can otherwise only be checked by watching it, and the bug
 * this file was written after — the movement flickering past its bottom position and lingering
 * at the top — is exactly the kind you cannot see in a screenshot.
 */

import { describe, expect, it } from 'vitest';
import { loopMs, poseAt, tween, type PoseAnimation } from './poseFigure';

const top = { hip: [50, 50] as [number, number], knee: [50, 70] as [number, number] };
const bottom = { hip: [40, 70] as [number, number], knee: [56, 72] as [number, number] };

const squat: PoseAnimation = { frames: [top, bottom], stepMs: 500 };
const walk: PoseAnimation = { frames: [top, bottom], stepMs: 500, loop: 'cycle' };

describe('blending two positions', () => {
  it('is the first pose at nothing and the second at everything', () => {
    expect(tween(top, bottom, 0).hip).toEqual([50, 50]);
    expect(tween(top, bottom, 1).hip).toEqual([40, 70]);
  });

  it('is halfway between them in the middle', () => {
    expect(tween(top, bottom, 0.5).hip).toEqual([45, 60]);
  });

  /* A joint only one keyframe names would otherwise fly in from nowhere. */
  it('holds a joint the other pose does not mention', () => {
    const partial = { hip: [40, 70] as [number, number] };
    expect(tween(top, partial, 1).knee).toEqual([50, 70]);
  });
});

describe('walking the loop', () => {
  it('starts at the first keyframe', () => {
    expect(poseAt(squat, 0).hip).toEqual([50, 50]);
  });

  /*
   * The bug. A ping-pong already travels out and back, so easing the loop *as well* made the
   * figure reach the bottom at a quarter and again at three quarters, and spend the rest of
   * the time near the top — a squat that looked like a twitch.
   */
  it('reaches the far keyframe exactly halfway through a ping-pong', () => {
    expect(poseAt(squat, 0.5).hip[0]).toBeCloseTo(40, 1);
    expect(poseAt(squat, 0.5).hip[1]).toBeCloseTo(70, 1);
  });

  it('comes back to the first keyframe by the end', () => {
    expect(poseAt(squat, 0.999).hip[0]).toBeCloseTo(50, 0);
  });

  /* Down and up should be mirror images. A quarter in matches three quarters in. */
  it('is symmetric about the turn', () => {
    const going = poseAt(squat, 0.25).hip;
    const coming = poseAt(squat, 0.75).hip;
    expect(going[0]).toBeCloseTo(coming[0], 5);
    expect(going[1]).toBeCloseTo(coming[1], 5);
  });

  /* Reversing a walk would run the figure backwards, so a cycle returns to the start instead. */
  it('returns to the start rather than reversing, when cycling', () => {
    expect(poseAt(walk, 0.5).hip[0]).toBeCloseTo(40, 1);
    expect(poseAt(walk, 0.999).hip[0]).toBeCloseTo(50, 0);
  });

  it('moves slowest at the turnarounds', () => {
    const early = poseAt(squat, 0.02).hip[1] - poseAt(squat, 0.0).hip[1];
    const middle = poseAt(squat, 0.27).hip[1] - poseAt(squat, 0.25).hip[1];
    expect(Math.abs(middle)).toBeGreaterThan(Math.abs(early) * 3);
  });

  it('has nothing to say about an empty animation', () => {
    expect(poseAt({ frames: [] }, 0.5)).toEqual({});
  });
});

describe('how long a loop lasts', () => {
  /* Two keyframes ping-ponged is two steps: down, then up. */
  it('counts the return trip', () => {
    expect(loopMs(squat)).toBe(1000);
  });

  it('counts a cycle as one pass plus the wrap', () => {
    expect(loopMs(walk)).toBe(1000);
  });
});

/**
 * The point of the whole exercise, stated as a number.
 *
 * A movement is a handful of coordinates. The same movement as a 180-pixel GIF from the
 * licensed set measured 121 KB, so the figure has to stay some three orders of magnitude
 * smaller than that or there is no argument for drawing it.
 */
describe('what it costs', () => {
  it('is a rounding error next to an animation file', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(squat)).length;
    expect(bytes).toBeLessThan(500);
  });
});
