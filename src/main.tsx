import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider } from './ui/AppProvider';
import ErrorBoundary from './ui/ErrorBoundary';
import CrashScreen from './ui/CrashScreen';
import App from './App';
import './styles.css';

// Hash routing, deliberately: GitHub Pages serves static files with no rewrite rules, so a
// deep link like /history would 404 on refresh under a browser router.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      Outside the router and the provider on purpose: this one catches the crashes that take
      the navigation with them, including a failure inside the provider itself. The narrower
      boundary around the routed screen is in `App`, and catches everything this one would
      rather not be reached for.
    */}
    <ErrorBoundary
      fallback={({ error, reset }) => <CrashScreen error={error} scope="app" reset={reset} />}
    >
      <HashRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);
