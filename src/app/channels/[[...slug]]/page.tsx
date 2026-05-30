"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useServer } from "@/context/ServerContext";
import Modals from "@/app/components/Modals";
import styles from "./dashboard.module.css";
import {
  Hash,
  Volume2,
  Video,
  Plus,
  Compass,
  Settings,
  Mic,
  MicOff,
  Headphones,
  LogOut,
  Send,
  MessageSquare,
  Users,
  Bell,
  Pin,
  PinOff,
  Search,
  HelpCircle,
  PhoneOff,
  VideoOff,
  Monitor,
  Edit2,
  Trash,
  ChevronDown,
  Maximize2,
  Minimize2,
  X
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

interface VideoFeedProps {
  stream: MediaStream | null;
  className?: string;
  muted?: boolean;
}

const VideoFeed = ({ stream, className, muted = true }: VideoFeedProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => console.error("Video play error", err));
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      className={className}
      muted={muted}
      playsInline
      autoPlay
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

// Invisible audio element for playing remote peer audio
const AudioPlayer = ({ stream, muted = false }: { stream: MediaStream | null; muted?: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [stream]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);
  if (!stream) return null;
  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
};


export default function DashboardPage({ params }: PageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    servers,
    activeServer,
    activeChannel,
    messages,
    activeVoiceChannel,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    voiceParticipants,
    setActiveModal,
    setModalTargetChannel,
    selectServer,
    selectChannel,
    sendMessage,
    editMessage,
    deleteMessage,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    joinServerByInvite
  } = useServer();

  const [inputVal, setInputVal] = useState("");
  const [searchVal, setSearchVal] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInputVal, setEditInputVal] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  // Speaking state: set of userIds currently speaking
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  // VAD (Voice Activity Detection) refs
  const localVadRef = useRef<{ audioCtx: AudioContext; analyser: AnalyserNode; interval: ReturnType<typeof setInterval> } | null>(null);
  const remoteVadRefs = useRef<{ [userId: string]: { audioCtx: AudioContext; analyser: AnalyserNode; interval: ReturnType<typeof setInterval> } }>({});

  const stopLocalVAD = () => {
    if (localVadRef.current) {
      clearInterval(localVadRef.current.interval);
      localVadRef.current.audioCtx.close().catch(() => {});
      localVadRef.current = null;
    }
  };

  const startLocalVAD = (stream: MediaStream) => {
    stopLocalVAD();
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const isSpeaking = avg > 10; // threshold
        setSpeakingUsers(prev => {
          const next = new Set(prev);
          if (isSpeaking) next.add("self");
          else next.delete("self");
          return next;
        });
      }, 150);
      localVadRef.current = { audioCtx, analyser, interval };
    } catch (_e) { /* no audio context */ }
  };

  const startRemoteVAD = (userId: string, stream: MediaStream) => {
    // Clean up existing
    if (remoteVadRefs.current[userId]) {
      clearInterval(remoteVadRefs.current[userId].interval);
      remoteVadRefs.current[userId].audioCtx.close().catch(() => {});
      delete remoteVadRefs.current[userId];
    }
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setSpeakingUsers(prev => {
          const next = new Set(prev);
          if (avg > 8) next.add(userId);
          else next.delete(userId);
          return next;
        });
      }, 150);
      remoteVadRefs.current[userId] = { audioCtx, analyser, interval };
    } catch (_e) { /* no audio context */ }
  };

  // Handle turning Camera on/off (video-only track; audio handled separately)
  useEffect(() => {
    const toggleCameraStream = async () => {
      if (isCameraOn && activeVoiceChannel) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          setLocalStream(stream);
        } catch (err) {
          console.error("Error accessing camera", err);
          toggleCamera();
        }
      } else {
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
          setLocalStream(null);
        }
      }
    };

    toggleCameraStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraOn, activeVoiceChannel]);

  // Capture microphone when joining a voice channel; release when leaving
  useEffect(() => {
    if (activeVoiceChannel) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          // Apply initial mute state
          stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
          setMicStream(stream);
          startLocalVAD(stream);
        })
        .catch(err => console.error("Mic access denied", err));
    } else {
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        setMicStream(null);
      }
      stopLocalVAD();
      // Clean up all remote VADs
      Object.values(remoteVadRefs.current).forEach(v => {
        clearInterval(v.interval);
        v.audioCtx.close().catch(() => {});
      });
      remoteVadRefs.current = {};
      setSpeakingUsers(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVoiceChannel]);

  // Apply mute/unmute to mic track in real time
  useEffect(() => {
    if (micStream) {
      micStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
      // Restart VAD only if unmuted
      if (!isMuted) startLocalVAD(micStream);
      else stopLocalVAD();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted, micStream]);

  // Handle turning Screen Share on/off
  useEffect(() => {
    const toggleScreenStream = async () => {
      if (isScreenSharing && activeVoiceChannel) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          setScreenStream(stream);
          
          stream.getVideoTracks()[0].onended = () => {
            toggleScreenShare();
          };
        } catch (err) {
          console.error("Error sharing screen", err);
          toggleScreenShare();
        }
      } else {
        if (screenStream) {
          screenStream.getTracks().forEach((track) => track.stop());
          setScreenStream(null);
        }
      }
    };

    toggleScreenStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScreenSharing, activeVoiceChannel]);

  // Clean up streams when leaving voice channel
  useEffect(() => {
    if (!activeVoiceChannel) {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
      }
    }
  }, [activeVoiceChannel]);

  const [realParticipants, setRealParticipants] = useState<{ [userId: string]: { username: string; avatarUrl: string; isCameraOn: boolean; isScreenSharing: boolean } }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [userId: string]: MediaStream }>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<{ [userId: string]: MediaStream }>({});
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<{ [userId: string]: MediaStream }>({});

  // Mic stream ref for callbacks
  const micStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => { micStreamRef.current = micStream; }, [micStream]);

  // Audio peer connection maps
  const outgoingAudioPeersRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const incomingAudioPeersRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});

  // Pin / fullscreen state — cardId format: "cam:{userId}" | "screen:{userId}" | "screen:self"
  const [pinnedCard, setPinnedCard] = useState<string | null>(null);
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);

  const togglePin = (cardId: string) => setPinnedCard(prev => prev === cardId ? null : cardId);

  const openFullscreen = (cardId: string) => {
    setFullscreenCard(cardId);
    // Request native browser fullscreen on the overlay element after render
    setTimeout(() => {
      const el = document.getElementById("fs-overlay");
      if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    }, 50);
  };

  const closeFullscreen = () => {
    setFullscreenCard(null);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  // Sync native fullscreen exit (e.g. Escape key) back to state
  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setFullscreenCard(null); };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Helper: resolve the MediaStream for a given cardId
  const resolveStream = (cardId: string): MediaStream | null => {
    if (!cardId) return null;
    if (cardId === "screen:self") return screenStream;
    if (cardId.startsWith("cam:")) {
      const uid = cardId.slice(4);
      if (uid === user?._id) return localStream;
      return remoteStreams[uid] ?? null;
    }
    if (cardId.startsWith("screen:")) {
      return remoteScreenStreams[cardId.slice(7)] ?? null;
    }
    return null;
  };

  // Camera peer connection maps
  const outgoingPeersRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const incomingPeersRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  // Screen share peer connection maps (completely independent from camera)
  const outgoingScreenPeersRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const incomingScreenPeersRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollTimeRef = useRef<number>(Date.now());
  // Refs so polling callbacks always see current values
  const activeVoiceChannelRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const realParticipantsRef = useRef<typeof realParticipants>({});
  const isCameraOnRef = useRef(false);
  const isScreenSharingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { activeVoiceChannelRef.current = activeVoiceChannel; }, [activeVoiceChannel]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);
  useEffect(() => { realParticipantsRef.current = realParticipants; }, [realParticipants]);
  useEffect(() => { isCameraOnRef.current = isCameraOn; }, [isCameraOn]);
  useEffect(() => { isScreenSharingRef.current = isScreenSharing; }, [isScreenSharing]);

  // ── Signaling helpers (HTTP instead of BroadcastChannel) ──────────────────

  const sendSignal = async (to: string | null, payload: any) => {
    if (!user || !activeVoiceChannelRef.current) return;
    try {
      await fetch("/api/signaling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: activeVoiceChannelRef.current,
          from: user._id,
          to,          // null = broadcast to all
          payload,
        }),
      });
    } catch (e) {
      console.error("sendSignal error", e);
    }
  };

  // ── Peer connection helpers ───────────────────────────────────────────────

  const initiateOutgoingConnection = async (peerId: string, stream: MediaStream) => {
    if (!user) return;
    const existing = outgoingPeersRef.current[peerId];
    if (existing) { existing.close(); }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    outgoingPeersRef.current[peerId] = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, { type: "candidate", connectionType: "outgoing", candidate: event.candidate });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { type: "offer", offer });
    } catch (err) {
      console.error("initiateOutgoingConnection error", err);
    }
  };

  const handleIncomingOffer = async (peerId: string, offer: any) => {
    if (!user) return;
    const existing = incomingPeersRef.current[peerId];
    if (existing) { existing.close(); }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    incomingPeersRef.current[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, { type: "candidate", connectionType: "incoming", candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;
      setRemoteStreams(prev => ({ ...prev, [peerId]: remoteStream }));
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(peerId, { type: "answer", answer });
    } catch (err) {
      console.error("handleIncomingOffer error", err);
    }
  };

  // ── Screen share peer connection helpers (mirrors camera but uses screen-* signal types) ─

  const initiateOutgoingScreenConnection = async (peerId: string, stream: MediaStream) => {
    if (!user) return;
    const existing = outgoingScreenPeersRef.current[peerId];
    if (existing) { existing.close(); }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    outgoingScreenPeersRef.current[peerId] = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, { type: "screen-candidate", connectionType: "outgoing", candidate: event.candidate });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { type: "screen-offer", offer });
    } catch (err) {
      console.error("initiateOutgoingScreenConnection error", err);
    }
  };

  const handleIncomingScreenOffer = async (peerId: string, offer: any) => {
    if (!user) return;
    const existing = incomingScreenPeersRef.current[peerId];
    if (existing) { existing.close(); }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    incomingScreenPeersRef.current[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, { type: "screen-candidate", connectionType: "incoming", candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;
      setRemoteScreenStreams(prev => ({ ...prev, [peerId]: remoteStream }));
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(peerId, { type: "screen-answer", answer });
    } catch (err) {
      console.error("handleIncomingScreenOffer error", err);
    }
  };

  // ── Audio-only peer connection helpers ───────────────────────────────────

  const initiateOutgoingAudioConnection = async (peerId: string, stream: MediaStream) => {
    if (!user) return;
    const existing = outgoingAudioPeersRef.current[peerId];
    if (existing) { existing.close(); }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    outgoingAudioPeersRef.current[peerId] = pc;
    stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, { type: "audio-candidate", connectionType: "outgoing", candidate: event.candidate });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { type: "audio-offer", offer });
    } catch (err) {
      console.error("initiateOutgoingAudioConnection error", err);
    }
  };

  const handleIncomingAudioOffer = async (peerId: string, offer: any) => {
    if (!user) return;
    const existing = incomingAudioPeersRef.current[peerId];
    if (existing) { existing.close(); }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    incomingAudioPeersRef.current[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, { type: "audio-candidate", connectionType: "incoming", candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;
      setRemoteAudioStreams(prev => ({ ...prev, [peerId]: remoteStream }));
      startRemoteVAD(peerId, remoteStream);
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(peerId, { type: "audio-answer", answer });
    } catch (err) {
      console.error("handleIncomingAudioOffer error", err);
    }
  };

  const handleMessage = async (from: string, payload: any) => {
    if (!user) return;
    const { type, offer, answer, candidate, connectionType, username, avatarUrl, isCameraOn: peerCam, isScreenSharing: peerScreen } = payload;

    if (type === "join") {
      setRealParticipants(prev => ({
        ...prev,
        [from]: { username, avatarUrl, isCameraOn: !!peerCam, isScreenSharing: !!peerScreen },
      }));
      sendSignal(from, {
        type: "join-ack",
        username: user.username,
        avatarUrl: user.avatarUrl,
        isCameraOn: isCameraOnRef.current,
        isScreenSharing: isScreenSharingRef.current,
      });
      if (localStreamRef.current) {
        initiateOutgoingConnection(from, localStreamRef.current);
      }
      if (screenStreamRef.current && isScreenSharingRef.current) {
        initiateOutgoingScreenConnection(from, screenStreamRef.current);
      }
      // Send audio
      if (micStreamRef.current) {
        initiateOutgoingAudioConnection(from, micStreamRef.current);
      }
    } else if (type === "join-ack") {
      setRealParticipants(prev => ({
        ...prev,
        [from]: { username, avatarUrl, isCameraOn: !!peerCam, isScreenSharing: !!peerScreen },
      }));
      if (localStreamRef.current) {
        initiateOutgoingConnection(from, localStreamRef.current);
      }
      if (screenStreamRef.current && isScreenSharingRef.current) {
        initiateOutgoingScreenConnection(from, screenStreamRef.current);
      }
      // Send audio
      if (micStreamRef.current) {
        initiateOutgoingAudioConnection(from, micStreamRef.current);
      }
    } else if (type === "leave") {
      const pcOut = outgoingPeersRef.current[from]; if (pcOut) pcOut.close(); delete outgoingPeersRef.current[from];
      const pcIn = incomingPeersRef.current[from]; if (pcIn) pcIn.close(); delete incomingPeersRef.current[from];
      const pcSOut = outgoingScreenPeersRef.current[from]; if (pcSOut) pcSOut.close(); delete outgoingScreenPeersRef.current[from];
      const pcSIn = incomingScreenPeersRef.current[from]; if (pcSIn) pcSIn.close(); delete incomingScreenPeersRef.current[from];
      const pcAOut = outgoingAudioPeersRef.current[from]; if (pcAOut) pcAOut.close(); delete outgoingAudioPeersRef.current[from];
      const pcAIn = incomingAudioPeersRef.current[from]; if (pcAIn) pcAIn.close(); delete incomingAudioPeersRef.current[from];
      // Clean up remote VAD
      if (remoteVadRefs.current[from]) {
        clearInterval(remoteVadRefs.current[from].interval);
        remoteVadRefs.current[from].audioCtx.close().catch(() => {});
        delete remoteVadRefs.current[from];
      }
      setSpeakingUsers(prev => { const next = new Set(prev); next.delete(from); return next; });
      setRealParticipants(prev => { const c = { ...prev }; delete c[from]; return c; });
      setRemoteStreams(prev => { const c = { ...prev }; delete c[from]; return c; });
      setRemoteScreenStreams(prev => { const c = { ...prev }; delete c[from]; return c; });
      setRemoteAudioStreams(prev => { const c = { ...prev }; delete c[from]; return c; });
    } else if (type === "offer") {
      handleIncomingOffer(from, offer);
    } else if (type === "answer") {
      const pc = outgoingPeersRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
    } else if (type === "candidate") {
      const pc = connectionType === "outgoing" ? incomingPeersRef.current[from] : outgoingPeersRef.current[from];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    } else if (type === "screen-offer") {
      handleIncomingScreenOffer(from, offer);
    } else if (type === "screen-answer") {
      const pc = outgoingScreenPeersRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
    } else if (type === "screen-candidate") {
      const pc = connectionType === "outgoing" ? incomingScreenPeersRef.current[from] : outgoingScreenPeersRef.current[from];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    } else if (type === "audio-offer") {
      handleIncomingAudioOffer(from, offer);
    } else if (type === "audio-answer") {
      const pc = outgoingAudioPeersRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
    } else if (type === "audio-candidate") {
      const pc = connectionType === "outgoing" ? incomingAudioPeersRef.current[from] : outgoingAudioPeersRef.current[from];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    } else if (type === "state-update") {
      setRealParticipants(prev => {
        if (!prev[from]) return prev;
        return { ...prev, [from]: { ...prev[from], isCameraOn: !!peerCam, isScreenSharing: !!peerScreen } };
      });
    }
  };

  // ── Polling loop ──────────────────────────────────────────────────────────

  const startPolling = (channelId: string, userId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    lastPollTimeRef.current = Date.now() - 500;

    const poll = async () => {
      try {
        const since = lastPollTimeRef.current;
        lastPollTimeRef.current = Date.now();
        const res = await fetch(`/api/signaling?channelId=${encodeURIComponent(channelId)}&userId=${encodeURIComponent(userId)}&since=${since}`);
        if (!res.ok) return;
        const { messages } = await res.json();
        for (const msg of messages) {
          await handleMessage(msg.from, msg.payload);
        }
      } catch (_e) { /* network blip */ }
    };

    pollIntervalRef.current = setInterval(poll, 800);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
  };

  // ── Join/leave effect ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !activeVoiceChannel) return;

    startPolling(activeVoiceChannel, user._id);
    sendSignal(null, {
      type: "join",
      username: user.username,
      avatarUrl: user.avatarUrl,
      isCameraOn,
      isScreenSharing,
    });

    return () => {
      sendSignal(null, { type: "leave" });
      stopPolling();
      Object.values(outgoingPeersRef.current).forEach(pc => pc.close());
      Object.values(incomingPeersRef.current).forEach(pc => pc.close());
      Object.values(outgoingScreenPeersRef.current).forEach(pc => pc.close());
      Object.values(incomingScreenPeersRef.current).forEach(pc => pc.close());
      Object.values(outgoingAudioPeersRef.current).forEach(pc => pc.close());
      Object.values(incomingAudioPeersRef.current).forEach(pc => pc.close());
      outgoingPeersRef.current = {};
      incomingPeersRef.current = {};
      outgoingScreenPeersRef.current = {};
      incomingScreenPeersRef.current = {};
      outgoingAudioPeersRef.current = {};
      incomingAudioPeersRef.current = {};
      setRealParticipants({});
      setRemoteStreams({});
      setRemoteScreenStreams({});
      setRemoteAudioStreams({});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVoiceChannel, user]);

  // When camera turns on/off, push camera stream to all current peers
  useEffect(() => {
    if (!user || !activeVoiceChannel) return;
    sendSignal(null, { type: "state-update", isCameraOn, isScreenSharing });
    if (localStream) {
      Object.keys(realParticipantsRef.current).forEach(peerId => {
        initiateOutgoingConnection(peerId, localStream);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraOn, localStream, user]);

  // When mic stream is ready, push audio to all current peers
  useEffect(() => {
    if (!user || !activeVoiceChannel || !micStream) return;
    Object.keys(realParticipantsRef.current).forEach(peerId => {
      initiateOutgoingAudioConnection(peerId, micStream);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micStream, user]);

  // When screen share turns on/off, push screen stream to all current peers
  useEffect(() => {
    if (!user || !activeVoiceChannel) return;
    sendSignal(null, { type: "state-update", isCameraOn, isScreenSharing });
    if (screenStream && isScreenSharing) {
      Object.keys(realParticipantsRef.current).forEach(peerId => {
        initiateOutgoingScreenConnection(peerId, screenStream);
      });
    } else if (!isScreenSharing) {
      // Tear down outgoing screen connections when stopped
      Object.keys(outgoingScreenPeersRef.current).forEach(peerId => {
        outgoingScreenPeersRef.current[peerId].close();
        delete outgoingScreenPeersRef.current[peerId];
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScreenSharing, screenStream, user]);

  const displayedParticipants = React.useMemo(() => {
    if (!user) return [];
    const self = {
      username: user.username,
      avatarUrl: user.avatarUrl,
      speaking: false,
      video: isCameraOn,
      isSelf: true,
      userId: user._id
    };

    const realList = Object.entries(realParticipants).map(([peerId, data]) => ({
      username: data.username,
      avatarUrl: data.avatarUrl,
      speaking: false,
      video: data.isCameraOn,
      isSelf: false,
      userId: peerId
    }));

    const simulatedList = voiceParticipants
      .filter(p => p.username !== user.username && !realList.some(r => r.username === p.username))
      .map(p => ({
        username: p.username,
        avatarUrl: p.avatarUrl,
        speaking: p.speaking,
        video: p.video,
        isSelf: false,
        userId: "simulated-" + p.username
      }));

    return [self, ...realList, ...simulatedList];
  }, [voiceParticipants, realParticipants, user, isCameraOn]);

  // 1. Resolve Next.js 16 params & sync state with URL route
  useEffect(() => {
    const syncRoute = async () => {
      const resolvedParams = await params;
      const slug = resolvedParams.slug;
      
      if (!slug || slug.length === 0) {
        router.push("/channels/@me");
        return;
      }

      if (slug[0] === "@me") {
        // We are on DMs / Home
        // No server selected
      } else if (slug.length >= 2) {
        // We are on a server and channel
        const serverId = slug[0];
        const channelId = slug[1];
        
        // Context selection
        selectServer(serverId);
        selectChannel(channelId);
      }
    };
    
    syncRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, servers]);

  // 2. Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (authLoading) {
    return (
      <div style={{ display: "flex", width: "100vw", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-tertiary)" }}>
        <h2 style={{ color: "var(--accent-blurple)", fontWeight: "600", fontSize: "20px" }}>Loading Discord...</h2>
      </div>
    );
  }

  if (!user) return null;

  // Handle message send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const val = inputVal;
    setInputVal("");
    await sendMessage(val);
  };

  // Handle message edit submission
  const handleEditMessageSubmit = async (messageId: string) => {
    if (!editInputVal.trim()) return;
    const res = await editMessage(messageId, editInputVal);
    if (res.success) {
      setEditingMessageId(null);
      setEditInputVal("");
    }
  };

  // Join server by invite input in DM view
  const handleInviteJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    
    // Extract code if user pasted full URL
    let code = inviteInput.trim();
    if (code.includes("/invite/")) {
      code = code.split("/invite/")[1];
    }

    const res = await joinServerByInvite(code);
    if (res.success && res.serverId) {
      setInviteInput("");
      router.push(`/channels/${res.serverId}/general`);
    } else {
      alert(res.error || "Invalid invite code");
    }
  };

  const handleChannelSelectClick = (serverId: string, channel: any) => {
    if (channel.type === "VOICE" || channel.type === "VIDEO") {
      joinVoiceChannel(channel.id);
    }
    router.push(`/channels/${serverId}/${channel.id}`);
  };

  const handleBringVoiceToFront = () => {
    if (activeServer && activeVoiceChannel) {
      router.push(`/channels/${activeServer._id}/${activeVoiceChannel}`);
    }
  };

  return (
    <div className={styles.container}>
      
      {/* 1. Server List Column (Leftmost) */}
      <div className={styles.serverList}>
        
        {/* Direct Messages Home Button */}
        <div
          className={`${styles.serverIconContainer} ${!activeServer ? styles.serverIconContainerActive : ""}`}
          onClick={() => {
            selectServer("");
            router.push("/channels/@me");
          }}
          title="Direct Messages"
        >
          <div className={styles.serverPill}></div>
          <div className={`${styles.serverIcon} ${!activeServer ? styles.serverIconActive : ""}`}>
            <svg width="28" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c2.06-1.5,4.07-3.12,6-4.82a75.14,75.14,0,0,0,86,0c1.9,1.7,3.91,3.32,6,4.82a68.43,68.43,0,0,1-10.5,5A77.7,77.7,0,0,0,111.42,96.36a105.73,105.73,0,0,0,31-18.83C145.47,54.65,139.95,31.58,107.7,8.07Z" />
            </svg>
          </div>
        </div>

        <div className={styles.divider}></div>

        {/* Server Icons Map */}
        {servers.map((s) => {
          const isActive = activeServer?._id === s._id;
          const initials = s.name.split(" ").map(w => w[0]).join("").substring(0, 3).toUpperCase();
          return (
            <div
              key={s._id}
              className={`${styles.serverIconContainer} ${isActive ? styles.serverIconContainerActive : ""}`}
              onClick={() => selectServer(s._id)}
              title={s.name}
            >
              <div className={styles.serverPill}></div>
              {s.imageUrl && !s.imageUrl.startsWith("https://api.dicebear.com") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.imageUrl}
                  alt={s.name}
                  className={`${styles.serverIcon} ${isActive ? styles.serverIconActive : ""}`}
                />
              ) : (
                <div className={`${styles.serverIcon} ${isActive ? styles.serverIconActive : ""}`}>
                  {initials}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Server Button */}
        <button
          className={styles.actionIcon}
          onClick={() => setActiveModal("createServer")}
          title="Add a Server"
        >
          <Plus size={24} />
        </button>

      </div>

      {/* 2. Channel Sidebar Column */}
      <div className={styles.channelSidebar}>
        {activeServer ? (
          <>
            {/* Server Header Dropdown */}
            <div
              className={styles.serverHeader}
              onClick={() => setIsServerDropdownOpen(!isServerDropdownOpen)}
            >
              <span>{activeServer.name}</span>
              <ChevronDown size={18} />
              
              {isServerDropdownOpen && (
                <div className={styles.dropdownMenu} onMouseLeave={() => setIsServerDropdownOpen(false)}>
                  <div
                    className={`${styles.dropdownItem} ${styles.dropdownItemInvite}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsServerDropdownOpen(false);
                      setActiveModal("invite");
                    }}
                  >
                    Invite People <Plus size={16} />
                  </div>
                  {(activeServer.ownerId === user._id || activeServer.members.find(m => m.userId?._id === user._id)?.role === "ADMIN") && (
                    <>
                      <div
                        className={styles.dropdownItem}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsServerDropdownOpen(false);
                          setActiveModal("editServer");
                        }}
                      >
                        Server Settings <Settings size={16} />
                      </div>
                      <div
                        className={styles.dropdownItem}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsServerDropdownOpen(false);
                          setActiveModal("createChannel");
                        }}
                      >
                        Create Channel <Plus size={16} />
                      </div>
                      <div
                        className={styles.dropdownItem}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsServerDropdownOpen(false);
                          setActiveModal("members");
                        }}
                      >
                        Manage Members <Users size={16} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Channels List */}
            <div className={styles.channelList}>
              {/* Group channels by categories */}
              {Array.from(new Set(activeServer.channels.map((c) => c.category))).map((categoryName) => (
                <div key={categoryName} className={styles.categoryGroup}>
                  <div className={styles.categoryHeader}>
                    <span>{categoryName}</span>
                    <Plus
                      size={14}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModal("createChannel");
                      }}
                    />
                  </div>
                  {activeServer.channels
                    .filter((c) => c.category === categoryName)
                    .map((channel) => {
                      const isActive = activeChannel?.id === channel.id;
                      return (
                        <div
                          key={channel.id}
                          className={`${styles.channelItem} ${isActive ? styles.channelItemActive : ""}`}
                          onClick={() => handleChannelSelectClick(activeServer._id, channel)}
                        >
                          <div className={styles.channelInfo}>
                            {channel.type === "TEXT" && <Hash size={18} />}
                            {channel.type === "VOICE" && <Volume2 size={18} />}
                            {channel.type === "VIDEO" && <Video size={18} />}
                            <span>{channel.name}</span>
                          </div>
                          
                          {(activeServer.ownerId === user._id || activeServer.members.find(m => m.userId?._id === user._id)?.role === "ADMIN") && (
                            <div className={styles.channelActions}>
                              <Settings
                                size={14}
                                className={styles.channelActionIcon}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalTargetChannel(channel);
                                  setActiveModal("editChannel");
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* DM / Home View Channel Sidebar */}
            <div className={styles.serverHeader}>
              <span>Direct Messages</span>
            </div>
            <div className={styles.channelList}>
              <div
                className={`${styles.channelItem} ${styles.channelItemActive}`}
                onClick={() => router.push("/channels/@me")}
              >
                <div className={styles.channelInfo}>
                  <Compass size={18} />
                  <span>Friends & Communities</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Voice Connected Status Bar */}
        {activeVoiceChannel && (
          <div className={styles.voiceConnectionBar}>
            <div className={styles.voiceConnInfo} onClick={handleBringVoiceToFront}>
              <span className={styles.voiceConnStatus}>
                <span className={styles.voiceConnIndicator}></span> Voice Connected
              </span>
              <span className={styles.voiceConnChannel}>
                {activeServer?.name} / {activeServer?.channels.find(c => c.id === activeVoiceChannel)?.name || "Voice Channel"}
              </span>
            </div>
            <div className={styles.voiceConnControls}>
              <button className={styles.voiceConnBtn} onClick={leaveVoiceChannel} title="Disconnect">
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        )}

        {/* User Footer Panel */}
        <div className={styles.userFooter}>
          <div className={styles.userInfo} onClick={() => setActiveModal("userSettings")}>
            <div className={styles.avatarWrapper}>
              <img src={user.avatarUrl} alt="Avatar" className={styles.avatar} />
              <div className={`${styles.statusDot} ${styles[`statusDot${user.status.charAt(0).toUpperCase() + user.status.slice(1)}`]}`}></div>
            </div>
            <div className={styles.userText}>
              <span className={styles.username}>{user.username}</span>
              <span className={styles.userSubtext}>{user.customStatus || `#${user._id.substring(user._id.length - 4)}`}</span>
            </div>
          </div>
          
          <div className={styles.userControls}>
            <button
              className={`${styles.controlBtn} ${isMuted ? styles.controlBtnActive : ""}`}
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              className={`${styles.controlBtn} ${isDeafened ? styles.controlBtnActive : ""}`}
              onClick={toggleDeafen}
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              <Headphones size={18} />
            </button>
            <button
              className={styles.controlBtn}
              onClick={() => setActiveModal("userSettings")}
              title="User Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Chat View or Voice/Video Grid */}
      {activeServer && activeChannel ? (
        <div className={styles.chatArea}>
          
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.headerTitle}>
              {activeChannel.type === "TEXT" && <Hash className={styles.headerTextHash} size={22} />}
              {activeChannel.type === "VOICE" && <Volume2 className={styles.headerTextHash} size={22} />}
              {activeChannel.type === "VIDEO" && <Video className={styles.headerTextHash} size={22} />}
              <span>{activeChannel.name}</span>
            </div>
            
            <div className={styles.headerControls}>
              <button title="Start Thread"><MessageSquare size={20} /></button>
              <button title="Notification Settings"><Bell size={20} /></button>
              <button title="Pinned Messages"><Pin size={20} /></button>
              
              <div className={styles.searchBar}>
                <input
                  type="text"
                  placeholder="Search"
                  className={styles.searchInput}
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                />
                <Search size={16} />
              </div>
              
              <button title="Help"><HelpCircle size={20} /></button>
            </div>
          </div>

          {/* Render Text Message Feed or Video/Voice simulation screen */}
          {activeVoiceChannel && (activeChannel.type === "VOICE" || activeChannel.type === "VIDEO") ? (
            // Voice & Video call interface
            <div className={styles.voiceGridContainer}>

              {/* ── Fullscreen overlay ── */}
              {fullscreenCard && (
                <div id="fs-overlay" className={styles.fullscreenOverlay}>
                  <div className={styles.fullscreenVideo}>
                    {(() => {
                      const fsStream = resolveStream(fullscreenCard);
                      return fsStream
                        ? <VideoFeed stream={fsStream} muted={fullscreenCard.startsWith("cam:") && fullscreenCard.slice(4) === user._id} />
                        : <div style={{color:"#fff",fontSize:18}}>Stream unavailable</div>;
                    })()}
                  </div>
                  <button className={styles.fsCloseBtn} onClick={closeFullscreen} title="Exit fullscreen">
                    <Minimize2 size={22} />
                  </button>
                </div>
              )}

              {/* ── Main grid (pinned or auto-fit) ── */}
              <div className={pinnedCard ? styles.voiceGridPinned : styles.voiceGrid}>

                {/* Pinned focused view */}
                {pinnedCard && (() => {
                  const pinnedStream = resolveStream(pinnedCard);
                  const label = pinnedCard === "screen:self"
                    ? `${user.username}'s Screen`
                    : pinnedCard.startsWith("screen:")
                      ? `${realParticipants[pinnedCard.slice(7)]?.username ?? ""}'s Screen`
                      : pinnedCard.startsWith("cam:")
                        ? (pinnedCard.slice(4) === user._id ? user.username : realParticipants[pinnedCard.slice(4)]?.username ?? "")
                        : "";
                  return (
                    <div className={styles.pinnedFocus}>
                      {pinnedStream
                        ? <VideoFeed stream={pinnedStream} muted={pinnedCard === `cam:${user._id}`} />
                        : <div style={{color:"#aaa",display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>Stream unavailable</div>}
                      <div className={styles.participantNameTag}>{label} 📌 Pinned</div>
                      <div className={styles.cardActions}>
                        <button className={styles.cardActionBtn} onClick={() => togglePin(pinnedCard)} title="Unpin"><PinOff size={16}/></button>
                        <button className={styles.cardActionBtn} onClick={() => openFullscreen(pinnedCard)} title="Fullscreen"><Maximize2 size={16}/></button>
                      </div>
                    </div>
                  );
                })()}

                {/* Strip / full grid of participant camera cards */}
                <div className={pinnedCard ? styles.voiceGridStrip : styles.voiceGridInner}>
                  {displayedParticipants.map((p, idx) => {
                    const isSelf = p.isSelf;
                    const isSimulated = p.userId.toString().startsWith("simulated-");
                    const camStream = isSelf ? localStream : (!isSimulated ? remoteStreams[p.userId] ?? null : null);
                    const cardId = `cam:${p.userId}`;
                    const isPinned = pinnedCard === cardId;

                    return (
                      <div
                        key={idx}
                        className={`${styles.participantCard} ${p.speaking || speakingUsers.has(isSelf ? "self" : p.userId) ? styles.participantCardSpeaking : ""} ${isPinned ? styles.participantCardPinned : ""}`}
                      >
                        {p.video && camStream ? (
                          <div className={styles.participantVideoFeed}>
                            <VideoFeed stream={camStream} muted={isSelf} />
                          </div>
                        ) : p.video ? (
                          <div className={styles.participantVideoFeed}>
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1e1f22 0%, #2b2d31 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <img src={p.avatarUrl} alt="Avatar" className={styles.participantAvatarLarge} style={{ animation: "pulse 2s infinite" }} />
                              <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", color: "#23a55a", fontWeight: "600" }}>🟢 LIVE</div>
                            </div>
                          </div>
                        ) : (
                          <img src={p.avatarUrl} alt="Avatar" className={styles.participantAvatarLarge} />
                        )}
                        <div className={styles.participantNameTag}>
                          {p.username}{p.speaking && " 🎙️"}
                        </div>
                        {/* Hover actions */}
                        <div className={styles.cardActions}>
                          <button className={styles.cardActionBtn} onClick={() => togglePin(cardId)} title={isPinned ? "Unpin" : "Pin"}>
                            {isPinned ? <PinOff size={15}/> : <Pin size={15}/>}
                          </button>
                          {camStream && (
                            <button className={styles.cardActionBtn} onClick={() => openFullscreen(cardId)} title="Fullscreen"><Maximize2 size={15}/></button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Self screen share card */}
                  {isScreenSharing && screenStream && (() => {
                    const cardId = "screen:self";
                    const isPinned = pinnedCard === cardId;
                    return (
                      <div className={`${styles.participantCard} ${isPinned ? styles.participantCardPinned : ""}`} style={{ gridColumn: "span 2", aspectRatio: "16/9" }}>
                        <div className={styles.participantVideoFeed}>
                          <VideoFeed stream={screenStream} muted={true} />
                        </div>
                        <div className={styles.participantNameTag}>{user.username}&apos;s Screen 🖥️</div>
                        <div className={styles.cardActions}>
                          <button className={styles.cardActionBtn} onClick={() => togglePin(cardId)} title={isPinned?"Unpin":"Pin"}>
                            {isPinned ? <PinOff size={15}/> : <Pin size={15}/>}
                          </button>
                          <button className={styles.cardActionBtn} onClick={() => openFullscreen(cardId)} title="Fullscreen"><Maximize2 size={15}/></button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Hidden audio players for remote peers */}
                  {Object.entries(remoteAudioStreams).map(([peerId, audioStr]) => (
                    <AudioPlayer key={`audio-${peerId}`} stream={audioStr} muted={isDeafened} />
                  ))}
                  {Object.entries(remoteScreenStreams).map(([peerId, screenStr]) => {
                    const peerData = realParticipants[peerId];
                    if (!peerData || !screenStr) return null;
                    const cardId = `screen:${peerId}`;
                    const isPinned = pinnedCard === cardId;
                    return (
                      <div key={cardId} className={`${styles.participantCard} ${isPinned ? styles.participantCardPinned : ""}`} style={{ gridColumn: "span 2", aspectRatio: "16/9" }}>
                        <div className={styles.participantVideoFeed}>
                          <VideoFeed stream={screenStr} muted={false} />
                        </div>
                        <div className={styles.participantNameTag}>{peerData.username}&apos;s Screen 🖥️</div>
                        <div className={styles.cardActions}>
                          <button className={styles.cardActionBtn} onClick={() => togglePin(cardId)} title={isPinned?"Unpin":"Pin"}>
                            {isPinned ? <PinOff size={15}/> : <Pin size={15}/>}
                          </button>
                          <button className={styles.cardActionBtn} onClick={() => openFullscreen(cardId)} title="Fullscreen"><Maximize2 size={15}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Voice Floating Controls Dock */}
              <div className={styles.voiceControlsBar}>
                <button
                  className={`${styles.voiceControlBtn} ${isCameraOn ? styles.voiceControlBtnActive : ""}`}
                  onClick={toggleCamera}
                  title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                >
                  {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
                <button
                  className={`${styles.voiceControlBtn} ${isScreenSharing ? styles.voiceControlBtnActive : ""}`}
                  onClick={toggleScreenShare}
                  title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                >
                  <Monitor size={20} />
                </button>
                <button
                  className={`${styles.voiceControlBtn} ${isMuted ? styles.voiceControlBtnDanger : ""}`}
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button
                  className={`${styles.voiceControlBtn} ${styles.voiceControlBtnDanger}`}
                  onClick={leaveVoiceChannel}
                  title="Disconnect Call"
                >
                  <PhoneOff size={20} />
                </button>
              </div>
            </div>
          ) : (
            // Regular text channel chat room
            <>
              {/* Message scroll container */}
              <div className={`${styles.messagesContainer} chat-scroll`}>
                
                {/* Welcome channel banner */}
                <div className={styles.welcomeBanner}>
                  <div className={styles.welcomeTitle}>Welcome to #{activeChannel.name}!</div>
                  <div className={styles.welcomeSubtitle}>This is the start of the #{activeChannel.name} channel.</div>
                  <button className={styles.welcomeButton} onClick={() => setActiveModal("invite")}>
                    Invite Friends to Server
                  </button>
                </div>

                {/* Filter and display messages */}
                {messages
                  .filter((m) => !searchVal || m.content.toLowerCase().includes(searchVal.toLowerCase()))
                  .map((msg) => {
                    const isSelfMsg = msg.userId?._id === user._id;
                    const dateFormatted = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={msg._id} className={styles.messageRow}>
                        <img src={msg.userId?.avatarUrl} alt="Avatar" className={styles.messageAvatar} />
                        <div className={styles.messageContentWrapper}>
                          <div className={styles.messageHeader}>
                            <span className={styles.messageSender}>{msg.userId?.username}</span>
                            <span className={styles.messageTime}>{dateFormatted}</span>
                          </div>
                          
                          {editingMessageId === msg._id ? (
                            <div className={styles.messageEditArea}>
                              <input
                                type="text"
                                className={styles.messageEditInput}
                                value={editInputVal}
                                onChange={(e) => setEditInputVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleEditMessageSubmit(msg._id);
                                  else if (e.key === "Escape") setEditingMessageId(null);
                                }}
                                autoFocus
                              />
                              <div className={styles.messageEditActions}>
                                <span className={styles.messageEditBtnCancel} onClick={() => setEditingMessageId(null)}>escape to cancel</span>
                                <span>•</span>
                                <span className={styles.messageEditBtnSave} onClick={() => handleEditMessageSubmit(msg._id)}>enter to save</span>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.messageContent}>{msg.content}</div>
                          )}
                        </div>

                        {/* Hover Action Panel */}
                        <div className={styles.messageActions}>
                          {isSelfMsg && (
                            <button
                              className={styles.msgActionBtn}
                              onClick={() => {
                                setEditingMessageId(msg._id);
                                setEditInputVal(msg.content);
                              }}
                              title="Edit Message"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {(isSelfMsg || activeServer.ownerId === user._id || activeServer.members.find(m => m.userId?._id === user._id)?.role === "ADMIN") && (
                            <button
                              className={`${styles.msgActionBtn} ${styles.msgActionBtnDanger}`}
                              onClick={() => deleteMessage(msg._id)}
                              title="Delete Message"
                            >
                              <Trash size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Field (Fixed bottom) */}
              <div className={styles.inputContainer}>
                <form onSubmit={handleSendMessage} className={styles.inputWrapper}>
                  <Plus size={20} className={styles.inputPlus} />
                  <input
                    type="text"
                    className={styles.chatInput}
                    placeholder={`Message #${activeChannel.name}`}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                  />
                  <button type="submit" style={{ display: "none" }}></button>
                  <Send size={20} className={styles.inputPlus} onClick={handleSendMessage} />
                </form>
              </div>
            </>
          )}

        </div>
      ) : (
        // Clyde Direct Messages view
        <div className={styles.dmContainer}>
          <svg className={styles.dmLogo} width="80" height="80" viewBox="0 0 127.14 96.36" fill="currentColor">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c2.06-1.5,4.07-3.12,6-4.82a75.14,75.14,0,0,0,86,0c1.9,1.7,3.91,3.32,6,4.82a68.43,68.43,0,0,1-10.5,5A77.7,77.7,0,0,0,111.42,96.36a105.73,105.73,0,0,0,31-18.83C145.47,54.65,139.95,31.58,107.7,8.07Z" />
          </svg>
          <h1 className={styles.dmTitle}>No Place Like Home!</h1>
          <p className={styles.dmText}>
            Welcome to Discord! Join an existing server using an invite code below, or create your very own server to start hanging out with friends!
          </p>
          
          <form onSubmit={handleInviteJoinSubmit} style={{ display: "flex", gap: "8px", maxWidth: "400px", width: "100%", marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="Enter invite code (e.g. ABCDEFGH)"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              style={{ flex: 1, background: "var(--bg-secondary-alt)", padding: "12px", borderRadius: "4px", fontSize: "14px", border: "1px solid var(--interactive-muted)" }}
              required
            />
            <button type="submit" className={styles.dmActionButton} style={{ padding: "10px 18px", fontSize: "14px" }}>
              Join Server
            </button>
          </form>

          <button className={styles.dmActionButton} onClick={() => setActiveModal("createServer")}>
            Create a New Server
          </button>
        </div>
      )}

      {/* 4. Server Member Column (Rightmost) */}
      {activeServer && !activeVoiceChannel && (
        <div className={styles.membersSidebar}>
          {/* Active members list */}
          <div className={styles.memberGroupTitle}>Online Members ({activeServer.members.filter(m => m.userId && m.userId.status !== "offline").length})</div>
          {activeServer.members
            .filter((m) => m.userId && m.userId.status !== "offline")
            .map((m) => {
              const nameClass = m.role === "ADMIN" ? styles.memberNameAdmin : m.role === "MODERATOR" ? styles.memberNameMod : "";
              return (
                <div key={m.userId._id} className={styles.memberRow} title={m.userId.username}>
                  <div className={styles.avatarWrapper}>
                    <img src={m.userId.avatarUrl} alt="Avatar" className={styles.avatar} style={{ width: "32px", height: "32px" }} />
                    <div className={`${styles.statusDot} ${styles[`statusDot${m.userId.status.charAt(0).toUpperCase() + m.userId.status.slice(1)}`]}`}></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span className={`${styles.memberName} ${nameClass}`}>{m.userId.username}</span>
                    {m.userId.customStatus && <span className={styles.memberCustomStatus}>{m.userId.customStatus}</span>}
                  </div>
                </div>
              );
            })}

          <div className={styles.memberGroupTitle}>Offline Members ({activeServer.members.filter(m => m.userId && m.userId.status === "offline").length})</div>
          {activeServer.members
            .filter((m) => m.userId && m.userId.status === "offline")
            .map((m) => {
              const nameClass = m.role === "ADMIN" ? styles.memberNameAdmin : m.role === "MODERATOR" ? styles.memberNameMod : "";
              return (
                <div key={m.userId._id} className={styles.memberRow} title={m.userId.username} style={{ opacity: 0.5 }}>
                  <div className={styles.avatarWrapper}>
                    <img src={m.userId.avatarUrl} alt="Avatar" className={styles.avatar} style={{ width: "32px", height: "32px" }} />
                    <div className={`${styles.statusDot} ${styles.statusDotOffline}`}></div>
                  </div>
                  <span className={`${styles.memberName} ${nameClass}`}>{m.userId.username}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Embedding global Modals panel overlay */}
      <Modals />
      
    </div>
  );
}
