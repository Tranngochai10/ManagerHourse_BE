require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');

const PORT = process.env.PORT || 3000;

// Connect to database
connectDB().then(() => {
  // Create HTTP server wrapping the Express app
  const server = http.createServer(app);

  // Initialize Socket.io
  initSocket(server);

  // Start server
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

