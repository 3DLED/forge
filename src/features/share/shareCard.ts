/**
 * The picture a finished session is shared as.
 *
 * An image rather than a link, because this app has no server to host a page on and should not
 * grow one for this. An image goes anywhere the share sheet goes — Messages, a group chat, a
 * story — and looks the same in every one of them.
 *
 * Two halves on purpose. `cardData` decides what the card says and is plain data, so it is
 * tested. `renderCard` only paints that data, because a canvas cannot be exercised in the test
 * environment and the less that lives there the better.
 *
 * The card keeps one look whatever theme the app is in. It is a thing sent to other people, and
 * a light card from one friend and a dark one from the next would read as two different apps.
 */

import { M_PER_MILE, formatClock, formatDistance, formatPace, formatWeight } from '../../domain/units';
import { decodeSeries } from '../../domain/series';
import { splitsFromTrace } from '../../domain/runTrace';
import { RUN_SLUGS, estimateDurationMin, sessionRounds, sessionVolumeKg } from '../../domain/training';
import { monthName, weekdayName, weekdayOf } from '../../domain/dates';
import type { Exercise, LoggedSession, UnitSystem } from '../../domain/types';

export interface CardStat {
  label: string;
  value: string;
}

export interface CardSplit {
  label: string;
  value: string;
  secPerKm: number;
  partial: boolean;
}

export interface CardData {
  kind: 'run' | 'workout';
  title: string;
  date: string;
  stats: CardStat[];
  splits: CardSplit[];
  /** For a workout: what was done most, "4 × Kettlebell Swing". */
  highlights: string[];
  heart: { avg: number; max: number; curve: number[] } | null;
  labels: { splits: string; heart: string; avg: string; max: string; more: string };
}

export function cardData(
  session: LoggedSession,
  options: {
    bySlug: Map<string, Exercise>;
    units: UnitSystem;
    t: (english: string) => string;
    bodyweightKg?: number;
  },
): CardData {
  const { bySlug, units, t, bodyweightKg } = options;

  const heart =
    session.avgHrBpm && session.maxHrBpm
      ? { avg: session.avgHrBpm, max: session.maxHrBpm, curve: decodeSeries(session.hrPerMinute) }
      : null;
  const date = `${weekdayName(weekdayOf(session.date))}, ${monthName(session.date)} ${Number(session.date.slice(8))}`;
  const labels = {
    splits: t('Splits'),
    heart: t('Heart rate'),
    avg: t('avg'),
    max: t('max'),
    more: t('more'),
  };

  const run = session.sets.find(
    (set) =>
      set.completed &&
      RUN_SLUGS.has(set.exerciseSlug) &&
      (set.values.distanceM ?? 0) > 0 &&
      (set.values.timeSec ?? 0) > 0,
  );

  if (run) {
    const distanceM = run.values.distanceM!;
    const timeSec = run.values.timeSec!;
    const unit = units === 'imperial' ? M_PER_MILE : 1000;
    const word = units === 'imperial' ? t('Mile') : t('Km');

    const splits = splitsFromTrace(decodeSeries(run.runTrace), unit, distanceM, timeSec).map((split) => ({
      label: split.partial ? formatDistance(split.metres, units) : `${word} ${split.index}`,
      value: formatPace(split.secPerKm, units),
      secPerKm: split.secPerKm,
      partial: split.partial,
    }));

    return {
      kind: 'run',
      title: session.name,
      date,
      stats: [
        { label: t('Distance'), value: formatDistance(distanceM, units) },
        { label: t('Time'), value: formatClock(Math.round(timeSec)) },
        { label: t('Avg pace'), value: formatPace((timeSec / distanceM) * 1000, units) },
      ],
      splits,
      highlights: [],
      heart,
      labels,
    };
  }

  const done = session.sets.filter((set) => set.completed);
  const counts = new Map<string, number>();
  for (const set of done) counts.set(set.exerciseSlug, (counts.get(set.exerciseSlug) ?? 0) + 1);

  const minutes = session.durationMin ?? estimateDurationMin(session);
  const rounds = sessionRounds(session);
  const volume = sessionVolumeKg(session, bySlug, bodyweightKg);

  return {
    kind: 'workout',
    title: session.name,
    date,
    stats: [
      { label: t('Duration'), value: formatClock(Math.round(minutes * 60)) },
      rounds > 0 ? { label: t('Rounds'), value: String(rounds) } : { label: t('Sets'), value: String(done.length) },
      volume > 0
        ? { label: t('Volume'), value: formatWeight(volume, units) }
        : { label: t('Movements'), value: String(counts.size) },
    ],
    splits: [],
    highlights: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([slug, sets]) => `${sets} × ${bySlug.get(slug)?.name ?? slug}`),
    heart,
    labels,
  };
}

