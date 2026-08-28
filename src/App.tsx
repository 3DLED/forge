import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import TodayView from './features/today/TodayView';
import SessionLogger from './features/log/SessionLogger';
import PlanView from './features/plan/PlanView';
import HistoryView from './features/history/HistoryView';
import ProgressView from './features/progress/ProgressView';
import MoreView from './features/more/MoreView';
import EquipmentView from './features/more/EquipmentView';
import SettingsView from './features/more/SettingsView';
import AppearanceView from './features/more/AppearanceView';
import BodyView from './features/more/BodyView';

const TABS = [
  { to: '/today', glyph: '🔥', label: 'Today' },
  { to: '/plan', glyph: '🗓️', label: 'Plan' },
  { to: '/history', glyph: '📋', label: 'History' },
  { to: '/progress', glyph: '📈', label: 'Progress' },
  { to: '/more', glyph: '⚙️', label: 'More' },
];

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayView />} />
          <Route path="/log/:sessionId" element={<SessionLogger />} />
          <Route path="/plan" element={<PlanView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/progress" element={<ProgressView />} />
          <Route path="/more" element={<MoreView />} />
          <Route path="/more/body" element={<BodyView />} />
          <Route path="/more/equipment" element={<EquipmentView />} />
          <Route path="/more/settings" element={<SettingsView />} />
          <Route path="/more/appearance" element={<AppearanceView />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>

      <nav className="tabbar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            <span className="glyph">{tab.glyph}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
