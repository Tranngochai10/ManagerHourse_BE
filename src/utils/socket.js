const { Server } = require("socket.io");

let io = null;

/**
 * Initializes Socket.io instance attached to the provided HTTP server.
 * @param {object} server - Node HTTP server instance
 * @returns {Server} - The initialized socket.io instance
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Allows any frontend client domain
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    },
    // Configured to keep connection alive through Render's proxy timeout
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  return io;
};

/**
 * Gets the active Socket.io Server instance.
 * @returns {Server}
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};

/**
 * Helper to emit events to all connected clients.
 * @param {string} event - Event name
 * @param {any} data - Event payload data
 */
const emitEvent = (event, data) => {
  if (io) {
    io.emit(event, data);
    console.log(`[Socket.io] Emitted event: ${event}`);
  } else {
    console.warn(`[Socket.io] Cannot emit ${event}, io is not initialized yet.`);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitEvent,
};
