import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import TodayView from './features/today/TodayView';
import SessionLogger from './features/log/SessionLogger';
import PlanView from './features/plan/PlanView';
import HistoryView from './features/history/HistoryView';
import ProgressView from './features/progress/ProgressView';
import MoreView from './features/more/MoreView';
import EquipmentView from './features/more/EquipmentView';
import RunSettingsView from './features/more/RunSettingsView';
import SettingsView from './features/more/SettingsView';
import AppearanceView from './features/more/AppearanceView';
import BodyView from './features/more/BodyView';
import InjuryView from './features/more/InjuryView';
import TestsView from './features/more/TestsView';
import ExerciseLibraryView from './features/more/ExerciseLibraryView';
import PlansView from './features/more/PlansView';
import SavedWorkoutsView from './features/more/SavedWorkoutsView';
import { useT } from './i18n/useT';

const TABS = [
  { to: '/today', glyph: '🔥', label: 'Today' },
  { to: '/plan', glyph: '🗓️', label: 'Plan' },
  { to: '/history', glyph: '📋', label: 'History' },
  { to: '/progress', glyph: '📈', label: 'Progress' },
  { to: '/more', glyph: '⚙️', label: 'More' },
];

export default function App() {
  const t = useT();
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
          <Route path="/more/injuries" element={<InjuryView />} />
          <Route path="/more/tests" element={<TestsView />} />
          <Route path="/more/movements" element={<ExerciseLibraryView />} />
          <Route path="/more/plans" element={<PlansView />} />
          <Route path="/more/workouts" element={<SavedWorkoutsView />} />
          <Route path="/more/equipment" element={<EquipmentView />} />
          <Route path="/more/run" element={<RunSettingsView />} />
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
            {t(tab.label)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
