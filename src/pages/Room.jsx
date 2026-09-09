import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, 
  PhoneOff, Users, MessageSquare, Copy, Check, Shield, Code, User,
  X, Info, AlertCircle, CheckCircle, Wifi, Loader2, MonitorUp
} from 'lucide-react';
import useWebRTC from '../hooks/useWebRTC.js';
import { persistChatMessage, syncRoom } from '../lib/supabase.js';

function getInitials(name) {
  if (!name) return '??';
  const clean = name.trim();
  if (!clean) return '??';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const VideoTile = React.memo(function VideoTile({ participant, micActive, camActive, isLocal, isScreen = false, screenOwnerName = '' }) {
  const videoRef = useRef(null);
  const stream = isScreen ? participant.screenStream : participant.stream;

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    const video = videoRef.current;
    if (video.srcObject === stream) return;
    video.srcObject = stream;
    return () => {
      try { video.srcObject = null; } catch { /* noop */ }
    };
  }, [stream]);

  const hasActiveVideo = stream
    ? stream.getVideoTracks().some((t) => t.enabled)
    : false;

  const hasActiveAudio = participant.stream
    ? participant.stream.getAudioTracks().some((t) => t.enabled)
    : true;

  const showCam = isScreen
    ? hasActiveVideo
    : (isLocal ? camActive : hasActiveVideo);

  const showMic = isLocal ? micActive : (participant.status?.micActive ?? hasActiveAudio);
  const speaking = showMic && !isScreen;

  const videoTrackLabel = useMemo(() => {
    return stream?.getVideoTracks?.()?.[0]?.label || '';
  }, [stream]);

  const voidVideoTrack = videoTrackLabel && !showCam && !isScreen;

  return (
    <div className={`relative ${isScreen ? 'aspect-[16/9]' : 'aspect-video'} rounded-3xl bg-slate-900 shadow-xl overflow-hidden group flex items-center justify-center transition-all duration-300 ${
      speaking
        ? 'border-2 border-indigo-500/50 shadow-[0_0_0_2px_rgba(99,102,241,0.08),0_0_40px_-12px_rgba(99,102,241,0.6)]'
        : 'border border-slate-800'
    } ${isScreen ? 'ring-1 ring-emerald-500/30' : ''}`}>
      {showCam && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isScreen}
          className="absolute inset-0 w-full h-full object-cover bg-black"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 h-full w-full bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 relative">
          {voidVideoTrack ? (
            <div className="absolute inset-0 bg-slate-950/70" />
          ) : null}
          <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center font-bold text-2xl md:text-3xl z-10 border transition ${
            isScreen
              ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border-indigo-500/30 text-indigo-300'
          }`}>
            {isScreen ? (
              <Monitor className="w-10 h-10 md:w-12 md:h-12 text-emerald-400" />
            ) : isLocal ? (
              <User className="w-10 h-10 md:w-12 md:h-12 text-indigo-400" />
            ) : (
              <span className="font-mono tracking-wider">{getInitials(participant.rawUsername || participant.username)}</span>
            )}
          </div>
          <span className="text-sm font-semibold text-slate-500 z-10">
            {isScreen ? 'No screen shared' : (showCam ? '' : 'Camera Off')}
          </span>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-70 pointer-events-none" />
        </div>
      )}

      {showCam && (
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80 pointer-events-none z-[1]" />
      )}

      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isScreen && (
            <div className="p-1 rounded-lg backdrop-blur-sm border bg-emerald-600/90 border-emerald-500/60 shadow-lg shadow-emerald-900/50">
              <MonitorUp className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          {!isScreen && (
            <div className={`p-1 rounded-lg backdrop-blur-sm border shadow ${
              showMic
                ? 'bg-indigo-600/90 border-indigo-500/60'
                : 'bg-slate-900/80 border-slate-700/80'
            }`}>
              {showMic ? (
                <Mic className="w-3.5 h-3.5 text-white" />
              ) : (
                <MicOff className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
          )}
          <span className="text-xs font-semibold text-white drop-shadow px-1 max-w-[60%] truncate">
            {isScreen ? `${screenOwnerName || participant.username} — Screen` : participant.username}
          </span>
        </div>
        {isLocal && !isScreen && (
          <div className="text-[10px] font-semibold text-slate-200/90 bg-slate-950/70 border border-slate-700/60 rounded-full px-2 py-0.5 backdrop-blur shadow">
            You
          </div>
        )}
        {isScreen && (
          <div className="text-[10px] font-semibold text-emerald-200 bg-emerald-950/80 border border-emerald-700/40 rounded-full px-2 py-0.5 backdrop-blur shadow flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        )}
      </div>
    </div>
  );
});

function Toast({ toast }) {
  if (!toast) return null;
  const { message, level } = toast;
  const style = {
    info: 'bg-indigo-600/95 border-indigo-500 text-white',
    success: 'bg-emerald-600/95 border-emerald-500 text-white',
    error: 'bg-red-600/95 border-red-500 text-white'
  }[level] || 'bg-indigo-600/95 border-indigo-500 text-white';
  const Icon = {
    info: Info,
    success: CheckCircle,
    error: AlertCircle
  }[level] || Info;

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-auto z-[100] animate-in slide-in-from-right fade-in duration-300 pointer-events-none"
    >
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-sm ${style}`}>
        <Icon className="w-4.5 h-4.5 flex-shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold">{message}</span>
      </div>
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="relative aspect-video rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden">
      <div className="absolute inset-0 animate-skeleton" />
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-slate-800/80 animate-skeleton" />
          <div className="h-3 w-24 rounded-full bg-slate-800/80 animate-skeleton" />
        </div>
        <div className="h-4 w-10 rounded-full bg-slate-800/80 animate-skeleton" />
      </div>
    </div>
  );
}

