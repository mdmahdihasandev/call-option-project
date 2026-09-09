import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

const ROOM_ID_REGEX = /^[a-zA-Z0-9][\w-]{3,}$/;

function getSocketUrl() {
  if (import.meta.env.VITE_SIGNALING_URL) {
    return import.meta.env.VITE_SIGNALING_URL;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  return window.location.origin;
}

function defaultStatus() {
  return { micActive: true, camActive: true, screenSharing: false };
}

function isSafeIceServer(server) {
  const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
  return urls.length > 0 && urls.every((url) => (
    typeof url === 'string' && /^(stun|turn|turns):/i.test(url)
  ));
}

export default function useWebRTC(roomId, username) {
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const localCameraVideoTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const remoteScreenStreamsRef = useRef(new Map());
  const pendingIceCandidatesRef = useRef(new Map());
  const isLeavingRef = useRef(false);
  const roomIdRef = useRef(roomId);
  const iceServersRef = useRef(ICE_SERVERS);

  const [localStream, setLocalStream] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [startingScreenShare, setStartingScreenShare] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [error, setError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [_chatPanelOpenState, setChatPanelOpenRefState] = useState(false);
  const [peersStatus, setPeersStatus] = useState(new Map());
  const [disconnected, setDisconnected] = useState(false);
  const [toast, setToast] = useState(null);
  const hadFirstConnectRef = useRef(false);
  const leftGuardRef = useRef(false);
  const chatIdSeenRef = useRef(new Set());

  roomIdRef.current = roomId;

  const showToast = useCallback((message, level = 'info') => {
    setToast({ message, level, id: Date.now() });
    setTimeout(() => setToast((prev) => (prev && Date.now() - prev.id >= 2800 ? null : prev)), 3000);
  }, []);

  const pushSystemChat = useCallback((text) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        socketId: 'system',
        username: 'System',
        text,
        timestamp: Date.now(),
        isSystem: true
      }
    ]);
  }, []);

  const broadcastStatus = useCallback((patch) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('participant-status', patch);
    }
  }, []);

  const resetUnreadChat = useCallback(() => {
    setUnreadChatCount(0);
  }, []);

  const markChatPanelOpen = useCallback((open) => {
    setChatPanelOpenRefState(open);
    if (open) setUnreadChatCount(0);
  }, []);

  const loadIceServers = useCallback(async (socketUrl) => {
    try {
      const response = await fetch(`${socketUrl.replace(/\/$/, '')}/ice-servers`);
      if (!response.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload?.iceServers) && payload.iceServers.every(isSafeIceServer)) {
        iceServersRef.current = payload.iceServers;
      }
    } catch {
      // TURN is optional; continue with the established STUN-only fallback.
    }
  }, []);

  const updateParticipants = useCallback(() => {
    const list = [];
    if (localStreamRef.current) {
      list.push({
        socketId: 'local',
        username: `${username} (You)`,
        rawUsername: username,
        stream: screenStreamRef.current || localStreamRef.current,
        screenStream: screenStreamRef.current || null,
        isLocal: true,
        status: {
          micActive,
          camActive,
          screenSharing: !!screenStreamRef.current
        }
      });
    }
    for (const [socketId, stream] of remoteStreamsRef.current.entries()) {
      const pc = peerConnectionsRef.current.get(socketId);
      const name = pc?._username || 'Guest';
      const status = peersStatus.get(socketId) || defaultStatus();
      const screenRemote = remoteScreenStreamsRef.current.get(socketId) || null;
      list.push({
        socketId,
        username: name,
        rawUsername: name,
        stream,
        screenStream: screenRemote,
        isLocal: false,
        status
      });
    }
    setParticipants(list);
  }, [username, micActive, camActive, peersStatus]);

  const replaceVideoTrackOnAllPeers = useCallback((newVideoTrack) => {
    for (const pc of peerConnectionsRef.current.values()) {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        try {
          videoSender.replaceTrack(newVideoTrack);
        } catch (err) {
          console.warn('replaceTrack failed:', err);
        }
      } else if (newVideoTrack && localStreamRef.current) {
        try {
          pc.addTrack(newVideoTrack, localStreamRef.current);
        } catch {
          /* noop */
        }
      }
    }
  }, []);

  const createPeerConnection = useCallback((remoteSocketId, remoteUsername, isOfferer) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pc._username = remoteUsername;
    peerConnectionsRef.current.set(remoteSocketId, pc);

    const remoteStream = new MediaStream();
    remoteStreamsRef.current.set(remoteSocketId, remoteStream);

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];
      const track = event.track;
      if (!track) return;
