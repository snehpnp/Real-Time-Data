const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { createClient } = require("redis");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

// Redis Clients
const redisPublisher = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});
const redisSubscriber = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

// Connect Redis Clients
Promise.all([
  redisPublisher.connect(),
  redisSubscriber.connect()
]).then(() => console.log("✅ Redis Connected")).catch(console.error);

// WebSocket Logic
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("subscribe", async (symbol) => {
    console.log(`🔔 Client subscribed to ${symbol}`);

    // Send last stored price if available
    const stockData = await redisPublisher.get(`stock:${symbol}`);
    if (stockData) {
      socket.emit("stockUpdate", JSON.parse(stockData));
    }

    // Subscribe to stock updates
    const channel = `stock:${symbol}`;
    await redisSubscriber.subscribe(channel, (message) => {
      socket.emit("stockUpdate", JSON.parse(message));
    });
  });

  socket.on("disconnect", async () => {
    console.log("🔴 Client disconnected:", socket.id);
    await redisSubscriber.unsubscribe(); // Unsubscribe when client disconnects
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
