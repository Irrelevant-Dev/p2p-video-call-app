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
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join receiver host presence rooms
    socket.on('register-receiver', ({ receiverId }) => {
      socket.join('hosts:all');
      if (receiverId) {
        socket.join(`receiver:${receiverId}`);
        console.log(`[Presence] Socket ${socket.id} registered for receiver:${receiverId} and hosts:all`);
      }
    });

    // Join room for specific call session
    socket.on('join-room', ({ callId, userType }) => {
      const roomName = `call:${callId}`;
      socket.join(roomName);
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 1;
      console.log(`[Room] Socket ${socket.id} (${userType}) joined ${roomName}. Peers in room: ${roomSize}`);

      // Notify others in room
      socket.to(roomName).emit('peer-joined', { socketId: socket.id, userType });

      // If 2 or more peers are present in room, emit room-ready to all peers in room
      if (roomSize >= 2) {
        console.log(`[Room] ${roomName} is READY with ${roomSize} peers. Emitting 'room-ready' event.`);
        io.to(roomName).emit('room-ready');
      }
    });

    // Notify target receiver AND all connected hosts of incoming call
    socket.on('notify-receiver', ({ targetReceiverId, callId, guestName }) => {
      console.log(`[Call Notification] Call ${callId} from '${guestName}' targeting ${targetReceiverId}`);
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
      console.log(`[WebRTC Relay] Relaying SDP Offer for call:${callId} from socket ${socket.id}`);
      socket.to(`call:${callId}`).emit('offer', { offer, from: socket.id });
    });

    // Relay WebRTC Answer
    socket.on('answer', ({ callId, answer }) => {
      console.log(`[WebRTC Relay] Relaying SDP Answer for call:${callId} from socket ${socket.id}`);
      socket.to(`call:${callId}`).emit('answer', { answer, from: socket.id });
    });

    // Relay ICE Candidate
    socket.on('ice-candidate', ({ callId, candidate }) => {
      console.log(`[WebRTC Relay] Relaying ICE candidate for call:${callId} from socket ${socket.id}`);
      socket.to(`call:${callId}`).emit('ice-candidate', { candidate, from: socket.id });
    });

    // Relay Call Control (Decline / End)
    socket.on('call:decline', ({ callId }) => {
      console.log(`[Call Control] Call ${callId} declined`);
      io.to(`call:${callId}`).emit('call:declined');
    });

    socket.on('call:end', ({ callId }) => {
      console.log(`[Call Control] Call ${callId} ended`);
      io.to(`call:${callId}`).emit('call:ended');
    });

    socket.on('disconnecting', () => {
      socket.rooms.forEach((room) => {
        if (room.startsWith('call:')) {
          console.log(`[Room] Socket ${socket.id} disconnecting from ${room}`);
          socket.to(room).emit('peer-disconnected', { socketId: socket.id });
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
