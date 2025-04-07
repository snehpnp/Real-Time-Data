const io = require("socket.io-client");

// const socket = io("ws://185.209.75.192:5000");
const socket = io("ws://localhost:5000"); // Localhost par server chal raha hai


socket.on("connect", () => {
  console.log("✅ Connected to server:", socket.id);

  const userId = "user1"; 
  socket.emit("subscribe", userId);

  const stockSymbols = "NFO|74361#NFO|74364#NFO|74375#NFO|743802";
  socket.emit("subscribeStocks", stockSymbols);
});

socket.on("stockUpdate", (data) => {
  console.log("📩 Stock Update:", data);
});


socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});
  