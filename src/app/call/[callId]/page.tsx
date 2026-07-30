'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Loader2 } from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

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

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function initCall() {
      try {
        // Fetch call details
        const res = await fetch(`/api/calls/${callId}`);
        if (!res.ok) throw new Error('Call session not found');
        const sessionData = await res.json();
        setCallSession(sessionData);

        // Get Local Media Stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize PeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Handle incoming remote track
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setCallStatus('active');
          }
        };

        // Initialize Socket.io Connection
        const socket = io();
        socketRef.current = socket;

        socket.emit('join-room', { callId, userType: userRole });

        // Handle ICE Candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { callId, candidate: event.candidate });
          }
        };

        // Peer Joined Event -> Create Offer if caller/guest
        socket.on('peer-joined', async () => {
          if (userRole === 'guest') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { callId, offer });
            setCallStatus('ringing');
          }
        });

        // Handle Incoming Offer
        socket.on('offer', async ({ offer }) => {
          if (userRole !== 'guest') {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { callId, answer });
            setCallStatus('active');
          }
        });

        // Handle Incoming Answer
        socket.on('answer', async ({ answer }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          setCallStatus('active');
        });

        // Handle Incoming ICE Candidate
        socket.on('ice-candidate', async ({ candidate }) => {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        });

        // Handle Call Termination
        socket.on('call:ended', () => {
          setCallStatus('ended');
          cleanupMedia();
        });
      } catch (err: any) {
        console.error('Call initialization failed:', err);
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
      }
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md z-10">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {callStatus === 'ringing'
                ? 'Ringing Recipient...'
                : callStatus === 'connecting'
                ? 'Connecting Call Room...'
                : 'Waiting for Peer to Connect...'}
            </h2>
            <p className="text-slate-400 text-sm">
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
            P2P Room: <span className="font-mono text-indigo-300">{callId.slice(0, 8)}</span>
          </span>
        </div>
      </div>

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
