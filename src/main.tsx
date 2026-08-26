import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider } from './ui/AppProvider';
import App from './App';
import './styles.css';

// Hash routing, deliberately: GitHub Pages serves static files with no rewrite rules, so a
// deep link like /history would 404 on refresh under a browser router.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </StrictMode>,
);
