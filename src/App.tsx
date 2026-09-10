import './styles/index.css';
import '@rainbow-me/rainbowkit/styles.css';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { RoleAuthModal } from './components/RoleAuthModal';

import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { WhyBotchain } from './components/WhyBotchain';
import { FeaturesGrid } from './components/FeaturesGrid';
import { Footer } from './components/Footer';
import { LiveEventsSection } from './components/LiveEventsSection';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HostDashboard } from './pages/HostDashboard';
import { VoterDashboard } from './pages/VoterDashboard';
import { SubmitterDashboard } from './pages/SubmitterDashboard';
import { CreateEventPage } from './pages/CreateEventPage';
import { SubmitEventPage } from './pages/SubmitEventPage';
import { SubmissionPage } from './pages/SubmissionPage';
import { EventSubmissionsPage } from './pages/EventSubmissionsPage';
import { VotingPage } from './pages/VotingPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { JoinPage } from './pages/JoinPage';

function HomePage() {
  const { authenticated, user, loading, ready, shouldRedirect, clearRedirect } = useAuth();
  const navigate = useNavigate();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const liveEventsRef = useRef<HTMLDivElement>(null);

  // Handle redirect after auth
  useEffect(() => {
    if (shouldRedirect) {
      console.log('Navigating to:', shouldRedirect);
      clearRedirect();
      navigate(shouldRedirect, { replace: true });
    }
  }, [shouldRedirect, navigate, clearRedirect]);

  // Wait for auth to be ready
  if (!ready || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fffbf5' }}>
        <p style={{ fontFamily: 'monospace', fontSize: '18px' }}>Loading...</p>
      </div>
    );
  }

  // Already have user with role - redirect (fallback)
  if (authenticated && user?.role) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  // Show homepage
  return (
    <div className="app">
      <Header />
      <main>
        <Hero onViewLeaderboards={() => liveEventsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
        <div ref={liveEventsRef}>
          <LiveEventsSection />
        </div>
        <WhyBotchain />
        <FeaturesGrid />
      </main>
      <Footer />
      <RoleAuthModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/join/:code" element={<JoinPage />} />

        <Route
          path="/dashboard/host"
          element={
            <ProtectedRoute requiredRole="host">
              <div className="app">
                <Header />
                <HostDashboard />
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-event"
          element={
            <ProtectedRoute requiredRole="host">
              <div className="app">
                <Header />
                <CreateEventPage />
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/submitter"
          element={
            <ProtectedRoute requiredRole="submitter">
              <div className="app">
                <Header />
                <SubmitterDashboard />
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/voter"
          element={
            <ProtectedRoute requiredRole="voter">
              <div className="app">
                <Header />
                <VoterDashboard />
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/event/:eventId/submit"
          element={
            <ProtectedRoute requiredRole="host">
              <div className="app">
                <Header />
                <SubmitEventPage />
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/submit/:eventId"
          element={
            <ProtectedRoute requiredRole="submitter">
              <div className="app">
                <Header />
                <SubmissionPage />
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/event/:eventId/submissions"
          element={
            <ProtectedRoute requiredRole="host">
              <div className="app">
                <Header />
                <EventSubmissionsPage />
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/vote/:eventId"
          element={
            <ProtectedRoute requiredRole="voter">
              <div className="app">
                <Header />
                <VotingPage />
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaderboard/:eventId"
          element={
            <div className="app">
              <Header />
              <LeaderboardPage />
              <Footer />
            </div>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
