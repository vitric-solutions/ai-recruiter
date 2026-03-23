import { Server } from "socket.io";

let io;
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });
  io.on("connection", (socket) => {
 
    socket.on("user-join-room", (userId) => {
      socket.join(userId);
      
    });
    socket.on("admin-join-room", () => {
      socket.join("admins");
  
    });
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
