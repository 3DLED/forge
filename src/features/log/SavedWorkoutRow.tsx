/**
 * One saved workout in a list you are picking from.
 *
 * One button, deliberately. This list is answered in a gym, part-way through a session, and
 * the only question it asks is which of these am I doing now. Sharing and deleting used to sit
 * beside Use as an arrow and a cross — three targets inside a thumb's width, where the one you
 * hit by accident was the delete. They live in More → Saved workouts now, which is where you
 * are when you are managing a library rather than using it.
 */

import type { SessionTemplate } from '../../domain/types';

export default function SavedWorkoutRow({
  template,
  subtitle,
  onUse,
}: {
  template: SessionTemplate;
  subtitle: string;
  onUse: () => void | Promise<void>;
}) {
  return (
    <div className="suggest-row">
      <span className="grow">
        <strong>{template.name}</strong>
        <br />
        <span className="tiny faint">{subtitle}</span>
      </span>

      <button className="btn sm primary" onClick={() => void onUse()}>
        Use
      </button>
    </div>
  );
}