// --- painting ------------------------------------------------------------------

export const CARD_W = 1080;
export const CARD_H = 1350;

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const BG = '#0B0C10';
const PANEL = '#1A1D24';
const INK = '#F4F5F7';
const MUTED = '#9AA0AB';
const FAINT = '#5B616C';
const ACCENT = '#D4FF3F';
const HEART = '#FF6B6B';
const PAD = 72;

/** A PNG data URL, or null where there is no canvas to draw on. */
export function renderCard(data: CardData, doc: Document = document): string | null {
  const canvas = doc.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paint(ctx, data);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Rounded rectangles by hand: `roundRect` arrived in Safari 16, and the app supports iOS 15. */
function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(trial).width <= maxWidth) line = trial;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** Shrinks a figure until it fits its column rather than letting it run into the next one. */
function fit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number): void {
  let size = 64;
  do {
    ctx.font = `800 ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 30);
  ctx.fillText(text, x, y);
}

function sectionLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = MUTED;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(text.toUpperCase(), x, y);
}

function paint(ctx: CanvasRenderingContext2D, data: CardData): void {
  const width = CARD_W - PAD * 2;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  let y = PAD + 28;
  ctx.fillStyle = ACCENT;
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText('HYBRID FORGE', PAD, y);
  y += 40;

  ctx.fillStyle = INK;
  ctx.font = `800 72px ${FONT}`;
  for (const line of wrap(ctx, data.title, width, 2)) {
    y += 76;
    ctx.fillText(line, PAD, y);
  }

  y += 50;
  ctx.fillStyle = MUTED;
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(data.date, PAD, y);
  y += 80;

  const column = width / Math.max(1, data.stats.length);
  data.stats.forEach((stat, i) => {
    const x = PAD + i * column;
    ctx.fillStyle = INK;
    fit(ctx, stat.value, x, y + 56, column - 20);
    ctx.fillStyle = MUTED;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(stat.label.toUpperCase(), x, y + 100);
  });
  y += 170;

  const footer = CARD_H - PAD;
  const heartHeight = data.heart ? 290 : 0;
  const listBottom = footer - 50 - heartHeight;

  if (data.splits.length > 0) paintSplits(ctx, data, PAD, y, width, listBottom);
  else if (data.highlights.length > 0) paintHighlights(ctx, data.highlights, PAD, y, listBottom);

  if (data.heart) paintHeart(ctx, data, PAD, listBottom + 30, width, heartHeight - 30);

  ctx.fillStyle = FAINT;
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('Hybrid Forge', PAD, footer);
}

function paintSplits(ctx: CanvasRenderingContext2D, data: CardData, x: number, top: number, width: number, bottom: number): void {
  sectionLabel(ctx, data.labels.splits, x, top + 26);
  let y = top + 56;

  const available = bottom - y;
  const rowHeight = Math.max(42, Math.min(66, available / data.splits.length));
  const fits = Math.max(1, Math.floor(available / rowHeight));
  const rows = data.splits.length > fits ? [...data.splits.slice(0, fits - 1), null] : data.splits;

  const whole = data.splits.filter((split) => !split.partial);
  const scale = whole.length > 0 ? whole : data.splits;
  const fastest = Math.min(...scale.map((split) => split.secPerKm));
  const slowest = Math.max(...scale.map((split) => split.secPerKm));

  const labelWidth = 210;
  const valueWidth = 230;
  const barX = x + labelWidth;
  const barWidth = width - labelWidth - valueWidth - 20;

  for (const split of rows) {
    const middle = y + rowHeight / 2;
    if (!split) {
      ctx.fillStyle = FAINT;
      ctx.font = `600 30px ${FONT}`;
      ctx.fillText(`+${data.splits.length - (fits - 1)} ${data.labels.more}`, x, middle + 10);
      y += rowHeight;
      continue;
    }

    ctx.fillStyle = INK;
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(split.label, x, middle + 11);

    // Faster is longer. A pace chart where the quick mile draws shortest reads backwards.
    const share =
      slowest === fastest
        ? 1
        : Math.min(1, Math.max(0.3, 0.3 + 0.7 * ((slowest - split.secPerKm) / (slowest - fastest))));
    ctx.fillStyle = PANEL;
    pill(ctx, barX, middle - 12, barWidth, 24);
    ctx.fillStyle = split.partial ? FAINT : ACCENT;
    pill(ctx, barX, middle - 12, barWidth * share, 24);

    ctx.fillStyle = INK;
    ctx.font = `700 32px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(split.value, x + width, middle + 11);
    ctx.textAlign = 'left';
    y += rowHeight;
  }
}

