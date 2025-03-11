const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { connectMongo, redisClient, connectRedis } = require("./config/db");
const Stock = require("./models/Stock");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

(async () => {
  await connectMongo();
  await connectRedis();
})();

// WebSocket for real-time updates
io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("subscribe", async (symbol) => {
    const stockData = await redisClient.get(`stock:${symbol}`);
    if (stockData) {
      socket.emit("stockUpdate", JSON.parse(stockData));
    }

    redisClient.subscribe(`stock:${symbol}`, (message) => {
      socket.emit("stockUpdate", JSON.parse(message));
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const { Alice_Socket } = require("./services/aliceSocket");

server.listen(5000, () => {
  console.log("Server running on port 5000");
  Alice_Socket();
});
