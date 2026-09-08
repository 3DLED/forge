/**
 * Hand-placed movements, as a proof that the format carries its weight.
 *
 * Three deliberately chosen: an air squat and a kettlebell swing, neither of which the
 * licensed catalogue has a usable entry for, and a suitcase carry, which is one of the three
 * carries in a set of 1,394. If stick figures work at all they have to work here, because
 * this is precisely the ground no purchase covers.
 *
 * Coordinates are a 100 × 100 box seen from the side, facing right, Y downward. They were
 * placed by hand, which is the slow way; the fast way is a pose estimator over a video of
 * somebody doing the movement, which emits these same joint names.
 */

import type { PoseAnimation } from '../domain/poseFigure';

/**
 * Down and up, two positions.
 *
 * Everything that matters about a squat is the difference between these: the hips travel back
 * as well as down, the knee tracks forward over a foot that does not move, and the torso
 * inclines to keep the weight over the middle of the foot. Arms come forward as a counterweight.
 */
const airSquat: PoseAnimation = {
  stepMs: 900,
  frames: [
    {
      head: [50, 12], neck: [50, 21], shoulder: [50, 24],
      elbow: [54, 35], wrist: [55, 46],
      shoulderFar: [47, 25], elbowFar: [44, 36], wristFar: [43, 46],
      hip: [50, 50], knee: [52, 70], ankle: [51, 88], toe: [59, 90],
      hipFar: [47, 51], kneeFar: [45, 70], ankleFar: [44, 88], toeFar: [52, 90],
    },
    {
      head: [43, 34], neck: [45, 41], shoulder: [46, 44],
      elbow: [57, 47], wrist: [68, 49],
      shoulderFar: [43, 45], elbowFar: [54, 49], wristFar: [65, 52],
      hip: [38, 67], knee: [58, 72], ankle: [51, 88], toe: [59, 90],
      hipFar: [35, 68], kneeFar: [52, 73], ankleFar: [44, 88], toeFar: [52, 90],
    },
  ],
};

/**
 * The hinge, and the float.
 *
 * The one thing a swing picture has to say is that it is a hinge and not a squat -- hips back,
 * shins near vertical, bell arcing between the legs -- so the backswing puts the knee almost
 * where it started and drives the hip backwards instead. The top position is a plank standing
 * up: hips through, spine stacked, arms along for the ride rather than lifting.
 */
const kettlebellSwing: PoseAnimation = {
  stepMs: 500,
  load: { joint: 'wrist', kind: 'bell' },
  frames: [
    {
      head: [42, 30], neck: [44, 38], shoulder: [45, 41],
      elbow: [52, 50], wrist: [58, 60],
      shoulderFar: [42, 42], elbowFar: [49, 51], wristFar: [56, 61],
      hip: [36, 60], knee: [49, 72], ankle: [49, 88], toe: [57, 90],
      hipFar: [33, 61], kneeFar: [45, 73], ankleFar: [43, 88], toeFar: [51, 90],
    },
    {
      head: [50, 12], neck: [50, 21], shoulder: [50, 24],
      elbow: [59, 29], wrist: [70, 33],
      shoulderFar: [47, 25], elbowFar: [56, 31], wristFar: [68, 35],
      hip: [50, 52], knee: [51, 70], ankle: [50, 88], toe: [58, 90],
      hipFar: [47, 53], kneeFar: [46, 70], ankleFar: [45, 88], toeFar: [53, 90],
    },
  ],
};

/**
 * A carry, which is a walk that refuses to lean.
 *
 * Two strides, cycled rather than ping-ponged — reversing a walk would run the figure
 * backwards. The whole coaching point is what does *not* move: the loaded shoulder stays
 * level with the other one and the spine stays vertical, so both are held still across the
 * frames while only the legs and the free arm change.
 */
const suitcaseCarry: PoseAnimation = {
  stepMs: 420,
  loop: 'cycle',
  load: { joint: 'wrist', kind: 'bell' },
  frames: [
    {
      head: [50, 12],
      neck: [50, 21],
      shoulder: [50, 23],
      elbow: [50, 35],
      wrist: [50, 47],
      hip: [50, 50],
      knee: [58, 68],
      ankle: [62, 87],
      toe: [70, 89],
      shoulderFar: [48, 24],
      elbowFar: [45, 36],
      wristFar: [41, 46],
      hipFar: [48, 51],
      kneeFar: [43, 69],
      ankleFar: [38, 87],
      toeFar: [46, 89],
    },
    {
      head: [50, 12],
      neck: [50, 21],
      shoulder: [50, 23],
      elbow: [50, 35],
      wrist: [50, 47],
      hip: [50, 50],
      knee: [43, 69],
      ankle: [38, 87],
      toe: [46, 89],
      shoulderFar: [48, 24],
      elbowFar: [51, 36],
      wristFar: [55, 46],
      hipFar: [48, 51],
      kneeFar: [58, 68],
      ankleFar: [62, 87],
      toeFar: [70, 89],
    },
  ],
};

/**
 * Forge slug to figure. Absence is the ordinary case and always will be while these are
 * placed by hand, so everything that reads this has to work with nothing there.
 */
export const POSES: Record<string, PoseAnimation> = {
  'air-squat': airSquat,
  'kb-swing': kettlebellSwing,
  'suitcase-carry': suitcaseCarry,
};

export function poseFor(slug: string): PoseAnimation | null {
  return POSES[slug] ?? null;
}
