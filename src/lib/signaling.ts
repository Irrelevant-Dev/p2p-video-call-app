import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

export function setupSignalingServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // Join room for specific call session
    socket.on('join-room', ({ callId, userType }) => {
      const roomName = `call:${callId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} (${userType}) joined room ${roomName}`);

      // Notify others in room
      socket.to(roomName).emit('peer-joined', { socketId: socket.id, userType });
    });

    // Relay WebRTC Offer
    socket.on('offer', ({ callId, offer }) => {
      socket.to(`call:${callId}`).emit('offer', { offer, from: socket.id });
    });

    // Relay WebRTC Answer
    socket.on('answer', ({ callId, answer }) => {
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
