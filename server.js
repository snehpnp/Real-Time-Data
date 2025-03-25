const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { exec } = require("child_process");
require("dotenv").config();
const { connectMongo } = require("./config/db");

connectMongo();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

module.exports = { io }; // ✅ Export io instance for use in aliceSocket.js

app.use(express.json());

require("./services/Apis")(app,io);


const { Alice_Socket } = require("./services/aliceSocket");

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  Alice_Socket(); // ✅ WebSocket Start
});
