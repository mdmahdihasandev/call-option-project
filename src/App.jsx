import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import { ensureGuestSession, isSupabaseConfigured } from './lib/supabase';

function RoomWrapper() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username || localStorage.getItem('devcall_username') || '';

  const handleLeave = () => {
    localStorage.removeItem('devcall_username');
    navigate('/', { replace: true });
  };

  if (!roomId) {
    return <Navigate to="/" replace />;
  }

  return (
    <Room
      roomId={roomId}
      username={username}
      onLeave={handleLeave}
    />
  );
}

function App() {
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Anonymous auth is intentionally best-effort while the dashboard provider
    // is being enabled; the live call remains fully usable without it.
    ensureGuestSession().catch((error) => {
      console.info('Supabase guest auth is not ready:', error.message);
    });
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomWrapper />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