<<<<<<< HEAD
=======

      // Browsers normally provide the complete remote MediaStream here. Keep
      // that exact stream rather than assembling a second one track-by-track:
      // tracks can arrive at different times on mobile, and the UI must retain
      // the same stream object so its audio and video play together.
      if (incomingStream) {
        remoteStreamsRef.current.set(remoteSocketId, incomingStream);
        track.onunmute = () => updateParticipants();
        track.onended = () => updateParticipants();
        updateParticipants();
        return;
      }
>>>>>>> b22ae32 (Update call website)

      if (track.kind === 'video') {
        const incomingStreamId = incomingStream?.id || '';
        const isScreenTrack = (track.label || '').toLowerCase().includes('screen') || incomingStreamId.includes('screen') || incomingStreamId.includes('display');
        const targetStream = isScreenTrack
          ? (remoteScreenStreamsRef.current.get(remoteSocketId) || (() => {
              const s = new MediaStream();
              remoteScreenStreamsRef.current.set(remoteSocketId, s);
              return s;
            })())
          : remoteStream;

        for (const existing of targetStream.getVideoTracks()) {
          try { targetStream.removeTrack(existing); } catch { /* noop */ }
        }
        targetStream.addTrack(track);
      } else {
        for (const existing of remoteStream.getAudioTracks()) {
          if (existing.id === track.id) return;
        }
        remoteStream.addTrack(track);
      }
      // Some mobile browsers initially deliver muted tracks. Refresh the UI
      // when media begins flowing instead of waiting for a later track event.
      track.onunmute = updateParticipants;
      track.onended = updateParticipants;
      updateParticipants();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          to: remoteSocketId,
          from: socketRef.current.id,
          candidate: event.candidate
        });
      }
    };

    const sendOffer = async () => {
      if (!isOfferer || !socketRef.current?.connected || pc.signalingState !== 'stable' || pc._makingOffer) return;
      pc._makingOffer = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('offer', {
          to: remoteSocketId,
          from: socketRef.current.id,
          sdp: pc.localDescription
        });
      } catch (err) {
        console.error('Error creating/sending offer:', err);
      } finally {
        pc._makingOffer = false;
      }
    };
    pc.onnegotiationneeded = sendOffer;

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'closed') return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (!isLeavingRef.current) {
          console.warn(`Connection state with ${remoteSocketId}: ${pc.connectionState}`);
        }
      }
    };

    if (localStreamRef.current) {
      const videoTrack = (screenStreamRef.current ? screenStreamRef.current.getVideoTracks()[0] : localStreamRef.current.getVideoTracks()[0]) || null;
      for (const track of localStreamRef.current.getAudioTracks()) {
        try { pc.addTrack(track, localStreamRef.current); } catch { /* noop */ }
      }
      if (videoTrack) {
        const baseStream = screenStreamRef.current || localStreamRef.current;
        try {
          pc.addTrack(videoTrack, baseStream);
        } catch {
          /* noop */
        }
      }

<<<<<<< HEAD
      // `negotiationneeded` can be missed during initial setup on some mobile
      // Chromium builds, so explicitly queue the first offer as a fallback.
=======
      // `negotiationneeded` is reliable in modern desktop browsers, but can be
      // missed during initial setup on some mobile Chromium builds. Explicitly
      // queue the first offer as a compatibility fallback.
>>>>>>> b22ae32 (Update call website)
      queueMicrotask(sendOffer);
    }

    return pc;
  }, [updateParticipants]);

  const closePeerConnection = useCallback((remoteSocketId) => {
    const pc = peerConnectionsRef.current.get(remoteSocketId);
    if (pc) {
      try { pc.close(); } catch { /* noop */ }
      peerConnectionsRef.current.delete(remoteSocketId);
    }
    remoteStreamsRef.current.delete(remoteSocketId);
    remoteScreenStreamsRef.current.delete(remoteSocketId);
    pendingIceCandidatesRef.current.delete(remoteSocketId);
  }, []);

  const sendChatMessage = useCallback((text) => {
    if (!text || !text.trim()) return false;
    if (!socketRef.current || !socketRef.current.connected) {
      showToast('Not connected — message not sent', 'error');
      return false;
    }
    try {
      socketRef.current.emit('chat-message', { text: text.trim() });
      return true;
    } catch {
      showToast('Failed to send message', 'error');
      return false;
    }
  }, [showToast]);

  const stopScreenShare = useCallback(() => {
    if (!screenStreamRef.current) return;
    for (const t of screenStreamRef.current.getTracks()) {
      try { t.stop(); } catch { /* noop */ }
    }
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);

    if (localCameraVideoTrackRef.current && localStreamRef.current) {
      if (!localStreamRef.current.getVideoTracks().some((track) => track.id === localCameraVideoTrackRef.current.id)) {
        localStreamRef.current.addTrack(localCameraVideoTrackRef.current);
      }
      localCameraVideoTrackRef.current.enabled = camActive;
      replaceVideoTrackOnAllPeers(localCameraVideoTrackRef.current);
    }
    broadcastStatus({ screenSharing: false });
    updateParticipants();
    showToast('Screen sharing stopped', 'info');
  }, [camActive, replaceVideoTrackOnAllPeers, broadcastStatus, updateParticipants, showToast]);

  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showToast('Screen sharing is not supported in this browser', 'error');
      return false;
    }
    if (startingScreenShare) return false;
    setStartingScreenShare(true);
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false
      });

      const videoTrack = displayStream.getVideoTracks()[0];
      if (!videoTrack) {
        showToast('No screen track available', 'error');
        for (const t of displayStream.getTracks()) t.stop();
        return false;
      }

      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setScreenSharing(true);

      videoTrack.addEventListener('ended', () => {
        stopScreenShare();
      });

      replaceVideoTrackOnAllPeers(videoTrack);
      broadcastStatus({ screenSharing: true });
      updateParticipants();
      showToast('Screen sharing started', 'success');
      return true;
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        showToast('Screen sharing permission denied', 'error');
      } else if (err && err.name === 'NotFoundError') {
        showToast('No screens available to share', 'error');
      } else if (err && (err.name === 'AbortError' || err.name === 'NotReadableError')) {
        showToast('Screen sharing cancelled', 'info');
      } else {
        console.warn('Screen share error:', err);
        showToast('Could not start screen sharing', 'error');
      }
      return false;
    } finally {
      setStartingScreenShare(false);
    }
  }, [replaceVideoTrackOnAllPeers, broadcastStatus, updateParticipants, stopScreenShare, showToast, startingScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (screenSharing || screenStreamRef.current) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [screenSharing, startScreenShare, stopScreenShare]);

  const flushPendingIceCandidates = useCallback(async (remoteSocketId, pc) => {
    const buffered = pendingIceCandidatesRef.current.get(remoteSocketId);
    if (!buffered || buffered.length === 0) return;
    pendingIceCandidatesRef.current.delete(remoteSocketId);
    for (const candidate of buffered) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Failed to add buffered ICE candidate:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!roomId || !username) {
      setIsJoining(false);
      setError('Missing room ID or username. Return home and try again.');
      return;
    }

    if (!ROOM_ID_REGEX.test(roomId)) {
      setIsJoining(false);
      setError('This Room ID is invalid. Check the invite link and try again.');
      return;
    }

    let cancelled = false;
    isLeavingRef.current = false;
    leftGuardRef.current = false;
    setDisconnected(false);
    setIsJoining(true);
    setIsReconnecting(false);
    let localSocket = null;

    const teardownPartial = () => {
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          try { track.stop(); } catch { /* noop */ }
        }
        localStreamRef.current = null;
        localCameraVideoTrackRef.current = null;
      }
      if (screenStreamRef.current) {
        for (const track of screenStreamRef.current.getTracks()) {
          try { track.stop(); } catch { /* noop */ }
        }
        screenStreamRef.current = null;
      }
      for (const [sid] of peerConnectionsRef.current) {
        const pc = peerConnectionsRef.current.get(sid);
        if (pc) {
          try { pc.close(); } catch { /* noop */ }
        }
      }
      peerConnectionsRef.current.clear();
      remoteStreamsRef.current.clear();
      remoteScreenStreamsRef.current.clear();
      pendingIceCandidatesRef.current.clear();
      hadFirstConnectRef.current = false;
      chatIdSeenRef.current.clear();
      if (localSocket) {
        try { localSocket.disconnect(); } catch { /* noop */ }
        localSocket = null;
      }
      if (socketRef.current === localSocket) {
        socketRef.current = null;
      }
    };

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        localStreamRef.current = stream;
        const camTrack = stream.getVideoTracks()[0] || null;
        localCameraVideoTrackRef.current = camTrack || null;
        setLocalStream(stream);
        pushSystemChat(`Welcome to the room, ${username}! Share the invite link to invite peers.`);
        updateParticipants();
      } catch (mediaErr) {
        console.error('Media error:', mediaErr);
        const name = mediaErr?.name || '';
        const msg = mediaErr?.message || 'Failed to access camera or microphone';
        let friendly = msg;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') friendly = 'Camera & microphone permissions were denied. Please allow them in your browser settings and refresh.';
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') friendly = 'No camera or microphone devices were found on your system.';
        if (name === 'NotReadableError') friendly = 'Camera or microphone is already in use by another app.';
        setError(friendly);
        showToast('Could not access camera/mic', 'error');
      }

      if (cancelled) return;

      const socketUrl = getSocketUrl();
      await loadIceServers(socketUrl);
      if (cancelled) return;
      const socket = io(socketUrl, { transports: ['websocket', 'polling'], withCredentials: true });
      localSocket = socket;
      socketRef.current = socket;

      socket.on('connect', () => {
        if (cancelled) return;
        setIsConnected(true);
        setDisconnected(false);
        setIsJoining(false);
        const wasReconnect = hadFirstConnectRef.current;
        hadFirstConnectRef.current = true;
        socket.emit('join-room', { roomId, username });
        broadcastStatus({ micActive, camActive, screenSharing: !!screenStreamRef.current });
        if (wasReconnect) {
          showToast('Reconnected to the call', 'success');
          pushSystemChat('Reconnected successfully.');
          setIsReconnecting(false);
        }
      });

      socket.on('disconnect', (reason) => {
        setIsConnected(false);
        if (!isLeavingRef.current && reason !== 'io client disconnect') {
          setDisconnected(true);
          setIsReconnecting(hadFirstConnectRef.current);
          showToast('Disconnected from server. Reconnecting…', 'error');
          pushSystemChat('Disconnected from the call. Attempting to reconnect…');
        }
      });

      socket.on('connect_error', () => {
        setIsJoining(false);
        setDisconnected(true);
        setError('Failed to connect to signaling server. Please refresh or check the network.');
        showToast('Signaling server unreachable', 'error');
      });

      socket.on('app-error', ({ message } = {}) => {
        if (!message) return;
        setError(message);
        setIsJoining(false);
        showToast(message, 'error');
      });

      socket.on('server-shutting-down', () => {
        if (isLeavingRef.current) return;
        showToast('Server is restarting. Reconnecting…', 'info');
      });

      socket.on('room-users', ({ users }) => {
        if (cancelled) return;
        setIsJoining(false);
        for (const user of users) {
          if (!peerConnectionsRef.current.has(user.socketId)) {
            createPeerConnection(user.socketId, user.username, true);
          }
          setPeersStatus((prev) => {
            const next = new Map(prev);
            next.set(user.socketId, user.status || defaultStatus());
            return next;
          });
          if (user.username) {
            pushSystemChat(`${user.username} is already in the room.`);
          }
        }
        updateParticipants();
      });

      socket.on('user-joined', ({ socketId, username: remoteUsername, status }) => {
        if (cancelled) return;
        if (socketId === socket.id || peerConnectionsRef.current.has(socketId)) return;
        createPeerConnection(socketId, remoteUsername, false);
        setPeersStatus((prev) => {
          const next = new Map(prev);
          next.set(socketId, status || defaultStatus());
          return next;
        });
        pushSystemChat(`${remoteUsername} joined the room.`);
        showToast(`${remoteUsername} joined`, 'success');
        updateParticipants();
      });

      socket.on('user-left', ({ socketId }) => {
        if (cancelled) return;
        const pc = peerConnectionsRef.current.get(socketId);
        const name = pc?._username || 'A participant';
        closePeerConnection(socketId);
        setPeersStatus((prev) => {
          const next = new Map(prev);
          next.delete(socketId);
          return next;
        });
        pushSystemChat(`${name} left the room.`);
        showToast(`${name} left`, 'info');
        updateParticipants();
      });

      socket.on('participant-status', ({ socketId, status }) => {
        if (cancelled) return;
        if (status?.screenSharing === false) {
          remoteScreenStreamsRef.current.delete(socketId);
        }
        setPeersStatus((prev) => {
          const next = new Map(prev);
          const existing = next.get(socketId) || defaultStatus();
          next.set(socketId, { ...existing, ...(status || {}) });
          return next;
        });
        updateParticipants();
      });

      socket.on('chat-message', (payload) => {
        if (!payload || !payload.id) return;
        if (chatIdSeenRef.current.has(payload.id)) return;
        chatIdSeenRef.current.add(payload.id);

        const fromSelf = payload.socketId === socketRef.current?.id;
        if (!fromSelf) {
          if (!_chatPanelOpenState) {
            setUnreadChatCount((n) => n + 1);
          }
        }
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, { ...payload, isSystem: false }];
        });
      });

      socket.on('offer', async ({ from, sdp }) => {
        if (cancelled) return;
        let pc = peerConnectionsRef.current.get(from);
        if (!pc) {
          pc = createPeerConnection(from, 'Guest', false);
        }
        try {
          if (pc.signalingState === 'closed') return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await flushPendingIceCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('answer', { to: from, from: socket.id, sdp: pc.localDescription });
        } catch (err) {
          console.error('Error handling offer:', err);
        }
      });

      socket.on('answer', async ({ from, sdp }) => {
        if (cancelled) return;
        const pc = peerConnectionsRef.current.get(from);
        if (!pc) return;
        try {
          if (pc.signalingState !== 'closed' && pc.remoteDescription == null) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushPendingIceCandidates(from, pc);
          }
        } catch (err) {
          console.error('Error handling answer:', err);
        }
      });

      socket.on('ice-candidate', async ({ from, candidate }) => {
        if (cancelled || !candidate) return;
        const pc = peerConnectionsRef.current.get(from);
        if (!pc) {
          const list = pendingIceCandidatesRef.current.get(from) || [];
          list.push(candidate);
          pendingIceCandidatesRef.current.set(from, list);
          return;
        }
        if (pc.remoteDescription == null) {
          const list = pendingIceCandidatesRef.current.get(from) || [];
          list.push(candidate);
          pendingIceCandidatesRef.current.set(from, list);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });
    };

    setup();

    return () => {
      cancelled = true;
      teardownPartial();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, username]);

  const leaveRoom = useCallback(() => {
    if (leftGuardRef.current) return;
    leftGuardRef.current = true;
    isLeavingRef.current = true;
    hadFirstConnectRef.current = false;
    if (screenStreamRef.current) {
      for (const t of screenStreamRef.current.getTracks()) {
        try { t.stop(); } catch { /* noop */ }
      }
      screenStreamRef.current = null;
    }
    for (const [socketId] of peerConnectionsRef.current) {
      closePeerConnection(socketId);
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        try { track.stop(); } catch { /* noop */ }
      }
      localStreamRef.current = null;
      localCameraVideoTrackRef.current = null;
    }
    setLocalStream(null);
    setScreenStream(null);
    setScreenSharing(false);
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch { /* noop */ }
      socketRef.current = null;
    }
    remoteStreamsRef.current.clear();
    remoteScreenStreamsRef.current.clear();
    peerConnectionsRef.current.clear();
    setParticipants([]);
    setIsConnected(false);
    setIsJoining(false);
    setIsReconnecting(false);
    setPeersStatus(new Map());
    setChatMessages([]);
    setUnreadChatCount(0);
    setError(null);
    setDisconnected(false);
  }, [closePeerConnection]);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    for (const t of tracks) {
      t.enabled = !t.enabled;
    }
    const anyOn = tracks.some((t) => t.enabled);
    setMicActive(anyOn);
    broadcastStatus({ micActive: anyOn });
    updateParticipants();
  }, [broadcastStatus, updateParticipants]);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;

    if (screenSharing || screenStreamRef.current) {
      const next = !camActive;
      setCamActive(next);
      broadcastStatus({ camActive: next });
      updateParticipants();
      return;
    }

    const tracks = localStreamRef.current.getVideoTracks();
    for (const t of tracks) {
      t.enabled = !t.enabled;
    }
    const anyOn = tracks.some((t) => t.enabled);
    setCamActive(anyOn);
    broadcastStatus({ camActive: anyOn });
    updateParticipants();
  }, [camActive, screenSharing, broadcastStatus, updateParticipants]);

  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  return {
    localStream,
    screenStream,
    screenSharing,
    participants,
    isConnected,
    isJoining,
    isReconnecting,
    startingScreenShare,
    micActive,
    camActive,
    error,
    chatMessages,
    unreadChatCount,
    toast,
    disconnected,
    peersStatus,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    startScreenShare,
    stopScreenShare,
    sendChatMessage,
    leaveRoom,
    resetUnreadChat,
    markChatPanelOpen
  };
}
