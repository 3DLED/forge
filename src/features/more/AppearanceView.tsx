/**
 * Choosing a visual direction.
 *
 * Each card previews itself using the real theme tokens rather than a hand-copied palette —
 * the swatch sets `data-theme`, so what you see here is literally what the app becomes.
 * Selection applies immediately for the same reason: a theme is judged on your own calendar
 * and your own numbers, not on a sample screen.
 */

import { Link } from 'react-router-dom';
import PageHeader from '../../ui/PageHeader';
import { useApp } from '../../ui/AppProvider';
import { profileRepo } from '../../data/repos';
import { DEFAULT_THEME, THEMES, isThemeId, type ThemeId } from '../../ui/themes';

export default function AppearanceView() {
  const { profile } = useApp();
  const current: ThemeId = isThemeId(profile.theme) ? profile.theme : DEFAULT_THEME;

  return (
    <>
      <PageHeader
        title="Appearance"
        subtitle="Applies instantly — try each on a real screen"
        action={<Link to="/more" className="btn ghost sm">Back</Link>}
      />

      <p className="small muted">
        These are four different directions, not four palettes. Each one changes the shape of
        things, the type, and how tightly the screen is packed.
      </p>

      {THEMES.map((theme) => {
        const selected = theme.id === current;

        return (
          <button
            key={theme.id}
            className={`theme-card${selected ? ' selected' : ''}`}
            aria-pressed={selected}
            onClick={() => void profileRepo.update(profile.id, { theme: theme.id })}
          >
            {/* Painted in the candidate theme's own tokens, whatever is currently active. */}
            <span className="theme-swatch" data-theme={theme.id} style={{ background: 'var(--bg)' }}>
              <span className="swatch-bg">
                <span
                  className="bar"
                  style={{ background: 'var(--text)', width: '55%', height: 9 }}
                />
                <span className="bar" style={{ background: 'var(--surface-3)', width: '85%' }} />
                <span className="bar" style={{ background: 'var(--surface-3)', width: '70%' }} />
              </span>
              <span
                className="swatch-accent"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                Aa
              </span>
            </span>

            <span className="theme-meta">
              <span className="row between">
                <strong>{theme.name}</strong>
                {selected && <span className="pill accent">Active</span>}
              </span>
              <span className="tiny faint" style={{ display: 'block', marginTop: '0.1rem' }}>
                {theme.tagline}
              </span>
              <span
                className="small muted"
                style={{ display: 'block', marginTop: '0.45rem' }}
              >
                {theme.rationale}
              </span>
            </span>
          </button>
        );
      })}

      <p className="tiny faint">
        Nothing here touches your data — it is a display setting stored with your profile, so
        it travels in your backup.
      </p>
    </>
  );
}
