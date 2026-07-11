// ============================================================================
// AnfieldVoice — WebRTC Hook (Slice 2)
// Manages RTCPeerConnection lifecycle for gate call audio
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
} from 'react-native-webrtc';
import type { WsMessage } from '../types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'error';

interface UseWebRtcOptions {
  sendWs: (data: Record<string, unknown>) => void;
  streamIncomingCall?: (data: WsMessage & { type: 'sdp_offer' | 'sdp_answer' | 'ice_candidate' }) => void;
}

interface UseWebRtcReturn {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (callId: number) => Promise<void>;
  answerCall: (callId: number) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  isMuted: boolean;
  isSpeakerOn: boolean;
  durationSecs: number;
  handleRemoteSdp: (callId: number, sdp: string, type: 'offer' | 'answer') => Promise<void>;
  handleRemoteIce: (callId: number, candidate: string, sdpMid?: string, sdpMLineIndex?: number) => Promise<void>;
  error: string | null;
}

export function useWebRtc({ sendWs }: UseWebRtcOptions): UseWebRtcReturn {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [durationSecs, setDurationSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startTimer = useCallback(() => {
    setDurationSecs(0);
    timerRef.current = setInterval(() => {
      setDurationSecs((s) => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const createPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && activeCallIdRef.current) {
        sendWs({
          type: 'ice_candidate',
          call_id: activeCallIdRef.current,
          candidate: event.candidate.candidate,
          sdp_mid: event.candidate.sdpMid,
          sdp_mline_index: event.candidate.sdpMLineIndex,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setCallState('ended');
        cleanup();
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [sendWs]);

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      setError('Microphone access denied. Please grant microphone permission.');
      throw err;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopTimer();
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsSpeakerOn(false);
    activeCallIdRef.current = null;
  }, [stopTimer]);

  const startCall = useCallback(async (callId: number) => {
    setError(null);
    setCallState('calling');
    activeCallIdRef.current = callId;

    try {
      const stream = await getLocalStream();
      const pc = await createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendWs({
        type: 'sdp_offer',
        call_id: callId,
        sdp: offer.sdp,
      });

      setCallState('ringing');
      startTimer();
    } catch (err) {
      setCallState('error');
      setError(err instanceof Error ? err.message : 'Failed to start call');
      cleanup();
    }
  }, [getLocalStream, createPeerConnection, sendWs, startTimer, cleanup]);

  const answerCall = useCallback(async (callId: number) => {
    setError(null);
    setCallState('calling');
    activeCallIdRef.current = callId;

    try {
      const stream = await getLocalStream();
      const pc = await createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      setCallState('connected');
      startTimer();
    } catch (err) {
      setCallState('error');
      setError(err instanceof Error ? err.message : 'Failed to answer call');
      cleanup();
    }
  }, [getLocalStream, createPeerConnection, startTimer, cleanup]);

  const endCall = useCallback(() => {
    sendWs({ type: 'end_call', call_id: activeCallIdRef.current });
    setCallState('ended');
    cleanup();
    // Reset after brief delay so UI shows "Call Ended" state
    setTimeout(() => setCallState('idle'), 2000);
  }, [sendWs, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    // Speaker toggle is platform-specific
    // react-native-webrtc doesn't have a direct API for this
    // We store the state for UI purposes
    setIsSpeakerOn((s) => !s);
  }, []);

  const handleRemoteSdp = useCallback(async (callId: number, sdp: string, type: 'offer' | 'answer') => {
    if (!pcRef.current || callId !== activeCallIdRef.current) return;

    try {
      const desc = new RTCSessionDescription({ type, sdp });
      await pcRef.current.setRemoteDescription(desc);

      if (type === 'offer') {
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        sendWs({
          type: 'sdp_answer',
          call_id: callId,
          sdp: answer.sdp,
        });
        setCallState('connected');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process SDP');
    }
  }, [sendWs]);

  const handleRemoteIce = useCallback(async (callId: number, candidate: string, sdpMid?: string, sdpMLineIndex?: number) => {
    if (!pcRef.current || callId !== activeCallIdRef.current) return;
    try {
      const iceCandidate = new RTCIceCandidate({ candidate, sdpMid, sdpMLineIndex });
      await pcRef.current.addIceCandidate(iceCandidate);
    } catch {
      // Ignore invalid candidates
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    callState,
    localStream,
    remoteStream,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    isMuted,
    isSpeakerOn,
    durationSecs,
    handleRemoteSdp,
    handleRemoteIce,
    error,
  };
}