export default function Room({ roomId, username, onLeave }) {
  const effectiveUsername = username || 'Guest';
  const {
    participants,
    isConnected,
    isJoining,
    isReconnecting,
    startingScreenShare,
    micActive,
    camActive,
    screenSharing,
    chatMessages,
    unreadChatCount,
    toast,
    disconnected,
    error,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    sendChatMessage,
    markChatPanelOpen,
    leaveRoom
  } = useWebRTC(roomId, effectiveUsername);

  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatScrollRef = useRef(null);
  const chatDrawerRef = useRef(null);
  const participantsRef = useRef(null);

  useEffect(() => {
    // The call itself stays peer-to-peer; this only records room metadata when
    // the linked Supabase schema is present.
    syncRoom(roomId, effectiveUsername);
  }, [roomId, effectiveUsername]);

  useEffect(() => {
    markChatPanelOpen(showChat);
  }, [showChat, markChatPanelOpen]);

  useEffect(() => {
    if (chatScrollRef.current && showChat) {
      const el = chatScrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [chatMessages, showChat]);

  const closeDrawers = useCallback(() => {
    setShowChat(false);
    setShowParticipants(false);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') closeDrawers();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeDrawers]);

  useEffect(() => {
    const drawer = showChat ? chatDrawerRef.current : showParticipants ? participantsRef.current : null;
    if (!drawer) return undefined;
    const previousFocus = document.activeElement;
    const firstFocusable = drawer.querySelector('button, input, textarea, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [showChat, showParticipants]);

  const copyRoomId = () => {
    const inviteUrl = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard?.writeText(inviteUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCopied(false);
        window.prompt('Copy this invite link:', inviteUrl);
      });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const body = chatMessage.trim();
      const ok = sendChatMessage(body);
      if (ok) {
        setChatMessage('');
        void persistChatMessage(roomId, effectiveUsername, body);
      }
    } finally {
      setTimeout(() => setSendingChat(false), 150);
    }
  };

  const handleLeave = () => {
    closeDrawers();
    leaveRoom();
    onLeave?.();
  };

  const participantsWithLocal = useMemo(() => {
    if (participants.length > 0) return participants;
    if (error || !roomId || !effectiveUsername) return [];
    return [
      {
        socketId: 'local',
        username: `${effectiveUsername} (You)`,
        rawUsername: effectiveUsername,
        stream: null,
        screenStream: null,
        isLocal: true,
        status: { micActive, camActive, screenSharing }
      }
    ];
  }, [participants, effectiveUsername, roomId, error, micActive, camActive, screenSharing]);

  const activeScreenSharers = useMemo(() => {
    return participantsWithLocal.filter(
      (p) => p.screenStream && p.status?.screenSharing
    );
  }, [participantsWithLocal]);

  const cameraParticipants = useMemo(() => {
    return participantsWithLocal;
  }, [participantsWithLocal]);

  const gridCols = useMemo(() => {
    const count = cameraParticipants.length;
    if (activeScreenSharers.length > 0) {
      if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
      if (count <= 4) return 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4';
      return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
    }
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  }, [cameraParticipants.length, activeScreenSharers.length]);

  const totalParticipants = participantsWithLocal.length;
  const onlySelf = totalParticipants === 1 && !error;
  const chatCount = chatMessages.filter((m) => !m.isSystem).length;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Toast toast={toast} />

      {disconnected && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-amber-950/40 border-b border-amber-800/50 text-amber-300 text-xs font-semibold"
        >
          <Wifi className="w-4 h-4 flex-shrink-0 animate-pulse" aria-hidden="true" />
          <span>{isReconnecting ? 'Connection lost — reconnecting to the call…' : 'Disconnected from server. Attempting to reconnect…'}</span>
        </div>
      )}
      
      <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-slate-900 border-b border-slate-800/80 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-md flex-shrink-0">
            <Code className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-sm font-bold tracking-wide truncate">Developer Call Room</span>
            <span
              className="text-[10px] text-indigo-400 font-mono tracking-wider truncate max-w-[9rem] sm:max-w-none"
              title={roomId}
              aria-label={`Room ID: ${roomId}`}
            >
              {roomId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <button 
            onClick={copyRoomId}
            aria-label={copied ? 'Invite link copied to clipboard' : 'Copy invite link to this room'}
            aria-live="polite"
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-xl active:scale-[0.98] transition duration-200"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-400 hidden sm:inline">Invite Copied</span>
                <span className="text-emerald-400 sm:hidden">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span className="hidden sm:inline">Copy Invite Link</span>
                <span className="sm:hidden">Share</span>
              </>
            )}
          </button>
          
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              isConnected
                ? 'bg-slate-950 border-slate-800'
                : 'bg-amber-950/30 border-amber-800/40'
            }`}
            aria-live="polite"
          >
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} aria-hidden="true" />
            <span className="text-slate-300 hidden sm:inline">
              {isConnected ? 'Connected' : isJoining ? 'Connecting…' : error ? 'Unavailable' : 'Reconnecting…'}
            </span>
            <span className="text-slate-300 sm:hidden">
              {isConnected ? 'Live' : error ? 'Offline' : '…'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative min-h-0">

        <div
          className={`flex-1 flex flex-col overflow-y-auto min-w-0 relative ${
            showParticipants || showChat ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {isJoining && !error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="max-w-md w-full flex flex-col items-center gap-5 text-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-3xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" aria-hidden="true" />
                  </div>
                  <div className="absolute -inset-3 rounded-3xl bg-indigo-500/10 blur-xl -z-10" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-1.5">
                    Joining the room…
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Connecting to signaling server and getting your media ready.
                  </p>
                </div>
                <div className="w-full grid grid-cols-2 sm:grid-cols-1 gap-3 mt-2">
                  <SkeletonTile />
                  <SkeletonTile />
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
              <div
                role="alert"
                aria-live="assertive"
                className="max-w-md mx-auto p-6 rounded-3xl bg-red-950/30 border border-red-800/40 text-red-300 text-sm shadow-2xl shadow-red-950/40"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-red-900/50 border border-red-700/40 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-200 mb-0.5">Media / Connection Error</p>
                    <p className="text-xs opacity-90 leading-relaxed">{error}</p>
                  </div>
                </div>
                <p className="text-xs mt-2 opacity-80 leading-relaxed p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl text-slate-300">
                  Troubleshooting steps:
                  <br />• Allow camera &amp; microphone permissions in your browser.
                  <br />• Refresh the page to try again.
                  <br />• If the error persists, close other apps using your camera.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="flex-1 flex flex-col gap-3 sm:gap-4 max-w-7xl mx-auto w-full justify-start content-start p-3 sm:p-5 lg:p-6"
              style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
            >
              
              {activeScreenSharers.length > 0 && (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2 sm:mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30">
                        <MonitorUp className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-emerald-300">
                        {activeScreenSharers.length === 1 ? 'Screen Presenting' : 'Screens Presenting'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900/60 border border-slate-800 px-2 py-1 rounded-full">
                      {activeScreenSharers.length} {activeScreenSharers.length === 1 ? 'source' : 'sources'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {activeScreenSharers.map((p) => (
                      <VideoTile
                        key={`screen-${p.socketId}`}
                        participant={p}
                        micActive={p.isLocal ? micActive : (p.status?.micActive ?? true)}
                        camActive={p.isLocal ? camActive : (p.status?.camActive ?? true)}
                        isLocal={p.isLocal}
                        isScreen={true}
                        screenOwnerName={p.rawUsername || p.username}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-400">
                    Participants
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900/60 border border-slate-800 px-2 py-1 rounded-full">
                  {totalParticipants} in call
                </span>
              </div>

              <div className={`grid ${gridCols} gap-3 sm:gap-4 w-full items-center justify-center content-center`}>
                {cameraParticipants.map((p) => (
                  <VideoTile
                    key={p.socketId}
                    participant={p}
                    micActive={p.isLocal ? micActive : (p.status?.micActive ?? true)}
                    camActive={p.isLocal ? camActive : (p.status?.camActive ?? true)}
                    isLocal={p.isLocal}
                  />
                ))}
              </div>

              {onlySelf && !isJoining && (
                <div className="flex items-center justify-center mt-2">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 text-xs font-medium shadow shadow-indigo-950/30">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    Waiting for peers — share the invite link above
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showParticipants && (
          <div
            className="fixed inset-0 z-40 lg:relative lg:z-0 lg:inset-auto lg:!flex"
            role="dialog"
            aria-modal="true"
            aria-labelledby="participants-title"
            onClick={closeDrawers}
          >
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md lg:hidden" aria-hidden="true" />
            <div
              ref={participantsRef}
              className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full animate-in slide-in-from-right duration-300 lg:relative lg:inset-auto lg:animate-none lg:w-80 lg:max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 text-indigo-400 flex-shrink-0" aria-hidden="true" />
                  <h2 id="participants-title" className="font-semibold text-sm truncate">Participants</h2>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-800 flex-shrink-0">
                    {totalParticipants}
                  </span>
                </div>
                <button 
                  onClick={closeDrawers}
                  aria-label="Close participants panel"
                  className="text-xs font-medium text-slate-500 hover:text-slate-300 p-2 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {participantsWithLocal.length === 0 ? (
                  <div className="py-10 px-4 text-center">
                    <Users className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-50" aria-hidden="true" />
                    <p className="text-xs text-slate-500">No participants yet.</p>
                  </div>
                ) : (
                  participantsWithLocal.map((p) => {
                    const status = p.status || {};
                    const pMic = p.isLocal ? micActive : (status.micActive ?? true);
                    const pCam = p.isLocal ? camActive : (status.camActive ?? true);
                    const pScreen = p.isLocal ? screenSharing : (status.screenSharing ?? false);
                    return (
                      <div 
                        key={p.socketId}
                        className={`flex items-center justify-between gap-2 p-3 rounded-2xl border transition ${
                          p.isLocal
                            ? 'bg-indigo-950/30 border-indigo-800/40'
                            : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 border ${
                            p.isLocal
                              ? 'bg-gradient-to-br from-indigo-500/25 to-violet-500/10 border-indigo-500/40'
                              : 'bg-gradient-to-br from-slate-800/50 to-slate-900 border-slate-700/50'
                          }`}>
                            {p.isLocal ? (
                              <User className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                            ) : (
                              <span className="font-mono tracking-wider text-slate-300">{getInitials(p.rawUsername || p.username)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-100 truncate">
                                {p.isLocal ? (p.rawUsername || effectiveUsername) : (p.rawUsername || p.username)}
                              </span>
                              {p.isLocal && (
                                <span className="text-[9px] font-bold text-indigo-300 bg-indigo-600/20 border border-indigo-500/30 rounded-full px-1.5 py-0.5 uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" aria-label="Participant media status">
                          <div
                            title={pMic ? 'Microphone on' : 'Microphone muted'}
                            aria-label={pMic ? 'Microphone on' : 'Microphone muted'}
                            className={`p-1 rounded-lg border ${
                              pMic
                                ? 'bg-slate-800/60 border-slate-700'
                                : 'bg-red-500/20 border-red-500/30'
                            }`}
                          >
                            {pMic ? (
                              <Mic className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                            ) : (
                              <MicOff className="w-3 h-3 text-red-400" aria-hidden="true" />
                            )}
                          </div>
                          <div
                            title={pCam ? 'Camera on' : 'Camera off'}
                            aria-label={pCam ? 'Camera on' : 'Camera off'}
                            className={`p-1 rounded-lg border ${
                              pCam
                                ? 'bg-slate-800/60 border-slate-700'
                                : 'bg-red-500/20 border-red-500/30'
                            }`}
                          >
                            {pCam ? (
                              <Video className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                            ) : (
                              <VideoOff className="w-3 h-3 text-red-400" aria-hidden="true" />
                            )}
                          </div>
                          <div
                            title={pScreen ? 'Screen sharing active' : 'Not screen sharing'}
                            aria-label={pScreen ? 'Screen sharing active' : 'Not screen sharing'}
                            className={`p-1 rounded-lg border ${
                              pScreen
                                ? 'bg-emerald-500/20 border-emerald-500/40'
                                : 'bg-slate-800/40 border-slate-700/40 opacity-40'
                            }`}
                          >
                            {pScreen ? (
                              <Monitor className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                            ) : (
                              <MonitorOff className="w-3 h-3 text-slate-400" aria-hidden="true" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {showChat && (
          <div
            className="fixed inset-0 z-40 lg:relative lg:z-0 lg:inset-auto lg:!flex"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-title"
            onClick={closeDrawers}
          >
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md lg:hidden" aria-hidden="true" />
            <div 
              ref={chatDrawerRef}
              className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full animate-in slide-in-from-right duration-300 lg:relative lg:inset-auto lg:animate-none lg:w-80 lg:max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" aria-hidden="true" />
                  <h2 id="chat-title" className="font-semibold text-sm truncate">Room Chat</h2>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-800 flex-shrink-0">
                    {chatCount}
                  </span>
                </div>
                <button 
                  onClick={closeDrawers}
                  aria-label="Close chat panel"
                  className="text-xs font-medium text-slate-500 hover:text-slate-300 p-2 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="py-14 px-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 border border-indigo-800/30 mx-auto mb-3 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-indigo-400 opacity-70" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-semibold text-slate-300 mb-1">No messages yet</p>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                      Say hi to the room. Chat is live and delivered instantly to all participants.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isSystem = !!msg.isSystem;
                    const isSelf = msg.username === effectiveUsername && !isSystem;
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex items-center justify-center py-1">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 text-[10px] font-semibold text-center max-w-[90%]">
                            <Info className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                            <span className="truncate">{msg.text}</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col gap-1 ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-baseline gap-2 max-w-[90%]">
                          {!isSelf && (
                            <span className="text-[10px] font-bold text-slate-400 truncate flex-shrink-0">
                              {msg.username}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-600 flex-shrink-0">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <div
                          className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words border shadow-sm ${
                            isSelf
                              ? 'bg-indigo-600/90 border-indigo-500/40 text-white rounded-br-md'
                              : 'bg-slate-800/80 border-slate-700/60 text-slate-100 rounded-bl-md'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900/60 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <label htmlFor="chat-input" className="sr-only">Send a message</label>
                  <input
                    id="chat-input"
                    type="text"
                    placeholder={`Message ${totalParticipants === 1 ? 'the room' : `${totalParticipants} participants`}…`}
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    disabled={!isConnected || sendingChat}
                    aria-disabled={!isConnected || sendingChat}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={!chatMessage.trim() || !isConnected || sendingChat}
                    aria-label="Send chat message"
                    className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white transition active:scale-95 border border-indigo-500/30 disabled:border-slate-800"
                    title="Send message"
                  >
                    {sendingChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800/80 px-2 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10 gap-2 flex-shrink-0 safe-area-bottom" role="toolbar" aria-label="Call controls">
        
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <Shield className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">End-to-End P2P Encryption</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2.5 md:gap-3 mx-auto sm:mx-0 flex-wrap justify-center">
          <button 
            onClick={toggleMic}
            disabled={!isConnected}
            aria-pressed={micActive}
            aria-label={micActive ? 'Mute microphone' : 'Unmute microphone'}
            title={micActive ? 'Mute microphone' : 'Unmute microphone'}
            className={`relative p-2.5 sm:p-3 rounded-2xl border transition duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              micActive 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100' 
                : 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30 text-red-400'
            }`}
          >
            {micActive ? <Mic className="w-5 h-5" aria-hidden="true" /> : <MicOff className="w-5 h-5" aria-hidden="true" />}
          </button>

          <button 
            onClick={toggleCam}
            disabled={!isConnected}
            aria-pressed={camActive}
            aria-label={camActive ? 'Turn off camera' : 'Turn on camera'}
            title={camActive ? 'Turn off camera' : 'Turn on camera'}
            className={`relative p-2.5 sm:p-3 rounded-2xl border transition duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              camActive 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100' 
                : 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30 text-red-400'
            }`}
          >
            {camActive ? <Video className="w-5 h-5" aria-hidden="true" /> : <VideoOff className="w-5 h-5" aria-hidden="true" />}
          </button>

          <button 
            onClick={toggleScreenShare}
            disabled={startingScreenShare || !isConnected}
            aria-pressed={screenSharing}
            aria-label={screenSharing ? 'Stop sharing screen' : (startingScreenShare ? 'Starting screen share…' : 'Share screen')}
            title={screenSharing ? 'Stop sharing screen' : (startingScreenShare ? 'Starting screen share…' : 'Share screen')}
            className={`relative p-2.5 sm:p-3 rounded-2xl border transition duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
              screenSharing 
                ? 'bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-400 animate-pulse' 
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100'
            }`}
          >
            {startingScreenShare ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              screenSharing ? <MonitorOff className="w-5 h-5" aria-hidden="true" /> : <Monitor className="w-5 h-5" aria-hidden="true" />
            )}
            {screenSharing && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" aria-hidden="true" />
            )}
          </button>

          <button 
            onClick={() => {
              const willOpen = !showChat;
              setShowParticipants(false);
              setShowChat(willOpen);
            }}
            aria-pressed={showChat}
            aria-label={showChat ? 'Close chat' : (unreadChatCount > 0 ? `Open chat (${unreadChatCount} new messages)` : 'Open chat')}
            title="Toggle chat"
            className={`relative p-2.5 sm:p-3 rounded-2xl border transition duration-200 active:scale-95 ${
              showChat 
                ? 'bg-indigo-500/20 border-indigo-500/40 hover:bg-indigo-500/30 text-indigo-400' 
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100'
            }`}
          >
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
            {unreadChatCount > 0 && !showChat && (
              <span
                aria-live="polite"
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 border-2 border-slate-900 text-white text-[10px] font-bold flex items-center justify-center shadow shadow-red-500/30"
              >
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => {
              const willOpen = !showParticipants;
              setShowChat(false);
              setShowParticipants(willOpen);
            }}
            aria-pressed={showParticipants}
            aria-label={showParticipants ? 'Close participants panel' : 'Open participants panel'}
            title="Toggle participants"
            className={`relative p-2.5 sm:p-3 rounded-2xl border transition duration-200 active:scale-95 ${
              showParticipants 
                ? 'bg-indigo-500/20 border-indigo-500/40 hover:bg-indigo-500/30 text-indigo-400' 
                : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-100'
            }`}
          >
            <Users className="w-5 h-5" aria-hidden="true" />
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500/80 border-2 border-slate-900 text-white text-[10px] font-bold flex items-center justify-center"
            >
              {totalParticipants > 99 ? '99+' : totalParticipants}
            </span>
          </button>

          <button 
            onClick={handleLeave}
            aria-label="Leave this call"
            title="Leave call"
            className="p-2.5 sm:p-3 bg-red-600 hover:bg-red-500 border border-red-500/20 text-white rounded-2xl transition duration-200 active:scale-95 ml-0.5 sm:ml-1 shadow-lg shadow-red-600/20"
          >
            <PhoneOff className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-400 flex-shrink-0">
          <Users className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span>{totalParticipants} Participant{totalParticipants === 1 ? '' : 's'}</span>
        </div>
        <div className="sm:hidden text-[10px] text-slate-500 font-semibold flex-shrink-0 max-w-[5rem] truncate">
          {totalParticipants} in call
        </div>

      </footer>
    </div>
  );
}
