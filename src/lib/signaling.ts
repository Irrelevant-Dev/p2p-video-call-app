import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

let globalIO: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return globalIO;
}

export function setupSignalingServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
  globalIO = io;

  io.on('connection', (socket: Socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // Join receiver host presence rooms
    socket.on('register-receiver', ({ receiverId }) => {
      socket.join('hosts:all');
      if (receiverId) {
        socket.join(`receiver:${receiverId}`);
        console.log(`Socket ${socket.id} registered as receiver ${receiverId}`);
      }
    });

    // Join room for specific call session
    socket.on('join-room', ({ callId, userType }) => {
      const roomName = `call:${callId}`;
      socket.join(roomName);
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 1;
      console.log(`Socket ${socket.id} (${userType}) joined room ${roomName}. Room size: ${roomSize}`);

      // Notify others in room
      socket.to(roomName).emit('peer-joined', { socketId: socket.id, userType });

      // If 2 or more peers are present in room, emit room-ready to both peers
      if (roomSize >= 2) {
        console.log(`Room ${roomName} is ready with ${roomSize} peers. Emitting room-ready.`);
        io.to(roomName).emit('room-ready');
      }
    });

    // Notify target receiver AND all connected hosts of incoming call
    socket.on('notify-receiver', ({ targetReceiverId, callId, guestName }) => {
      console.log(`Broadcasting incoming call ${callId} for target ${targetReceiverId}`);
      io.to(`receiver:${targetReceiverId}`).emit('incoming-call', {
        callId,
        guestName,
      });
      io.to('hosts:all').emit('incoming-call', {
        callId,
        guestName,
      });
    });

    // Relay WebRTC Offer
    socket.on('offer', ({ callId, offer }) => {
      console.log(`Relaying SDP offer for call ${callId}`);
      socket.to(`call:${callId}`).emit('offer', { offer, from: socket.id });
    });

    // Relay WebRTC Answer
    socket.on('answer', ({ callId, answer }) => {
      console.log(`Relaying SDP answer for call ${callId}`);
      socket.to(`call:${callId}`).emit('answer', { answer, from: socket.id });
    });

    // Relay ICE Candidate
    socket.on('ice-candidate', ({ callId, candidate }) => {
      socket.to(`call:${callId}`).emit('ice-candidate', { candidate, from: socket.id });
    });

    // Relay Call Control (Decline / End / Mute)
    socket.on('call:decline', ({ callId }) => {
      io.to(`call:${callId}`).emit('call:declined');
    });

    socket.on('call:end', ({ callId }) => {
      io.to(`call:${callId}`).emit('call:ended');
    });

    socket.on('disconnecting', () => {
      socket.rooms.forEach((room) => {
        if (room.startsWith('call:')) {
          socket.to(room).emit('peer-disconnected', { socketId: socket.id });
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
}
