'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Loader2, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

export default function CallRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const callId = params.callId as string;
  const userRole = searchParams.get('role') || 'host';

  const [callSession, setCallSession] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<string>('connecting');

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Diagnostic Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isOfferingRef = useRef(false);

  function log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
    const time = new Date().toLocaleTimeString();
    const entry: LogEntry = { id: Math.random().toString(), time, message, type };
    console.log(`[CallDiagnostic ${time}] [${type.toUpperCase()}] ${message}`);
    setLogs((prev) => [...prev.slice(-49), entry]);
  }

  useEffect(() => {
    async function initCall() {
      try {
        log(`Initializing call session: ${callId} as role: ${userRole}`, 'info');

        // Fetch call details
        const res = await fetch(`/api/calls/${callId}`);
        if (!res.ok) throw new Error('Call session not found in database');
        const sessionData = await res.json();
        setCallSession(sessionData);
        log(`Call session retrieved (Guest: ${sessionData.guestName})`, 'success');

        // Get Local Media Stream
        log('Requesting local camera & microphone access...', 'info');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        log(`Acquired local media stream (Video tracks: ${stream.getVideoTracks().length}, Audio tracks: ${stream.getAudioTracks().length})`, 'success');

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize PeerConnection
        log('Creating RTCPeerConnection with Google STUN servers...', 'info');
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
          log(`Added local ${track.kind} track to RTCPeerConnection`, 'info');
        });

        // Connection state monitoring
        pc.onconnectionstatechange = () => {
          log(`RTCPeerConnection state changed to: ${pc.connectionState}`, pc.connectionState === 'connected' ? 'success' : 'info');
          if (pc.connectionState === 'connected') {
            setCallStatus('active');
          } else if (pc.connectionState === 'failed') {
            log('Peer connection failed. Check NAT/firewall settings.', 'error');
            setCallStatus('failed');
          }
        };

        pc.oniceconnectionstatechange = () => {
          log(`ICE Connection state: ${pc.iceConnectionState}`, pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed' ? 'success' : 'info');
        };

        pc.onicegatheringstatechange = () => {
          log(`ICE Gathering state: ${pc.iceGatheringState}`, 'info');
        };

        // Handle incoming remote track
        pc.ontrack = (event) => {
          log(`Received remote track (${event.track.kind}). Stream ID: ${event.streams[0]?.id}`, 'success');
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setCallStatus('active');
          }
        };

        // Initialize Socket.io Connection
        log('Connecting to Socket.io signaling server...', 'info');
        const socket = io();
        socketRef.current = socket;

        socket.on('connect', () => {
          log(`Connected to Socket server with ID: ${socket.id}`, 'success');
          socket.emit('join-room', { callId, userType: userRole });
          log(`Sent 'join-room' for room: call:${callId}`, 'info');
        });

        // Handle ICE Candidates from local peer
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            log(`Gathered ICE Candidate: ${event.candidate.type || 'host'} (${event.candidate.protocol})`, 'info');
            socket.emit('ice-candidate', { callId, candidate: event.candidate });
          } else {
            log('All local ICE candidates gathered.', 'info');
          }
        };

        // Helper to create and send offer
        async function initiateOffer() {
          if (userRole === 'guest' && !isOfferingRef.current && pc.signalingState === 'stable') {
            try {
              isOfferingRef.current = true;
              log('Guest initiating WebRTC SDP Offer...', 'info');
              const offer = await pc.createOffer();
              log('Created SDP Offer successfully. Setting local description...', 'info');
              await pc.setLocalDescription(offer);
              log('Local description set. Transmitting offer over Socket...', 'info');
              socket.emit('offer', { callId, offer });
              setCallStatus('ringing');
            } catch (err: any) {
              log(`Failed to create/send offer: ${err.message}`, 'error');
              isOfferingRef.current = false;
            }
          }
        }

        // Room Ready or Peer Joined Event -> Initiate Offer if guest caller
        socket.on('peer-joined', ({ userType }) => {
          log(`Peer joined event received (Peer role: ${userType})`, 'info');
          initiateOffer();
        });

        socket.on('room-ready', () => {
          log('Room ready signal received from server (2+ peers present)', 'success');
          initiateOffer();
        });

        // Helper to flush pending ICE candidates
        async function flushPendingCandidates() {
          if (pendingCandidatesRef.current.length > 0) {
            log(`Flushing ${pendingCandidatesRef.current.length} queued ICE candidates...`, 'info');
            while (pendingCandidatesRef.current.length > 0) {
              const candidate = pendingCandidatesRef.current.shift();
              if (candidate && pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e: any) {
                  log(`Failed to add queued candidate: ${e.message}`, 'warn');
                }
              }
            }
            log('Queued ICE candidates flushed successfully', 'success');
          }
        }

        // Handle Incoming Offer (Host Receiver)
        socket.on('offer', async ({ offer, from }) => {
          if (userRole !== 'guest') {
            try {
              log(`Received SDP Offer from peer ${from}`, 'info');
              await pc.setRemoteDescription(new RTCSessionDescription(offer));
              log('Remote description set from offer. Flushing ICE queue...', 'success');
              await flushPendingCandidates();

              log('Creating SDP Answer...', 'info');
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              log('Local description set for answer. Transmitting answer over Socket...', 'success');
              socket.emit('answer', { callId, answer });
              setCallStatus('active');
            } catch (err: any) {
              log(`Error processing offer/answer: ${err.message}`, 'error');
            }
          }
        });

        // Handle Incoming Answer (Guest Caller)
        socket.on('answer', async ({ answer, from }) => {
          try {
            log(`Received SDP Answer from peer ${from}`, 'success');
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            log('Remote description set from answer. Flushing ICE queue...', 'success');
            await flushPendingCandidates();
            setCallStatus('active');
          } catch (err: any) {
            log(`Error setting remote answer: ${err.message}`, 'error');
          }
        });

        // Handle Incoming ICE Candidate
        socket.on('ice-candidate', async ({ candidate }) => {
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              log('Added remote ICE Candidate directly', 'info');
            } catch (e: any) {
              log(`Failed to add remote candidate: ${e.message}`, 'warn');
            }
          } else {
            log('Remote description not ready. Queuing incoming ICE Candidate...', 'warn');
            pendingCandidatesRef.current.push(candidate);
          }
        });

        // Handle Call Termination
        socket.on('call:ended', () => {
          log('Call ended by remote peer', 'warn');
          setCallStatus('ended');
          cleanupMedia();
        });
      } catch (err: any) {
        log(`Call initialization error: ${err.message}`, 'error');
        setCallStatus('failed');
      }
    }

    if (callId) initCall();

    return () => {
      cleanupMedia();
    };
  }, [callId, userRole]);

  function cleanupMedia() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }

  function toggleMicrophone() {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
        log(`Microphone ${audioTrack.enabled ? 'unmuted' : 'muted'}`, 'info');
      }
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
        log(`Camera ${videoTrack.enabled ? 'turned on' : 'turned off'}`, 'info');
      }
    }
  }

  async function handleHangup() {
    try {
      await fetch(`/api/calls/${callId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      });

      if (socketRef.current) {
        socketRef.current.emit('call:end', { callId });
      }
    } catch (err) {
      console.error('Failed to update ended status:', err);
    } finally {
      cleanupMedia();
      router.push(userRole === 'guest' ? '/' : '/dashboard');
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-hidden">
      {/* Remote Video Feed (Full Screen) */}
      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {callStatus !== 'active' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md z-10 p-6">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-center">
              {callStatus === 'ringing'
                ? 'Ringing Recipient...'
                : callStatus === 'connecting'
                ? 'Connecting Call Room...'
                : 'Waiting for Peer to Connect...'}
            </h2>
            <p className="text-slate-400 text-sm text-center">
              {callSession?.guestName || 'Guest'} &bull; {callSession?.receiverName || 'Host'}
            </p>
          </div>
        )}
      </div>

      {/* Local Video Picture-in-Picture (Top Right) */}
      <div className="absolute top-6 right-6 w-36 sm:w-48 aspect-[3/4] bg-slate-950 border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl z-20">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {!cameraEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400">
            <User className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Top Header Overlay */}
      <div className="relative z-20 p-6 flex items-center justify-between bg-gradient-to-b from-slate-950/90 to-transparent">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-semibold text-slate-200">
            P2P Room: <span className="font-mono text-indigo-300">{callId.slice(0, 8)}</span> ({userRole.toUpperCase()})
          </span>
        </div>

        <button
          onClick={() => setShowLogs(!showLogs)}
          className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-indigo-300 flex items-center space-x-2 transition"
        >
          <Terminal className="w-4 h-4" />
          <span>{showLogs ? 'Hide Diagnostics' : 'Show Diagnostics'}</span>
          {showLogs ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* Real-time Diagnostic Log Console Overlay */}
      {showLogs && (
        <div className="relative z-30 mx-6 mb-4 max-h-44 bg-slate-950/90 border border-indigo-500/40 rounded-2xl p-4 overflow-y-auto font-mono text-xs shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase tracking-wider mb-2 pb-1 border-b border-slate-800">
            <span>WebRTC Diagnostic Console Stream</span>
            <span>{logs.length} events logged</span>
          </div>
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">Initializing WebRTC diagnostic stream...</div>
          ) : (
            <div className="space-y-1">
              {logs.map((e) => (
                <div
                  key={e.id}
                  className={`flex items-start space-x-2 ${
                    e.type === 'error'
                      ? 'text-red-400 font-semibold'
                      : e.type === 'warn'
                      ? 'text-amber-300'
                      : e.type === 'success'
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-500 shrink-0">[{e.time}]</span>
                  <span>{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Call Action Bar Overlay (Bottom Center) */}
      <div className="relative z-20 p-6 flex items-center justify-center bg-gradient-to-t from-slate-950/90 to-transparent">
        <div className="flex items-center space-x-4 bg-slate-900/90 border border-slate-800 backdrop-blur-lg px-6 py-4 rounded-full shadow-2xl">
          <button
            onClick={toggleMicrophone}
            className={`p-4 rounded-full transition ${
              micEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
            title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full transition ${
              cameraEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
            title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {cameraEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          <button
            onClick={handleHangup}
            className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full transition shadow-lg transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
