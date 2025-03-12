const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { createClient } = require("redis");

const { exec } = require("child_process");
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


// WebSocket Logic 1
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("subscribe", async (symbol) => {
    console.log(`🔔 Client subscribed to ${symbol}`);

    // Send last stored price if available
    // const stockData = await redisPublisher.get(`stock:${symbol}`);
    // if (stockData) {
      socket.emit("stockUpdate", JSON.parse("sneh............"));
    // }

    // Subscribe to stock updates
    // const channel = `stock:${symbol}`;
    // await redisSubscriber.subscribe(channel, (message) => {
      socket.emit("stockUpdate", JSON.parse("okkkk"));
    // });
  });

  socket.on("disconnect", async () => {
    console.log("🔴 Client disconnected:", socket.id);
    await redisSubscriber.unsubscribe(); // Unsubscribe when client disconnects
  });
});



app.post("/github-webhook", (req, res) => {
  console.log("🔔 Webhook Triggered:", req.body);

  // Jab push event aayega, git pull karega
  exec("cd /var/www/Socket && git pull origin main && pm2 restart all", (err, stdout, stderr) => {
      if (err) {
          console.error(`❌ Error: ${stderr}`);
          return res.status(500).send("Deployment Failed");
      }
      console.log(`✅ Success: ${stdout}`);
      res.status(200).send("Deployment Successful");
  });
});



// Start Server

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