function paintHighlights(ctx: CanvasRenderingContext2D, highlights: string[], x: number, top: number, bottom: number): void {
  let y = top + 20;
  ctx.fillStyle = INK;
  ctx.font = `600 38px ${FONT}`;
  for (const line of highlights) {
    if (y + 58 > bottom) break;
    y += 58;
    ctx.fillText(line, x, y);
  }
}

function paintHeart(ctx: CanvasRenderingContext2D, data: CardData, x: number, top: number, width: number, height: number): void {
  const heart = data.heart!;
  sectionLabel(ctx, data.labels.heart, x, top + 26);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(`${heart.avg} ${data.labels.avg}  ·  ${heart.max} ${data.labels.max}`, x + width, top + 26);
  ctx.textAlign = 'left';

  const readings = heart.curve.map((bpm, minute) => ({ bpm, minute })).filter((point) => point.bpm > 0);
  // Two numbers and no line is honest; a line through one point is not a curve.
  if (readings.length < 2) return;

  const chartTop = top + 56;
  const chartHeight = height - 56;
  const low = Math.min(...readings.map((point) => point.bpm)) - 6;
  const high = Math.max(...readings.map((point) => point.bpm)) + 6;
  const last = Math.max(1, heart.curve.length - 1);
  const px = (minute: number) => x + (minute / last) * width;
  const py = (bpm: number) => chartTop + chartHeight - ((bpm - low) / (high - low)) * chartHeight;

  // Runs of consecutive readings. A minute the watch missed is a gap, not a straight line.
  const runs: { bpm: number; minute: number }[][] = [];
  for (const point of readings) {
    const current = runs[runs.length - 1];
    if (current && point.minute === current[current.length - 1].minute + 1) current.push(point);
    else runs.push([point]);
  }

  for (const run of runs) {
    if (run.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(px(run[0].minute), chartTop + chartHeight);
    for (const point of run) ctx.lineTo(px(point.minute), py(point.bpm));
    ctx.lineTo(px(run[run.length - 1].minute), chartTop + chartHeight);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 107, 107, 0.16)';
    ctx.fill();

    ctx.beginPath();
    run.forEach((point, i) => (i === 0 ? ctx.moveTo(px(point.minute), py(point.bpm)) : ctx.lineTo(px(point.minute), py(point.bpm))));
    ctx.strokeStyle = HEART;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
