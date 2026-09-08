/**
 * Drawing the stick figure.
 *
 * SVG rather than canvas, because the whole point of this route is that the figure is
 * resolution-free and takes its colour from the page. `currentColor` means one drawing works
 * on all four themes; a raster demonstration is a white square wherever it lands.
 *
 * The clock is `requestAnimationFrame` reading a wall-clock start, not a frame counter, so a
 * backgrounded tab resumes at the right point in the movement rather than wherever it was
 * suspended — the same reasoning as every other timer in this app.
 *
 * The clock here is deliberately dumb: it hands `poseAt` a linear position in the loop and
 * that function decides what the figure looks like. Everything about how a rep is *shaped* —
 * slow at the turnarounds, quick through the middle — belongs with the poses, where it can
 * be tested without watching it.
 */

import { useEffect, useRef, useState } from 'react';
import { FAR_SEGMENTS, SEGMENTS, loopMs, poseAt, type Load, type Pose, type PoseAnimation } from '../domain/poseFigure';

export default function PoseFigure({
  animation,
  size = 180,
  /** Held still at a given point in the loop — for a still frame in a list. */
  frozenAt,
}: {
  animation: PoseAnimation;
  size?: number;
  frozenAt?: number;
}) {
  const [progress, setProgress] = useState(frozenAt ?? 0);
  const frame = useRef(0);

  useEffect(() => {
    if (frozenAt != null) return;

    const period = loopMs(animation);
    const startedAt = performance.now();

    const tick = (now: number) => {
      // Linear. The easing lives in `poseAt`, applied to each keyframe step, because a
      // ping-pong already travels there and back and easing both would double it up.
      setProgress(((now - startedAt) % period) / period);
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [animation, frozenAt]);

  const pose = poseAt(animation, progress);

  return (
    <svg
      className="pose-figure"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
    >
      {/* The ground, so the figure has something to stand on and the eye has a reference. */}
      <line x1="8" y1="92" x2="92" y2="92" className="pose-ground" />

      <g className="pose-far">
        {FAR_SEGMENTS.map(([from, to]) => (
          <Segment key={`${from}-${to}`} pose={pose} from={from} to={to} />
        ))}
      </g>

      {SEGMENTS.map(([from, to]) => (
        <Segment key={`${from}-${to}`} pose={pose} from={from} to={to} />
      ))}

      {pose.head && <circle cx={pose.head[0]} cy={pose.head[1]} r="6" className="pose-head" />}

      {/* Hands and feet as shapes rather than as anatomy — there is nothing there to get
          wrong, and a blob at the end of a limb reads as a hand at this size anyway. */}
      {(['wrist', 'wristFar'] as const).map((joint) =>
        pose[joint] ? (
          <circle key={joint} cx={pose[joint]![0]} cy={pose[joint]![1]} r="2.6" className="pose-hand" />
        ) : null,
      )}

      {animation.load && <LoadMark pose={pose} load={animation.load} />}
    </svg>
  );
}

function Segment({ pose, from, to }: { pose: Pose; from: keyof Pose; to: keyof Pose }) {
  const a = pose[from];
  const b = pose[to];
  if (!a || !b) return null;
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="pose-bone" />;
}

/**
 * The implement, in the smallest vocabulary that says which one it is.
 *
 * A bell hangs below the hand, a bar runs through it, a plate stands on edge. Nothing here is
 * trying to look like the object — it is trying to be unmistakable at 180 pixels, which is a
 * different and much easier problem.
 */
function LoadMark({ pose, load }: { pose: Pose; load: Load }) {
  const at = pose[load.joint];
  if (!at) return null;
  const [x, y] = at;

  if (load.kind === 'bar') {
    return <line x1={x - 18} y1={y} x2={x + 18} y2={y} className="pose-load" />;
  }
  if (load.kind === 'plate') {
    return <ellipse cx={x} cy={y + 6} rx="2.5" ry="7" className="pose-load" />;
  }
  if (load.kind === 'ball') {
    return <circle cx={x} cy={y + 6} r="5" className="pose-load" />;
  }

  // A bell: the handle, then the body hanging under it.
  return (
    <g className="pose-load">
      <path d={`M ${x - 3} ${y} a 3 3 0 0 1 6 0`} fill="none" />
      <circle cx={x} cy={y + 6} r="4.5" />
    </g>
  );
}
