/**
 * A movement as a stick figure: joint positions, and lines between them.
 *
 * The idea this exists to test is that an exercise demonstration does not need anatomy. What
 * a picture of a swing has to communicate is where the hips go, where the bell goes, and what
 * the spine does — and none of that needs a face, fingers, or a deltoid. Strip the figure back
 * to joints and the whole problem changes shape:
 *
 * - **It is correct by construction.** A joint is at a coordinate you chose. There is no
 *   generator to review, no third elbow, no knee bending the wrong way, because the only
 *   things on screen are the ones you put there.
 * - **It costs almost nothing.** Two keyframes of nine joints is thirty-six numbers. The same
 *   movement as a 180-pixel GIF is 121 KB — about three thousand times more, for a picture
 *   that cannot be recoloured, rescaled, or corrected.
 * - **It belongs to the theme.** Line art drawn in `currentColor` sits on a dark background as
 *   comfortably as a light one. A licensed GIF is a white square punched into whatever theme
 *   the user picked.
 * - **It is yours outright.** No licence, no attribution, no redistribution clause, and no
 *   question about whether it can go in a public repo.
 *
 * The cost is that somebody has to place the joints. That is a real cost, and it is why the
 * shape of this file matters more than it looks: poses are plain coordinates, so they can be
 * hand-placed, tweened from two keyframes, or lifted wholesale from a pose estimator run over
 * a video of somebody doing the movement properly.
 */

/** Joint names follow the pose-estimation convention, so extracted landmarks drop straight in. */
export type Joint =
  | 'head'
  | 'neck'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'toe'
  /* The far side of the body, for movements where the two halves differ. Optional. */
  | 'shoulderFar'
  | 'elbowFar'
  | 'wristFar'
  | 'hipFar'
  | 'kneeFar'
  | 'ankleFar'
  | 'toeFar';

/** One instant, in a 100 × 100 box. Y runs downward, as it does in SVG. */
export type Pose = Partial<Record<Joint, [number, number]>>;

/**
 * What the figure is holding, drawn at a joint rather than modelled.
 *
 * A bell is a circle below the wrist and a bar is a line through it. That is the entire
 * vocabulary, and it is enough — the equipment in a demonstration only has to say *which*
 * implement and *where*, and a stick figure holding a photorealistic kettlebell would look
 * worse than one holding a circle.
 */
export interface Load {
  joint: Joint;
  kind: 'bell' | 'bar' | 'ball' | 'plate';
}

export interface PoseAnimation {
  /**
   * Keyframes, tweened between rather than played.
   *
   * A squat is two positions and everything in between is arithmetic, so authoring the
   * in-between frames would be storing something the computer can work out — and getting one
   * of them slightly wrong is exactly what makes an animation look broken.
   */
  frames: Pose[];
  /**
   * `pingPong` runs the keyframes forward then back, which is what a rep is: down and up,
   * the same positions in reverse. `cycle` returns to the first frame instead, for anything
   * that travels — a run, a crawl.
   */
  loop?: 'pingPong' | 'cycle';
  /** Milliseconds to cross one keyframe. Roughly rep tempo. */
  stepMs?: number;
  load?: Load;
}

/**
 * Which joints are connected, in draw order.
 *
 * Order matters only for what sits on top of what: the near-side limbs are drawn last so they
 * read as nearer. The far side is the same list with the far joints, drawn first and faded.
 */
export const SEGMENTS: [Joint, Joint][] = [
  ['neck', 'shoulder'],
  ['neck', 'hip'],
  ['shoulder', 'elbow'],
  ['elbow', 'wrist'],
  ['hip', 'knee'],
  ['knee', 'ankle'],
  ['ankle', 'toe'],
];

export const FAR_SEGMENTS: [Joint, Joint][] = [
  ['neck', 'shoulderFar'],
  ['shoulderFar', 'elbowFar'],
  ['elbowFar', 'wristFar'],
  ['hip', 'hipFar'],
  ['hipFar', 'kneeFar'],
  ['kneeFar', 'ankleFar'],
  ['ankleFar', 'toeFar'],
];

/**
 * Slow at each end of a step, quick through the middle.
 *
 * Applied per keyframe rather than across the loop, which is the distinction that matters: a
 * ping-pong already goes there and back, so easing the whole loop as well makes the figure
 * pass through the interesting half of the movement at double speed and linger at the top.
 * Easing each step instead gives a rep its real shape — slowest at the turnarounds.
 */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Straight-line blend between two poses. Joints missing from either side are dropped. */
export function tween(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const key of Object.keys(a) as Joint[]) {
    const from = a[key];
    const to = b[key] ?? from;
    if (!from || !to) continue;
    out[key] = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  }
  return out;
}

/**
 * The pose at a moment in the loop.
 *
 * `progress` is 0..1 across the whole animation, so the caller owns the clock and this stays
 * a pure function of it — the same input always draws the same figure, which is what lets a
 * pose be checked in a test rather than watched.
 */
export function poseAt(animation: PoseAnimation, progress: number): Pose {
  const { frames } = animation;
  if (frames.length === 0) return {};
  if (frames.length === 1) return frames[0];

  // Ping-pong walks out and back over one loop, so the sequence is 2n-2 steps rather than n.
  const sequence =
    animation.loop === 'cycle'
      ? [...frames, frames[0]]
      : [...frames, ...frames.slice(0, -1).reverse()];

  const steps = sequence.length - 1;
  const position = Math.min(Math.max(progress, 0), 0.999999) * steps;
  const index = Math.floor(position);
  return tween(sequence[index], sequence[index + 1], smooth(position - index));
}

/** How long one full loop lasts, for pacing the clock. */
export function loopMs(animation: PoseAnimation): number {
  const step = animation.stepMs ?? 700;
  const frames = animation.frames.length;
  if (frames < 2) return step;
  return step * (animation.loop === 'cycle' ? frames : (frames - 1) * 2);
}
