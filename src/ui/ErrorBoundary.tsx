/**
 * The last thing standing between a rendering bug and a white rectangle.
 *
 * React unmounts the whole tree when a render throws and nothing catches it, which on a
 * laptop means a blank page and an explanation in the console. On a phone there is no
 * console, so a blank page is the entire message: the app is gone, the data looks gone with
 * it, and the only move left is deleting and reinstalling — which, with no server behind this
 * app, is the one action that would actually destroy the training history that is still
 * sitting safely in the database.
 *
 * So the fallback is not an apology. It is the three things worth having at that moment: the
 * backup button, because a crash is exactly when you want your data off the device; a way
 * back in that does not involve the App Store; and the error itself, in text you can select,
 * because a bug nobody can describe is a bug nobody can fix.
 *
 * A class, because `getDerivedStateFromError` has no hook equivalent and is not getting one.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: (crash: { error: Error; reset: () => void }) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Still worth logging where there is somewhere to log to: a web build has devtools, and
    // the component stack says which screen it was rather than only which function.
    console.error('Forge crashed while rendering', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return this.props.fallback({ error, reset: () => this.setState({ error: null }) });
  }
}
