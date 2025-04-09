# 📌 Real-Time Stock Price WebSocket API

## 🚀 Overview

This project provides a **real-time stock price streaming service** using **WebSockets**. Clients can connect to a WebSocket URL and receive **live price updates** for subscribed stock symbols. The data is fetched from Redis, ensuring fast and efficient real-time updates.

--- 1

## 📂 Folder Structure

```
📦 Real-Time Data Streaming
 ┣ 📜 server.js         # Main WebSocket server
 ┣ 📜 .env              # Environment variables
 ┣ 📜 package.json      # Node.js dependencies
 ┣ 📜 README.md         # Documentation
```

---

## 🛠️ Installation

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-repo/realtime-stock-websocket.git
cd realtime-stock-websocket
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Set Up Environment Variables

Create a `.env` file and configure your database:

```
PORT=5000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### 4️⃣ Start Redis Server (If not running)

```bash
redis-server
```

### 5️⃣ Run the WebSocket Server

```bash
node server.js
```

---

## 🌐 WebSocket API Usage

### 🔹 WebSocket Connection URL

```
wss://yourserver.com/live-price
```

### 🔹 Subscribe to a Stock Symbol

Clients can **subscribe to a stock symbol** to receive real-time price updates.

#### 📌 Example Client Code

```javascript
const socket = new WebSocket("wss://yourserver.com/live-price");

socket.onopen = function () {
  console.log("Connected to WebSocket server");
  socket.send(JSON.stringify({ action: "subscribe", symbol: "AAPL" }));
};

socket.onmessage = function (event) {
  const data = JSON.parse(event.data);
  console.log("Live Price Update:", data);
};
```

### 🔹 Server Response Format

```json
{
  "symbol": "AAPL",
  "price": 189.45,
  "timestamp": 1712331900000
}
```

---

## 🔧 Server Implementation

The server listens for WebSocket connections and fetches **live price updates** from Redis.

### 📌 WebSocket Server Code (server.js)

```javascript
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { createClient } = require("redis");

require("dotenv").config();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});
redisClient
  .connect()
  .then(() => console.log("Redis Connected"))
  .catch(console.error);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("subscribe", async (symbol) => {
    console.log(`Client subscribed to ${symbol}`);
    const stockData = await redisClient.get(`stock:${symbol}`);
    if (stockData) {
      socket.emit("stockUpdate", JSON.parse(stockData));
    }
    redisClient.subscribe(`stock:${symbol}`, (message) => {
      socket.emit("stockUpdate", JSON.parse(message));
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
```

---

## 📊 Sending Price Updates

Use this function to update stock prices **in real-time**.

```javascript
async function sendPriceUpdate(symbol, price) {
  const stockData = { symbol, price, timestamp: Date.now() };
  await redisClient.set(`stock:${symbol}`, JSON.stringify(stockData));
  await redisClient.publish(`stock:${symbol}`, JSON.stringify(stockData));
}

sendPriceUpdate("AAPL", 189.45); // Example Update
```

---

## 🛡️ Authentication (Optional)

For secure connections, implement **JWT-based authentication**.

```javascript
socket.on("authenticate", (token) => {
  const user = verifyToken(token);
  if (!user) return socket.disconnect();
  console.log("Authenticated User:", user.id);
});
```

---

## 🚀 Advanced Features (Future Scope)

✅ **Multi-symbol subscription** (Subscribe to multiple stocks in one request)  
✅ **Kafka Integration** (For handling large-scale real-time data)  
✅ **Historical data retrieval** (Fetch past stock price movements)

---

🔶 "FO" – Futures & Options Combined Segment
कुछ APIs या platforms में "FO" लिखा होता है, और इसका मतलब है पूरा Futures & Options segment।

लेकिन कई जगह इसे और break कर दिया जाता है:

"F" – Futures

"O" – Options

तो:

Symbol Segment Meaning
RELIANCE C Cash Segment (Equity)
NIFTY24APR18000CE O Option Contract
RELIANCE24APRFUT F / FO Futures Contract
🔁 BONUS: Segment Mapping in Real-Time APIs
Segment Description Exchange
NSE_EQ / C Equity Shares NSE
BSE_EQ / C Equity Shares BSE
NFO / FO Futures & Options NSE
BFO Futures & Options BSE
CDS Currency Derivatives NSE
MCX Commodities MCX

## 🎯 Conclusion

This WebSocket API provides a **fast and efficient way** to deliver live stock prices using Redis. Clients can connect, subscribe to stock symbols, and receive **instant price updates**. 🚀
