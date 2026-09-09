import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Keyboard, ArrowRight, Code, Users, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

function extractRoomId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/room\/([^/?#]+)/);
    if (match) return match[1];
  } catch {
    /* not a URL */
  }
  return trimmed;
}

const ROOM_ID_REGEX = /^[a-zA-Z0-9][\w-]{3,}$/;

export default function Home() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('join');
  const [username, setUsername] = useState(() => localStorage.getItem('devcall_username') || '');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({ username: false, roomId: false });

  const cleanRoomId = useMemo(() => extractRoomId(roomId), [roomId]);

  const usernameError = useMemo(() => {
    if (!touched.username || submitting) return '';
    if (!username.trim()) return 'Please enter your name.';
    if (username.trim().length < 2) return 'Name is too short (minimum 2 characters).';
    if (username.trim().length > 40) return 'Name is too long (maximum 40 characters).';
    return '';
  }, [username, touched.username, submitting]);

  const roomIdError = useMemo(() => {
    if (activeTab !== 'join') return '';
    if (!touched.roomId || submitting) return '';
    if (!roomId.trim()) return 'Please enter a Room ID or invite link.';
    if (!cleanRoomId) return 'Could not extract a valid room ID from the input.';
    if (!ROOM_ID_REGEX.test(cleanRoomId)) return 'Room ID looks invalid (letters, numbers, dashes only).';
    return '';
  }, [roomId, cleanRoomId, touched.roomId, submitting, activeTab]);

  const validCreate = !!username.trim() && username.trim().length >= 2 && username.trim().length <= 40;
  const validJoin = validCreate && !!cleanRoomId && ROOM_ID_REGEX.test(cleanRoomId);

  const generateRoomId = () => {
    const prefixes = ['code', 'sync', 'hack', 'meet', 'learn', 'collab'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum1 = Math.random().toString(36).substring(2, 6);
    const randomNum2 = Math.random().toString(36).substring(2, 6);
    return `dev-${randomPrefix}-${randomNum1}-${randomNum2}`;
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setTouched({ username: true, roomId: true });
    if (!validCreate) {
      setError('Please enter a valid name before creating a room.');
      return;
    }
    setError('');
    setSubmitting(true);
    const generatedId = generateRoomId();
    localStorage.setItem('devcall_username', username.trim());
    await new Promise((r) => setTimeout(r, 350));
    navigate(`/room/${generatedId}`, { state: { username: username.trim() }, replace: false });
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setTouched({ username: true, roomId: true });
    if (!validJoin) {
      if (!validCreate) setError('Please enter a valid name.');
      else if (!cleanRoomId) setError('Please enter a valid Room ID or invite link.');
      else setError('Please fix the errors above before joining.');
      return;
    }
    setError('');
    setSubmitting(true);
    localStorage.setItem('devcall_username', username.trim());
    await new Promise((r) => setTimeout(r, 350));
    navigate(`/room/${cleanRoomId}`, { state: { username: username.trim() }, replace: false });
  };

  const InlineError = ({ text, id }) => (
    text ? (
      <div id={id} className="flex items-start gap-1.5 mt-1.5 text-[11px] text-red-400">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span className="leading-snug">{text}</span>
      </div>
    ) : null
  );

  const InlineValid = ({ text, id }) => (
    text ? (
      <div id={id} className="flex items-start gap-1.5 mt-1.5 text-[11px] text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span className="leading-snug">{text}</span>
      </div>
    ) : null
  );

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 max-w-7xl mx-auto w-full border-b border-slate-900">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/25">
            <Code className="w-4 h-4 sm:w-5 sm:h-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            DevCall
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <span>Online</span>
          </span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center px-4 sm:px-6 py-8 sm:py-12 max-w-7xl mx-auto w-full gap-8 lg:gap-20 sm:gap-12">
        <div className="flex-1 text-center lg:text-left space-y-5 sm:space-y-6 max-w-xl w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 text-[11px] sm:text-xs font-medium">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            Built for Web Developers & Learner Groups
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Real-time collaboration{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              made for builders.
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg leading-relaxed">
            Create instant call rooms, share your screens, review code, and collaborate in high-definition video. Free, secure, and running directly in your browser.
          </p>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm text-slate-500 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-bold" aria-hidden="true">✓</span> No accounts required
            </div>
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-bold" aria-hidden="true">✓</span> HD Screen Sharing
            </div>
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-bold" aria-hidden="true">✓</span> High-quality Audio
            </div>
          </div>
        </div>

        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-2xl shadow-slate-950/50">
          <div
            role="tablist"
            aria-label="Choose to join an existing room or create a new one"
            className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 mb-6"
          >
            <button
              role="tab"
              aria-selected={activeTab === 'join'}
              tabIndex={activeTab === 'join' ? 0 : -1}
              onClick={() => { setActiveTab('join'); setError(''); setTouched({ username: touched.username, roomId: false }); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'join'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Keyboard className="w-4 h-4" aria-hidden="true" />
              Join Room
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'create'}
              tabIndex={activeTab === 'create' ? 0 : -1}
              onClick={() => { setActiveTab('create'); setError(''); setTouched({ username: touched.username, roomId: false }); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'create'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-4 h-4" aria-hidden="true" />
              New Room
            </button>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 flex items-start gap-2 p-3 bg-red-950/30 border border-red-800/40 text-red-400 rounded-xl text-xs"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {activeTab === 'join' ? (
            <form onSubmit={handleJoinRoom} className="space-y-4" noValidate>
              <div>
                <label htmlFor="home-username-join" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <input
                  id="home-username-join"
                  type="text"
                  autoComplete="nickname"
                  placeholder="e.g. Mahdi"
                  aria-invalid={!!usernameError || undefined}
                  aria-describedby={usernameError ? 'username-error-join' : (touched.username && validCreate ? 'username-ok-join' : undefined)}
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }}
                  onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                  disabled={submitting}
                  className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    usernameError
                      ? 'border-red-700/60 focus:border-red-500 focus:ring-red-500'
                      : touched.username && validCreate
                      ? 'border-emerald-800/40 focus:border-indigo-500 focus:ring-indigo-500'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                  required
                />
                <InlineError text={usernameError} id="username-error-join" />
                <InlineValid text={touched.username && validCreate ? 'Name looks good.' : ''} id="username-ok-join" />
              </div>

              <div>
                <label htmlFor="home-room-id" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Room ID / Invite Link
                </label>
                <input
                  id="home-room-id"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="dev-code-xxxx-xxxx OR paste invite URL"
                  aria-invalid={!!roomIdError || undefined}
                  aria-describedby={roomIdError ? 'room-error' : undefined}
                  value={roomId}
                  onChange={(e) => { setRoomId(e.target.value); if (error) setError(''); }}
                  onBlur={() => setTouched((t) => ({ ...t, roomId: true }))}
                  disabled={submitting}
                  className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition font-mono text-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                    roomIdError
                      ? 'border-red-700/60 focus:border-red-500 focus:ring-red-500'
                      : touched.roomId && cleanRoomId && ROOM_ID_REGEX.test(cleanRoomId)
                      ? 'border-emerald-800/40 focus:border-indigo-500 focus:ring-indigo-500'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                  required
                />
                <InlineError text={roomIdError} id="room-error" />
              </div>

              <button
                type="submit"
                disabled={submitting}
                aria-disabled={submitting}
                aria-busy={submitting}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Joining room…
                  </>
                ) : (
                  <>
                    Join Meeting
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreateRoom} className="space-y-4" noValidate>
              <div>
                <label htmlFor="home-username-create" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <input
                  id="home-username-create"
                  type="text"
                  autoComplete="nickname"
                  placeholder="e.g. Mahdi"
                  aria-invalid={!!usernameError || undefined}
                  aria-describedby={usernameError ? 'username-error-create' : (touched.username && validCreate ? 'username-ok-create' : undefined)}
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }}
                  onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                  disabled={submitting}
                  className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    usernameError
                      ? 'border-red-700/60 focus:border-red-500 focus:ring-red-500'
                      : touched.username && validCreate
                      ? 'border-emerald-800/40 focus:border-indigo-500 focus:ring-indigo-500'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                  required
                />
                <InlineError text={usernameError} id="username-error-create" />
                <InlineValid text={touched.username && validCreate ? 'Name looks good.' : ''} id="username-ok-create" />
              </div>

              <div
                aria-live="polite"
                className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1"
              >
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wide">
                  Random Room ID Generation
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We will automatically generate a clean, shareable developer room URL for you.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                aria-disabled={submitting}
                aria-busy={submitting}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Creating room…
                  </>
                ) : (
                  <>
                    Create & Join Room
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="relative z-10 text-center py-6 text-xs text-slate-600 border-t border-slate-900 max-w-7xl mx-auto w-full px-4 sm:px-6">
        <p>© 2026 DevCall. Designed with premium aesthetics for coding peer groups.</p>
      </footer>
    </div>
  );
}
